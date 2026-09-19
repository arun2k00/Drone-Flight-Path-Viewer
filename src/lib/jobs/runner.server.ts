import "server-only";
import { runExportJob } from "./export-service.server";

/** In-process, one active job at a time; a plain FIFO queue behind it. */
export class JobRunner {
  private queue: string[] = [];
  private active: { jobId: string; controller: AbortController } | null = null;

  enqueue(jobId: string): void {
    if (this.active?.jobId === jobId || this.queue.includes(jobId)) return;
    this.queue.push(jobId);
    void this.pump();
  }

  /** Returns false if the job is not queued or running in this process. */
  cancel(jobId: string): boolean {
    const i = this.queue.indexOf(jobId);
    if (i >= 0) {
      this.queue.splice(i, 1);
      return true;
    }
    if (this.active?.jobId === jobId) {
      this.active.controller.abort();
      return true;
    }
    return false;
  }

  isBusy(): boolean {
    return this.active !== null;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const jobId = this.queue.shift();
    if (!jobId) return;
    const controller = new AbortController();
    this.active = { jobId, controller };
    try {
      await runExportJob(jobId, controller.signal); // never throws — records failures itself
    } finally {
      this.active = null;
      void this.pump();
    }
  }
}

export function getJobRunner(): JobRunner {
  const g = globalThis as unknown as { __dtsJobRunner?: JobRunner };
  return (g.__dtsJobRunner ??= new JobRunner());
}
