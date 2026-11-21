param([switch]$SkipOllama)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $projectRoot
New-Item -ItemType Directory -Path '.local/downloads','.local/tools' -Force | Out-Null

function Install-OfficialRelease($Repository, $AssetName, $Destination, $Archive) {
    if (Test-Path -LiteralPath $Destination) { return }
    Write-Host "Downloading $Repository (first setup only)..."
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest"
    $asset = @($release.assets | Where-Object { $_.name -eq $AssetName })
    if ($asset.Count -ne 1 -or $asset[0].digest -notmatch '^sha256:([a-f0-9]{64})$') { throw 'Official release checksum is missing.' }
    $expectedHash = $Matches[1]
    $download = Join-Path $projectRoot ".local/downloads/$AssetName"
    & curl.exe --location --fail --retry 2 --silent --show-error --output $download $asset[0].browser_download_url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Repository" }
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) { throw 'Release checksum mismatch.' }
    if ($Archive) {
        $target = Split-Path -Parent $Destination
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Expand-Archive -LiteralPath $download -DestinationPath $target -Force
        Remove-Item -LiteralPath $download
    } else {
        Move-Item -LiteralPath $download -Destination $Destination
    }
    Write-Host "Installed $Repository $($release.tag_name)."
}
if (-not $SkipOllama) { Install-OfficialRelease 'ollama/ollama' 'ollama-windows-amd64.zip' (Join-Path $projectRoot '.local/ollama/ollama.exe') $true }
Install-OfficialRelease 'cloudflare/cloudflared' 'cloudflared-windows-amd64.exe' (Join-Path $projectRoot '.local/tools/cloudflared.exe') $false
