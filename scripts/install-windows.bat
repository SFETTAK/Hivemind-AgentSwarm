@echo off
:: =============================================================================
:: HIVEMIND WINDOWS INSTALLER
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
echo                                        
echo    HIVEMIND INSTALLER FOR WINDOWS      
echo                                        
echo    This will install:                  
echo    - Windows Subsystem for Linux       
echo    - Ubuntu                            
echo    - Hivemind Agent Swarm              
echo                                        
echo    Estimated time: 10-15 minutes       
echo                                        
echo  ========================================
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
    echo  ****************************************
    echo  *                                      *
    echo  *    WSL INSTALLED SUCCESSFULLY!       *
    echo  *                                      *
    echo  *    >>> RESTART REQUIRED <<<          *
    echo  *                                      *
    echo  ****************************************
    echo.
    echo  ========================================
    echo  =                                      =
    echo  =   !!! IMPORTANT - READ THIS !!!     =
    echo  =                                      =
    echo  =   Your computer MUST restart now.   =
    echo  =                                      =
    echo  =   After your computer restarts:     =
    echo  =                                      =
    echo  =   1. Find this installer file       =
    echo  =   2. Right-click it                 =
    echo  =   3. "Run as administrator" AGAIN   =
    echo  =                                      =
    echo  =   The installer will continue       =
    echo  =   from where it left off.           =
    echo  =                                      =
    echo  ========================================
    echo.
    echo  ****************************************
    echo  *   RUN THIS INSTALLER AGAIN AFTER    *
    echo  *   YOUR COMPUTER RESTARTS!           *
    echo  ****************************************
    echo.
    echo  Press any key to restart your computer now...
    pause >nul
    shutdown /r /t 0
    exit /b 0
) else (
    echo  WSL is already installed.
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
    echo  ****************************************
    echo  *                                      *
    echo  *   UBUNTU SETUP - ACTION REQUIRED    *
    echo  *                                      *
    echo  ****************************************
    echo.
    echo  A BLACK TERMINAL WINDOW will open.
    echo.
    echo  ========================================
    echo  =   FOLLOW THESE STEPS CAREFULLY:     =
    echo  ========================================
    echo.
    echo   STEP 1: Wait for "Installing..." to finish
    echo           (this takes 1-2 minutes)
    echo.
    echo   STEP 2: When it asks "Enter new UNIX username:"
    echo           Type a username (lowercase, no spaces)
    echo           Example: john
    echo           Press Enter
    echo.
    echo   STEP 3: When it asks "New password:"
    echo           Type a password (you won't see it)
    echo           Press Enter
    echo.
    echo   STEP 4: When it asks "Retype new password:"
    echo           Type the same password again
    echo           Press Enter
    echo.
    echo   STEP 5: When you see a $ prompt, type:
    echo           exit
    echo           Press Enter
    echo.
    echo  ****************************************
    echo  *   DO NOT CLOSE THE WINDOW WITH X!   *
    echo  *   You must type "exit" to finish.   *
    echo  ****************************************
    echo.
    echo  Press any key when you're ready to begin...
    pause >nul
    
    :: Launch Ubuntu and wait for user to configure it
    start /wait wsl -d Ubuntu -- echo "Ubuntu setup complete. Type 'exit' and press Enter."
    
    :: Give it a moment
    timeout /t 2 >nul
    
    :: Verify it worked
    wsl -d Ubuntu -e whoami >nul 2>&1
    if %errorLevel% neq 0 (
        echo.
        echo  Ubuntu may not be fully configured.
        echo  Trying to continue anyway...
        echo.
    ) else (
        echo  Ubuntu configured successfully!
    )
) else (
    echo  Ubuntu is already installed.
)

:: -----------------------------------------------------------------------------
:: Step 3: Install Hivemind inside WSL
:: -----------------------------------------------------------------------------
echo.
echo  [Step 3/4] Installing Hivemind...
echo.
echo  ****************************************
echo  *   THIS WILL TAKE 5-10 MINUTES       *
echo  *   DO NOT CLOSE THIS WINDOW!         *
echo  ****************************************
echo.
echo  You will see a lot of text scrolling by.
echo  This is normal. Wait until it says "DONE".
echo.

:: First update apt (required on fresh Ubuntu)
echo  Updating package lists...
wsl -d Ubuntu -e bash -c "sudo apt-get update -qq" 2>nul

:: Run the installer with --no-prompt flag
echo.
echo  Installing dependencies and Hivemind...
echo.
wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash -s -- --no-prompt"

:: Verify the installation actually worked
echo.
echo  Verifying installation...
wsl -d Ubuntu -e bash -c "test -d ~/Hivemind-AgentSwarm && echo EXISTS" > "%TEMP%\hivemind_check.txt" 2>nul
set /p INSTALL_CHECK=<"%TEMP%\hivemind_check.txt"
del "%TEMP%\hivemind_check.txt" 2>nul

if not "%INSTALL_CHECK%"=="EXISTS" (
    echo.
    echo  ****************************************
    echo  *                                      *
    echo  *   INSTALLATION INCOMPLETE           *
    echo  *                                      *
    echo  ****************************************
    echo.
    echo  Don't worry! We'll create a repair tool
    echo  on your desktop that you can use to fix this.
    echo.
    echo  After this window closes:
    echo  1. Double-click "Hivemind-Repair" on desktop
    echo  2. Wait for it to finish
    echo  3. Then double-click "Hivemind" to start
    echo.
    :: Still create the shortcuts so they can repair
    goto :create_shortcuts
) else (
    echo.
    echo  ****************************************
    echo  *   HIVEMIND INSTALLED SUCCESSFULLY!  *
    echo  ****************************************
    echo.
)

:: -----------------------------------------------------------------------------
:: Step 4: Create desktop shortcuts and help files
:: -----------------------------------------------------------------------------
:create_shortcuts
echo.
echo  [Step 4/4] Creating desktop shortcuts...

:: Create main Hivemind shortcut
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Hivemind.lnk"
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = "%SHORTCUT_PATH%"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "wsl.exe"
echo oLink.Arguments = "-d Ubuntu -- bash -l -c hivemind"
echo oLink.Description = "Launch Hivemind Agent Swarm"
echo oLink.WorkingDirectory = "%USERPROFILE%"
echo oLink.Save
) > "%TEMP%\CreateShortcut.vbs"
cscript //nologo "%TEMP%\CreateShortcut.vbs" >nul 2>&1
del "%TEMP%\CreateShortcut.vbs" 2>nul
echo  [+] Hivemind shortcut created

:: Create Repair/Reinstall script on desktop
set "REPAIR_PATH=%USERPROFILE%\Desktop\Hivemind-Repair.bat"
(
echo @echo off
echo title Hivemind Repair
echo echo.
echo echo  ========================================
echo echo    HIVEMIND REPAIR TOOL
echo echo  ========================================
echo echo.
echo echo  This will reinstall Hivemind.
echo echo  Please wait 5-10 minutes...
echo echo.
echo wsl -d Ubuntu -e bash -c "curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh ^| bash"
echo echo.
echo echo  ========================================
echo echo    REPAIR COMPLETE!
echo echo  ========================================
echo echo.
echo echo  Now double-click "Hivemind" to start.
echo echo.
echo pause
) > "%REPAIR_PATH%"
echo  [+] Hivemind-Repair shortcut created

:: Create README/Help file on desktop
set "README_PATH=%USERPROFILE%\Desktop\Hivemind-README.txt"
(
echo ========================================
echo   HIVEMIND AGENT SWARM - QUICK START
echo ========================================
echo.
echo STARTING HIVEMIND:
echo   Double-click "Hivemind" on your desktop.
echo   Wait for it to say "Dashboard running..."
echo   Then open: http://localhost:5173
echo.
echo IMPORTANT: Keep the black window open!
echo Closing it will stop Hivemind.
echo.
echo ----------------------------------------
echo.
echo TROUBLESHOOTING:
echo.
echo Problem: "localhost refused to connect"
echo Solution: The server isn't running yet.
echo   1. Double-click "Hivemind" on desktop
echo   2. Wait for "Dashboard running on port 5173"
echo   3. THEN open http://localhost:5173
echo.
echo Problem: Nothing happens when I click Hivemind
echo Solution: Run the repair tool.
echo   1. Double-click "Hivemind-Repair" on desktop
echo   2. Wait for it to finish
echo   3. Then try "Hivemind" again
echo.
echo Problem: "Hivemind command not found"
echo Solution: The install didn't complete.
echo   1. Double-click "Hivemind-Repair" on desktop
echo   2. Wait 5-10 minutes
echo   3. Then try "Hivemind" again
echo.
echo ----------------------------------------
echo.
echo SETTING UP YOUR API KEY:
echo.
echo   1. Get a key from: https://openrouter.ai/keys
echo   2. Open Ubuntu from Start Menu
echo   3. Type: nano ~/Hivemind-AgentSwarm/settings.json
echo   4. Add your key to "openrouterApiKey"
echo   5. Press Ctrl+X, then Y, then Enter to save
echo.
echo ----------------------------------------
echo.
echo LINKS:
echo   GitHub: https://github.com/SFETTAK/Hivemind-AgentSwarm
echo   Docs:   https://github.com/SFETTAK/Hivemind-AgentSwarm/blob/main/docs/INSTALL.md
echo.
echo ----------------------------------------
echo.
echo ^(c^) 2024-2025 Steven Fett ^& Contributors
echo MIT License
echo.
) > "%README_PATH%"
echo  [+] Hivemind-README.txt created

echo.
echo  Desktop shortcuts created!

:: -----------------------------------------------------------------------------
:: Done!
:: -----------------------------------------------------------------------------
echo.
echo  ========================================
echo                                        
echo    SETUP COMPLETE!                     
echo                                        
echo  ========================================
echo.
echo   3 items added to your Desktop:
echo.
echo   [Hivemind]        - Start the dashboard
echo   [Hivemind-Repair] - Fix if something breaks
echo   [Hivemind-README] - Help and troubleshooting
echo.
echo  ----------------------------------------
echo.
echo   GitHub: github.com/SFETTAK/Hivemind-AgentSwarm
echo.
echo   Thank you for trying Hivemind!
echo   (c) 2024-2025 Steven Fett ^& Contributors
echo.
echo  ----------------------------------------

:: Open the README so they have instructions
echo.
echo  Opening README with instructions...
start notepad "%USERPROFILE%\Desktop\Hivemind-README.txt"

:: Ask if they want to start now
echo.
set /p STARTNOW="Start Hivemind now? (Y/n): "
if /i "%STARTNOW%"=="n" goto :done
if /i "%STARTNOW%"=="no" goto :done

:: Start it
echo.
echo  Starting Hivemind...
echo.
echo  ****************************************
echo  *   KEEP THIS WINDOW OPEN!            *
echo  *   Closing it will stop Hivemind.    *
echo  ****************************************
echo.
echo  When you see "Dashboard running on port 5173"
echo  open http://localhost:5173 in your browser.
echo.
wsl -d Ubuntu -- bash -l -c hivemind

:done
echo.
echo  Press any key to close...
pause >nul
exit /b 0
