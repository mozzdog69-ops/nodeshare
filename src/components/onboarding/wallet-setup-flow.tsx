"use client";

import { useWalletSession } from "@/context/wallet-session";
import { generateNodeIdentity } from "@/lib/wallet/node-identity";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Step = 1 | 2 | 3;

export function WalletSetupFlow() {
  const router = useRouter();
  const { hydrated, hasVault, saveVaultAndUnlock } = useWalletSession();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [eth, setEth] = useState("");
  const [akt, setAkt] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (hasVault) router.replace("/login");
  }, [hydrated, hasVault, router]);

  const createIdentity = useCallback(async () => {
    setBusy(true);
    try {
      const id = await generateNodeIdentity();
      setEth(id.ethAddress);
      setAkt(id.aktAddress);
      setMnemonic(id.mnemonic);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }, []);

  const finish = useCallback(async () => {
    setVaultError(null);
    setBusy(true);
    try {
      await saveVaultAndUnlock({
        mnemonic,
        ethAddress: eth,
        aktAddress: akt,
      });
      setMnemonic("");
      setEth("");
      setAkt("");
      router.push("/app/dashboard");
    } catch {
      setVaultError("Could not save encrypted wallet. Try again.");
    } finally {
      setBusy(false);
    }
  }, [mnemonic, eth, akt, saveVaultAndUnlock, router]);

  if (!hydrated) {
    return (
      <div className="mx-auto flex max-w-lg justify-center py-16 text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  if (hasVault) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-text-muted">
        You already have a wallet on this device. Redirecting to login…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 flex justify-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div
            key={s}
            className={`h-1.5 w-10 rounded-full transition-colors ${
              s <= step ? "bg-accent" : "bg-border-strong"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Step 1
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  Create Node Identity
                </h1>
                <p className="text-sm text-text-secondary">
                  Generates an Ethereum wallet and an Akash (AKT) address from one
                  recovery phrase — same flow as pairing a secure device.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-base px-4 py-3">
                  <motion.span
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted"
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2 }}
                  >
                    <span className="text-lg">🔐</span>
                  </motion.span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Key generation
                    </p>
                    <p className="text-xs text-text-muted">
                      Entropy → BIP39 → secp256k1 (client-side only)
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full py-3 text-base"
                  disabled={busy}
                  onClick={() => void createIdentity()}
                >
                  {busy ? "Generating…" : "Generate wallets"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Step 2
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  Back up your phrase
                </h1>
                <p className="text-sm text-text-secondary">
                  Write these words offline. Anyone with this phrase controls your
                  nodes and funds.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-accent/25 bg-accent-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    Recovery phrase
                  </p>
                  <p className="mt-2 font-mono text-sm leading-relaxed text-text-primary">
                    {mnemonic}
                  </p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-base p-4 text-sm">
                  <p className="text-xs font-medium text-text-muted">ETH</p>
                  <p className="mt-1 break-all font-mono text-xs">{eth}</p>
                  <p className="mt-3 text-xs font-medium text-text-muted">AKT</p>
                  <p className="mt-1 break-all font-mono text-xs">{akt}</p>
                </div>
                <Button className="w-full" onClick={() => setStep(3)}>
                  I&apos;ve backed it up securely
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Card>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Step 3
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  Save vault on this device
                </h1>
                <p className="text-sm text-text-secondary">
                  Your recovery phrase alone encrypts the local copy (PBKDF2 + AES-GCM).
                  There is no separate device password — to return later, use the same
                  phrase on the login screen.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {vaultError ? (
                  <p className="text-sm text-red-600">{vaultError}</p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={busy}
                    onClick={() => void finish()}
                  >
                    {busy ? "Saving…" : "Save vault & enter console"}
                  </Button>
                  <Link
                    href="/"
                    className="inline-flex flex-1 items-center justify-center rounded-[10px] border border-border-strong bg-surface-elevated px-4 py-2.5 text-center text-sm font-medium text-text-primary transition-all hover:border-accent/30 hover:bg-white hover:shadow-card"
                  >
                    Back home
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
