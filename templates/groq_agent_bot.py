import os
import logging
from groq import Groq
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

load_dotenv()
TOKEN = os.getenv("TELEGRAM_TOKEN")
GROQ_KEY = os.getenv("GROQ_API_KEY")
BOT_NAME = os.getenv("BOT_NAME", "BotShell Agent")
BOT_PURPOSE = os.getenv("BOT_PURPOSE", "ein hilfreicher Assistent")

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

client = Groq(api_key=GROQ_KEY)
chat_histories: dict = {}


def ask_groq(user_id: int, message: str) -> str:
    history = chat_histories.get(user_id, [])
    history.append({"role": "user", "content": message})
    history = history[-10:]  # max 10 Nachrichten Kontext

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": f"Du bist {BOT_NAME}, {BOT_PURPOSE}. Antworte kurz und hilfreich."},
            *history,
        ],
        max_tokens=512,
    )
    reply = response.choices[0].message.content
    history.append({"role": "assistant", "content": reply})
    chat_histories[user_id] = history
    return reply


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"Hallo! Ich bin {BOT_NAME}.\n{BOT_PURPOSE}\n\nWie kann ich dir helfen?"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    await update.message.chat.send_action("typing")
    try:
        reply = ask_groq(user_id, text)
        await update.message.reply_text(reply)
    except Exception as e:
        logger.error("Fehler: %s", e)
        await update.message.reply_text("Fehler. Bitte erneut versuchen.")


async def error_handler(update, context):
    logger.error("Bot-Fehler: %s", context.error)


def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_TOKEN fehlt in .env")
    if not GROQ_KEY:
        raise ValueError("GROQ_API_KEY fehlt in .env")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.add_error_handler(error_handler)
    logger.info("%s läuft...", BOT_NAME)
    app.run_polling()


if __name__ == "__main__":
    main()
