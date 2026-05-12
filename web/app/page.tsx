"use client";

import { useState, useRef, useEffect } from "react";

type Role = "user" | "assistant";
type Step = "describe" | "confirm" | "audit" | "explain" | "tier" | "form" | "done";

interface Message { role: Role; content: string; }
interface FormData { email: string; telegramToken: string; botName: string; }

function BotFatherModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-[#e6edf3] mb-4">Telegram Bot Token erstellen</div>
        <ol className="space-y-3 text-sm text-gray-300">
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">1.</span>
            <span>Öffne Telegram und suche nach <span className="text-blue-400 font-mono">@BotFather</span></span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">2.</span>
            <span>Schicke dem Bot den Befehl <span className="font-mono bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">/newbot</span></span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">3.</span>
            <span>Wähle einen <strong>Namen</strong> für deinen Bot (z.B. <span className="italic">Mein Ideen Bot</span>)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">4.</span>
            <span>Wähle einen <strong>Benutzernamen</strong> — muss auf <span className="font-mono bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">bot</span> enden (z.B. <span className="italic">mein_ideen_bot</span>)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">5.</span>
            <span>BotFather schickt dir deinen Token — sieht so aus:<br /><span className="font-mono text-xs text-green-400">1234567890:AAH...</span><br />Kopiere ihn und füge ihn oben ein.</span>
          </li>
        </ol>
        <button onClick={onClose} className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
          Verstanden
        </button>
      </div>
    </div>
  );
}

const TIERS = [
  { id: "gcloud",  label: "Google Cloud",         desc: "24/7 auf Google Cloud VM. Einmalige Einrichtung — danach für immer kostenlos.", price: "€1,90 einmalig", requiresPC: true },
  { id: "render",  label: "Render.com",           desc: "Einfachstes Hosting, automatisches Deploy.",                                    price: "€9,99 einmalig", requiresPC: false },
  { id: "hetzner", label: "Hetzner + Claude CLI", desc: "Volle Power: eigener Server + Claude CLI.",                                     price: "~€4/Monat",     requiresPC: true },
];

export default function Home() {
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [groqKeyConfirmed, setGroqKeyConfirmed] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("describe");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ email: "", telegramToken: "", botName: "" });
  const [showTiers, setShowTiers] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBotFatherModal, setShowBotFatherModal] = useState(false);
  const [botSummary, setBotSummary] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (groqKeyConfirmed) {
      setMessages([{ role: "assistant", content: "Willkommen bei BotShell.\n\nBeschreibe in einem Satz was dein Telegram Bot tun soll — ich kümmere mich um den Rest." }]);
    }
  }, [groqKeyConfirmed]);

  async function send(overrideInput?: string) {
    const text = (overrideInput ?? input).trim();
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, step, botSummary, groqKey: groqKeyInput }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: aiText }; return u; });
      }
      advanceStep(step, text);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Verbindungsfehler. Bitte neu laden." }]);
    } finally { setLoading(false); }
  }

  function advanceStep(currentStep: Step, userInput: string) {
    if (currentStep === "describe") { setBotSummary(userInput); setStep("confirm"); }
    else if (currentStep === "confirm") setStep("audit");
    else if (currentStep === "audit") setStep("explain");
    else if (currentStep === "explain") { setStep("tier"); setShowTiers(true); }
  }

  function selectTier(tierId: string) {
    setSelectedTier(tierId);
    setShowTiers(false);
    setShowForm(true);
    setStep("form");
    const label = TIERS.find(t => t.id === tierId)?.label ?? tierId;
    const msg = tierId === "hetzner"
      ? "Volle Power! Du brauchst einen Hetzner Account und ein Claude Abo."
      : `${label} — fülle das Formular aus. Du bekommst deinen Setup-Befehl per E-Mail.`;
    setMessages(prev => [...prev,
      { role: "user", content: `Ich wähle: ${label}` },
      { role: "assistant", content: msg },
    ]);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, form: { ...form, groqKey: groqKeyInput }, botSummary }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setStep("done");
        setShowForm(false);
        setMessages(prev => [...prev, { role: "assistant", content: data.instructions }]);
      }
    } catch { alert("Fehler. Bitte erneut versuchen."); }
    finally { setLoading(false); }
  }

  // ── Groq Key eingeben ─────────────────────────────────────────────────────
  if (!groqKeyConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className="text-2xl font-bold tracking-tight mb-1">Bot<span className="text-blue-400">Shell</span></div>
        <div className="text-sm text-gray-500 mb-10">Telegram Bots in unter 10 Minuten</div>

        <div className="w-full max-w-sm">
          <div className="text-xs text-gray-500 mb-3">
            Groq ist kostenlos. Key erstellen unter:
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline ml-1">console.groq.com/keys →</a>
          </div>
          <input
            className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 text-sm font-mono text-[#e6edf3] focus:outline-none focus:border-blue-400 mb-3"
            placeholder="gsk_..."
            value={groqKeyInput}
            onChange={e => setGroqKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && groqKeyInput.startsWith("gsk_") && setGroqKeyConfirmed(true)}
            autoFocus
          />
          <button
            onClick={() => setGroqKeyConfirmed(true)}
            disabled={!groqKeyInput.startsWith("gsk_")}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-semibold transition-colors">
            Weiter
          </button>
        </div>
      </div>
    );
  }

  // ── Haupt-Chat ────────────────────────────────────────────────────────────
  return (<>
    {showBotFatherModal && <BotFatherModal onClose={() => setShowBotFatherModal(false)} />}
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-2xl font-bold tracking-tight mb-1">Bot<span className="text-blue-400">Shell</span></div>
        <div className="text-xs text-gray-600">Powered by Groq AI</div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === "user" ? "bg-blue-600 text-white" : "bg-[#161b22] border border-[#30363d] text-[#e6edf3]"
            }`}>{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {showTiers && (
          <div className="space-y-3">
            {isMobile && (
              <div className="text-xs text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                Einige Optionen erfordern einen PC zur Einrichtung und sind auf dem Handy deaktiviert.
              </div>
            )}
            {TIERS.map(tier => {
              const disabled = isMobile && tier.requiresPC;
              return (
                <button key={tier.id}
                  onClick={() => !disabled && selectTier(tier.id)}
                  disabled={disabled}
                  className={`w-full text-left rounded-xl p-4 transition-colors border ${
                    disabled
                      ? "bg-[#0d1117] border-[#21262d] opacity-40 cursor-not-allowed"
                      : "bg-[#161b22] border-[#30363d] hover:border-blue-400"
                  }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm text-[#e6edf3]">{tier.label}</div>
                        {disabled && <span className="text-xs bg-[#30363d] text-gray-500 px-1.5 py-0.5 rounded">Nur PC</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{tier.desc}</div>
                    </div>
                    <div className="text-xs text-blue-400 font-semibold ml-4 whitespace-nowrap">{tier.price}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showForm && (
          <form onSubmit={submitForm} className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 space-y-4">
            {[
              { label: "Bot Name", key: "botName", placeholder: "z.B. Mein Ideen Bot", type: "text" },
              { label: "E-Mail", key: "email", placeholder: "deine@email.de", type: "email" },
              { label: "Telegram Bot Token", key: "telegramToken", placeholder: "1234567890:AAH...", type: "text", mono: true, hint: "Erstellen via @BotFather" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                <input required type={f.type}
                  className={`w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-blue-400 ${f.mono ? "font-mono" : ""}`}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof FormData]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
                {f.hint && (
                  <button type="button" onClick={() => setShowBotFatherModal(true)}
                    className="text-xs text-blue-400 hover:underline mt-1 text-left">
                    {f.hint}
                  </button>
                )}
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
              {selectedTier === "gcloud" ? "Weiter zur Zahlung (€1,90)" : selectedTier === "render" ? "Weiter zur Zahlung (€9,99)" : "Bot erstellen"}
            </button>
          </form>
        )}

        <div ref={bottomRef} />
      </div>

      {step !== "tier" && step !== "form" && step !== "done" && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-[#e6edf3] placeholder-gray-600 focus:outline-none focus:border-blue-400"
            placeholder="Schreibe hier..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            disabled={loading}
            autoFocus
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-5 text-sm font-semibold transition-colors">
            Senden
          </button>
        </div>
      )}
    </div>
  </>);
}
