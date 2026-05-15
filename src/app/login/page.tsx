"use client";

import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { useWalletSession } from "@/context/wallet-session";
import { deriveIdentityFromMnemonic } from "@/lib/wallet/node-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const {
    hydrated,
    status,
    hasVault,
    unlockWithMnemonic,
    saveVaultAndUnlock,
    destroyLocalWallet,
  } = useWalletSession();

  const [replaceMode, setReplaceMode] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replaceAck, setReplaceAck] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (status === "unlocked") router.replace("/app/dashboard");
  }, [hydrated, status, router]);

  const onSubmitPhrase = useCallback(async () => {
    setError(null);
    const trimmed = mnemonic.trim();
    if (!trimmed) {
      setError("Enter your recovery phrase.");
      return;
    }
    setBusy(true);
    try {
      if (hasVault) {
        await unlockWithMnemonic(trimmed);
      } else {
        const id = await deriveIdentityFromMnemonic(trimmed);
        await saveVaultAndUnlock(id);
      }
      router.push("/app/dashboard");
    } catch {
      setError(
        hasVault
          ? "Wrong recovery phrase or corrupted vault. Check your words."
          : "Invalid recovery phrase. Check word order and spelling.",
      );
    } finally {
      setBusy(false);
    }
  }, [mnemonic, hasVault, unlockWithMnemonic, saveVaultAndUnlock, router]);

  const onReplace = useCallback(() => {
    if (!replaceAck) {
      setError("Confirm that you understand this removes the current wallet from this device.");
      return;
    }
    setError(null);
    destroyLocalWallet();
    setMnemonic("");
    setReplaceAck(false);
    setReplaceMode(false);
  }, [replaceAck, destroyLocalWallet]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white px-6 py-12">
      <div className="fixed left-0 right-0 top-0 h-1 bg-accent" aria-hidden />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <NodeShareLogo size="nav" href="/" />
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-text-muted hover:text-text-secondary"
        >
          ← NodeShare
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">
          {replaceMode
            ? "Replace wallet on this device"
            : hasVault
              ? "Unlock with recovery phrase"
              : "Log in with recovery phrase"}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {replaceMode
            ? "Remove the encrypted vault, then you can import a different phrase."
            : hasVault
              ? "Your phrase is the only secret — nothing is sent to a server. Log out clears memory; the encrypted phrase stays in this browser until you remove it."
              : "12 or 24 English words. We will save an encrypted copy on this device so you can unlock again with the same phrase."}
        </p>

        {!replaceMode && (
          <Card className="mt-8">
            <CardHeader>
              <h2 className="text-sm font-semibold text-text-primary">
                Recovery phrase
              </h2>
              <p className="text-sm text-text-secondary">
                {hasVault
                  ? "Enter the same words you used when you created this vault."
                  : "Paste your phrase to create the vault on this device."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                rows={4}
                placeholder="word1 word2 word3 …"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="w-full resize-y rounded-[10px] border border-border-strong bg-white px-3 py-2.5 font-mono text-sm outline-none ring-accent/30 focus:ring-2"
              />
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <Button
                className="w-full"
                disabled={busy || !mnemonic.trim()}
                onClick={() => void onSubmitPhrase()}
              >
                {busy
                  ? "Working…"
                  : hasVault
                    ? "Unlock console"
                    : "Save encrypted vault & enter"}
              </Button>
              {hasVault ? (
                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-accent hover:underline"
                  onClick={() => {
                    setReplaceMode(true);
                    setError(null);
                  }}
                >
                  Use a different recovery phrase on this device
                </button>
              ) : null}
              {!hasVault ? (
                <p className="text-center text-sm text-text-muted">
                  New here?{" "}
                  <Link href="/onboarding" className="font-medium text-accent hover:underline">
                    Create a wallet
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {replaceMode && (
          <Card className="mt-8 border-red-200">
            <CardHeader>
              <h2 className="text-sm font-semibold text-red-700">
                Remove current vault
              </h2>
              <p className="text-sm text-text-secondary">
                This deletes the encrypted phrase from this browser. You will need a
                recovery phrase to use NodeShare again.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={replaceAck}
                  onChange={(e) => setReplaceAck(e.target.checked)}
                  className="mt-1 accent-accent"
                />
                <span>
                  I understand my current encrypted wallet will be deleted from this
                  device and I have my phrase backed up.
                </span>
              </label>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setReplaceMode(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="danger" className="flex-1" onClick={onReplace}>
                  Remove vault
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!replaceMode && hasVault ? (
          <p className="mt-8 text-center text-sm text-text-muted">
            New device?{" "}
            <Link href="/onboarding" className="font-medium text-accent hover:underline">
              Create wallet
            </Link>{" "}
            or remove the vault above, then import another phrase.
          </p>
        ) : null}
      </div>
    </div>
  );
}
