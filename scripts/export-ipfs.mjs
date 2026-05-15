/**
 * Produces ./out for IPFS pinning (static HTML export).
 * Copies src/app/api away and deletes it — API routes cannot exist in static export.
 *
 * Set NEXT_PUBLIC_API_BASE to your Netlify deployment URL that still serves /api/*.
 *
 * Usage:  npm run export:ipfs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const bakDir = path.join(root, "src", "app", "_api_ipfs_export_backup");

process.chdir(root);

let moved = false;
try {
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(bakDir)) {
      console.error(
        "\nRemove folder src/app/_api_ipfs_export_backup first (stale backup).\n",
      );
      process.exit(1);
    }
    fs.cpSync(apiDir, bakDir, { recursive: true });
    fs.rmSync(apiDir, { recursive: true, force: true });
    moved = true;
    console.log("→ Temporarily removed src/app/api (backup at _api_ipfs_export_backup)\n");
  } else if (!fs.existsSync(bakDir)) {
    console.error("\nNo src/app/api folder found.\n");
    process.exit(1);
  }

  const env = { ...process.env, STATIC_IPFS_EXPORT: "1" };
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(cmd, ["next", "build"], {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (r.status !== 0) {
    console.error("\nnext build failed — see errors above.\n");
    process.exit(r.status ?? 1);
  }

  console.log(
    "\n✓ Static export in ./out — pin this folder to IPFS, then set ENS contenthash.\n" +
      "  Build with NEXT_PUBLIC_API_BASE set to your HTTPS API origin (see IPFS_ENS.md).\n",
  );
} finally {
  if (moved && fs.existsSync(bakDir)) {
    if (fs.existsSync(apiDir)) fs.rmSync(apiDir, { recursive: true, force: true });
    fs.cpSync(bakDir, apiDir, { recursive: true });
    fs.rmSync(bakDir, { recursive: true, force: true });
    console.log("→ Restored src/app/api\n");
  }
}
