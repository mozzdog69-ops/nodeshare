/** Client-side gate for Akash rent / manifest diagnostics UI. */

const DEBUG_KEY = "nodeshare_akash_rent_debug";

function persistRentDebugFlag() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEBUG_KEY, "1");
    sessionStorage.setItem(DEBUG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function enableAkashRentDebug() {
  persistRentDebugFlag();
}

export function isAkashRentDebugEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_AKASH_RENT_DEBUG === "true") return true;
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("rentDebug") === "1") {
      persistRentDebugFlag();
      return true;
    }
    if (localStorage.getItem(DEBUG_KEY) === "1") return true;
    return sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Show diagnostics when manifest failed even before user enables debug. */
export function shouldShowAkashRentDebug(manifestFailed: boolean): boolean {
  if (manifestFailed) {
    enableAkashRentDebug();
    return true;
  }
  return isAkashRentDebugEnabled();
}

export function rentDebugRequestHeaders(): HeadersInit {
  if (!isAkashRentDebugEnabled()) return {};
  return { "x-nodeshare-rent-debug": "1" };
}

const UPLOAD_DEBUG_KEY = "nodeshare_manifest_upload_debug";

export type ManifestUploadDebugSnapshot = {
  at: string;
  httpStatus: number;
  error?: string;
  mtlsError?: string;
  jwtError?: string;
  onChainHash?: string;
  uploadHash?: string;
  hashVerified?: boolean;
  method?: string;
  request?: {
    hostUri: string;
    dseq: number;
    owner: string;
    provider: string;
    hadClientCert: boolean;
    manifestJsonChars: number;
  };
};

export function saveManifestUploadDebug(snapshot: ManifestUploadDebugSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UPLOAD_DEBUG_KEY, JSON.stringify(snapshot));
    sessionStorage.setItem(UPLOAD_DEBUG_KEY, JSON.stringify(snapshot));
    enableAkashRentDebug();
  } catch {
    /* ignore */
  }
}

export function readManifestUploadDebug(): ManifestUploadDebugSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(UPLOAD_DEBUG_KEY) || sessionStorage.getItem(UPLOAD_DEBUG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManifestUploadDebugSnapshot;
  } catch {
    return null;
  }
}
