import { GpuTerminalPanel } from "@/components/gpu/gpu-terminal-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GPU Terminal",
};

export default async function GpuTerminalPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <GpuTerminalPanel jobId={decodeURIComponent(jobId)} />;
}
