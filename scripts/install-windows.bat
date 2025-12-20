@echo off
:: =============================================================================
:: HIVEMIND WINDOWS INSTALLER
:: =============================================================================
::
:: This script installs WSL2 + Ubuntu, then runs the Linux installer inside WSL.
::
:: USAGE:
::   1. Right-click this file
::   2. Select "Run as administrator"
::   3. Follow prompts
::   4. Restart when asked
::   5. Run again after restart to complete setup
::
:: =============================================================================

setlocal EnableDelayedExpansion

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ========================================
    echo   ERROR: Administrator Required
    echo ========================================
    echo.
    echo Please right-click this file and select
    echo "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Hivemind Installer for Windows
echo   Version 1.0
echo ========================================
echo.

:: Check if WSL is installed
wsl --status >nul 2>&1
if %errorLevel% neq 0 (
    goto :install_wsl
)

:: Check if Ubuntu is installed
wsl -l | findstr /i "Ubuntu" >nul 2>&1
if %errorLevel% neq 0 (
    goto :install_ubuntu
)

:: WSL and Ubuntu are ready, install Hivemind
goto :install_hivemind

:: -----------------------------------------------------------------------------
:: STEP 1: Install WSL
:: -----------------------------------------------------------------------------
:install_wsl
echo [1/3] Installing Windows Subsystem for Linux...
echo.
echo This may take a few minutes...
echo.

wsl --install --no-distribution

if %errorLevel% neq 0 (
    echo.
    echo ERROR: WSL installation failed.
    echo Please ensure Windows is up to date and try again.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   WSL Installed Successfully!
echo ========================================
echo.
echo Your computer needs to restart to complete
echo the WSL installation.
echo.
echo After restarting, run this installer again
echo to continue the setup.
echo.
pause
shutdown /r /t 30 /c "Restarting to complete WSL installation. Run Hivemind installer again after restart."
exit /b 0

:: -----------------------------------------------------------------------------
:: STEP 2: Install Ubuntu
:: -----------------------------------------------------------------------------
:install_ubuntu
echo [2/3] Installing Ubuntu...
echo.

wsl --install -d Ubuntu

if %errorLevel% neq 0 (
    echo.
    echo ERROR: Ubuntu installation failed.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Ubuntu Installed!
echo ========================================
echo.
echo Please complete the Ubuntu setup:
echo   1. A new window will open
echo   2. Create a username and password
echo   3. Close the window when done
echo   4. Then press any key here to continue
echo.
pause

:: -----------------------------------------------------------------------------
:: STEP 3: Install Hivemind
:: -----------------------------------------------------------------------------
:install_hivemind
echo [3/3] Installing Hivemind...
echo.

:: Run the Linux installer inside WSL
wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash"

if %errorLevel% neq 0 (
    echo.
    echo ERROR: Hivemind installation failed.
    echo Please check the output above for details.
    echo.
    pause
    exit /b 1
)

:: Create Windows shortcut
echo.
echo Creating desktop shortcut...

:: Create VBS script to make shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\CreateShortcut.vbs"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Hivemind.lnk" >> "%TEMP%\CreateShortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\CreateShortcut.vbs"
echo oLink.TargetPath = "wsl.exe" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.Arguments = "-d Ubuntu -e bash -l -c hivemind" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.Description = "Launch Hivemind Agent Swarm" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.WorkingDirectory = "%%USERPROFILE%%" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.Save >> "%TEMP%\CreateShortcut.vbs"

cscript //nologo "%TEMP%\CreateShortcut.vbs"
del "%TEMP%\CreateShortcut.vbs"

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo A "Hivemind" shortcut has been added to
echo your desktop.
echo.
echo To start Hivemind:
echo   1. Double-click the desktop shortcut
echo   OR
echo   2. Open Ubuntu and run: hivemind
echo.
echo The dashboard will open at:
echo   http://localhost:5173
echo.
pause
exit /b 0

