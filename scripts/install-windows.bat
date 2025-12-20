@echo off
:: =============================================================================
:: HIVEMIND WINDOWS INSTALLER - IMPROVED
:: =============================================================================
::
:: One-click installation for Windows users.
:: Installs WSL2 + Ubuntu, then sets up Hivemind automatically.
::
:: USAGE: Right-click → Run as administrator
::
:: =============================================================================

setlocal EnableDelayedExpansion
title Hivemind Installer

:: -----------------------------------------------------------------------------
:: Check for admin privileges
:: -----------------------------------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ╔════════════════════════════════════════╗
    echo  ║   ERROR: Administrator Required        ║
    echo  ╠════════════════════════════════════════╣
    echo  ║                                        ║
    echo  ║   Please RIGHT-CLICK this file and    ║
    echo  ║   select "Run as administrator"       ║
    echo  ║                                        ║
    echo  ╚════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------------------
:: Welcome screen
:: -----------------------------------------------------------------------------
cls
echo.
echo  ╔════════════════════════════════════════╗
echo  ║                                        ║
echo  ║   🐝 HIVEMIND INSTALLER FOR WINDOWS   ║
echo  ║                                        ║
echo  ║   This will install:                  ║
echo  ║   • Windows Subsystem for Linux       ║
echo  ║   • Ubuntu                            ║
echo  ║   • Hivemind Agent Swarm              ║
echo  ║                                        ║
echo  ║   Estimated time: 10-15 minutes       ║
echo  ║                                        ║
echo  ╚════════════════════════════════════════╝
echo.
echo  Press any key to begin installation...
pause >nul

:: -----------------------------------------------------------------------------
:: Step 1: Check/Install WSL
:: -----------------------------------------------------------------------------
echo.
echo  [Step 1/4] Checking Windows Subsystem for Linux...

wsl --status >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Installing WSL... This may take 5-10 minutes.
    echo.
    
    wsl --install --no-distribution
    
    if %errorLevel% neq 0 (
        echo.
        echo  ERROR: WSL installation failed.
        echo  Make sure Windows is fully updated and try again.
        echo.
        pause
        exit /b 1
    )
    
    echo.
    echo  ╔════════════════════════════════════════╗
    echo  ║   WSL Installed - RESTART REQUIRED     ║
    echo  ╠════════════════════════════════════════╣
    echo  ║                                        ║
    echo  ║   Your computer will restart in 60    ║
    echo  ║   seconds.                            ║
    echo  ║                                        ║
    echo  ║   After restart, RUN THIS INSTALLER   ║
    echo  ║   AGAIN to continue.                  ║
    echo  ║                                        ║
    echo  ╚════════════════════════════════════════╝
    echo.
    echo  Press any key to restart now, or wait 60 seconds...
    timeout /t 60
    shutdown /r /t 0
    exit /b 0
) else (
    echo  WSL is already installed. ✓
)

:: -----------------------------------------------------------------------------
:: Step 2: Check/Install Ubuntu
:: -----------------------------------------------------------------------------
echo.
echo  [Step 2/4] Checking Ubuntu...

wsl -l -q 2>nul | findstr /i "Ubuntu" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Installing Ubuntu...
    echo.
    
    wsl --install -d Ubuntu --no-launch
    
    if %errorLevel% neq 0 (
        echo  ERROR: Ubuntu installation failed.
        pause
        exit /b 1
    )
    
    echo.
    echo  ╔════════════════════════════════════════╗
    echo  ║   IMPORTANT: Ubuntu Setup Required     ║
    echo  ╠════════════════════════════════════════╣
    echo  ║                                        ║
    echo  ║   A new window will open.             ║
    echo  ║                                        ║
    echo  ║   You MUST:                           ║
    echo  ║   1. Wait for it to finish setup      ║
    echo  ║   2. Enter a username (lowercase)     ║
    echo  ║   3. Enter a password (twice)         ║
    echo  ║   4. Type 'exit' and press Enter      ║
    echo  ║                                        ║
    echo  ║   DO NOT just close the window!       ║
    echo  ║                                        ║
    echo  ╚════════════════════════════════════════╝
    echo.
    echo  Press any key to open Ubuntu setup...
    pause >nul
    
    :: Launch Ubuntu and wait for user to configure it
    start /wait wsl -d Ubuntu
    
    :: Verify it worked
    wsl -d Ubuntu -e whoami >nul 2>&1
    if %errorLevel% neq 0 (
        echo.
        echo  ERROR: Ubuntu setup was not completed.
        echo  Please run this installer again.
        pause
        exit /b 1
    )
    
    echo.
    echo  Ubuntu configured successfully! ✓
) else (
    echo  Ubuntu is already installed. ✓
)

:: -----------------------------------------------------------------------------
:: Step 3: Install Hivemind inside WSL
:: -----------------------------------------------------------------------------
echo.
echo  [Step 3/4] Installing Hivemind...
echo.
echo  This will take a few minutes. Please wait...
echo.

:: First update apt (required on fresh Ubuntu)
wsl -d Ubuntu -e bash -c "sudo apt-get update -qq"

:: Run the installer with --no-prompt to avoid nested prompts
wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash -s -- --no-prompt"

if %errorLevel% neq 0 (
    echo.
    echo  ╔════════════════════════════════════════╗
    echo  ║   Installation had issues             ║
    echo  ╠════════════════════════════════════════╣
    echo  ║                                        ║
    echo  ║   Check the output above for errors.  ║
    echo  ║                                        ║
    echo  ║   Common fixes:                       ║
    echo  ║   • Run this installer again          ║
    echo  ║   • Open Ubuntu and run:              ║
    echo  ║     hivemind                          ║
    echo  ║                                        ║
    echo  ╚════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------------------
:: Step 4: Create desktop shortcut
:: -----------------------------------------------------------------------------
echo.
echo  [Step 4/4] Creating desktop shortcut...

:: Get the path to hivemind in WSL
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Hivemind.lnk"

:: Create VBScript to make the shortcut
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = "%SHORTCUT_PATH%"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "wsl.exe"
echo oLink.Arguments = "-d Ubuntu -- bash -i -c ""cd ~/Hivemind-AgentSwarm && ./scripts/start.sh"""
echo oLink.Description = "Launch Hivemind Agent Swarm"
echo oLink.WorkingDirectory = "%USERPROFILE%"
echo oLink.Save
) > "%TEMP%\CreateShortcut.vbs"

cscript //nologo "%TEMP%\CreateShortcut.vbs"
del "%TEMP%\CreateShortcut.vbs" 2>nul

:: Also create a start script in WSL that's more reliable
wsl -d Ubuntu -e bash -c "mkdir -p ~/Hivemind-AgentSwarm/scripts && cat > ~/Hivemind-AgentSwarm/scripts/start.sh << 'STARTSCRIPT'
#!/bin/bash
cd ~/Hivemind-AgentSwarm

# Kill existing sessions
tmux kill-session -t hivemind-api 2>/dev/null

# Start API
tmux new-session -d -s hivemind-api -c ~/Hivemind-AgentSwarm/packages/api 'node dist/index.js'

# Wait for API
echo 'Starting Hivemind...'
for i in {1..10}; do
    curl -s http://localhost:3001/health >/dev/null && break
    sleep 1
done

echo ''
echo '========================================'
echo '  🐝 Hivemind is running!'
echo '========================================'
echo ''
echo '  Dashboard: http://localhost:5173'
echo '  API:       http://localhost:3001'
echo ''
echo '  Press Ctrl+C to stop'
echo ''

cd apps/dashboard
npx vite --host 0.0.0.0
STARTSCRIPT
chmod +x ~/Hivemind-AgentSwarm/scripts/start.sh"

echo  Desktop shortcut created! ✓

:: -----------------------------------------------------------------------------
:: Done!
:: -----------------------------------------------------------------------------
echo.
echo  ╔════════════════════════════════════════╗
echo  ║                                        ║
echo  ║   🎉 INSTALLATION COMPLETE! 🎉        ║
echo  ║                                        ║
echo  ╠════════════════════════════════════════╣
echo  ║                                        ║
echo  ║   To start Hivemind:                  ║
echo  ║   • Double-click "Hivemind" on your   ║
echo  ║     desktop                           ║
echo  ║                                        ║
echo  ║   The dashboard will open at:         ║
echo  ║   http://localhost:5173               ║
echo  ║                                        ║
echo  ║   IMPORTANT: Edit your API key in:    ║
echo  ║   Ubuntu → ~/Hivemind-AgentSwarm/     ║
echo  ║            settings.json              ║
echo  ║                                        ║
echo  ╚════════════════════════════════════════╝
echo.

:: Ask if they want to start now
set /p STARTNOW="Start Hivemind now? (Y/n): "
if /i "%STARTNOW%"=="n" goto :done
if /i "%STARTNOW%"=="no" goto :done

:: Start it
echo.
echo  Starting Hivemind...
wsl -d Ubuntu -- bash -i -c "cd ~/Hivemind-AgentSwarm && ./scripts/start.sh"

:done
echo.
echo  Press any key to close this window...
pause >nul
exit /b 0
