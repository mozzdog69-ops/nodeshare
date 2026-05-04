import { ComputeOffersGrid } from "@/components/marketplace/compute-offers-grid";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Run job",
};

const jobs = [
  {
    title: "Image generation",
    desc: "SDXL / Flux pipelines on demand.",
    price: "$0.62/hr",
    eta: "~6 min / 1k images",
    gpu: "1× A10",
  },
  {
    title: "LLM inference",
    desc: "Open models with vLLM-ready images.",
    price: "$0.48/hr",
    eta: "Token streaming",
    gpu: "1× L40S",
  },
  {
    title: "Training job",
    desc: "Fine-tunes with checkpoint sync to IPFS.",
    price: "$2.10/hr",
    eta: "Depends on steps",
    gpu: "1× A100 40G",
  },
  {
    title: "Custom Docker",
    desc: "Bring your own image — we schedule it.",
    price: "From $0.35/hr",
    eta: "Pull + cold start",
    gpu: "Your pick",
  },
] as const;

export default function RunJobPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Run job</h1>
      </header>
      <div className="p-6">
        <p className="max-w-2xl text-sm text-text-secondary">
          GUI path for operators who do not live in a shell — same scheduling and
          escrow as the terminal.
        </p>

        <div className="mt-10 rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated/60 p-6 shadow-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Live offers
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
                Spot GPUs for this session
              </h2>
              <p className="mt-1 max-w-xl text-sm text-text-secondary">
                Same tiles as{" "}
                <Link
                  href="/app/marketplace"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  Marketplace
                </Link>
                . Pick capacity here, then configure a job template below.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ComputeOffersGrid
              reserveHref="/app/run-job"
              reserveLabel="Select & configure"
              offerQueryParam
            />
          </div>
        </div>

        <h2
          id="job-templates"
          className="mt-12 scroll-mt-24 text-xs font-semibold uppercase tracking-wider text-text-muted"
        >
          Job templates
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          What you want to run — pricing below is indicative; final cost uses the offer
          or bid you attach.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {jobs.map((j) => (
            <Card key={j.title} interactive className="flex flex-col">
              <CardHeader className="border-0 pb-0">
                <h2 className="text-base font-semibold text-text-primary">
                  {j.title}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">{j.desc}</p>
              </CardHeader>
              <CardContent className="mt-auto flex flex-1 flex-col pt-4">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Price</dt>
                    <dd className="font-mono font-semibold text-accent">
                      {j.price}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">ETA</dt>
                    <dd className="text-right text-text-secondary">{j.eta}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">GPU</dt>
                    <dd className="font-mono text-xs text-text-primary">{j.gpu}</dd>
                  </div>
                </dl>
                <Button className="mt-5 w-full">Configure</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
