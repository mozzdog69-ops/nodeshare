import { DEFAULT_GPU_SDL_SERVICE } from "@/lib/akash/akash-provider-auth";
import {
  encodeShellResize,
  encodeShellStdin,
  LeaseShellCode,
} from "@/lib/akash/akash-lease-shell-codes";
import {
  DEFAULT_AKASH_PROVIDER_PROXY_WS,
  isLocalhostProxyUrl,
  normalizeProxyWsUrl,
  resolveProxyWsFromEnv,
  wakeAkashProviderProxy,
} from "@/lib/akash/akash-provider-proxy-url";
import { apiUrl } from "@/lib/api-base";
import { normalizeProviderHostUri } from "@/lib/akash/provider-host-uri";

export type AkashShellMessage = {
  message?: { data: number[] };
  error?: string;
  closed?: boolean;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildProviderShellUrl(input: {
  hostUri: string;
  dseq: number;
  gseq: number;
  oseq: number;
  service?: string;
}): string {
  const base = normalizeProviderHostUri(input.hostUri);
  const service = input.service || DEFAULT_GPU_SDL_SERVICE;
  const argv = ["sh", "-c", "command -v bash >/dev/null 2>&1 && exec bash || exec sh"];
  const cmdQuery = argv.map((c, i) => `cmd${i}=${encodeURIComponent(c)}`).join("&");
  return `${base}/lease/${input.dseq}/${input.gseq}/${input.oseq}/shell?stdin=1&tty=1&podIndex=0&${cmdQuery}&service=${encodeURIComponent(service)}`;
}

export { DEFAULT_AKASH_PROVIDER_PROXY_WS, normalizeProxyWsUrl } from "@/lib/akash/akash-provider-proxy-url";

/** Build-time proxy URL (may be stale until redeploy). */
export function akashProviderProxyWsUrl(): string {
  const baked = normalizeProxyWsUrl(process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS || "");
  if (typeof window !== "undefined") {
    return resolveProxyWsFromEnv(baked, window.location.hostname);
  }
  return baked || DEFAULT_AKASH_PROVIDER_PROXY_WS;
}

/** Prefer server API; never use localhost on Netlify. */
export async function resolveAkashProviderProxyWsUrl(): Promise<string> {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  try {
    const res = await fetch(apiUrl("/api/akash/terminal/config"), { cache: "no-store" });
    const json = (await res.json()) as { proxyWs?: string | null };
    const fromApi = normalizeProxyWsUrl(String(json.proxyWs || ""));
    if (fromApi && !(isLocalhostProxyUrl(fromApi) && host.endsWith(".netlify.app"))) {
      return fromApi;
    }
  } catch {
    /* fall through */
  }
  return akashProviderProxyWsUrl();
}

export class AkashLeaseShellSession {
  private ws: WebSocket | null = null;
  private queue: Uint8Array[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly input: {
      proxyWsUrl: string;
      hostUri: string;
      provider: string;
      jwt: string;
      dseq: number;
      gseq: number;
      oseq: number;
      service?: string;
      onData: (text: string, code: LeaseShellCode) => void;
      onError: (message: string) => void;
      onClose: () => void;
    },
  ) {}

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      const shellUrl = buildProviderShellUrl(this.input);
      const ws = new WebSocket(this.input.proxyWsUrl);
      this.ws = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        ws.send(
          JSON.stringify({
            type: "websocket",
            url: shellUrl,
            auth: { type: "jwt", token: this.input.jwt },
            providerAddress: this.input.provider,
            isBase64: true,
          }),
        );
        while (this.queue.length) {
          this.send(this.queue.shift()!);
        }
        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
        resolve(true);
      };

      ws.onmessage = (event) => {
        try {
          const json = JSON.parse(String(event.data)) as AkashShellMessage & { type?: string };
          if (json.type === "pong") return;
          if (json.error) {
            this.input.onError(json.error);
            return;
          }
          if (json.closed) {
            this.input.onClose();
            return;
          }
          const data = json.message?.data;
          if (!data?.length) return;
          const code = data[0] as LeaseShellCode;
          const text = new TextDecoder().decode(Uint8Array.from(data.slice(1)));
          if (code === LeaseShellCode.Stdout || code === LeaseShellCode.Stderr) {
            this.input.onData(text, code);
          } else if (code === LeaseShellCode.Failure) {
            this.input.onError(text || "Shell session failed.");
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => {
        /* onclose follows */
      };

      ws.onclose = (ev) => {
        if (this.pingTimer) clearInterval(this.pingTimer);
        if (!opened) {
          const hint =
            ev.code === 1006
              ? " — open https://nodeshare-akash-proxy.onrender.com/health, wait for {\"ok\":true}, then Reconnect"
              : ev.code === 1008
                ? " (origin blocked on Render — redeploy proxy)"
                : "";
          this.input.onError(
            `WebSocket to provider proxy failed (code ${ev.code || "unknown"})${hint}. URL: ${this.input.proxyWsUrl}`,
          );
          resolve(false);
          return;
        }
        this.input.onClose();
      };
    });
  }

  /** Wake Render free tier, then retry WebSocket until connected. */
  static async connectWithWake(
    input: ConstructorParameters<typeof AkashLeaseShellSession>[0] & {
      onStatus?: (message: string) => void;
    },
  ): Promise<AkashLeaseShellSession> {
    const { onStatus, ...sessionInput } = input;
    onStatus?.("Starting Render proxy (free tier can take up to 90s)…");
    await wakeAkashProviderProxy(sessionInput.proxyWsUrl, onStatus);

    for (let attempt = 1; attempt <= 4; attempt++) {
      onStatus?.(`Opening terminal WebSocket (${attempt}/4)…`);
      const session = new AkashLeaseShellSession(sessionInput);
      const ok = await session.connect();
      if (ok) return session;
      session.disconnect();
      if (attempt < 4) {
        onStatus?.("Retrying in 5s…");
        await new Promise((r) => setTimeout(r, 5000));
        await wakeAkashProviderProxy(sessionInput.proxyWsUrl);
      }
    }
    throw new Error("Could not connect to provider proxy after retries.");
  }

  send(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(data);
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: "websocket",
        url: buildProviderShellUrl(this.input),
        auth: { type: "jwt", token: this.input.jwt },
        providerAddress: this.input.provider,
        isBase64: true,
        data: toBase64(data),
      }),
    );
  }

  sendStdin(text: string): void {
    this.send(encodeShellStdin(text));
  }

  sendResize(cols: number, rows: number): void {
    this.send(encodeShellResize(cols, rows));
  }

  disconnect(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}
