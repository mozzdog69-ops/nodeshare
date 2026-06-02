"use client";

import {
  AkashLeaseShellSession,
  akashProviderProxyWsUrl,
} from "@/lib/akash/akash-provider-shell-client";
import { LeaseShellCode } from "@/lib/akash/akash-lease-shell-codes";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

export function AkashLeaseShellTerminal({
  hostUri,
  provider,
  jwt,
  dseq,
  gseq,
  oseq,
  service,
  sshHint,
}: {
  hostUri: string;
  provider: string;
  jwt: string;
  dseq: number;
  gseq: number;
  oseq: number;
  service?: string;
  sshHint?: { host: string; port: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<AkashLeaseShellSession | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "error" | "closed">("connecting");
  const [error, setError] = useState("");

  const proxyWs = akashProviderProxyWsUrl();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !proxyWs || !jwt) {
      if (!proxyWs) {
        setStatus("error");
        setError(
          "Provider proxy is not configured. Set NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS (run: node scripts/akash-provider-proxy.mjs).",
        );
      }
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#0a0a0a",
        foreground: "#fafafa",
        cursor: "#f87171",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    let welcomeWritten = false;
    const shell = new AkashLeaseShellSession({
      proxyWsUrl: proxyWs,
      hostUri,
      provider,
      jwt,
      dseq,
      gseq,
      oseq,
      service,
      onData: (text, code) => {
        if (!welcomeWritten && code === LeaseShellCode.Stdout) {
          welcomeWritten = true;
          term.writeln("\r\n\x1b[38;2;248;113;113m● NodeShare\x1b[0m — GPU shell (Akash provider)");
          term.writeln("");
        }
        term.write(text);
        setStatus("open");
      },
      onError: (msg) => {
        setError(msg);
        setStatus("error");
        term.writeln(`\r\n\x1b[31m${msg}\x1b[0m`);
      },
      onClose: () => {
        setStatus("closed");
        term.writeln("\r\n\x1b[90m[session closed]\x1b[0m");
      },
    });
    sessionRef.current = shell;
    shell.connect();
    term.writeln("\x1b[90mConnecting to your GPU on the provider…\x1b[0m");

    term.onData((data) => shell.sendStdin(data));
    const onResize = () => {
      fit.fit();
      shell.sendResize(term.cols, term.rows);
    };
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      shell.disconnect();
      term.dispose();
    };
  }, [proxyWs, hostUri, provider, jwt, dseq, gseq, oseq, service]);

  return (
    <div className="flex min-h-[480px] flex-1 flex-col gap-2">
      {status === "error" && error ? (
        <p className="text-xs text-amber-800">{error}</p>
      ) : (
        <p className="text-xs text-text-secondary">
          Live shell on your Akash GPU (dseq {dseq}). If it stays blank, use SSH below.
        </p>
      )}
      <div
        ref={containerRef}
        className="min-h-[440px] flex-1 overflow-hidden rounded-xl border border-border-subtle bg-[#0a0a0a]"
      />
      {sshHint ? (
        <details className="rounded-lg border border-border-subtle bg-surface-elevated px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-text-primary">
            Or connect with SSH on your computer
          </summary>
          <p className="mt-2 font-mono text-xs text-text-secondary">
            ssh root@{sshHint.host} -p {sshHint.port}
          </p>
        </details>
      ) : null}
    </div>
  );
}
