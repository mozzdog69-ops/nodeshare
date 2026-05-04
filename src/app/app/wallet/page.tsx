import { WalletAddresses } from "@/components/wallet/wallet-addresses";
import { LiveWalletPanel } from "@/components/wallet/live-wallet-panel";
import { Card, CardHeader } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
};

export default function WalletPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Wallet</h1>
      </header>
      <div className="space-y-6 p-6">
        <WalletAddresses />
        <LiveWalletPanel />
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">Akash & credits</h2>
            <p className="text-sm text-text-secondary">
              AKT balances and in-app credits will plug into the same Akash LCD / indexer
              you use for leases — not wired on-chain in this pass.
            </p>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
