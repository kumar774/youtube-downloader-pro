import fs from "fs";

export interface JobState {
  id: string;
  type: "merge" | "convert";
  title: string;
  thumbnail?: string;
  qualityLabel?: string;
  turbo?: boolean;
  status: "starting" | "downloading" | "merging" | "completed" | "failed" | "cancelled";
  percent: number;
  stage: string;
  speed?: string;
  eta?: string;
  error?: string;
  tempFilePath?: string;
  childProcess?: any;
  listeners: Set<(data: Partial<JobState>) => void>;
  createdAt: number;
}

// Global registry across Next.js dev server reloads
const globalJobs = (globalThis as any).__YT_JOBS || new Map<string, JobState>();
(globalThis as any).__YT_JOBS = globalJobs;

export function createJob(params: {
  id: string;
  type: "merge" | "convert";
  title: string;
  thumbnail?: string;
  qualityLabel?: string;
  turbo?: boolean;
}): JobState {
  const job: JobState = {
    id: params.id,
    type: params.type,
    title: params.title,
    thumbnail: params.thumbnail,
    qualityLabel: params.qualityLabel,
    turbo: params.turbo ?? true,
    status: "starting",
    percent: 0,
    stage: "Connecting to server...",
    listeners: new Set(),
    createdAt: Date.now(),
  };

  globalJobs.set(params.id, job);
  cleanupOldJobs();
  return job;
}

export function getJob(id: string): JobState | undefined {
  return globalJobs.get(id);
}

export function updateJob(id: string, updates: Partial<JobState>) {
  const job = globalJobs.get(id);
  if (!job) return;

  Object.assign(job, updates);

  // Notify all SSE subscribers
  const payload = {
    id: job.id,
    status: job.status,
    percent: job.percent,
    stage: job.stage,
    speed: job.speed,
    eta: job.eta,
    error: job.error,
    turbo: job.turbo,
  };

  job.listeners.forEach((listener: (data: any) => void) => {
    try {
      listener(payload);
    } catch (e) {
      // Ignore disconnected listener
    }
  });
}

export function cancelJob(id: string): boolean {
  const job = globalJobs.get(id);
  if (!job) return false;

  if (job.childProcess) {
    try {
      job.childProcess.kill("SIGKILL");
    } catch (e) {}
  }

  if (job.tempFilePath && fs.existsSync(job.tempFilePath)) {
    try {
      fs.unlinkSync(job.tempFilePath);
    } catch (e) {}
  }

  updateJob(id, {
    status: "cancelled",
    stage: "Cancelled by user",
    percent: 0,
  });

  return true;
}

export function cleanupJob(id: string) {
  const job = globalJobs.get(id);
  if (!job) return;

  if (job.tempFilePath && fs.existsSync(job.tempFilePath)) {
    try {
      fs.unlinkSync(job.tempFilePath);
    } catch (e) {}
  }

  globalJobs.delete(id);
}

function cleanupOldJobs() {
  const now = Date.now();
  const TTL = 15 * 60 * 1000; // 15 minutes

  for (const [id, job] of globalJobs.entries()) {
    if (now - job.createdAt > TTL) {
      if (job.tempFilePath && fs.existsSync(job.tempFilePath)) {
        try {
          fs.unlinkSync(job.tempFilePath);
        } catch (e) {}
      }
      globalJobs.delete(id);
    }
  }
}

