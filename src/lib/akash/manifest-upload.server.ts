import { createAkashSdkFromMnemonic } from "@/lib/akash/akash-sdk-client";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { createProviderManifestJwtServer } from "@/lib/akash/create-provider-manifest-jwt.server";
import { sendManifestToProviderMtls } from "@/lib/akash/manifest-mtls.server";
import { publishManifestCertificate } from "@/lib/akash/publish-manifest-certificate.server";
import { sendManifestToProviderDirect } from "@/lib/akash/send-manifest";

export type ManifestUploadInput = {
  mnemonic: string;
  owner: string;
  provider: string;
  hostUri: string;
  dseq: number;
  manifestJson: string;
  /** Server verified manifest hash matches deployment before upload. */
  manifestHashVerified?: boolean;
  /** Skip upload when provider bid resources are below deployment (retry cannot fix). */
  skipUploadBidMismatch?: boolean;
  bidMismatchDetail?: string;
  /** Browser-stored cert from deploy (skip publish when valid). */
  clientCertificate?: AkashCertificatePem | null;
};

export type ManifestUploadResult =
  | { ok: true; method: "mtls" | "jwt"; status: number; savedCertificate?: AkashCertificatePem }
  | {
      ok: false;
      error: string;
      mtlsError?: string;
      jwtError?: string;
      savedCertificate?: AkashCertificatePem;
      providerRejectedVerifiedManifest?: boolean;
    };

function mtlsIndicatesManifestRejected(errors: string[]): boolean {
  return errors.some((e) =>
    /manifest version validation failed|hash mismatch|CheckAgainstDeployment/i.test(e),
  );
}

async function tryMtlsUpload(input: {
  hostUri: string;
  dseq: number;
  manifestJson: string;
  certificate: AkashCertificatePem;
}) {
  return sendManifestToProviderMtls({
    hostUri: input.hostUri,
    dseq: input.dseq,
    manifestJson: input.manifestJson,
    certificate: input.certificate,
  });
}

/** Upload manifest: mTLS (primary for GPU hosts) then JWT only if provider was unreachable. */
export async function uploadManifestToProvider(
  input: ManifestUploadInput,
): Promise<ManifestUploadResult> {
  if (input.skipUploadBidMismatch && input.bidMismatchDetail) {
    return {
      ok: false,
      error: input.bidMismatchDetail,
      mtlsError: "skipped: bid resources below deployment",
    };
  }

  const mtlsErrors: string[] = [];
  let publishedCert: AkashCertificatePem | undefined;

  const tryWithCert = async (label: string, cert: AkashCertificatePem) => {
    const res = await tryMtlsUpload({
      hostUri: input.hostUri,
      dseq: input.dseq,
      manifestJson: input.manifestJson,
      certificate: cert,
    });
    if (res.ok) {
      return { ok: true as const, status: res.status, method: "mtls" as const };
    }
    const detail = res.error || `HTTP ${res.status}`;
    mtlsErrors.push(`${label}: ${detail}`);
    return {
      ok: false as const,
      reachedProvider: res.status > 0,
      status: res.status,
      error: detail,
    };
  };

  if (input.clientCertificate?.cert && input.clientCertificate.privateKey) {
    const first = await tryWithCert("stored certificate", input.clientCertificate);
    if (first.ok) return first;
    if (
      first.reachedProvider &&
      /manifest version validation failed/i.test(first.error) &&
      !input.manifestHashVerified
    ) {
      return {
        ok: false,
        error: `Provider rejected manifest (hash mismatch). ${first.error}`,
        mtlsError: mtlsErrors.join(" · "),
      };
    }
  }

  try {
    const { sdk } = await createAkashSdkFromMnemonic(input.mnemonic);
    const published = await publishManifestCertificate(sdk, input.owner, input.clientCertificate);
    publishedCert = published;
    const second = await tryWithCert("new on-chain certificate", published);
    if (second.ok) {
      return { ...second, savedCertificate: published };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Certificate publish failed";
    mtlsErrors.push(`publish: ${msg}`);
  }

  if (mtlsIndicatesManifestRejected(mtlsErrors) && !input.manifestHashVerified) {
    return {
      ok: false,
      error:
        "Manifest bytes do not match the on-chain deployment hash. Close on Stuck orders and rent again.",
      mtlsError: mtlsErrors.join(" · "),
    };
  }

  let jwtError = "";
  try {
    const token = await createProviderManifestJwtServer({
      mnemonic: input.mnemonic,
      iss: input.owner,
      provider: input.provider,
      dseq: input.dseq,
    });
    const jwt = await sendManifestToProviderDirect({
      hostUri: input.hostUri,
      dseq: input.dseq,
      authorization: `Bearer ${token}`,
      manifestJson: input.manifestJson,
    });
    if (jwt.ok) {
      return { ok: true, method: "jwt", status: jwt.status };
    }
    jwtError = jwt.error || `HTTP ${jwt.status}`;
  } catch (e) {
    jwtError = e instanceof Error ? e.message : "JWT upload failed";
  }

  const verifiedHint = input.manifestHashVerified
    ? "Manifest hash matches on-chain; provider still rejected delivery."
    : "";

  const providerRejectedVerifiedManifest =
    input.manifestHashVerified && mtlsIndicatesManifestRejected(mtlsErrors);

  const error =
    [verifiedHint, jwtError || mtlsErrors.join(" · ") || "Could not upload manifest to provider."]
      .filter(Boolean)
      .join(" ") || "Could not upload manifest to provider.";

  return {
    ok: false,
    error: providerRejectedVerifiedManifest
      ? `${error} Close this deployment to recover ACT — retry manifest will not help on this host.`
      : error,
    mtlsError: mtlsErrors.join(" · "),
    jwtError,
    savedCertificate: publishedCert,
    providerRejectedVerifiedManifest,
  };
}

