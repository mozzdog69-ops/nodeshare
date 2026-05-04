import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WalletSessionProvider } from "@/context/wallet-session";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NodeShare — Decentralized AI Compute",
    template: "%s · NodeShare",
  },
  description:
    "Rent GPUs, run AI in a terminal, pay with crypto. A decentralized compute operating system for serious workloads.",
  keywords: [
    "Akash",
    "GPU",
    "AI compute",
    "decentralized cloud",
    "Web3",
    "terminal",
  ],
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletSessionProvider>{children}</WalletSessionProvider>
      </body>
    </html>
  );
}
