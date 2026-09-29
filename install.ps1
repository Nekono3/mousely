$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🚀 Mousely Auto-Setup & Launch for Windows" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$installDir = "$env:USERPROFILE\.mousely"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

# 1. Ensure Node.js is available
$nodeInPath = Get-Command node -ErrorAction SilentlyContinue
$localNode = "$installDir\node-win\node.exe"

if (-not $nodeInPath -and -not (Test-Path $localNode)) {
    Write-Host "⚙️ Setting up portable Node.js runtime (one-time setup)..." -ForegroundColor Yellow
    $nodeVer = "v20.18.0"
    $zipUrl = "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-x64.zip"
    $zipPath = "$env:TEMP\node.zip"

    Write-Host "📥 Downloading Node.js portable zip..." -ForegroundColor Green
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    Write-Host "📦 Extracting Node.js..." -ForegroundColor Green
    Expand-Archive -Path $zipPath -DestinationPath "$installDir\temp_node" -Force
    Move-Item -Path "$installDir\temp_node\node-$nodeVer-win-x64" -Destination "$installDir\node-win" -Force
    Remove-Item -Path "$installDir\temp_node" -Recurse -Force
    Remove-Item -Path $zipPath -Force
    Write-Host "✅ Portable Node.js ready!" -ForegroundColor Green
}

if (Test-Path "$installDir\node-win") {
    $env:PATH = "$installDir\node-win;" + $env:PATH
}

# 2. Clone or update Mousely
$appDir = "$installDir\app"
if (Test-Path $appDir) {
    Write-Host "📦 Updating Mousely..." -ForegroundColor Green
    Set-Location $appDir
    git pull origin main 2>$null
} else {
    Write-Host "📦 Downloading Mousely..." -ForegroundColor Green
    git clone https://github.com/Nekono3/mousely.git $appDir
    Set-Location $appDir
}

Write-Host "⚙️ Verifying dependencies..." -ForegroundColor Green
npm install --silent

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🌟 Starting Mousely Presentation Hub..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

node server.js
