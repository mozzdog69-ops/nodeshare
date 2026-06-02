import {
  listLeasedAkashDeploymentsByAddress,
  listStuckAkashDeploymentsByAddress,
} from "@/lib/akash/fetch-lcd-stuck-deployments";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAkashAddr(a: string) {
  return /^akash1[a-z0-9]{38}$/.test(a);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") ?? "").trim();

  if (!isAkashAddr(address)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing akash1… address", data: { items: [] } },
      { status: 400 },
    );
  }

  try {
    const [stuck, leased] = await Promise.all([
      listStuckAkashDeploymentsByAddress(address),
      listLeasedAkashDeploymentsByAddress(address),
    ]);
    return NextResponse.json({
      ok: true,
      data: {
        items: stuck,
        leased,
        totalEscrowAct:
          [...stuck, ...leased].reduce((sum, row) => sum + row.escrowAct, 0),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load stuck deployments.";
    return NextResponse.json({ ok: false, error: msg, data: { items: [] } }, { status: 502 });
  }
}
