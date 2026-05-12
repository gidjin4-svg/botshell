import { NextRequest } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  describe: `Du bist BotShell, ein freundlicher Telegram-Bot-Builder-Assistent.
Der Nutzer beschreibt was sein Bot tun soll.
Fasse in 2-3 Sätzen zusammen was du verstanden hast.
Frage dann: "Habe ich das richtig verstanden? Oder soll ich etwas anpassen?"
Antworte auf Deutsch, kurz und klar.`,

  confirm: `Du bist BotShell. Der Nutzer hat bestätigt oder eine Korrektur gegeben.
Fasse das finale Bot-Konzept in 1-2 Sätzen zusammen.
Schließe mit genau diesem Satz: "Perfekt — wähle jetzt wie dein Bot laufen soll:"
Stelle keine weiteren Fragen. Antworte auf Deutsch.`,
};

export async function POST(req: NextRequest) {
  const { messages, step, botSummary, groqKey } = await req.json();

  if (!groqKey) {
    return new Response("Groq API Key fehlt.", { status: 400 });
  }

  const systemPrompt = SYSTEM_PROMPTS[step] ?? SYSTEM_PROMPTS.describe;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt + (botSummary ? `\n\nBot-Konzept: "${botSummary}"` : "") },
        ...messages.slice(-4),
      ],
    }),
  });

  if (!res.ok) {
    return new Response("Groq API Fehler. Prüfe deinen Key.", { status: 400 });
  }

  const encoder = new TextEncoder();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
