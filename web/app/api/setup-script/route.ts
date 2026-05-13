import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
}

function generateScript(botName: string, telegramToken: string, groqKey: string, botSummary: string): string {
  return `#!/usr/bin/env python3
# BotShell Setup — ${botName}
# Fuehrt automatisch aus: Google Cloud VM erstellen + Bot installieren

import subprocess
import sys
import time
import os

BOT_NAME      = "${botName}"
TELEGRAM_TOKEN = "${telegramToken}"
GROQ_API_KEY  = "${groqKey}"
BOT_SUMMARY   = "${botSummary.replace(/"/g, '\\"')}"
VM_NAME       = "botshell-${botName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}"
ZONE          = "us-central1-a"
MACHINE_TYPE  = "e2-micro"
IMAGE_FAMILY  = "ubuntu-2204-lts"
IMAGE_PROJECT = "ubuntu-os-cloud"

STARTUP_SCRIPT = f"""#!/bin/bash
apt-get update -q
apt-get install -y python3 python3-pip python3-venv curl
mkdir -p /opt/botshell && cd /opt/botshell
python3 -m venv venv
cat > requirements.txt << 'REQ'
python-telegram-bot==21.6
python-dotenv==1.0.1
groq==0.11.0
REQ
./venv/bin/pip install -r requirements.txt -q
curl -fsSL https://raw.githubusercontent.com/gidjin4-svg/botshell/main/templates/groq_agent_bot.py -o bot.py
cat > .env << 'ENV'
TELEGRAM_TOKEN={TELEGRAM_TOKEN}
GROQ_API_KEY={GROQ_API_KEY}
BOT_NAME={BOT_NAME}
BOT_PURPOSE={BOT_SUMMARY}
ENV
chmod 600 .env
cat > /etc/systemd/system/botshell.service << 'SVC'
[Unit]
Description=BotShell Telegram Bot
After=network.target
[Service]
WorkingDirectory=/opt/botshell
ExecStart=/opt/botshell/venv/bin/python bot.py
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload
systemctl enable botshell
systemctl start botshell
"""

def run(cmd, check=True):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"  Fehler: {{result.stderr.strip()}}")
        sys.exit(1)
    return result

def step(n, text):
    print(f"\\n[{{n}}/5] {{text}}")
    time.sleep(0.5)

print("=" * 50)
print(f"  BotShell Setup — {{BOT_NAME}}")
print("=" * 50)

# Schritt 1: gcloud pruefen
step(1, "gcloud CLI pruefen...")
r = run("gcloud version", check=False)
if r.returncode != 0:
    print("  gcloud CLI nicht gefunden.")
    print("  Installieren: https://cloud.google.com/sdk/docs/install")
    sys.exit(1)
print("  gcloud gefunden.")

# Schritt 2: Login
step(2, "Google Account anmelden (Browser oeffnet sich)...")
run("gcloud auth login --quiet")
print("  Angemeldet.")

# Schritt 3: Projekt setzen
step(3, "Aktives Projekt pruefen...")
r = run("gcloud config get-value project", check=False)
project = r.stdout.strip()
if not project or project == "(unset)":
    print("  Kein Projekt aktiv. Bitte Projekt-ID eingeben:")
    project = input("  Projekt-ID: ").strip()
    run(f"gcloud config set project {{project}}")
print(f"  Projekt: {{project}}")

# Schritt 4: VM erstellen
step(4, f"VM erstellen ({{VM_NAME}})...")
startup_file = "/tmp/botshell_startup.sh"
with open(startup_file, "w") as f:
    f.write(STARTUP_SCRIPT)

r = run(
    f'gcloud compute instances create {{VM_NAME}} '
    f'--zone={{ZONE}} '
    f'--machine-type={{MACHINE_TYPE}} '
    f'--image-family={{IMAGE_FAMILY}} '
    f'--image-project={{IMAGE_PROJECT}} '
    f'--metadata-from-file=startup-script={{startup_file}} '
    f'--tags=botshell '
    f'--quiet',
    check=False
)
if r.returncode != 0:
    print(f"  Fehler beim Erstellen: {{r.stderr.strip()}}")
    sys.exit(1)
print(f"  VM erstellt.")

# Schritt 5: Warten
step(5, "Bot startet (ca. 60 Sekunden)...")
for i in range(12):
    time.sleep(5)
    print(f"  Warte... {{(i+1)*5}}s", end="\\r")
print()

print()
print("=" * 50)
print(f"  Fertig! {{BOT_NAME}} laeuft 24/7.")
print(f"  Teste deinen Bot in Telegram.")
print("=" * 50)
`;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Keine session_id" }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const meta = session.metadata ?? {};

    const script = generateScript(
      meta.botName ?? "Mein Bot",
      meta.telegramToken ?? "",
      meta.groqKey ?? "",
      meta.botSummary ?? "",
    );

    const filename = `setup-${(meta.botName ?? "bot").toLowerCase().replace(/[^a-z0-9]/g, "-")}.py`;

    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  }
}
