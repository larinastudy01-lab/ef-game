$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$statePath = Join-Path $projectRoot 'artifacts/local-ai/processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'No managed local AI services were found.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($name in @('tunnel','awake','frontend','api','ollama')) {
    $entry = $state.$name
    if (-not $entry) { continue }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)"
    if (-not $process) { continue }
    if (-not $process.CommandLine -or -not $process.CommandLine.Contains($entry.marker) -or -not $entry.marker.Contains($projectRoot)) { Write-Warning "Skipped $name because its identity changed."; continue }
    & taskkill.exe /PID $entry.pid /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not stop $name." }
    Write-Host "Stopped $name."
}
Remove-Item -LiteralPath $statePath
Write-Host 'Local AI stopped.'
