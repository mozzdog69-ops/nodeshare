import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { OffersSection } from "@/components/landing/offers-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { NodeGraphBg } from "@/components/landing/node-graph-bg";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-surface-base">
      <NodeGraphBg />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <NodeShareLogo size="nav" />
        <nav className="flex items-center gap-3">
          <Link
            href="/network"
            className="hidden text-sm font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline"
          >
            View network
          </Link>
          <Button className="px-5" asChild>
            <Link href="/login">Launch app</Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-10 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Decentralized AI compute OS
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl sm:leading-[1.08]">
          Decentralized compute for AI workloads
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Rent GPUs. Run AI in a terminal. Pay with crypto. No traditional cloud
          lock-in — control that feels like AWS, infrastructure that behaves like
          the open web.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button className="px-8 py-3.5 text-base" asChild>
            <Link href="/login">Launch app</Link>
          </Button>
          <Button variant="secondary" className="px-8 py-3.5 text-base" asChild>
            <Link href="/network">View network</Link>
          </Button>
        </div>
      </main>

      <OffersSection />

      <div className="relative z-10 mt-auto">
        <TrustStrip />
        <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-text-muted">
          NodeShare — the first decentralized AI compute operating system.
        </footer>
      </div>
    </div>
  );
}
