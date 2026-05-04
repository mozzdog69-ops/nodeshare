import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { WalletSetupFlow } from "@/components/onboarding/wallet-setup-flow";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wallet setup",
};

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base px-6 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-6">
          <NodeShareLogo size="nav" href="/" />
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-text-muted transition-colors hover:text-text-secondary"
        >
          ← NodeShare
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">
          Welcome to your compute identity
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          Three calm steps — like onboarding a phone. No noise, no casino UI.
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-text-muted">
          Already created a wallet?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in with your recovery phrase
          </Link>
        </p>
      </div>
      <WalletSetupFlow />
    </div>
  );
}
