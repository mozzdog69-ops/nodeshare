"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { useState } from "react";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;

type Token = "USDC" | "USDT";

export function SendStablecoinForm({
  mnemonic,
  usdcAddress,
  usdtAddress,
  onSent,
}: {
  mnemonic: string;
  usdcAddress: string;
  usdtAddress: string;
  onSent: () => void;
}) {
  const [token, setToken] = useState<Token>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rpc =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_ETH_RPC_URL
      : undefined;

  async function submit() {
    setErr(null);
    setMsg(null);
    if (!rpc) {
      setErr("Set NEXT_PUBLIC_ETH_RPC_URL in .env (same RPC you use server-side is fine).");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) {
      setErr("Enter a valid 0x recipient address.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a positive amount.");
      return;
    }

    setBusy(true);
    try {
      const provider = new JsonRpcProvider(rpc);
      const wallet = Wallet.fromPhrase(mnemonic.trim()).connect(provider);
      const addr = token === "USDC" ? usdcAddress : usdtAddress;
      const c = new Contract(addr, ERC20_ABI, wallet);
      const decimals = Number(await c.decimals());
      const tx = await c.transfer(to.trim(), parseUnits(amount.trim(), decimals));
      setMsg(`Submitted · ${tx.hash.slice(0, 10)}…`);
      await tx.wait(1);
      setMsg(`Confirmed · ${tx.hash}`);
      onSent();
      setAmount("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-text-primary">Send USDC / USDT</h2>
        <p className="text-sm text-text-secondary">
          Signed in-browser with your unlocked recovery phrase. You need ETH on the
          same network for gas. Never share your phrase.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!rpc ? (
          <p className="text-sm text-amber-700">
            Missing <code className="font-mono text-xs">NEXT_PUBLIC_ETH_RPC_URL</code>{" "}
            — add it to <code className="font-mono text-xs">.env.local</code> and restart{" "}
            <code className="font-mono text-xs">npm run dev</code>.
          </p>
        ) : null}
        <div className="flex gap-2">
          {(["USDC", "USDT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setToken(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                token === t
                  ? "bg-accent text-white"
                  : "bg-surface-base text-text-secondary ring-1 ring-border-subtle"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          placeholder="Recipient 0x…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full rounded-[10px] border border-border-strong bg-white px-3 py-2.5 font-mono text-sm outline-none ring-accent/30 focus:ring-2"
        />
        <input
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-[10px] border border-border-strong bg-white px-3 py-2.5 font-mono text-sm outline-none ring-accent/30 focus:ring-2"
        />
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        {msg ? <p className="text-sm text-success">{msg}</p> : null}
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Signing…" : `Send ${token}`}
        </Button>
      </CardContent>
    </Card>
  );
}
