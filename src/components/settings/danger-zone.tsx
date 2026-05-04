"use client";

import { useWalletSession } from "@/context/wallet-session";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DangerZone() {
  const { destroyLocalWallet } = useWalletSession();
  const router = useRouter();
  const [ack, setAck] = useState(false);

  return (
    <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50/40 p-5">
      <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
      <p className="mt-2 text-sm text-text-secondary">
        Remove the encrypted vault from this browser. You will need your recovery phrase
        to access this wallet again.
      </p>
      <label className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-1 accent-accent"
        />
        <span>I have my recovery phrase saved offline.</span>
      </label>
      <Button
        variant="danger"
        className="mt-4"
        disabled={!ack}
        onClick={() => {
          destroyLocalWallet();
          router.push("/login");
        }}
      >
        Remove wallet from this device
      </Button>
    </div>
  );
}
