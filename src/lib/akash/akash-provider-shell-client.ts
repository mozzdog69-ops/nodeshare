import { DEFAULT_GPU_SDL_SERVICE } from "@/lib/akash/akash-provider-auth";
import {
  encodeShellResize,
  encodeShellStdin,
  LeaseShellCode,
} from "@/lib/akash/akash-lease-shell-codes";
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

export function normalizeProxyWsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice(8)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice(7)}`;
  if (trimmed.startsWith("wss://") || trimmed.startsWith("ws://")) return trimmed;
  return `wss://${trimmed}`;
}

/** Build-time proxy URL (may be stale until redeploy). */
export function akashProviderProxyWsUrl(): string {
  return normalizeProxyWsUrl(process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS || "");
}

/** Prefer server env via API so Netlify can set AKASH_PROVIDER_PROXY_WS without rebuild. */
export async function resolveAkashProviderProxyWsUrl(): Promise<string> {
  const baked = akashProviderProxyWsUrl();
  try {
    const res = await fetch(apiUrl("/api/akash/terminal/config"), { cache: "no-store" });
    const json = (await res.json()) as { proxyWs?: string | null };
    const fromApi = normalizeProxyWsUrl(String(json.proxyWs || ""));
    return fromApi || baked;
  } catch {
    return baked;
  }
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

  connect(): void {
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
      /* onclose usually follows with a code */
    };

    ws.onclose = (ev) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (!opened) {
        const hint =
          ev.code === 1006
            ? " (proxy unreachable, sleeping on Render free tier, or wrong wss:// URL on Netlify)"
            : ev.code === 1008
              ? " (origin blocked — set AKASH_PROVIDER_PROXY_ORIGINS on Render)"
              : "";
        this.input.onError(
          `WebSocket to provider proxy failed (code ${ev.code || "unknown"})${hint}. URL: ${this.input.proxyWsUrl}`,
        );
      }
      this.input.onClose();
    };
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
