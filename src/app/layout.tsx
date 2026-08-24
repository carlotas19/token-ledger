import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Token Ledger — AI Gateway token economics benchmark",
  description:
    "A public benchmark that measures how many tokens each AI Gateway model spends to resolve a support ticket, and what that costs per successful outcome.",
  openGraph: {
    title: "Token Ledger",
    description:
      "Token economics for production AI: cost per successful task across the Neon AI Gateway catalog.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
