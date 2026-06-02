import { GpuJobsPanel } from "@/components/gpu/gpu-jobs-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GPU Jobs",
};

export default function GpuJobsPage() {
  return <GpuJobsPanel />;
}
