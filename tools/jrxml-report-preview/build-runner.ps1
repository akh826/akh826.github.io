$ErrorActionPreference = "Stop"
$javaDir = Join-Path $PSScriptRoot "java"
Push-Location $javaDir
try {
    mvn -q package
    $jar = Join-Path $javaDir "target\jrxml-local-runner.jar"
    if (-not (Test-Path $jar)) {
        throw "Build finished but jar was not found: $jar"
    }
    Write-Host "Built: $jar"
} finally {
    Pop-Location
}
