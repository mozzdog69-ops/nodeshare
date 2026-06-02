import { StuckOrdersPanel } from "@/components/gpu/stuck-orders-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stuck orders",
  description: "Close open Akash GPU deployments and recover ACT escrow",
};

export default function StuckOrdersPage() {
  return <StuckOrdersPanel />;
}
