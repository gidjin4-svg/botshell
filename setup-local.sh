#!/bin/bash
# BotShell — Lokales Setup (Mac/Linux)
set -e

echo ""
echo "================================"
echo "  BotShell Setup — Lokal"
echo "================================"
echo ""

read -p "Telegram Bot Token: " TOKEN
read -p "Groq API Key: " GROQ_KEY
read -p "Bot Name: " BOT_NAME

mkdir -p ~/botshell && cd ~/botshell
python3 -m venv venv

cat > requirements.txt << 'EOF'
python-telegram-bot==21.6
python-dotenv==1.0.1
groq==0.11.0
EOF

curl -fsSL https://raw.githubusercontent.com/gidjin4-svg/botshell/main/templates/groq_agent_bot.py -o bot.py

./venv/bin/pip install -r requirements.txt -q

cat > .env << EOF
TELEGRAM_TOKEN=${TOKEN}
GROQ_API_KEY=${GROQ_KEY}
BOT_NAME=${BOT_NAME}
BOT_PURPOSE=ein hilfreicher Assistent
EOF
chmod 600 .env

echo ""
echo "================================"
echo "  Starte Bot... (Terminal offen lassen)"
echo "================================"
./venv/bin/python bot.py
