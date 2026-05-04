import { redirect } from "next/navigation";

/** Spot workflows consolidated under Marketplace. */
export default function RunJobRedirectPage() {
  redirect("/app/marketplace");
}
