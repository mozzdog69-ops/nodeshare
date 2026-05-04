/** Console navigation — shared by sidebar, mobile drawer, and quick bar. */
export const APP_NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/marketplace", label: "Marketplace" },
  { href: "/app/terminal", label: "Terminal" },
  { href: "/app/wallet", label: "Wallet" },
  { href: "/app/network", label: "Compute Nodes" },
  { href: "/app/history", label: "History" },
  { href: "/app/settings", label: "Settings" },
] as const;

/** Primary thumb targets — shown on mobile quick bar (subset). */
export const APP_QUICK_ITEMS = [
  { href: "/app/dashboard", label: "Home", short: "Dash" },
  { href: "/app/marketplace", label: "Market", short: "Shop" },
  { href: "/app/terminal", label: "Shell", short: "Term" },
  { href: "/app/wallet", label: "Wallet", short: "Funds" },
] as const;
