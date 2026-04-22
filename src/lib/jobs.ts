// ============================================================
// 任务存储（Phase 1: 文件持久化，Phase 2: 迁移到 Redis/DB）
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { GenerationJob } from "./types";

const JOBS_FILE = join(process.cwd(), ".data", "jobs.json");

// 内存缓存
let jobsCache: Map<string, GenerationJob> | null = null;

function loadJobs(): Map<string, GenerationJob> {
  if (jobsCache) return jobsCache;

  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(JOBS_FILE)) {
    writeFileSync(JOBS_FILE, "{}", "utf-8");
    jobsCache = new Map();
    return jobsCache;
  }

  try {
    const raw = readFileSync(JOBS_FILE, "utf-8");
    const obj = JSON.parse(raw) as Record<string, GenerationJob>;
    jobsCache = new Map(Object.entries(obj));
    return jobsCache!;
  } catch {
    jobsCache = new Map();
    return jobsCache;
  }
}

function saveJobs() {
  if (!jobsCache) return;
  const obj = Object.fromEntries(jobsCache);
  writeFileSync(JOBS_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

export const jobs = {
  get(id: string): GenerationJob | undefined {
    return loadJobs().get(id);
  },

  set(id: string, job: GenerationJob): void {
    loadJobs().set(id, job);
    saveJobs();
  },

  has(id: string): boolean {
    return loadJobs().has(id);
  },

  delete(id: string): boolean {
    const result = loadJobs().delete(id);
    saveJobs();
    return result;
  },
};
