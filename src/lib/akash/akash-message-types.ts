import type { GeneratedType } from "@cosmjs/proto-signing";
import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/chain/types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/chain/types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/chain/types/akash.v1beta5";
import { MsgBurnMint, MsgMintACT, MSG_BURN_MINT_TYPE_URL, MSG_MINT_ACT_TYPE_URL } from "@/lib/akash/bme-messages";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";

/** Chain-sdk MessageFns — CosmJS calls `.encode(x).finish()` itself. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registerSchema(schema: any): GeneratedType {
  return schema as GeneratedType;
}

const REGISTRY = new Map<string, GeneratedType>([
  [`/${MsgCreateDeployment.$type}`, registerSchema(MsgCreateDeployment)],
  [`/${MsgCloseDeployment.$type}`, registerSchema(MsgCloseDeployment)],
  [`/${MsgCreateLease.$type}`, registerSchema(MsgCreateLease)],
  [`/${MsgCreateCertificate.$type}`, registerSchema(MsgCreateCertificate)],
  [MSG_BURN_MINT_TYPE_URL, MsgBurnMint],
  [MSG_MINT_ACT_TYPE_URL, MsgMintACT],
  ["/cosmos.tx.v1beta1.TxRaw", registerSchema(TxRaw)],
]);

export function getAkashMessageType(typeUrl: string): GeneratedType | undefined {
  return REGISTRY.get(typeUrl);
}
