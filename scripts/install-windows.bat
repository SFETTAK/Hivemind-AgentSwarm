@echo off
:: =============================================================================
:: HIVEMIND WINDOWS INSTALLER
:: =============================================================================
:: One installer that works from any state - fresh install, repair, or update.
:: =============================================================================

setlocal EnableDelayedExpansion
title Hivemind Installer

:: -----------------------------------------------------------------------------
:: Check for admin privileges
:: -----------------------------------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ========================================
    echo    ERROR: Administrator Required
    echo  ========================================
    echo.
    echo   Please RIGHT-CLICK this file and
    echo   select "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------------------
:: Welcome screen
:: -----------------------------------------------------------------------------
cls
echo.
echo  ========================================
echo.
echo    HIVEMIND INSTALLER FOR WINDOWS
echo.
echo    This installer will:
echo    - Install WSL and Ubuntu if needed
echo    - Install or update Hivemind
echo    - Create desktop shortcuts
echo.
echo    Safe to run multiple times!
echo.
echo  ========================================
echo.
pause

:: -----------------------------------------------------------------------------
:: Step 1: Check/Install WSL
:: -----------------------------------------------------------------------------
echo.
echo  [Step 1/5] Checking WSL...

wsl --status >nul 2>&1
if %errorLevel% neq 0 (
    echo  Installing WSL...
    wsl --install --no-distribution
    
    if %errorLevel% neq 0 (
        echo  ERROR: WSL installation failed.
        pause
        exit /b 1
    )
    
    echo.
    echo  ****************************************
    echo  *                                      *
    echo  *       RESTART REQUIRED               *
    echo  *                                      *
    echo  ****************************************
    echo.
    echo  WSL was installed. Your computer must restart.
    echo.
    echo  AFTER RESTART: Run this installer again!
    echo.
    echo  Press any key to restart now...
    pause
    shutdown /r /t 0
    exit /b 0
)
echo  WSL OK

:: -----------------------------------------------------------------------------
:: Step 2: Check/Install Ubuntu
:: -----------------------------------------------------------------------------
echo.
echo  [Step 2/5] Checking Ubuntu...

wsl -l -q 2>nul | findstr /i "Ubuntu" >nul 2>&1
if %errorLevel% neq 0 (
    echo  Installing Ubuntu...
    wsl --install -d Ubuntu --no-launch
    
    echo.
    echo  ****************************************
    echo  *       UBUNTU SETUP REQUIRED          *
    echo  ****************************************
    echo.
    echo  A terminal will open. You must:
    echo    1. Wait for install to finish
    echo    2. Create a username (lowercase)
    echo    3. Create a password
    echo    4. Type: exit
    echo.
    echo  Press any key to continue...
    pause
    
    start /wait wsl -d Ubuntu -- echo "Setup complete. Type exit."
    timeout /t 2 >nul
)
echo  Ubuntu OK

:: -----------------------------------------------------------------------------
:: Step 3: Install/Update Hivemind
:: -----------------------------------------------------------------------------
echo.
echo  [Step 3/5] Installing Hivemind...
echo.
echo  This takes 5-10 minutes. DO NOT CLOSE!
echo.

wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash -s -- --no-prompt"

:: -----------------------------------------------------------------------------
:: Step 4: Verify installation
:: -----------------------------------------------------------------------------
echo.
echo  [Step 4/5] Verifying...

wsl -d Ubuntu -e bash -c "test -d ~/Hivemind-AgentSwarm" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ****************************************
    echo  *       INSTALLATION FAILED            *
    echo  ****************************************
    echo.
    echo  Try running this installer again.
    echo  If it keeps failing, open Ubuntu from
    echo  Start Menu and run:
    echo.
    echo  curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh ^| bash
    echo.
    pause
    goto :create_shortcuts
)
echo  Hivemind OK

:: -----------------------------------------------------------------------------
:: Step 5: Create desktop shortcuts
:: -----------------------------------------------------------------------------
:create_shortcuts
echo.
echo  [Step 5/5] Creating shortcuts...

:: Hivemind launcher
set "SHORTCUT=%USERPROFILE%\Desktop\Hivemind.lnk"
echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\sc.vbs"
echo Set sc = ws.CreateShortcut("%SHORTCUT%") >> "%TEMP%\sc.vbs"
echo sc.TargetPath = "wsl.exe" >> "%TEMP%\sc.vbs"
echo sc.Arguments = "-d Ubuntu -- bash -l -c hivemind" >> "%TEMP%\sc.vbs"
echo sc.Description = "Start Hivemind" >> "%TEMP%\sc.vbs"
echo sc.Save >> "%TEMP%\sc.vbs"
cscript //nologo "%TEMP%\sc.vbs"
del "%TEMP%\sc.vbs"
echo  [+] Hivemind

:: Repair tool (stops Hivemind first, then repairs)
echo @echo off > "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo title Hivemind Repair >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo Stopping Hivemind if running... >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo wsl -d Ubuntu -e bash -c "hivemind-stop 2^>/dev/null; pkill -f 'node.*hivemind' 2^>/dev/null; tmux kill-server 2^>/dev/null; echo Stopped." >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo Repairing Hivemind... This takes 5-10 minutes. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh ^| bash" >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo echo Done! Now double-click Hivemind to start. >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo pause >> "%USERPROFILE%\Desktop\Hivemind-Repair.bat"
echo  [+] Hivemind-Repair

:: README
echo HIVEMIND QUICK START > "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo. >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo TO START: >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Double-click Hivemind on desktop >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Wait for "Dashboard running on port 5173" >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Open http://localhost:5173 >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo. >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo KEEP THE BLACK WINDOW OPEN! >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo. >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo IF IT DOESN'T WORK: >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Double-click Hivemind-Repair >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Wait for it to finish >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Try Hivemind again >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo. >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo API KEY: >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo   Get one at https://openrouter.ai/keys >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo. >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo GitHub: github.com/SFETTAK/Hivemind-AgentSwarm >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo (c) 2024-2025 Steven Fett >> "%USERPROFILE%\Desktop\Hivemind-README.txt"
echo  [+] Hivemind-README.txt

:: Web shortcut to dashboard
echo [InternetShortcut] > "%USERPROFILE%\Desktop\Hivemind-Dashboard.url"
echo URL=http://localhost:5173 >> "%USERPROFILE%\Desktop\Hivemind-Dashboard.url"
echo IconIndex=0 >> "%USERPROFILE%\Desktop\Hivemind-Dashboard.url"
echo  [+] Hivemind-Dashboard.url

:: -----------------------------------------------------------------------------
:: Done
:: -----------------------------------------------------------------------------
echo.
echo  ========================================
echo.
echo    SETUP COMPLETE!
echo.
echo    Desktop shortcuts created:
echo    - Hivemind (start the server)
echo    - Hivemind-Dashboard (open in browser)
echo    - Hivemind-Repair (fix problems)
echo    - Hivemind-README.txt (help)
echo.
echo  ========================================
echo.

:: Open readme
start notepad "%USERPROFILE%\Desktop\Hivemind-README.txt"

:: Ask to start
set /p START="Start Hivemind now? (Y/n): "
if /i "%START%"=="n" goto :end
if /i "%START%"=="no" goto :end

echo.
echo  Starting... Keep this window open!
echo.
wsl -d Ubuntu -- bash -l -c hivemind

:end
echo.
echo  Press any key to close...
pause
exit /b 0
