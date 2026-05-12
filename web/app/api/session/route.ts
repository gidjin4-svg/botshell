import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Keine session_id" }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const meta = session.metadata ?? {};
    return NextResponse.json({
      tier:          meta.tier,
      botName:       meta.botName,
      telegramToken: meta.telegramToken,
      groqKey:       meta.groqKey,
      botSummary:    meta.botSummary,
    });
  } catch {
    return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  }
}
