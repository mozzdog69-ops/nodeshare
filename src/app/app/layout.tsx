import { WalletGate } from "@/components/auth/wallet-gate";
import { AppShell } from "@/components/layout/app-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Console",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletGate>
      <AppShell>{children}</AppShell>
    </WalletGate>
  );
}
