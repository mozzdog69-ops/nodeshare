"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

const WELCOME = [
  "\r\n\x1b[38;2;251;113;133m● NodeShare\x1b[0m — decentralized AI compute shell",
  "\r\n\x1b[38;2;100;116;139mTry:\x1b[0m  run stable-diffusion --gpu 1",
  "        deploy model llama-3",
  "        rent gpu 2h",
  "\r\n",
].join("\r\n");

export function NodeTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: "#0c0f14",
        foreground: "#e2e8f0",
        cursor: "#fb7185",
        cursorAccent: "#0c0f14",
        black: "#0c0f14",
        brightBlack: "#334155",
        red: "#fb7185",
        brightRed: "#fda4af",
        green: "#4ade80",
        brightGreen: "#86efac",
        yellow: "#fbbf24",
        brightYellow: "#fde047",
        blue: "#38bdf8",
        brightBlue: "#7dd3fc",
        magenta: "#e879f9",
        brightMagenta: "#f0abfc",
        cyan: "#22d3ee",
        brightCyan: "#67e8f9",
        white: "#f1f5f9",
        brightWhite: "#ffffff",
        selectionBackground: "rgba(225,29,72,0.28)",
      },
      fontFamily:
        "var(--font-jetbrains), ui-monospace, 'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 1.38,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    term.write(WELCOME);
    term.write("$ ");

    let line = "";
    const disposable = term.onData((data) => {
      const code = data.charCodeAt(0);
      if (code === 127) {
        if (line.length > 0) {
          line = line.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }
      if (data === "\r") {
        term.writeln("");
        handleCommand(term, line.trim());
        line = "";
        term.write("$ ");
        return;
      }
      if (data < " " && data !== "\t") return;
      line += data;
      term.write(data);
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
    });
    ro.observe(el);
    requestAnimationFrame(() => fit.fit());

    return () => {
      ro.disconnect();
      disposable.dispose();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[400px] w-full overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-terminal-bg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
    />
  );
}

function handleCommand(term: Terminal, cmd: string) {
  if (!cmd) return;
  const lower = cmd.toLowerCase();
  if (lower === "help") {
    term.writeln(
      "\x1b[32mcommands\x1b[0m  run | deploy | rent | clear | status",
    );
    return;
  }
  if (lower === "clear") {
    term.clear();
    return;
  }
  if (lower.startsWith("run ") || lower.startsWith("deploy ") || lower.startsWith("rent ")) {
    term.writeln("\x1b[33m→\x1b[0m  allocating GPU …");
    term.writeln(
      "\x1b[32m✓\x1b[0m  provider: Akash · \x1b[38;2;251;113;133m1x A10\x1b[0m",
    );
    term.writeln(
      "\x1b[38;2;100;116;139m…\x1b[0m  streaming logs (mock) — job queued",
    );
    return;
  }
  if (lower === "status") {
    term.writeln("\x1b[32mnetwork\x1b[0m  healthy · latency 42ms · 128 nodes");
    return;
  }
  term.writeln(
    `\x1b[38;2;251;113;133m?\x1b[0m  unknown command — type \x1b[32mhelp\x1b[0m`,
  );
}
