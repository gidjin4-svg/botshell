import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes

load_dotenv()
TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)


def timestamp():
    return datetime.now().strftime("%d.%m.%Y %H:%M")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    await post_idea(context, f"💡 {text}\n\n_{timestamp()}_")
    await update.message.reply_text("Idee gespeichert.")


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not OPENAI_API_KEY:
        await update.message.reply_text(
            "Kein OpenAI Key hinterlegt. Sprachnachrichten werden nicht transkribiert.\n"
            "OPENAI_API_KEY in .env eintragen."
        )
        return

    await update.message.reply_text("Transkribiere...")

    voice = await update.message.voice.get_file()
    path = f"/tmp/voice_{update.message.message_id}.ogg"
    await voice.download_to_drive(path)

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        with open(path, "rb") as f:
            result = client.audio.transcriptions.create(model="whisper-1", file=f)
        text = result.text.strip()
        await post_idea(context, f"🎙 {text}\n\n_{timestamp()}_")
        await update.message.reply_text("Idee gespeichert.")
    except Exception as e:
        logger.error("Transkription fehlgeschlagen: %s", e)
        await update.message.reply_text("Transkription fehlgeschlagen. Prüfe deinen OpenAI Key.")
    finally:
        if os.path.exists(path):
            os.remove(path)


async def post_idea(context, text):
    await context.bot.send_message(chat_id=CHANNEL_ID, text=text, parse_mode="Markdown")


async def error_handler(update, context):
    logger.error("Fehler: %s", context.error)


def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_TOKEN fehlt in .env")
    if not CHANNEL_ID:
        raise ValueError("CHANNEL_ID fehlt in .env")

    app = Application.builder().token(TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_error_handler(error_handler)
    logger.info("Ideen Bot läuft...")
    app.run_polling()


if __name__ == "__main__":
    main()
