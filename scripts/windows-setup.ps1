# Hivemind Windows/WSL2 Setup Script
# Run as Administrator in PowerShell
#
# Usage: .\scripts\windows-setup.ps1
#        .\scripts\windows-setup.ps1 -SkipWSLInstall  # If WSL already installed
#        .\scripts\windows-setup.ps1 -Distro Ubuntu   # Specify distro name

param(
    [switch]$SkipWSLInstall,
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "🐝 Hivemind Windows/WSL2 Setup" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $SkipWSLInstall) {
    Write-Host "❌ Please run as Administrator for WSL installation" -ForegroundColor Red
    Write-Host "   Or use -SkipWSLInstall if WSL is already installed" -ForegroundColor Yellow
    exit 1
}

# Step 1: Check/Install WSL
Write-Host "`n📦 Step 1: Checking WSL..." -ForegroundColor Cyan

if (-not $SkipWSLInstall) {
    $wslStatus = wsl --status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing WSL2..." -ForegroundColor Yellow
        wsl --install
        Write-Host "`n⚠️  WSL installed. Please RESTART your computer and run this script again with -SkipWSLInstall" -ForegroundColor Yellow
        exit 0
    }
}

# Check if distro exists (handle WSL's weird encoding)
$distroList = wsl --list --quiet 2>&1 | ForEach-Object { $_.Trim() -replace '\x00', '' } | Where-Object { $_ -ne '' }
$distroFound = $distroList | Where-Object { $_ -like "*$Distro*" }

if (-not $distroFound) {
    Write-Host "❌ Distro '$Distro' not found." -ForegroundColor Red
    Write-Host "Available distros:" -ForegroundColor Yellow
    wsl --list --verbose
    Write-Host "`nInstall Ubuntu with: wsl --install -d Ubuntu" -ForegroundColor Yellow
    Write-Host "Then restart and run this script again with: .\scripts\windows-setup.ps1 -SkipWSLInstall" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ WSL2 with $Distro is available" -ForegroundColor Green

# Step 2: Install dependencies in WSL
Write-Host "`n📦 Step 2: Installing dependencies in WSL..." -ForegroundColor Cyan

$wslCommands = @"
set -e
echo "Updating packages..."
sudo apt-get update -qq

echo "Installing tmux, nodejs, npm, python3-pip..."
sudo apt-get install -y -qq tmux nodejs npm python3-pip > /dev/null

echo "Installing Python packages..."
pip3 install --break-system-packages --quiet mcp fastmcp pydantic uvicorn

# Add local bin to PATH if not already there
if ! grep -q 'HOME/.local/bin' ~/.bashrc; then
    echo 'export PATH=\$PATH:\$HOME/.local/bin' >> ~/.bashrc
fi

echo "Verifying installations..."
echo "  tmux: \$(tmux -V)"
echo "  python3: \$(python3 --version)"
echo "  node: \$(node --version)"
echo "  pip packages: mcp, fastmcp, pydantic, uvicorn installed"
"@

Write-Host "Running setup in WSL (this may take a few minutes)..." -ForegroundColor Yellow
$wslCommands | wsl -d $Distro -- bash

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 3: Set up Cursor MCP config
Write-Host "`n📦 Step 3: Configuring Cursor MCP..." -ForegroundColor Cyan

$cursorMcpPath = "$env:USERPROFILE\.cursor\mcp.json"
$mcpConfig = @{
    mcpServers = @{
        hivemind = @{
            url = "http://localhost:8000/mcp"
        }
    }
}

if (Test-Path $cursorMcpPath) {
    $existingConfig = Get-Content $cursorMcpPath | ConvertFrom-Json
    if ($existingConfig.mcpServers.hivemind) {
        Write-Host "✅ Hivemind MCP already configured in Cursor" -ForegroundColor Green
    } else {
        # Add hivemind to existing config
        $existingConfig.mcpServers | Add-Member -NotePropertyName "hivemind" -NotePropertyValue @{ url = "http://localhost:8000/mcp" }
        $existingConfig | ConvertTo-Json -Depth 10 | Set-Content $cursorMcpPath
        Write-Host "✅ Added Hivemind to existing Cursor MCP config" -ForegroundColor Green
    }
} else {
    # Create new config
    New-Item -ItemType Directory -Force -Path (Split-Path $cursorMcpPath) | Out-Null
    $mcpConfig | ConvertTo-Json -Depth 10 | Set-Content $cursorMcpPath
    Write-Host "✅ Created Cursor MCP config" -ForegroundColor Green
}

# Step 4: Install dashboard dependencies
Write-Host "`n📦 Step 4: Installing dashboard dependencies..." -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardDir = Join-Path (Split-Path -Parent $scriptDir) "dashboard"

if (Test-Path $dashboardDir) {
    Push-Location $dashboardDir
    npm install --silent 2>&1 | Out-Null
    
    # Copy settings if not exists
    if (-not (Test-Path "settings.json") -and (Test-Path "settings.example.json")) {
        Copy-Item "settings.example.json" "settings.json"
        Write-Host "⚠️  Created settings.json from template - edit with your API keys" -ForegroundColor Yellow
    }
    
    Pop-Location
    Write-Host "✅ Dashboard dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Dashboard directory not found, skipping" -ForegroundColor Yellow
}

# Get the WSL path for this project
$projectPath = (Get-Location).Path
$wslProjectPath = $projectPath -replace '\\', '/' -replace '^([A-Za-z]):', '/mnt/$1'.ToLower()

# Done!
Write-Host "`n" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "🐝 Hivemind Setup Complete!" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your project in WSL: $wslProjectPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Start the MCP server (in a new terminal):" -ForegroundColor White
Write-Host "     wsl -d $Distro" -ForegroundColor Gray
Write-Host "     cd $wslProjectPath/mcp" -ForegroundColor Gray
Write-Host "     python3 hivemind_mcp.py --http --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Start the dashboard (optional, in another terminal):" -ForegroundColor White
Write-Host "     cd dashboard" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Restart Cursor to connect to MCP server" -ForegroundColor White
Write-Host ""
Write-Host "  4. Edit dashboard/settings.json with your API keys" -ForegroundColor White
Write-Host "     Get keys from: https://openrouter.ai/keys" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Test in Cursor chat: 'list tmux sessions'" -ForegroundColor White
Write-Host ""

