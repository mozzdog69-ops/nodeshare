import { encodeSecp256k1Signature } from "@cosmjs/amino";
import {
  Bip39,
  EnglishMnemonic,
  Secp256k1,
  sha256,
  Slip10,
  Slip10Curve,
  stringToPath,
} from "@cosmjs/crypto";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { StdSignature } from "@cosmjs/amino";

const BASE_HD_PATH = "m/44'/118'/0'/0/";

/** SDL service name in gpu-sdl.ts */
export const DEFAULT_GPU_SDL_SERVICE = "gpu";

export type SignArbitraryAkashWallet = {
  pubkey: Uint8Array;
  address: string;
  signArbitrary: (
    signer: string,
    data: string | Uint8Array,
    accountIndex?: number,
  ) => Promise<StdSignature & { signature: string }>;
};

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function seedFromMnemonic(mnemonic: string): Promise<Uint8Array> {
  const checked = new EnglishMnemonic(mnemonic);
  return Bip39.mnemonicToSeed(checked);
}

export async function createSignArbitraryAkashWallet(
  wallet: DirectSecp256k1HdWallet,
  mnemonic: string,
): Promise<SignArbitraryAkashWallet> {
  const [account] = await wallet.getAccounts();
  return {
    pubkey: account.pubkey,
    address: account.address,
    signArbitrary: async (signer, data, accountIndex = 0) => {
      void signer;
      const message = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const hashedMessage = sha256(message);
      const seed = await seedFromMnemonic(mnemonic);
      const { privkey } = Slip10.derivePath(
        Slip10Curve.Secp256k1,
        seed,
        stringToPath(`${BASE_HD_PATH}${accountIndex}`),
      );
      const signature = await Secp256k1.createSignature(hashedMessage, privkey);
      const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
      const stdSignature = encodeSecp256k1Signature(account.pubkey, signatureBytes);
      return {
        ...stdSignature,
        signature: base64UrlEncode(signatureBytes),
      };
    },
  };
}

export type ProviderLeaseScope =
  | "send-manifest"
  | "get-manifest"
  | "logs"
  | "shell"
  | "events"
  | "status"
  | "restart"
  | "hostname-migrate"
  | "ip-migrate";

export type ProviderManifestJwtOptions = {
  iss: string;
  provider: string;
  dseq: number;
  services?: string[];
  scope?: ProviderLeaseScope[];
};

/** ES256K JWT for provider manifest (AEP-64). Requires `services` when scoping by dseq. */
export async function createProviderManifestJwt(
  wallet: DirectSecp256k1HdWallet,
  mnemonic: string,
  options: ProviderManifestJwtOptions,
): Promise<string> {
  const akashWallet = await createSignArbitraryAkashWallet(wallet, mnemonic);
  const now = Math.floor(Date.now() / 1000);
  const provider = options.provider.trim().toLowerCase();
  const iss = options.iss.trim().toLowerCase();
  const services = options.services?.length ? options.services : [DEFAULT_GPU_SDL_SERVICE];
  const scope = options.scope?.length
    ? options.scope
    : (["send-manifest", "status"] as ProviderLeaseScope[]);

  const payload = {
    version: "v1" as const,
    iss,
    iat: now,
    nbf: now,
    exp: now + 3600,
    leases: {
      access: "granular" as const,
      permissions: [
        {
          provider,
          access: "granular" as const,
          deployments: [
            {
              dseq: options.dseq,
              scope,
              services,
            },
          ],
        },
      ],
    },
  };

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256K", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const { signature } = await akashWallet.signArbitrary(akashWallet.address, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}
