#!/bin/bash
# BotShell Setup Script
# Tested on Ubuntu 22.04 / Oracle Linux 8+
# Usage: bash setup.sh

set -e

echo ""
echo "================================"
echo "  BotShell Setup"
echo "  botshell.io"
echo "================================"
echo ""

# Root-Check
if [ "$EUID" -ne 0 ]; then
  echo "Bitte als root ausfuehren: sudo bash setup.sh"
  exit 1
fi

# Token: aus Umgebungsvariable (von Web UI gesetzt) oder manuell abfragen
TOKEN="${BOTSHELL_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  read -p "Telegram Bot Token (@BotFather): " TOKEN
fi
if [ -z "$TOKEN" ]; then
  echo "Fehler: Kein Token eingegeben."
  exit 1
fi

echo ""
echo "[1/5] Pakete installieren..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y python3 python3-pip python3-venv -qq
elif command -v dnf &>/dev/null; then
  dnf install -y python3 python3-pip
else
  echo "Fehler: Unbekanntes System. Ubuntu/Debian oder Oracle Linux benoetigt."
  exit 1
fi

echo "[2/5] Verzeichnis anlegen..."
mkdir -p /opt/botshell
cd /opt/botshell

echo "[3/5] Bot installieren..."
python3 -m venv venv

cat > requirements.txt << 'EOF'
python-telegram-bot==21.6
python-dotenv==1.0.1
EOF

cat > bot.py << 'BOTEOF'
import os
import logging
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
TOKEN = os.getenv("TELEGRAM_TOKEN")

MENU = InlineKeyboardMarkup([
    [InlineKeyboardButton("Meine Bots", callback_data="my_bots")],
    [InlineKeyboardButton("Neuen Bot erstellen", callback_data="new_bot")],
    [InlineKeyboardButton("Hilfe", callback_data="help")],
])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "BotShell\nDein persoenlicher Bot-Server.\n\nWas willst du tun?",
        reply_markup=MENU
    )

async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "my_bots":
        await query.edit_message_text(
            "Keine Bots aktiv.\n\nErstelle deinen ersten Bot:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Neuen Bot erstellen", callback_data="new_bot")],
                [InlineKeyboardButton("Zuruck", callback_data="back")],
            ])
        )
    elif query.data == "new_bot":
        context.user_data["waiting_for_description"] = True
        await query.edit_message_text(
            "Beschreibe in einem Satz was dein Bot tun soll:\n\n"
            "Beispiele:\n"
            "- Schicke mir jeden Morgen um 8 Uhr einen Wetterbericht\n"
            "- Erinnere mich jeden Tag an mein Training\n"
            "- Melde mir jeden neuen Trade meines Bots"
        )
    elif query.data == "help":
        await query.edit_message_text(
            "BotShell - Open Source Telegram Bot Builder\n\n"
            "Du brauchst:\n"
            "1. Einen eigenen Server (Oracle kostenlos oder Hetzner)\n"
            "2. Einen Telegram Bot Token von @BotFather\n"
            "3. setup.sh ausfuehren - fertig\n\n"
            "botshell.io",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Zuruck", callback_data="back")]
            ])
        )
    elif query.data == "back":
        await query.edit_message_text(
            "BotShell\nDein persoenlicher Bot-Server.\n\nWas willst du tun?",
            reply_markup=MENU
        )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("waiting_for_description"):
        context.user_data["waiting_for_description"] = False
        description = update.message.text
        await update.message.reply_text(
            f"Bot-Beschreibung gespeichert:\n\"{description}\"\n\n"
            f"Generierung kommt in der naechsten Version.\n"
            f"Zuruck zum Menu: /start"
        )
    else:
        await update.message.reply_text("Tippe /start um das Menu zu oeffnen.")

async def error_handler(update, context):
    logger.error("Fehler: %s", context.error)

def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_TOKEN fehlt in .env")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_error_handler(error_handler)
    logger.info("BotShell laeuft...")
    app.run_polling()

if __name__ == "__main__":
    main()
BOTEOF

./venv/bin/pip install -r requirements.txt -q

echo "[4/5] Konfiguration schreiben..."
cat > .env << EOF
TELEGRAM_TOKEN=${TOKEN}
EOF
chmod 600 .env

echo "[5/5] Systemd-Service einrichten..."
cat > /etc/systemd/system/botshell.service << EOF
[Unit]
Description=BotShell Telegram Bot
After=network.target

[Service]
WorkingDirectory=/opt/botshell
ExecStart=/opt/botshell/venv/bin/python bot.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable botshell --quiet
systemctl start botshell

echo ""
echo "================================"
echo "  BotShell laeuft!"
echo ""
echo "  Status:  systemctl status botshell"
echo "  Logs:    journalctl -u botshell -f"
echo "  Stoppen: systemctl stop botshell"
echo "================================"
echo ""
