import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { OffersSection } from "@/components/landing/offers-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { NodeGraphBg } from "@/components/landing/node-graph-bg";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const features = [
  { title: "Live Akash bids", desc: "GPU specs & on-chain spot rates" },
  { title: "ETH + stablecoins", desc: "USDC / USDT balances & history" },
  { title: "Balance-gated terminal", desc: "Run workloads after you fund" },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <div className="h-1 w-full bg-accent" aria-hidden />

      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface-glass backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NodeShareLogo size="nav" href="/" />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/network"
              className="hidden px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-accent sm:inline"
            >
              Network
            </Link>
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button className="px-5 shadow-[var(--shadow-red)]" asChild>
              <Link href="/login">Launch app</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-mesh-pattern">
        <NodeGraphBg variant="hero" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-border-accent bg-surface-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="size-1.5 rounded-full bg-live" />
            Akash mainnet · live data
          </p>
          <h1 className="mt-8 max-w-4xl text-4xl font-bold tracking-tight text-text-primary sm:text-6xl sm:leading-[1.05]">
            Decentralized compute
            <span className="text-accent"> for AI</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Rent GPUs on Akash. Pay with crypto. Operate from a terminal that feels like
            a cloud console — without locking you into one vendor.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button className="px-8 py-3.5 text-base" asChild>
              <Link href="/login">Get started</Link>
            </Button>
            <Button variant="secondary" className="px-8 py-3.5 text-base" asChild>
              <Link href="/app/marketplace">Browse live offers</Link>
            </Button>
          </div>

          <ul className="mt-16 grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <li
                key={f.title}
                className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated p-5 shadow-card"
              >
                <p className="text-sm font-semibold text-text-primary">{f.title}</p>
                <p className="mt-1 text-sm text-text-muted">{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <OffersSection />

      <TrustStrip />
      <footer className="border-t border-border-subtle bg-surface-subtle py-10">
        <p className="text-center text-sm text-text-muted">
          NodeShare — decentralized compute on Akash & Ethereum
        </p>
      </footer>
    </div>
  );
}
