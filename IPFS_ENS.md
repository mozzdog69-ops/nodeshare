# NodeShare on IPFS + your `.eth` domain

Next.js **API routes** (`/api/chain/*`, `/api/akash/*`, …) need a **Node server**. A pure IPFS folder is only **static files**, so this repo uses a **split**:

1. **HTTPS API host (Netlify)** — full Next app with env vars + `/api/*`. CORS for `/api/*` is in **`netlify.toml`**.
2. **Static IPFS site** — `npm run export:ipfs` writes **`out/`**. Set **`NEXT_PUBLIC_API_BASE`** to your **Netlify** URL **before** exporting.

You do **not** need Vercel for this project.

---

## Step A — Deploy on Netlify (API + app)

1. [Netlify](https://www.netlify.com/) → Add site → Import from Git → this repo.
2. Build uses **`netlify.toml`** (`npm run build` + `@netlify/plugin-nextjs`).
3. Add env vars from **`.env.example`** (at minimum):
   - `ETH_RPC_URL` / `NEXT_PUBLIC_ETH_RPC_URL` (full Alchemy URL)
   - `ETHERSCAN_API_KEY`
   - `CHAIN_ID` / `NEXT_PUBLIC_CHAIN_ID`
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://nodeshare.eth.limo` or your Netlify URL)
4. Deploy. Copy production URL, e.g. `https://nodesharev1.netlify.app`.
5. Confirm: `https://YOUR-SITE.netlify.app/api/build-info` → `ethRpcProbe.ok: true`.

**Do not set** `NEXT_PUBLIC_API_BASE` on the Netlify site itself (only needed for the IPFS export build).

---

## Step B — Build the IPFS bundle

In `.env.local` for the **export** on your PC:

```bash
NEXT_PUBLIC_API_BASE=https://nodesharev1.netlify.app
NEXT_PUBLIC_APP_URL=https://nodeshare.eth.limo
# … other NEXT_PUBLIC_* / keys as needed for the export build
```

Use your **exact** Netlify origin (no trailing slash). Then:

```bash
npm run export:ipfs
```

Upload **`out/`** (folder contents, not the repo) to IPFS (Pinata, web3.storage, etc.) and note the **CID**.

---

## Step C — ENS (`yourname.eth`)

1. [app.ens.domains](https://app.ens.domains) → your name → **Records** → **Content** (contenthash).
2. Set **IPFS** + your **CID** (or IPNS for mutable pins).
3. Save on Ethereum L1.

Gateways: `https://yourname.eth.limo`, `https://yourname.eth.link`, or Brave `yourname.eth`.

---

## Step D — When you change env or code

| Change | Action |
|--------|--------|
| Netlify env (RPC, Etherscan) | Redeploy on Netlify |
| App UI / `NEXT_PUBLIC_*` used on IPFS | Re-run `export:ipfs` → pin new `out/` → update ENS contenthash |
| Only using Netlify URL (no IPFS) | Just redeploy Netlify — no IPFS step |

---

## Optional: `.eth` → Netlify without IPFS

Point ENS **text** / forwarding to your Netlify URL, or use the app only at `https://YOUR-SITE.netlify.app`.

---

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Blank balances on `.eth.limo` | `NEXT_PUBLIC_API_BASE` must be your **Netlify** URL; re-export IPFS if it still says `api.example.com`. |
| CORS errors | Redeploy Netlify; `netlify.toml` allows `/api/*` from browsers. |
| `export:ipfs` fails | Close editors locking `src/app/api`. Delete `src/app/_api_ipfs_export_backup` if a run stopped mid-way. |
| ENS shows old site | New CID + contenthash; gateway cache can lag. |
