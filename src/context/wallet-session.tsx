"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NodeIdentity } from "@/lib/wallet/node-identity";
import { deriveIdentityFromMnemonic } from "@/lib/wallet/node-identity";
import { encryptMnemonic, decryptMnemonic } from "@/lib/wallet/vault-crypto";
import {
  clearVaultBlob,
  readVaultBlob,
  writeVaultBlob,
} from "@/lib/wallet/vault-storage";

export type WalletSessionStatus =
  | "loading"
  | "no_vault"
  | "locked"
  | "unlocked";

type WalletSessionContextValue = {
  hydrated: boolean;
  status: WalletSessionStatus;
  /** Encrypted vault exists in localStorage (wallet may still be locked). */
  hasVault: boolean;
  identity: NodeIdentity | null;
  ethAddress: string | null;
  aktAddress: string | null;
  /** Decrypt local vault with recovery phrase (only login factor). */
  unlockWithMnemonic: (mnemonic: string) => Promise<void>;
  /** Persist phrase-derived vault and unlock (phrase is the sole secret). */
  saveVaultAndUnlock: (identity: NodeIdentity) => Promise<void>;
  lockSession: () => void;
  destroyLocalWallet: () => void;
};

const WalletSessionContext = createContext<WalletSessionContextValue | null>(
  null,
);

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [vaultPresent, setVaultPresent] = useState(false);
  const [identity, setIdentity] = useState<NodeIdentity | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setVaultPresent(readVaultBlob() !== null);
      setHydrated(true);
    });
  }, []);

  const status: WalletSessionStatus = useMemo(() => {
    if (!hydrated) return "loading";
    if (identity) return "unlocked";
    if (vaultPresent) return "locked";
    return "no_vault";
  }, [hydrated, vaultPresent, identity]);

  const unlockWithMnemonic = useCallback(async (mnemonic: string) => {
    const blob = readVaultBlob();
    if (!blob) throw new Error("No encrypted wallet found on this device.");
    const phrase = await decryptMnemonic(blob, mnemonic);
    const id = await deriveIdentityFromMnemonic(phrase);
    setIdentity(id);
  }, []);

  const saveVaultAndUnlock = useCallback(async (id: NodeIdentity) => {
    const blob = await encryptMnemonic(id.mnemonic);
    writeVaultBlob(blob);
    setVaultPresent(true);
    setIdentity(id);
  }, []);

  const lockSession = useCallback(() => {
    setIdentity(null);
  }, []);

  const destroyLocalWallet = useCallback(() => {
    clearVaultBlob();
    setVaultPresent(false);
    setIdentity(null);
  }, []);

  const value = useMemo(
    (): WalletSessionContextValue => ({
      hydrated,
      status,
      hasVault: vaultPresent,
      identity,
      ethAddress: identity?.ethAddress ?? null,
      aktAddress: identity?.aktAddress ?? null,
      unlockWithMnemonic,
      saveVaultAndUnlock,
      lockSession,
      destroyLocalWallet,
    }),
    [
      hydrated,
      status,
      vaultPresent,
      identity,
      unlockWithMnemonic,
      saveVaultAndUnlock,
      lockSession,
      destroyLocalWallet,
    ],
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession(): WalletSessionContextValue {
  const ctx = useContext(WalletSessionContext);
  if (!ctx) {
    throw new Error("useWalletSession must be used within WalletSessionProvider");
  }
  return ctx;
}
