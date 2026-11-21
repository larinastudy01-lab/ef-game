param([switch]$LocalOnly, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $projectRoot
New-Item -ItemType Directory -Path 'artifacts/local-ai','.local/ollama-models' -Force | Out-Null
$statePath = Join-Path $projectRoot 'artifacts/local-ai/processes.json'
$state = @{}
if (Test-Path -LiteralPath $statePath) {
    $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($property in $saved.PSObject.Properties) { $state[$property.Name] = $property.Value }
}
function Save-State { $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8 }
function Wait-Http($Url, $Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try { return Invoke-RestMethod -Uri $Url -TimeoutSec 3 } catch { Start-Sleep -Seconds 1 }
    } while ((Get-Date) -lt $deadline)
    throw "Service did not become ready: $Url. See artifacts/local-ai/*.log."
}
function Start-Managed($Name, $Executable, $Arguments, $Marker) {
    if ($state.ContainsKey($Name)) {
        $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$($state[$Name].pid)"
        if ($existing -and $existing.CommandLine -and $existing.CommandLine.Contains($Marker)) { return }
    }
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput "artifacts/local-ai/$Name.stdout.log" -RedirectStandardError "artifacts/local-ai/$Name.stderr.log" -PassThru
    $state[$Name] = @{ pid = $process.Id; marker = $Marker }
    Save-State
}
function Adopt-Listener($Name, $Port, $Marker) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $false }
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if (-not $existing.CommandLine -or -not $existing.CommandLine.Contains($Marker)) { throw "Port $Port is held by another process; it was not stopped." }
    $state[$Name] = @{ pid = $existing.ProcessId; marker = $Marker }
    Save-State
    return $true
}

if (-not (Test-Path -LiteralPath '.local/ollama/ollama.exe') -or (-not $LocalOnly -and -not (Test-Path -LiteralPath '.local/tools/cloudflared.exe'))) {
    & (Join-Path $PSScriptRoot 'install.ps1')
}
$node = (Get-Command node.exe).Source
$configText = & $node (Join-Path $PSScriptRoot 'config.mjs') --configure
if ($LASTEXITCODE -ne 0) { throw 'Could not configure local AI.' }
$config = $configText | ConvertFrom-Json
$env:AI_PROVIDER = 'ollama'
$env:AI_RETRIEVAL_FALLBACK = 'true'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $projectRoot '.local/ollama-models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_FLASH_ATTENTION = '1'
$env:OLLAMA_KV_CACHE_TYPE = 'q8_0'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:ALLOWED_ORIGINS = $config.allowedOrigins
$env:CLINICAL_API_HOST = '127.0.0.1'
$ollama = Join-Path $projectRoot '.local/ollama/ollama.exe'
if (-not (Adopt-Listener 'ollama' 11434 $ollama)) { Start-Managed 'ollama' $ollama @('serve') $ollama }
$models = Wait-Http 'http://127.0.0.1:11434/api/tags'
$modelName = 'qwen3:4b-instruct-2507-q4_K_M'
if (-not ($models.models | Where-Object { $_.name -eq $modelName })) {
    Write-Host 'Downloading Qwen3 4B Instruct (first setup only)...'
    & $ollama pull $modelName
    if ($LASTEXITCODE -ne 0) { throw 'Model download failed.' }
}
Write-Host 'Loading the local model onto the GPU...'
$warmup = @{ model = $modelName; stream = $false; keep_alive = '10m'; options = @{ num_ctx = 16384 } } | ConvertTo-Json
$null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' -Body $warmup -TimeoutSec 180
$apiFile = Join-Path $projectRoot 'src/api/server.mjs'
if (-not (Adopt-Listener 'api' $config.apiPort $apiFile)) { Start-Managed 'api' $node @('"' + $apiFile + '"') $apiFile }
$health = Wait-Http "http://127.0.0.1:$($config.apiPort)/healthz"
if ($health.provider -ne 'ollama') { throw 'The API is not using Ollama; restart it before continuing.' }
$awakeFile = Join-Path $PSScriptRoot 'keep-awake.ps1'
Start-Managed 'awake' (Get-Command powershell.exe).Source @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $awakeFile + '"'),'-ApiPid',"$($state['api'].pid)") $awakeFile
$env:PORT = '3000'
$env:BROWSER = 'none'
$frontFile = Join-Path $projectRoot 'node_modules/react-scripts/scripts/start.js'
if (-not (Adopt-Listener 'frontend' 3000 $frontFile)) { Start-Managed 'frontend' $node @('"' + $frontFile + '"') $frontFile }
$null = Wait-Http 'http://127.0.0.1:3000/' 180
$endpoint = ''
$shareUrl = ''
$parentShareUrl = ''
if (-not $LocalOnly) {
    $cloudflared = Join-Path $projectRoot '.local/tools/cloudflared.exe'
    Start-Managed 'tunnel' $cloudflared @('tunnel','--no-autoupdate','--protocol','http2','--url',"http://127.0.0.1:$($config.apiPort)") $cloudflared
    $deadline = (Get-Date).AddSeconds(60)
    do {
        $log = Get-Content -LiteralPath 'artifacts/local-ai/tunnel.stderr.log' -Raw -ErrorAction SilentlyContinue
        if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $endpoint = $Matches[0]; break }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    if (-not $endpoint) { throw 'The HTTPS tunnel did not start. Local AI is available; check tunnel.stderr.log.' }
    if ($config.siteUrl) { $shareUrl = $config.siteUrl.TrimEnd('/') + '/clinician-dashboard?aiEndpoint=' + [Uri]::EscapeDataString($endpoint) }
    if ($config.siteUrl) { $parentShareUrl = $config.siteUrl.TrimEnd('/') + '/login?aiEndpoint=' + [Uri]::EscapeDataString($endpoint) }
}
$connection = @{ startedAt = (Get-Date).ToUniversalTime().ToString('o'); localUrl = 'http://localhost:3000/clinician-dashboard'; endpoint = $endpoint; githubUrl = $shareUrl; parentGithubUrl = $parentShareUrl }
$connection | ConvertTo-Json | Set-Content -LiteralPath 'artifacts/local-ai/connection.json' -Encoding UTF8
Write-Host ''
Write-Host 'Local AI is ready. No OpenAI credits are used.' -ForegroundColor Green
Write-Host "Local website: $($connection.localUrl)"
if ($endpoint) {
    Write-Host "HTTPS API: $endpoint"
    Write-Host "GitHub website link: $shareUrl"
    Write-Host "Parent website link: $parentShareUrl"
    Write-Host 'Open AI connection settings and confirm this service URL in the browser tab.'
    Write-Host 'The GitHub website must include the updated frontend. The temporary URL changes after restarting the tunnel.'
}
Write-Host 'Use Stop-Local-AI.cmd to stop services. Logs: artifacts/local-ai/'
if (-not $NoBrowser) { Start-Process $connection.localUrl }
