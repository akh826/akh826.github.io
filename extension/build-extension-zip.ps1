$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "extension\storage-inspector-extension"
$zipPath = Join-Path $root "extension\storage-inspector-extension.zip"

if (-not (Test-Path (Join-Path $source "manifest.json"))) {
    throw "Extension source not found: $source"
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$staging = Join-Path $env:TEMP "storage-inspector-extension-pack"
if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $staging -Recurse -Force
Compress-Archive -Path $staging -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

Write-Host "Created $zipPath"
