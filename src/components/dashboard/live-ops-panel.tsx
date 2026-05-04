"use client";

import { apiUrl } from "@/lib/api-base";
import { ordersToOfferCards } from "@/lib/akash/summarize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type RenderSvc = {
  id?: string;
  name?: string;
  type?: string;
  suspended?: string;
};

export function LiveOpsPanel() {
  const [render, setRender] = useState<{
    ok: boolean;
    services: RenderSvc[];
    error?: string;
  }>({ ok: false, services: [] });
  const [akash, setAkash] = useState<{
    ok: boolean;
    count: number;
    sample: unknown[];
    source?: string;
    error?: string;
  }>({ ok: false, count: 0, sample: [] });

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      fetch(apiUrl("/api/render/services")),
      fetch(apiUrl("/api/akash/market?limit=12")),
    ]);
    const rj = (await r.json()) as {
      ok: boolean;
      data?: { services: RenderSvc[] };
      error?: string;
    };
    if (rj.ok && rj.data?.services)
      setRender({ ok: true, services: rj.data.services, error: rj.error });
    else setRender({ ok: false, services: [], error: rj.error });

    const aj = (await a.json()) as {
      ok: boolean;
      data?: { orders: unknown[]; source?: string };
      error?: string;
    };
    if (aj.ok && aj.data?.orders) {
      const orders = aj.data.orders;
      setAkash({
        ok: true,
        count: orders.length,
        sample: orders.slice(0, 3),
        source: aj.data.source,
        error: aj.error,
      });
    } else
      setAkash({
        ok: false,
        count: 0,
        sample: [],
        error: aj.error,
      });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Render (optional)
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Lists services when{" "}
              <code className="rounded bg-surface-base px-1 font-mono text-xs">
                RENDER_API_KEY
              </code>{" "}
              is set. Many teams can’t get Render API access — NodeShare works
              fine with only RPC + Etherscan for purchases.
            </p>
          </div>
          <Button variant="ghost" className="text-xs" type="button" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {!render.ok ? (
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="text-amber-800">
                {render.error?.includes("RENDER_API_KEY")
                  ? "Render API key not configured — skipped by design if your Render plan blocks API access."
                  : (render.error ?? "Render API unavailable.")}
              </p>
              <p className="text-xs text-text-muted">
                Track Render workloads in the Render dashboard; use this app for wallet,
                Akash mesh, and job flows.
              </p>
            </div>
          ) : render.services.length === 0 ? (
            <p className="text-sm text-text-muted">No services returned.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-auto text-sm">
              {render.services.map((s) => (
                <li
                  key={String(s.id)}
                  className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-base px-3 py-2"
                >
                  <span className="font-medium text-text-primary">{s.name ?? s.id}</span>
                  <span className="text-xs text-text-muted">
                    {s.type} {s.suspended === "yes" ? "· suspended" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {render.ok && render.services[0]?.id ? (
            <p className="mt-3 text-xs text-text-muted">
              Deploy history: GET{" "}
              <code className="rounded bg-surface-base px-1 font-mono">
                /api/render/deploys?serviceId=
                {String(render.services[0].id).slice(0, 8)}…
              </code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Akash market (live)
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Open orders from a public LCD ({akash.source ? "reachable" : "n/a"}).
            </p>
          </div>
          <Button variant="ghost" className="text-xs" type="button" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {!akash.ok ? (
            <p className="text-sm text-amber-800">
              {akash.error ?? "Akash market feed unavailable."}
            </p>
          ) : (
            <>
              <p className="font-mono text-2xl font-semibold text-text-primary">
                {akash.count}{" "}
                <span className="text-sm font-normal text-text-muted">open orders (page)</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {ordersToOfferCards(akash.sample, 3).map((o) => (
                  <li
                    key={o.id}
                    className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2"
                  >
                    <p className="font-medium text-text-primary">{o.title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{o.gpu}</p>
                    <p className="mt-1 font-mono text-sm text-accent">{o.price}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
