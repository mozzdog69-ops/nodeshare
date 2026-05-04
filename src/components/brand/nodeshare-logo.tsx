import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Vertical lockup (hex N + NODESHARE + .eth) — height-constrained, width follows aspect. */
const heightClass = {
  nav: "h-9 sm:h-10",
  sidebar: "h-10 max-w-[140px]",
  hero: "h-16 w-auto sm:h-[4.5rem]",
} as const;

export type NodeShareLogoSize = keyof typeof heightClass;

export function NodeShareLogo({
  size = "nav",
  className,
  href = "/",
}: {
  size?: NodeShareLogoSize;
  className?: string;
  /** Pass `null` to render without a link (e.g. inside an existing anchor). */
  href?: string | null;
}) {
  const img = (
    <Image
      src="/nodeshare-logo.png"
      alt="NodeShare"
      width={200}
      height={236}
      sizes={size === "hero" ? "(max-width: 640px) 160px, 200px" : "140px"}
      className={cn(
        "w-auto object-contain object-left",
        heightClass[size],
        className,
      )}
      priority={size === "nav" || size === "hero"}
    />
  );

  if (href === null) {
    return <span className="inline-flex items-center">{img}</span>;
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg outline-none ring-offset-2 ring-offset-surface-base focus-visible:ring-2 focus-visible:ring-accent"
    >
      {img}
    </Link>
  );
}
