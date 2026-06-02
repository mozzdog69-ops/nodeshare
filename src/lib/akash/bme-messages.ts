import type { GeneratedType } from "@cosmjs/proto-signing";
import { BinaryWriter } from "@bufbuild/protobuf/wire";

export const MSG_BURN_MINT_TYPE_URL = "/akash.bme.v1.MsgBurnMint";
export const MSG_MINT_ACT_TYPE_URL = "/akash.bme.v1.MsgMintACT";

type BurnMintMsg = {
  owner: string;
  to: string;
  coinsToBurn: { denom: string; amount: string };
  denomToMint?: string;
};

function encodeCoin(coin: { denom: string; amount: string }): Uint8Array {
  const writer = new BinaryWriter();
  if (coin.denom) writer.uint32(10).string(coin.denom);
  if (coin.amount) writer.uint32(18).string(coin.amount);
  return writer.finish();
}

function encodeMsgBurnMint(message: BurnMintMsg): BinaryWriter {
  const writer = new BinaryWriter();
  if (message.owner) writer.uint32(10).string(message.owner);
  if (message.to) writer.uint32(18).string(message.to);
  if (message.coinsToBurn) {
    writer.uint32(26).bytes(encodeCoin(message.coinsToBurn));
  }
  if (message.denomToMint) writer.uint32(34).string(message.denomToMint);
  return writer;
}

function encodeMsgMintAct(message: BurnMintMsg): BinaryWriter {
  const writer = new BinaryWriter();
  if (message.owner) writer.uint32(10).string(message.owner);
  if (message.to) writer.uint32(18).string(message.to);
  if (message.coinsToBurn) {
    writer.uint32(26).bytes(encodeCoin(message.coinsToBurn));
  }
  return writer;
}

/** BME burn-mint — not yet in @akashnetwork/chain-sdk alpha browser bundle. */
export const MsgBurnMint: GeneratedType = {
  typeUrl: MSG_BURN_MINT_TYPE_URL,
  encode: (value: unknown) => encodeMsgBurnMint(value as BurnMintMsg),
  decode: () => {
    throw new Error("MsgBurnMint decode is not implemented.");
  },
  fromPartial: (object) => object as BurnMintMsg,
};

/** Preferred path for AKT → ACT (matches `akash tx bme mint-act`). */
export const MsgMintACT: GeneratedType = {
  typeUrl: MSG_MINT_ACT_TYPE_URL,
  encode: (value: unknown) => encodeMsgMintAct(value as BurnMintMsg),
  decode: () => {
    throw new Error("MsgMintACT decode is not implemented.");
  },
  fromPartial: (object) => object as BurnMintMsg,
};
