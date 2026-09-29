Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  🚀 Installing & Starting Mousely for Windows" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check for node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ Node.js is not found." -ForegroundColor Yellow
    Write-Host "Please download and install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    Start-Process "https://nodejs.org"
    exit
}

$installDir = "$env:USERPROFILE\.mousely"

if (Test-Path $installDir) {
    Write-Host "📦 Updating Mousely..." -ForegroundColor Green
    Set-Location $installDir
    git pull origin main 2>$null
} else {
    Write-Host "📦 Downloading Mousely..." -ForegroundColor Green
    git clone https://github.com/Nekono3/mousely.git $installDir
    Set-Location $installDir
}

Write-Host "⚙️ Installing dependencies..." -ForegroundColor Green
npm install --silent

Write-Host "🌟 Launching Mousely..." -ForegroundColor Cyan
node server.js
