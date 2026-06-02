import { isValidAkashAddress, sanitizeAkashAddress } from "@/lib/akash/akash-address";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { createProviderManifestJwtServer } from "@/lib/akash/create-provider-manifest-jwt.server";
import { createProviderShellJwtServer } from "@/lib/akash/create-provider-shell-jwt.server";
import { DEFAULT_GPU_SDL_SERVICE } from "@/lib/akash/akash-provider-auth";
import { fetchLeaseInfoLcd } from "@/lib/akash/fetch-lease-info";
import { fetchProviderHostUriLcd } from "@/lib/akash/fetch-provider-host-uri.server";
import {
  fetchProviderLeaseStatusResolved,
  leaseWorkloadReady,
  sshEndpointFromLeaseStatus,
} from "@/lib/akash/fetch-provider-lease-status.server";
import { parseAkashLeaseJobId } from "@/lib/akash/akash-lease-job-id";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function gpuBackendBases(): string[] {
  const primary = String(process.env.GPU_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
  const fallback = String(process.env.GPU_BACKEND_FALLBACK_URL || "")
    .trim()
    .replace(/\/$/, "");
  return [...new Set([primary, fallback].filter(Boolean))];
}

async function tryGpuBackendTerminal(input: {
  jobId: string;
  recoveryJob: Record<string, unknown>;
  authHeaders: Record<string, string>;
}): Promise<{ token?: string; ws_path?: string } | null> {
  const apiKey = String(process.env.GPU_API_KEY || "").trim();
  const bases = gpuBackendBases();
  if (!bases.length) return null;

  const body = JSON.stringify({
    recovery_job: input.recoveryJob,
    akash_lease: input.recoveryJob,
  });

  for (const backend of bases) {
    const target = `${backend}/api/marketplace/gpu/jobs/${encodeURIComponent(input.jobId)}/terminal/session`;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...input.authHeaders,
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const res = await fetch(target, {
        method: "POST",
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        token?: string;
        ws_path?: string;
      };
      if (res.ok && json.token && json.ws_path) {
        return { token: json.token, ws_path: json.ws_path };
      }
    } catch {
      /* try next backend */
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    let payload: {
      jobId?: string;
      owner?: string;
      mnemonic?: string;
      dseq?: number;
      provider?: string;
      gseq?: number;
      oseq?: number;
      clientCertificate?: AkashCertificatePem | null;
    };

    try {
      payload = (await req.json()) as typeof payload;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const jobId = String(payload.jobId || "").trim();
    const parsed = parseAkashLeaseJobId(jobId);
    const owner = sanitizeAkashAddress(payload.owner);
    const mnemonic = String(payload.mnemonic || "").trim();
    const dseq = Math.floor(Number(parsed?.dseq ?? payload.dseq ?? 0));
    const provider = sanitizeAkashAddress(payload.provider);
    const gseq = Math.floor(Number(payload.gseq ?? 1)) || 1;
    const oseq = Math.floor(Number(payload.oseq ?? 1)) || 1;
    const clientCertificate = payload.clientCertificate ?? null;

    if (!jobId || !parsed) {
      return NextResponse.json({ ok: false, error: "Invalid Akash job id." }, { status: 400 });
    }
    if (!owner || !isValidAkashAddress(owner)) {
      return NextResponse.json(
        { ok: false, error: "Valid Akash owner address is required." },
        { status: 400 },
      );
    }
    if (!mnemonic) {
      return NextResponse.json(
        { ok: false, error: "Unlock your wallet — mnemonic is required for provider auth." },
        { status: 400 },
      );
    }
    if (!dseq || !provider) {
      return NextResponse.json(
        { ok: false, error: "Could not resolve deployment (dseq) or provider for this job." },
        { status: 404 },
      );
    }

    const lease = await fetchLeaseInfoLcd(owner, dseq);
    if (!lease || lease.state !== "active") {
      return NextResponse.json(
        {
          ok: false,
          error:
            lease?.state === "closed"
              ? "This GPU lease has ended on-chain. Rent again from the marketplace."
              : "No active lease found for this job. Check GPU Jobs or Stuck orders.",
          lease_state: lease?.state ?? null,
        },
        { status: 409 },
      );
    }

    const leaseProvider = lease.provider || provider;
    if (leaseProvider !== provider) {
      return NextResponse.json(
        { ok: false, error: "Provider does not match the active on-chain lease." },
        { status: 409 },
      );
    }

    const authHeaders: Record<string, string> = {};
    for (const name of ["x-user-address", "x-user-ts", "x-user-signature"]) {
      const val = req.headers.get(name);
      if (val) authHeaders[name] = val;
    }

    const recoveryJob: Record<string, unknown> = {
      id: jobId,
      kind: "akash-lease",
      owner,
      dseq,
      gseq,
      oseq,
      provider_owner: leaseProvider,
      provider_id: leaseProvider,
      internal_status: "running",
      provider_status: "lease_active",
      lease_state: "active",
    };

    const gpuSession = await tryGpuBackendTerminal({ jobId, recoveryJob, authHeaders });
    if (gpuSession?.token && gpuSession.ws_path) {
      return NextResponse.json({ ok: true, mode: "iframe", ...gpuSession, source: "gpu-backend" });
    }

    let hostUri: string;
    try {
      hostUri = await fetchProviderHostUriLcd(leaseProvider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load provider host URI.";
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }

    let jwt: string;
    try {
      jwt = await createProviderManifestJwtServer({
        mnemonic,
        iss: owner,
        provider: leaseProvider,
        dseq,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sign provider JWT.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    let status;
    try {
      status = await fetchProviderLeaseStatusResolved({
        hostUri,
        dseq,
        gseq,
        oseq,
        jwt,
        certificate: clientCertificate,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Provider lease status failed.";
      return NextResponse.json(
        {
          ok: false,
          error: msg,
          queued: /not found|404|no lease|still starting/i.test(msg),
        },
        { status: 502 },
      );
    }

    const ready = leaseWorkloadReady(status);
    const ssh = sshEndpointFromLeaseStatus(status);

    if (!ready && !ssh) {
      return NextResponse.json(
        {
          ok: false,
          error: "GPU container is still starting on the provider. Try again in a minute.",
          queued: true,
        },
        { status: 425 },
      );
    }

    let shellJwt: string;
    try {
      shellJwt = await createProviderShellJwtServer({
        mnemonic,
        iss: owner,
        provider: leaseProvider,
        dseq,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sign provider shell JWT.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const proxyWs = String(process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS || "").trim();

    return NextResponse.json({
      ok: true,
      mode: "provider_shell",
      host_uri: hostUri,
      provider: leaseProvider,
      dseq,
      gseq,
      oseq,
      service: DEFAULT_GPU_SDL_SERVICE,
      shell_jwt: shellJwt,
      provider_proxy_ws: proxyWs || undefined,
      ssh: ssh ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Terminal session failed.";
    console.error("[akash/terminal/session]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
