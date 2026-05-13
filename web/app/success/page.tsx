"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SessionData {
  tier: string;
  botName: string;
}

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    fetch(`/api/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

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

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">

      <div className="w-12 h-12 rounded-full bg-green-600/20 border border-green-600/40 flex items-center justify-center mx-auto mb-6">
        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-[#e6edf3] mb-1">Zahlung erfolgreich!</h1>
      {data?.botName && (
        <p className="text-sm text-gray-500 mb-10">Bot: <span className="text-[#e6edf3]">{data.botName}</span></p>
      )}

      {sessionId && (
        <div className="space-y-6">
          <a
            href={`/api/setup-script?session_id=${sessionId}`}
            download
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 text-sm font-semibold transition-colors">
            Setup-Script herunterladen
          </a>

          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-left">
            <div className="text-xs text-gray-500 mb-2">Dann einmal ausführen:</div>
            <pre className="text-sm text-green-400 font-mono">python setup-botshell.py</pre>
          </div>

          <p className="text-xs text-gray-600">
            Das Script installiert alles automatisch. Python muss installiert sein.
          </p>
        </div>
      )}

      <a href="/" className="inline-block mt-10 text-sm text-gray-600 hover:text-gray-400 transition-colors">
        Neuen Bot erstellen
      </a>
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
