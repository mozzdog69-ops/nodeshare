import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = process.env.RENDER_API_KEY;
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "RENDER_API_KEY is not set", data: null },
      { status: 503 },
    );
  }
  if (!serviceId) {
    return NextResponse.json(
      { ok: false, error: "Missing serviceId query param", data: null },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys?limit=15`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
        },
        next: { revalidate: 0 },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          ok: false,
          error: `Render API ${res.status}: ${text.slice(0, 200)}`,
          data: null,
        },
        { status: 502 },
      );
    }

    const body = await res.json();
    return NextResponse.json({ ok: true, data: body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg, data: null },
      { status: 500 },
    );
  }
}
