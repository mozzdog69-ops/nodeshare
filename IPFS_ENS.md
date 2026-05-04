# NodeShare on IPFS + your `.eth` domain

Next.js **API routes** (`/api/chain/*`, `/api/render/*`, …) need a **Node server**. A pure IPFS folder is only **static files**, so this repo uses a **split**:

1. **HTTPS “API” deployment** — full Next app on **Vercel** (or similar) with env vars + `/api/*` working. `vercel.json` adds **CORS** so the IPFS site can call it.
2. **Static IPFS site** — `npm run export:ipfs` writes **`out/`** (no `src/app/api` in that build). Set **`NEXT_PUBLIC_API_BASE`** to the API deployment origin **before** running the export build.

---

## Step A — API deployment (Vercel)

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add all env vars from `.env.example` (at least RPC + Etherscan + `NEXT_PUBLIC_APP_URL`).
3. Deploy. Copy the production URL, e.g. `https://nodeshare-xxxxx.vercel.app`.

---

## Step B — Build the IPFS bundle

In `.env.local` (or CI env) for the **export** build only, set:

```bash
NEXT_PUBLIC_API_BASE=https://nodeshare-xxxxx.vercel.app
```

Use the **exact** Vercel origin (no trailing slash). Then:

```bash
npm run export:ipfs
```

This produces **`out/`**. Upload **`out/`** contents (not the repo) to IPFS:

- [Pinata](https://pinata.cloud/) → Upload folder  
- [web3.storage](https://web3.storage/) / [NFT.Storage](https://nft.storage/)  
- [IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/) → Import folder → Copy CID  

Note the **CID** (starts with `Qm…` or `bafy…`).

---

## Step C — ENS (`yourname.eth`)

1. Open [app.ens.domains](https://app.ens.domains) and connect the wallet that owns the name.
2. Open your name → **Records** → **Content** (contenthash).
3. Set protocol to **IPFS** and paste the **CID**, or use an **IPNS** name if you use mutable pinning.
4. Save transaction on Ethereum L1.

**Gateways:** Visitors resolve `https://yourname.eth.limo` or `https://yourname.eth.link` (Brave supports `yourname.eth` directly). These gateways fetch your CID.

---

## Step D — RPC keys & CORS

- The IPFS site runs in the browser and calls **`NEXT_PUBLIC_API_BASE/api/...`**. Your Vercel project includes **`vercel.json`** CORS headers for `/api/*`.
- Restrict **Alchemy/Infura** keys by **origin** where possible; IPFS gateways use varied origins — you may need a dedicated RPC key with broader allowance for the static site, or proxy RPC yourself on the API host later.

---

## If you only want `.eth` → HTTPS (no IPFS)

You can set an **ENS “text”** record or use the app’s **forwarding** / **linked** profile to your Vercel URL without hosting files on IPFS. That’s the simplest “live + .eth” path.

---

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Blank balances on IPFS site | `NEXT_PUBLIC_API_BASE` wrong or API not deployed; check browser Network tab for `/api/chain/balances`. |
| CORS errors | Redeploy API on Vercel with this repo’s `vercel.json`. |
| `export:ipfs` fails | Close editors locking `src/app/api`. Delete `src/app/_api_ipfs_export_backup` if a run stopped mid-way. On Windows, copy+delete is used instead of rename. |
| ENS shows old site | IPFS propagation + clear gateway cache; contenthash must match new CID. |
