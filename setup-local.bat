@echo off
echo.
echo ================================
echo   BotShell Setup - Windows Lokal
echo   botshell.io
echo ================================
echo.

set /p TOKEN="Telegram Bot Token: "
set /p GROQ_KEY="Groq API Key: "
set /p BOT_NAME="Bot Name: "

mkdir "%USERPROFILE%\botshell" 2>nul
cd /d "%USERPROFILE%\botshell"

echo TELEGRAM_TOKEN=%TOKEN% > .env
echo GROQ_API_KEY=%GROQ_KEY% >> .env
echo BOT_NAME=%BOT_NAME% >> .env
echo BOT_PURPOSE=ein hilfreicher Assistent >> .env

pip install python-telegram-bot==21.6 python-dotenv==1.0.1 groq==0.11.0 -q

if not exist "bot.py" (
  curl -fsSL https://raw.githubusercontent.com/gidjin4-svg/botshell/main/templates/groq_agent_bot.py -o bot.py
)

echo.
echo ================================
echo   Bot wird gestartet...
echo   Fenster offen lassen!
echo ================================
echo.

python bot.py
pause
