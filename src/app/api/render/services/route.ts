import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error: "RENDER_API_KEY is not set",
        data: null,
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch("https://api.render.com/v1/services?limit=50", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      next: { revalidate: 0 },
    });

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

    const body = (await res.json()) as
      | unknown[]
      | {
          service?: unknown[];
          services?: unknown[];
        };
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body.service)
        ? body.service
        : Array.isArray(body.services)
          ? body.services
          : [];

    const slim = rawList.map((s: unknown) => {
      const o = s as Record<string, unknown>;
      return {
        id: o.id,
        name: o.name,
        type: o.type,
        serviceDetails: o.serviceDetails,
        suspended: o.suspended,
        updatedAt: o.updatedAt,
      };
    });

    return NextResponse.json({ ok: true, data: { services: slim } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg, data: null },
      { status: 500 },
    );
  }
}
