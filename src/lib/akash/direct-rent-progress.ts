import {
  buildRentProgress,
  completeStepsBefore,
  createInitialRentProgress,
  type DirectRentProgressSnapshot,
  type DirectRentStepId,
  type DirectRentStepState,
} from "@/lib/akash/direct-rent-steps";

export type { DirectRentProgressSnapshot };

export class DirectRentProgressReporter {
  private snapshot: DirectRentProgressSnapshot = createInitialRentProgress();

  constructor(private readonly onProgress?: (p: DirectRentProgressSnapshot) => void) {}

  get current(): DirectRentProgressSnapshot {
    return this.snapshot;
  }

  private emit(patch: Parameters<typeof buildRentProgress>[0]) {
    this.snapshot = buildRentProgress({ ...patch, prior: this.snapshot });
    this.onProgress?.(this.snapshot);
  }

  start(message: string) {
    this.snapshot = createInitialRentProgress(message);
    this.onProgress?.(this.snapshot);
  }

  activate(stepId: DirectRentStepId, detail: string) {
    const steps = completeStepsBefore(this.snapshot.steps, stepId);
    steps[stepId] = { status: "active", detail };
    this.emit({ steps, message: detail });
  }

  complete(stepId: DirectRentStepId, detail?: string, txHash?: string) {
    const steps = completeStepsBefore(this.snapshot.steps, stepId);
    const next: DirectRentStepState = {
      status: "complete",
      detail,
      txHash,
    };
    steps[stepId] = { ...steps[stepId], ...next };
    this.emit({ steps, message: detail ?? this.snapshot.message });
  }

  skip(stepId: DirectRentStepId, detail: string) {
    const steps = { ...this.snapshot.steps };
    steps[stepId] = { status: "skipped", detail };
    this.emit({ steps, message: detail });
  }

  setDseq(dseq: number, message?: string, manifestJson?: string) {
    this.emit({
      steps: {},
      message: message ?? this.snapshot.message,
      dseq,
      manifestJson: manifestJson ?? this.snapshot.manifestJson,
    });
  }

  setManifestJson(manifestJson: string) {
    this.emit({ steps: {}, message: this.snapshot.message, manifestJson: manifestJson.trim() });
  }

  fail(stepId: DirectRentStepId, message: string) {
    const steps = { ...this.snapshot.steps };
    const cur = steps[stepId];
    steps[stepId] = { ...cur, status: "error", detail: message };
    this.emit({ steps, message, failedStep: stepId });
  }

  poll(stepId: DirectRentStepId, detail: string) {
    const steps = { ...this.snapshot.steps };
    const cur = steps[stepId];
    if (cur.status !== "active") {
      steps[stepId] = { status: "active", detail };
    } else {
      steps[stepId] = { ...cur, detail };
    }
    this.emit({ steps, message: detail });
  }
}
