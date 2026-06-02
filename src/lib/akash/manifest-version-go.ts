/**
 * Akash provider Manifest.Version(): json.Marshal → cosmos SortJSON → sha256.
 * Go json.Marshal keeps default httpOptions, empty ip/service strings, hosts:[],
 * credentials:null, and omits params — deploy hash and PUT body must match that.
 */

/** Provider ResourceValue.val must be JSON strings (manifest asString mode). */
function coerceResourceValuesToStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(coerceResourceValuesToStrings);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(obj)) {
      if (key === "val" && (typeof entry === "number" || typeof entry === "bigint")) {
        out[key] = String(entry);
      } else {
        out[key] = coerceResourceValuesToStrings(entry);
      }
    }
    return out;
  }
  return value;
}

function quantityFieldsToSize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(quantityFieldsToSize);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(obj)) {
      if (key === "quantity" && entry && typeof entry === "object" && "val" in entry) {
        out.size = quantityFieldsToSize(entry);
      } else {
        out[key] = quantityFieldsToSize(entry);
      }
    }
    return out;
  }
  return value;
}

const DEFAULT_HTTP_OPTIONS = {
  maxBodySize: 1_048_576,
  readTimeout: 60_000,
  sendTimeout: 60_000,
  nextTries: 3,
  nextTimeout: 0,
  nextCases: ["error", "timeout"],
};

function isServiceExpose(obj: Record<string, unknown>): boolean {
  return "port" in obj && "proto" in obj && "global" in obj;
}

function isManifestService(obj: Record<string, unknown>): boolean {
  return "image" in obj && "name" in obj && "expose" in obj;
}

function normalizeExposeForGoMarshal(entry: Record<string, unknown>): Record<string, unknown> {
  const httpOptions =
    entry.httpOptions && typeof entry.httpOptions === "object"
      ? (entry.httpOptions as Record<string, unknown>)
      : DEFAULT_HTTP_OPTIONS;
  return {
    port: entry.port,
    externalPort: entry.externalPort,
    proto: entry.proto,
    global: entry.global,
    service: typeof entry.service === "string" ? entry.service : "",
    hosts: Array.isArray(entry.hosts) ? entry.hosts : [],
    httpOptions,
    ip: typeof entry.ip === "string" ? entry.ip : "",
    endpointSequenceNumber: entry.endpointSequenceNumber ?? 0,
  };
}

/**
 * Shape JSON like provider Manifest.Version() after json.Marshal.
 * Omits params; keeps credentials:null and full default expose fields.
 */
export function canonicalizeManifestForProvider(manifest: unknown): unknown {
  const prepared = coerceResourceValuesToStrings(quantityFieldsToSize(manifest));

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (isServiceExpose(obj)) {
        return normalizeExposeForGoMarshal(obj);
      }
      const isService = isManifestService(obj);
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(obj)) {
        if (key === "params") continue;
        if (key === "expose" && Array.isArray(entry)) {
          out.expose = entry.map((ex) =>
            ex && typeof ex === "object"
              ? normalizeExposeForGoMarshal(ex as Record<string, unknown>)
              : ex,
          );
          continue;
        }
        out[key] = walk(entry);
      }
      if (isService) {
        out.credentials = obj.credentials ?? null;
      }
      return out;
    }
    return value;
  };

  return walk(prepared);
}

/** Prior NodeShare hash that stripped expose fields providers still marshal in. */
function canonicalizeManifestStrippedCanon(manifest: unknown): unknown {
  const prepared = coerceResourceValuesToStrings(quantityFieldsToSize(manifest));

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const isService = isManifestService(obj);
      const isExpose = isServiceExpose(obj);
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(obj)) {
        if (key === "params") continue;
        if (isExpose && key === "hosts" && (entry === null || (Array.isArray(entry) && entry.length === 0))) {
          continue;
        }
        if (
          isExpose &&
          key === "httpOptions" &&
          entry &&
          typeof entry === "object" &&
          (entry as Record<string, unknown>).maxBodySize === DEFAULT_HTTP_OPTIONS.maxBodySize
        ) {
          continue;
        }
        if (isExpose && key === "ip" && entry === "") continue;
        if (isExpose && key === "service" && entry === "") continue;
        out[key] = walk(entry);
      }
      if (isService) {
        out.credentials = obj.credentials ?? null;
      }
      return out;
    }
    return value;
  };

  return walk(prepared);
}

/** Sorted manifest JSON for provider PUT (pass chain-sdk SDL.SortJSON). */
export function manifestSortedJsonWithSort(
  manifest: unknown,
  sortJson: (jsonStr: string) => string,
): string {
  const canon = canonicalizeManifestForProvider(manifest);
  return sortJson(JSON.stringify(canon));
}

/** @deprecated use manifestSortedJsonWithSort + SDL.SortJSON */
export function manifestSortedJsonForProvider(manifest: unknown): string {
  return JSON.stringify(canonicalizeManifestForProvider(manifest));
}

/** @deprecated use manifestSortedJsonWithSort */
export function manifestSortedJsonGo(manifest: unknown): string {
  return manifestSortedJsonForProvider(manifest);
}

/** Legacy chain-sdk manifestSortedJSON() body (wrong for provider Version). */
export function manifestSortedJsonSdkLegacy(manifest: unknown): string {
  const sortJsonValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortJsonValue);
    if (value && typeof value === "object") {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[key] = sortJsonValue((value as Record<string, unknown>)[key]);
      }
      return sorted;
    }
    return value;
  };
  return JSON.stringify(sortJsonValue(coerceResourceValuesToStrings(quantityFieldsToSize(manifest))));
}

export async function manifestVersionForProvider(manifest: unknown): Promise<Uint8Array> {
  const sorted = manifestSortedJsonForProvider(manifest);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sorted));
  return new Uint8Array(digest);
}

export async function manifestVersionGo(manifest: unknown): Promise<Uint8Array> {
  return manifestVersionForProvider(manifest);
}

export async function manifestVersionFromJson(manifestJson: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifestJson.trim()));
  return new Uint8Array(digest);
}

export async function manifestHashBase64FromJson(manifestJson: string): Promise<string> {
  return manifestVersionBase64(await manifestVersionFromJson(manifestJson));
}

export async function manifestHashBase64ForProvider(manifest: unknown): Promise<string> {
  return manifestVersionBase64(await manifestVersionForProvider(manifest));
}

export async function manifestHashBase64SdkLegacy(manifest: unknown): Promise<string> {
  return manifestHashBase64FromJson(manifestSortedJsonSdkLegacy(manifest));
}

/** Broken intermediate deploy hash (stripped creds only, still had httpOptions). */
const STRIP_ONLY_NULL_KEYS = new Set(["credentials", "params"]);

function stripOnlyCredParams(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOnlyCredParams);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === null && STRIP_ONLY_NULL_KEYS.has(key)) continue;
      out[key] = stripOnlyCredParams(entry);
    }
    return out;
  }
  return value;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJsonValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export async function manifestHashBase64BrokenStrip(manifest: unknown): Promise<string> {
  const body = JSON.stringify(sortJsonValue(stripOnlyCredParams(prepareForSort(manifest))));
  return manifestHashBase64FromJson(body);
}

/** NodeShare build that matched on-chain but not provider Manifest.Version(). */
export async function manifestHashBase64StrippedCanon(
  manifest: unknown,
  sortJson: (jsonStr: string) => string,
): Promise<string> {
  const body = manifestSortedJsonWithSort(canonicalizeManifestStrippedCanon(manifest), sortJson);
  return manifestHashBase64FromJson(body);
}

function prepareForSort(manifest: unknown): unknown {
  return coerceResourceValuesToStrings(quantityFieldsToSize(manifest));
}

export async function resolveManifestBodyForOnChainHash(
  manifestJson: string,
  onChainHashB64: string,
  sortJson?: (jsonStr: string) => string,
): Promise<{
  body: string;
  matched: boolean;
  legacyOnChain?: boolean;
  brokenStrip?: boolean;
  strippedCanon?: boolean;
}> {
  const trimmed = manifestJson.trim();
  if (!trimmed || !onChainHashB64) {
    return { body: trimmed, matched: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { body: trimmed, matched: false };
  }

  const providerBody = sortJson
    ? manifestSortedJsonWithSort(parsed, sortJson)
    : manifestSortedJsonForProvider(parsed);
  const providerHash = await manifestHashBase64FromJson(providerBody);
  if (providerHash === onChainHashB64) {
    return { body: providerBody, matched: true };
  }

  const legacyBody = manifestSortedJsonSdkLegacy(parsed);
  const legacyHash = await manifestHashBase64FromJson(legacyBody);
  if (legacyHash === onChainHashB64) {
    return { body: providerBody, matched: false, legacyOnChain: true };
  }

  const brokenHash = await manifestHashBase64BrokenStrip(parsed);
  if (brokenHash === onChainHashB64) {
    return { body: providerBody, matched: false, brokenStrip: true };
  }

  if (sortJson) {
    const strippedHash = await manifestHashBase64StrippedCanon(parsed, sortJson);
    if (strippedHash === onChainHashB64) {
      return { body: providerBody, matched: false, strippedCanon: true };
    }
  }

  return { body: providerBody, matched: false };
}

export function manifestVersionBase64(hash: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(hash).toString("base64");
  }
  let binary = "";
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary);
}
