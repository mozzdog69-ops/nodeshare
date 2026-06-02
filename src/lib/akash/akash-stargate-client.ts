import type { EncodeObject, GeneratedType, OfflineSigner } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import type { DeliverTxResponse, SignerData, SigningStargateClientOptions, StdFee } from "@cosmjs/stargate";
import { calculateFee, defaultRegistryTypes, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import type { TxClient } from "@akashnetwork/chain-sdk/chain/web";
import { getAkashMessageType } from "@/lib/akash/akash-message-types";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";

const DEFAULT_GAS_PRICE = "0.025uakt";
const GAS_MULTIPLIER = 2;
/** Floor for lease/deploy txs — simulation often underestimates on mainnet. */
const MIN_SIMULATED_GAS = 500_000;

export type AkashStargateClientOptions = {
  baseUrl: string;
  signer: OfflineSigner;
  defaultGasPrice?: string;
  gasMultiplier?: number;
  stargateOptions?: SigningStargateClientOptions;
  getMessageType?: (typeUrl: string) => GeneratedType | undefined;
};

export function createAkashStargateClient(options: AkashStargateClientOptions): TxClient {
  const registry = new Registry([
    ...defaultRegistryTypes,
    ["/cosmos.tx.v1beta1.TxRaw", TxRaw],
  ]);
  const gasPrice = GasPrice.fromString(options.defaultGasPrice ?? DEFAULT_GAS_PRICE);
  const gasMultiplier = options.gasMultiplier ?? GAS_MULTIPLIER;
  const resolveType = options.getMessageType ?? getAkashMessageType;

  let clientPromise: Promise<SigningStargateClient> | undefined;

  async function getClient() {
    clientPromise ??= SigningStargateClient.connectWithSigner(options.baseUrl, options.signer, {
      ...options.stargateOptions,
      registry,
    });
    return clientPromise;
  }

  async function getAddress() {
    const [account] = await options.signer.getAccounts();
    if (!account?.address) throw new Error("Akash wallet has no accounts.");
    return account.address;
  }

  function ensureRegistered(messages: EncodeObject[]) {
    for (const message of messages) {
      if (registry.lookupType(message.typeUrl)) continue;
      const type = resolveType(message.typeUrl);
      if (!type) throw new Error(`Unknown Akash message type: ${message.typeUrl}`);
      registry.register(message.typeUrl, type);
    }
    return messages;
  }

  return {
    async estimateFee(messages, memo) {
      ensureRegistered(messages);
      const address = await getAddress();
      const client = await getClient();
      const gas = await client.simulate(address, messages, memo);
      const adjusted = Math.max(MIN_SIMULATED_GAS, Math.ceil(gasMultiplier * gas));
      return calculateFee(adjusted, gasPrice);
    },
    async sign(messages, fee, memo) {
      ensureRegistered(messages);
      const address = await getAddress();
      const client = await getClient();
      return client.sign(address, messages, fee, memo);
    },
    async broadcast(txRaw: Parameters<TxClient["broadcast"]>[0]) {
      const txType = registry.lookupType("/cosmos.tx.v1beta1.TxRaw") ?? resolveType("/cosmos.tx.v1beta1.TxRaw");
      if (!txType) throw new Error("TxRaw type is not registered.");
      const client = await getClient();
      return client.broadcastTx(txType.encode(txRaw).finish());
    },
  };
}

export type { SignerData, StdFee };
