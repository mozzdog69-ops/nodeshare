import Long from "long";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { createAkashSdkFromMnemonic } from "@/lib/akash/akash-sdk-client";
import {
  listLeasedAkashDeploymentsByAddress,
  listStuckAkashDeploymentsByAddress,
  type StuckAkashDeployment,
} from "@/lib/akash/fetch-lcd-stuck-deployments";

export type { StuckAkashDeployment } from "@/lib/akash/fetch-lcd-stuck-deployments";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function akashAddressFromMnemonic(mnemonic: string): Promise<string> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), { prefix: "akash" });
  const [account] = await wallet.getAccounts();
  if (!account?.address) throw new Error("Could not derive Akash address from wallet.");
  return account.address;
}

/** Active deployments with no lease — uses LCD REST (safe in browser). */
export async function listStuckAkashDeployments(mnemonic: string): Promise<StuckAkashDeployment[]> {
  const address = await akashAddressFromMnemonic(mnemonic);
  return listStuckAkashDeploymentsByAddress(address);
}

export { listStuckAkashDeploymentsByAddress };

export async function closeStuckAkashDeployment(input: {
  mnemonic: string;
  dseq: number;
}): Promise<string | undefined> {
  const { sdk, address } = await createAkashSdkFromMnemonic(input.mnemonic);
  const res = await sdk.akash.deployment.v1beta4.closeDeployment({
    id: { owner: address, dseq: Long.fromNumber(input.dseq) },
  });
  return (
    (res as { txHash?: string }).txHash ??
    (res as { transactionHash?: string }).transactionHash
  );
}

/** Close all stuck deployments — returns count closed. */
export async function closeOpenAkashDeployments(input: {
  mnemonic: string;
  onProgress?: (message: string) => void;
}): Promise<number> {
  const address = await akashAddressFromMnemonic(input.mnemonic);
  const stuck = await listStuckAkashDeploymentsByAddress(address);
  const leased = await listLeasedAkashDeploymentsByAddress(address);
  const all = [...stuck, ...leased];
  let closed = 0;

  for (const row of all) {
    input.onProgress?.(`Closing deployment dseq ${row.dseq}…`);
    await closeStuckAkashDeployment({ mnemonic: input.mnemonic, dseq: row.dseq });
    closed += 1;
    await sleep(3000);
  }

  return closed;
}
