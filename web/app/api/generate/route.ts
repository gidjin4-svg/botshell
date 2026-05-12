import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_placeholder");
}

function generateBotCode(botSummary: string, tier: string, form: { botName: string; groqKey: string; telegramToken: string }): string {
  const useGroq = tier === "free" || tier === "oracle";

  return `import os
import logging
${useGroq ? "from groq import Groq" : "import anthropic"}
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, MessageHandler, CommandHandler, filters, ContextTypes

load_dotenv()
TOKEN = os.getenv("TELEGRAM_TOKEN")
${useGroq ? 'GROQ_KEY = os.getenv("GROQ_API_KEY")' : 'ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")'}

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot-Beschreibung: ${botSummary}
# Bot-Name: ${form.botName}
# Tier: ${tier}

${useGroq ? `client = Groq(api_key=GROQ_KEY)

def ask_ai(message: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "Du bist ${form.botName}, ein hilfreicher Telegram-Bot. ${botSummary}"},
            {"role": "user", "content": message}
        ],
        max_tokens=512,
    )
    return response.choices[0].message.content` : `client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

def ask_ai(message: str) -> str:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system="Du bist ${form.botName}, ein hilfreicher Telegram-Bot. ${botSummary}",
        messages=[{"role": "user", "content": message}]
    )
    return response.content[0].text`}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"Hallo! Ich bin ${form.botName}.\\n${botSummary}\\n\\nWie kann ich dir helfen?"
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_msg = update.message.text
    await update.message.chat.send_action("typing")
    try:
        response = ask_ai(user_msg)
        await update.message.reply_text(response)
    except Exception as e:
        logger.error("AI Fehler: %s", e)
        await update.message.reply_text("Fehler beim Verarbeiten. Bitte erneut versuchen.")

async def error_handler(update, context):
    logger.error("Fehler: %s", context.error)

def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_TOKEN fehlt in .env")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.add_error_handler(error_handler)
    logger.info("${form.botName} läuft...")
    app.run_polling()

if __name__ == "__main__":
    main()
`;
}

function getInstructions(tier: string, form: { telegramToken: string; groqKey: string; botName: string }, botSummary: string): string {
  const botCode = generateBotCode(botSummary, tier, form);
  const encodedCode = Buffer.from(botCode).toString("base64");

  if (tier === "free") {
    return `Dein Bot ist fertig! Hier sind deine nächsten Schritte:

1. Lade das Setup-Paket herunter (Link wird per E-Mail geschickt)
2. Entpacke es auf deinem PC
3. Führe setup-lokal.bat (Windows) oder setup-lokal.sh (Mac/Linux) aus
4. Dein Bot läuft — solange dein PC an ist

Bot-Name: ${form.botName}
Was er kann: ${botSummary}

Wichtig: Dein PC muss an bleiben damit der Bot funktioniert. Für 24/7-Betrieb empfehlen wir Oracle (einmalig €9,99).`;
  }

  if (tier === "hetzner") {
    return `Dein Bot ist fertig! Für den Hetzner-Tier brauchst du:

1. Hetzner Account erstellen → hetzner.com (CAX11, ~€4/Monat)
2. Ubuntu 22.04 VM anlegen
3. Diesen Befehl in deiner VM ausführen:

BOTSHELL_TOKEN="${form.telegramToken}" bash <(curl -fsSL https://gidjin4-svg.github.io/botshell/setup.sh)

4. Claude CLI installieren: npm install -g @anthropic-ai/claude-code
5. claude auth (einmalig, braucht Claude Pro/Max Abo)

Bot-Name: ${form.botName}
Was er kann: ${botSummary}

Dein Bot wird dann über Telegram steuerbar sein.`;
  }

  return `Danke für deine Zahlung! Dein Bot wird jetzt eingerichtet.

Du bekommst per E-Mail:
- Den fertigen Bot-Code
- Eine Schritt-für-Schritt Anleitung für Oracle
- Den Setup-Befehl mit allem vorbereitet

Bot-Name: ${form.botName}
Was er kann: ${botSummary}`;
}

export async function POST(req: NextRequest) {
  const { tier, form, botSummary } = await req.json();

  if (tier === "oracle" || tier === "gcloud" || tier === "render") {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: `BotShell — ${form.botName}`, description: botSummary },
          unit_amount: 999,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}&tier=oracle`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}`,
      metadata: {
        tier,
        botName: form.botName,
        email: form.email,
        telegramToken: form.telegramToken,
        groqKey: form.groqKey,
        botSummary: botSummary.slice(0, 500),
      },
    });
    return NextResponse.json({ checkoutUrl: session.url });
  }

  const instructions = getInstructions(tier, form, botSummary);
  return NextResponse.json({ instructions });
}
