"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SessionData {
  tier: string;
  botName: string;
  telegramToken: string;
  groqKey: string;
  botSummary: string;
}

function getSetupCommand(data: SessionData): string {
  if (data.tier === "gcloud") {
    return `BOTSHELL_TOKEN="${data.telegramToken}" GROQ_API_KEY="${data.groqKey}" BOT_NAME="${data.botName}" bash <(curl -fsSL https://gidjin4-svg.github.io/botshell/setup-gcloud.sh)`;
  }
  if (data.tier === "render") {
    return `BOTSHELL_TOKEN="${data.telegramToken}" GROQ_API_KEY="${data.groqKey}" BOT_NAME="${data.botName}" bash <(curl -fsSL https://gidjin4-svg.github.io/botshell/setup-render.sh)`;
  }
  return "";
}

function getSteps(tier: string): string[] {
  if (tier === "gcloud") return [
    "Google Account oeffnen: cloud.google.com - Kostenlos starten",
    "Compute Engine - VM-Instanzen - Erstellen - e2-micro - Ubuntu 22.04 (Region: us-central1)",
    "VM starten - in der Zeile auf SSH klicken (Browser-Terminal oeffnet sich)",
    "Den Befehl unten kopieren, einfuegen und Enter druecken",
    "Fertig - dein Bot laeuft 24/7, auch wenn dein PC aus ist",
  ];
  if (tier === "render") return [
    "render.com oeffnen - kostenlosen Account erstellen",
    "New + - Web Service auswaehlen",
    "Den Befehl unten kopieren und als Start-Command einfuegen",
    "Deploy starten - dauert ca. 2 Minuten",
    "Fertig - dein Bot laeuft auf Render",
  ];
  return [];
}

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    fetch(`/api/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(getSetupCommand(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-1">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const steps = data ? getSteps(data.tier) : [];
  const command = data ? getSetupCommand(data) : "";

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-green-600/20 border border-green-600/40 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#e6edf3] mb-1">Zahlung erfolgreich!</h1>
        {data && (
          <p className="text-sm text-gray-500">Bot: <span className="text-[#e6edf3]">{data.botName}</span></p>
        )}
      </div>

      {steps.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Naechste Schritte</div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-[#8b949e]">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {command && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Setup-Befehl</span>
            <button onClick={copy} className="text-xs text-blue-400 hover:underline transition-colors">
              {copied ? "Kopiert!" : "Kopieren"}
            </button>
          </div>
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{command}</pre>
        </div>
      )}

      <div className="text-center">
        <a href="/" className="text-sm text-blue-400 hover:underline">Neuen Bot erstellen</a>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
