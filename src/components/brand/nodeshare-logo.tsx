import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** NodeShare network mark — height-constrained, square aspect in sidebar/nav. */
const heightClass = {
  nav: "h-9 w-9 sm:h-10 sm:w-10",
  sidebar: "h-10 w-10",
  hero: "h-16 w-16 sm:h-20 sm:w-20",
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
      src="/nodeshare-network-mark.png"
      alt="NodeShare"
      width={256}
      height={256}
      sizes={
        size === "hero"
          ? "(max-width: 640px) 64px, 80px"
          : size === "sidebar"
            ? "40px"
            : "40px"
      }
      className={cn(
        "shrink-0 object-contain object-center",
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
