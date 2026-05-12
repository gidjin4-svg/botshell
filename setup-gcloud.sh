#!/bin/bash
# BotShell — Google Cloud Setup
# Läuft in Google Cloud Shell (kein SSH nötig)
set -e

echo ""
echo "================================"
echo "  BotShell Setup — Google Cloud"
echo "  botshell.io"
echo "================================"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Bitte als root: sudo bash setup-gcloud.sh"
  exit 1
fi

TOKEN="${BOTSHELL_TOKEN:-}"
GROQ_KEY="${GROQ_API_KEY:-}"
BOT_NAME="${BOT_NAME:-Mein Bot}"
BOT_PURPOSE="${BOT_PURPOSE:-ein hilfreicher Assistent}"

if [ -z "$TOKEN" ]; then read -p "Telegram Bot Token: " TOKEN; fi
if [ -z "$GROQ_KEY" ]; then read -p "Groq API Key: " GROQ_KEY; fi

echo "[1/5] Pakete installieren..."
apt-get update -qq && apt-get install -y python3 python3-pip python3-venv -qq

echo "[2/5] Bot installieren..."
mkdir -p /opt/botshell && cd /opt/botshell
python3 -m venv venv

cat > requirements.txt << 'EOF'
python-telegram-bot==21.6
python-dotenv==1.0.1
groq==0.11.0
EOF

curl -fsSL https://raw.githubusercontent.com/gidjin4-svg/botshell/main/templates/groq_agent_bot.py -o bot.py

./venv/bin/pip install -r requirements.txt -q

echo "[3/5] Konfiguration schreiben..."
cat > .env << EOF
TELEGRAM_TOKEN=${TOKEN}
GROQ_API_KEY=${GROQ_KEY}
BOT_NAME=${BOT_NAME}
BOT_PURPOSE=${BOT_PURPOSE}
EOF
chmod 600 .env

echo "[4/5] Service einrichten..."
cat > /etc/systemd/system/botshell.service << EOF
[Unit]
Description=BotShell Bot
After=network.target

[Service]
WorkingDirectory=/opt/botshell
ExecStart=/opt/botshell/venv/bin/python bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable botshell --quiet
systemctl start botshell

echo ""
echo "================================"
echo "  BotShell läuft!"
echo "  Status:  systemctl status botshell"
echo "  Logs:    journalctl -u botshell -f"
echo "================================"
echo ""
