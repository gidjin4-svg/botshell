"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const tier = params.get("tier");
  const [copied, setCopied] = useState(false);

  const steps = tier === "oracle" ? [
    { n: 1, text: "Google Account öffnen → cloud.google.com → Kostenlos starten" },
    { n: 2, text: "Compute Engine → VM-Instanzen → Erstellen → e2-micro → Ubuntu 22.04" },
    { n: 3, text: "Cloud Shell öffnen (Terminal-Icon oben rechts)" },
    { n: 4, text: "Den Befehl unten einfügen und Enter drücken" },
    { n: 5, text: "Fertig — dein Bot antwortet in Telegram" },
  ] : [];

  const command = "# Setup-Befehl wird per E-Mail gesendet";

  function copy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">✓</div>
      <h1 className="text-xl font-bold text-[#e6edf3] mb-2">
        {tier === "oracle" ? "Zahlung erfolgreich!" : "Bot wird eingerichtet!"}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Schau in deine E-Mail — du bekommst deinen Setup-Befehl in wenigen Minuten.
      </p>

      {steps.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 text-left space-y-3 mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Nächste Schritte</div>
          {steps.map(s => (
            <div key={s.n} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-[#21262d] text-blue-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.n}
              </div>
              <div className="text-sm text-[#8b949e]">{s.text}</div>
            </div>
          ))}
        </div>
      )}

      <a href="/" className="text-sm text-blue-400 hover:underline">← Zurück zur Startseite</a>
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
