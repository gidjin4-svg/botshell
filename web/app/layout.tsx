import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BotShell — Telegram Bots leicht gemacht",
  description: "Beschreibe deinen Bot in einem Satz. Wir bauen ihn.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
