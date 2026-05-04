/**
 * Validates .env.local (or .env) for “live” NodeShare features before deploy.
 * Usage: npm run verify-env
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function isPlaceholder(value) {
  if (!value || value.length < 8) return true;
  const v = value.toLowerCase();
  const bad = [
    "your_",
    "youral",
    "placeholder",
    "changeme",
    "xxx",
    "rnd_your",
    "example.com",
  ];
  return bad.some((b) => v.includes(b));
}

const localPath = path.join(root, ".env.local");
const envPath = path.join(root, ".env");
const hasLocal = fs.existsSync(localPath);
const hasEnv = fs.existsSync(envPath);
const fromFile = hasLocal ? parseEnvFile(localPath) : parseEnvFile(envPath);
const env = { ...fromFile, ...process.env };

if (!hasLocal && !hasEnv) {
  console.log(`
No .env.local or .env found in project root.

  1) copy .env.example .env.local
  2) Edit .env.local with real keys (see comments in .env.example)
  3) npm run verify-env
`);
  process.exit(1);
}

const checks = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public app URL",
    required: true,
  },
  {
    key: "ETH_RPC_URL",
    label: "Server Ethereum RPC (balances)",
    required: true,
  },
  {
    key: "NEXT_PUBLIC_ETH_RPC_URL",
    label: "Browser Ethereum RPC (send USDC/USDT)",
    required: true,
  },
  {
    key: "ETHERSCAN_API_KEY",
    label: "Etherscan API (tx history)",
    required: true,
  },
  {
    key: "RENDER_API_KEY",
    label: "Render API (optional — dashboard services list)",
    required: false,
  },
  {
    key: "AKASH_LCD_URL",
    label: "Akash LCD override (optional)",
    required: false,
  },
];

let failed = false;
const lines = ["\nNodeShare env check\n" + "=".repeat(50)];

for (const { key, label, required } of checks) {
  const val = env[key];
  const missing = !val || (required && isPlaceholder(val));
  if (missing) {
    if (required) {
      lines.push(`✗ ${key} — ${label} (missing or still a placeholder)`);
      failed = true;
    } else {
      lines.push(`○ ${key} — ${label} (optional, not set)`);
    }
  } else {
    lines.push(`✓ ${key} — ${label}`);
  }
}

lines.push("=".repeat(50));
if (failed) {
  lines.push(
    "\nFix: edit .env.local (copy from .env.example), replace placeholders, save, re-run npm run verify-env\n",
  );
  console.log(lines.join("\n"));
  process.exit(1);
}

lines.push("\nAll required variables look set. Run: npm run build && npm run start\n");
console.log(lines.join("\n"));
process.exit(0);
