import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FORWARD_HEADERS = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-user-address",
  "x-user-ts",
  "x-user-signature",
] as const;

const BAIRESPAY_NETLIFY = "https://bairespay.netlify.app";

function backendBases(): string[] {
  const primary = String(process.env.GPU_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
  const fallback = String(process.env.GPU_BACKEND_FALLBACK_URL || "")
    .trim()
    .replace(/\/$/, "");
  const bases = [primary, fallback].filter(Boolean);
  if (
    primary === "https://bairespay.com" &&
    !bases.includes(BAIRESPAY_NETLIFY)
  ) {
    bases.push(BAIRESPAY_NETLIFY);
  }
  return [...new Set(bases)];
}

async function proxyRequest(req: Request, pathSegments: string[]) {
  const bases = backendBases();
  const apiKey = String(process.env.GPU_API_KEY || "").trim();

  if (bases.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GPU marketplace backend is not configured. Set GPU_BACKEND_URL and GPU_API_KEY in Netlify env (see .env.example).",
      },
      { status: 503 },
    );
  }

  const subPath = pathSegments.join("/");
  const incoming = new URL(req.url);

  const headers = new Headers();
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  for (const name of FORWARD_HEADERS) {
    const val = req.headers.get(name);
    if (val) headers.set(name, val);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  const bodyText =
    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;
  if (bodyText !== undefined) {
    init.body = bodyText;
  }

  const errors: string[] = [];

  for (const backend of bases) {
    const target = `${backend}/api/marketplace/gpu/${subPath}${incoming.search}`;
    try {
      const res = await fetch(target, {
        ...init,
        signal: AbortSignal.timeout(55_000),
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") || "application/json",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${backend}: ${msg}`);
    }
  }

  const hint =
    bases.includes("https://bairespay.com") && errors.some((e) => /fetch failed|ssl|tls/i.test(e))
      ? " bairespay.com can fail TLS from Node on Windows — set GPU_BACKEND_URL=https://bairespay.netlify.app"
      : "";

  return NextResponse.json(
    {
      ok: false,
      error: `GPU backend unreachable: ${errors[errors.length - 1] ?? "unknown"}${hint}`,
    },
    { status: 502 },
  );
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function PUT(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}
