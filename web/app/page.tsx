"use client";

import { useState, useRef, useEffect } from "react";

type Role = "user" | "assistant";
type Step = "describe" | "confirm" | "tier" | "form" | "done";

interface Message { role: Role; content: string; }
interface FormData { email: string; telegramToken: string; botName: string; }

const TIERS = [
  { id: "gcloud",  label: "Google Cloud",         desc: "24/7 auf Google Cloud VM. Einmalige Einrichtung — danach für immer kostenlos.", price: "€1,90 einmalig", requiresPC: true },
  { id: "render",  label: "Render.com",           desc: "Einfachstes Hosting, automatisches Deploy.",                                    price: "€9,99 einmalig", requiresPC: false },
  { id: "hetzner", label: "Hetzner + Claude CLI", desc: "Volle Power: eigener Server + Claude CLI.",                                     price: "~€4/Monat",     requiresPC: true },
];

const WELCOME = "Willkommen bei BotShell.\n\nBeschreibe in einem Satz was dein Telegram Bot tun soll — ich kümmere mich um den Rest.";

function extractBotName(summary: string): string {
  const match = summary.toLowerCase().match(/(?:ein|einen|meinen?)\s+(\w{4,})\s+bot/);
  if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1) + " Bot";
  const words = summary.split(/\s+/).filter(w => w.length > 5 && !/^(einen?|meinen?|soll|der|die|das|und|für|ich|will|dass)$/i.test(w));
  if (words.length > 0) return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() + " Bot";
  return "Mein Bot";
}

function GroqTutorialModal({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: 1, text: <>Gehe zu <span className="text-blue-400 font-mono">console.groq.com</span> und klicke auf <strong>Sign Up</strong></> },
    { n: 2, text: <>Anmelden mit <strong>Google</strong> oder E-Mail — kostenlos, keine Kreditkarte</> },
    { n: 3, text: <>Im linken Menü auf <strong>API Keys</strong> klicken</> },
    { n: 4, text: <>Auf <strong>Create API Key</strong> klicken, Namen eingeben (z.B. "BotShell")</> },
    { n: 5, text: <>Key kopieren — beginnt mit <span className="font-mono text-green-400 text-xs">gsk_</span> — und hier einfügen</> },
  ];
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-[#e6edf3] mb-1">Groq API Key erstellen</div>
        <div className="text-xs text-gray-500 mb-5">Kostenlos — keine Kreditkarte nötig</div>
        <ol className="space-y-4">
          {steps.map(s => (
            <li key={s.n} className="flex gap-3 text-sm text-gray-300">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
          className="mt-5 block w-full text-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
          Zu Groq öffnen →
        </a>
        <button onClick={onClose} className="mt-2 w-full text-xs text-gray-600 hover:text-gray-400 py-1">Schließen</button>
      </div>
    </div>
  );
}

function BotFatherModal({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: 1, text: <>Öffne Telegram, suche nach <span className="text-blue-400 font-mono">@BotFather</span></> },
    { n: 2, text: <>Schicke den Befehl <span className="font-mono bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">/newbot</span></> },
    { n: 3, text: <>Wähle einen <strong>Namen</strong> (z.B. <span className="italic">Mein Ideen Bot</span>)</> },
    { n: 4, text: <>Wähle einen <strong>Benutzernamen</strong> — muss auf <span className="font-mono bg-[#0d1117] px-1.5 py-0.5 rounded text-xs">bot</span> enden</> },
    { n: 5, text: <>Token kopieren: <span className="font-mono text-xs text-green-400">1234567890:AAH...</span> — und hier einfügen</> },
  ];
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-[#e6edf3] mb-1">Telegram Bot Token erstellen</div>
        <div className="text-xs text-gray-500 mb-5">via @BotFather — dauert 1 Minute</div>
        <ol className="space-y-4">
          {steps.map(s => (
            <li key={s.n} className="flex gap-3 text-sm text-gray-300">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
          Verstanden
        </button>
      </div>
    </div>
  );
}

// ── Chat-Kern (eigene Komponente — key-Reset zerstört alles sauber) ────────
function Chat({ groqKey, onChangeKey }: { groqKey: string; onChangeKey: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("describe");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ email: "", telegramToken: "", botName: "" });
  const [showTiers, setShowTiers] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [botSummary, setBotSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showBotFatherModal, setShowBotFatherModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function copyInstructions() {
    const last = messages.filter(m => m.role === "assistant").at(-1);
    if (!last) return;
    await navigator.clipboard.writeText(last.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
        body: JSON.stringify({ messages: newMessages, step, botSummary, groqKey }),
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
      setMessages(prev => [...prev, { role: "assistant", content: "Verbindungsfehler. Bitte erneut versuchen." }]);
    } finally { setLoading(false); }
  }

  function advanceStep(currentStep: Step, userInput: string) {
    if (currentStep === "describe") {
      setBotSummary(userInput);
      setForm(prev => ({ ...prev, botName: extractBotName(userInput) }));
      setStep("confirm");
    } else if (currentStep === "confirm") {
      setStep("tier");
      setShowTiers(true);
    }
  }

  function selectTier(tierId: string) {
    setSelectedTier(tierId);
    setShowTiers(false);
    setShowForm(true);
    setStep("form");
    const label = TIERS.find(t => t.id === tierId)?.label ?? tierId;
    setMessages(prev => [...prev,
      { role: "user", content: `Ich wähle: ${label}` },
      { role: "assistant", content: "Füll das Formular aus — dann geht's los." },
    ]);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, form: { ...form, groqKey }, botSummary }),
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

  return (
    <>
      {showBotFatherModal && <BotFatherModal onClose={() => setShowBotFatherModal(false)} />}
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center justify-between mb-6">
          <div className="text-xl font-bold tracking-tight">Bot<span className="text-blue-400">Shell</span></div>
          <div className="flex items-center gap-4">
            {step !== "done" && (
              <button onClick={() => { window.location.reload(); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Neu starten
              </button>
            )}
            <button onClick={onChangeKey} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Key ändern
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-[#161b22] border border-[#30363d] text-[#e6edf3]"
              }`}>{msg.content}</div>
              {step === "done" && msg.role === "assistant" && i === messages.length - 1 && (
                <button onClick={copyInstructions} className="mt-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  {copied ? "Kopiert!" : "Anleitung kopieren"}
                </button>
              )}
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
                  <button key={tier.id} onClick={() => !disabled && selectTier(tier.id)} disabled={disabled}
                    className={`w-full text-left rounded-xl p-4 transition-colors border ${
                      disabled ? "bg-[#0d1117] border-[#21262d] opacity-40 cursor-not-allowed"
                             : "bg-[#161b22] border-[#30363d] hover:border-blue-400"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#e6edf3]">{tier.label}</span>
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
                { label: "Bot Name",           key: "botName",       placeholder: "z.B. Mein Ideen Bot", type: "text" },
                { label: "E-Mail",             key: "email",         placeholder: "deine@email.de",       type: "email" },
                { label: "Telegram Bot Token", key: "telegramToken", placeholder: "1234567890:AAH...",    type: "text", mono: true, hint: "Erstellen via @BotFather →" },
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
                      className="text-xs text-blue-400 hover:underline mt-1 text-left">{f.hint}</button>
                  )}
                </div>
              ))}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                {selectedTier === "gcloud" ? "Weiter zur Zahlung (€1,90)" : selectedTier === "render" ? "Weiter zur Zahlung (€9,99)" : "Bot erstellen"}
              </button>
            </form>
          )}

          {step === "done" && (
            <button onClick={() => window.location.reload()}
              className="w-full mt-2 border border-[#30363d] hover:border-blue-400 text-gray-400 hover:text-[#e6edf3] rounded-xl py-3 text-sm transition-colors">
              Neuen Bot erstellen
            </button>
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
    </>
  );
}

// ── Root: verwaltet nur den Groq Key ─────────────────────────────────────
export default function Home() {
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [groqKeyConfirmed, setGroqKeyConfirmed] = useState(false);
  const [showGroqTutorial, setShowGroqTutorial] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  function handleChangeKey() {
    setGroqKeyConfirmed(false);
    setGroqKeyInput("");
  }

  if (!groqKeyConfirmed) {
    return (
      <>
        {showGroqTutorial && <GroqTutorialModal onClose={() => setShowGroqTutorial(false)} />}
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="text-2xl font-bold tracking-tight mb-1">Bot<span className="text-blue-400">Shell</span></div>
          <div className="text-sm text-gray-500 mb-2">Telegram Bots in unter 10 Minuten</div>
          <div className="text-xs text-gray-600 text-center max-w-xs mb-10 leading-relaxed">
            Beschreibe deinen Bot — wir generieren den Code, richten den Server ein und du bist fertig.
          </div>
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Groq API Key</label>
              <button onClick={() => setShowGroqTutorial(true)} className="text-xs text-blue-400 hover:underline">
                Wie bekomme ich einen Key? →
              </button>
            </div>
            <input
              className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 text-sm font-mono text-[#e6edf3] focus:outline-none focus:border-blue-400 mb-3"
              placeholder="gsk_..."
              value={groqKeyInput}
              onChange={e => setGroqKeyInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && groqKeyInput.startsWith("gsk_") && setGroqKeyConfirmed(true)}
              autoFocus
            />
            <button onClick={() => setGroqKeyConfirmed(true)} disabled={!groqKeyInput.startsWith("gsk_")}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-semibold transition-colors">
              Los geht's
            </button>
          </div>
        </div>
      </>
    );
  }

  return <Chat key={chatKey} groqKey={groqKeyInput} onChangeKey={handleChangeKey} />;
}
