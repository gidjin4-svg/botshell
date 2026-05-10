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
        "BotShell\nDein persönlicher Bot-Server.\n\nWas willst du tun?",
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
            "3. setup.sh ausfuhren - fertig\n\n"
            "botshell.io",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Zuruck", callback_data="back")]
            ])
        )

    elif query.data == "back":
        await query.edit_message_text(
            "BotShell\nDein persönlicher Bot-Server.\n\nWas willst du tun?",
            reply_markup=MENU
        )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("waiting_for_description"):
        context.user_data["waiting_for_description"] = False
        description = update.message.text
        await update.message.reply_text(
            f"Bot-Beschreibung gespeichert:\n\"{description}\"\n\n"
            f"Generierung kommt in der naechsten Version.\n"
            f"Zuruck zum Menu: /start",
        )
    else:
        await update.message.reply_text("Tippe /start um das Menu zu offnen.")

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
    logger.info("BotShell läuft...")
    app.run_polling()

if __name__ == "__main__":
    main()
