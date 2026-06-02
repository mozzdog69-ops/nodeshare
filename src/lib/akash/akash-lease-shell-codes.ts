/** Provider lease shell multiplex codes (Akash Console / provider API). */
export enum LeaseShellCode {
  Stdout = 100,
  Stderr = 101,
  Result = 102,
  Failure = 103,
  Stdin = 104,
  TerminalResize = 105,
}

export function encodeShellStdin(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(bytes.length + 1);
  out[0] = LeaseShellCode.Stdin;
  out.set(bytes, 1);
  return out;
}

export function encodeShellResize(cols: number, rows: number): Uint8Array {
  const payload = JSON.stringify({ width: cols, height: rows });
  const bytes = new TextEncoder().encode(payload);
  const out = new Uint8Array(bytes.length + 1);
  out[0] = LeaseShellCode.TerminalResize;
  out.set(bytes, 1);
  return out;
}
