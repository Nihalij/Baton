import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baton · Knowledge handover",
  description: "Turn scattered project activity into a verified, permission-aware handover.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Prebuilt stylesheet: keeps the app styled even if the CSS build step is skipped */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/baton.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
