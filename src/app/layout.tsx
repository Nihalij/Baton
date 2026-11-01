import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baton · Knowledge handover",
  description: "Turn scattered project activity into a verified, permission-aware handover.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
