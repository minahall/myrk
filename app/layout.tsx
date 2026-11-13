import type { Metadata } from "next";
import "./globals.css";
import Fog from "@/components/background/Fog";
import Grain from "@/components/background/Grain";
import GhostCursor from "@/components/background/GhostCursor";

export const metadata: Metadata = {
  title: "Myrk. Tell the truth. Leave no trace.",
  description:
    "Anonymous tips through three relays that each know only a third of the story. Only the journalist can read them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Fog />
        <Grain />
        <GhostCursor />
        {children}
      </body>
    </html>
  );
}
