import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
}

function getSetupCommand(telegramToken: string, groqKey: string): string {
  return `BOTSHELL_TOKEN="${telegramToken}" GROQ_API_KEY="${groqKey}" bash <(curl -fsSL https://gidjin4-svg.github.io/botshell/setup-gcloud.sh)`;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return NextResponse.json({ error: "Webhook Fehler" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};

    const setupCommand = getSetupCommand(meta.telegramToken ?? "", meta.groqKey ?? "");

    // E-Mail senden (Resend oder SMTP — hier als Log, später implementieren)
    console.log(`[BotShell] Neuer Bot für ${meta.email}`);
    console.log(`Bot: ${meta.botName}`);
    console.log(`Setup-Befehl: ${setupCommand}`);

    // TODO: E-Mail mit setupCommand an meta.email senden
  }

  return NextResponse.json({ received: true });
}
