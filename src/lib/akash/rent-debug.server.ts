/** Server-side gate for Akash rent debug API routes. */

export function isAkashRentDebugRequest(req: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.AKASH_RENT_DEBUG === "true") return true;
  if (req.headers.get("x-nodeshare-rent-debug") === "1") return true;
  return new URL(req.url).searchParams.get("rentDebug") === "1";
}
