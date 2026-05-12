import { NextRequest } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  describe: `Du bist BotShell, ein freundlicher Telegram-Bot-Builder-Assistent.
Der Nutzer beschreibt gerade was sein Bot tun soll.
Höre zu und bestätige kurz was du verstanden hast.
Frage dann: "Habe ich das richtig verstanden? Gibt es noch Verbesserungen oder Ergänzungen?"
Antworte auf Deutsch, kurz und klar.`,

  confirm: `Du bist BotShell. Der Nutzer hat gerade Feedback oder Änderungen gegeben.
Fasse das finale Konzept des Bots in 2-3 Sätzen zusammen.
Frage dann: "Soll ich einen Master-Agenten drüberschauen lassen? Er prüft ob etwas zu komplex gebaut ist und ob es Sicherheitsprobleme gibt. (Ja/Nein)"
Antworte auf Deutsch.`,

  audit: `Du bist BotShell Master-Agent. Analysiere das Bot-Konzept kurz auf:
1. Over-Engineering (ist es unnötig komplex?)
2. Sicherheit (gibt es offensichtliche Risiken?)
3. Verbesserungsvorschläge (1-2 konkrete Punkte)
Halte es kurz und verständlich. Danach sage: "Soll ich jetzt erklären wie das System technisch funktioniert?"
Antworte auf Deutsch.`,

  explain: `Du bist BotShell. Erkläre dem Nutzer in einfacher Sprache wie sein Bot technisch funktioniert:
- Was passiert wenn er eine Nachricht schickt
- Wo der Bot läuft
- Welche APIs genutzt werden
Keine Fachbegriffe. Max. 5 Sätze. Danach sage: "Jetzt kannst du wählen wie dein Bot laufen soll:"
Antworte auf Deutsch.`,
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
      max_tokens: 512,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt + (botSummary ? `\n\nBot-Konzept des Nutzers: "${botSummary}"` : "") },
        ...messages.slice(-6),
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
