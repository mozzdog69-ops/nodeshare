import { DEFAULT_GPU_SDL_SERVICE } from "@/lib/akash/akash-provider-auth";
import {
  encodeShellResize,
  encodeShellStdin,
  LeaseShellCode,
} from "@/lib/akash/akash-lease-shell-codes";
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

export function akashProviderProxyWsUrl(): string {
  return String(process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS || "")
    .trim()
    .replace(/\/$/, "");
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

    ws.onopen = () => {
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
      this.input.onError("WebSocket connection to provider proxy failed.");
    };

    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
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
