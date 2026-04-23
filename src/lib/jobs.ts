// ============================================================
// 任务存储（Vercel: 纯内存 / 本地/其他: 文件持久化）
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { GenerationJob } from "./types";

const JOBS_FILE = join(process.cwd(), ".data", "jobs.json");

// 内存缓存
let jobsCache: Map<string, GenerationJob> | null = null;

// 是否为只读环境（Vercel / 未知文件系统）
function isReadonlyEnv(): boolean {
  if (process.env.VERCEL) return true;
  try {
    const dir = join(process.cwd(), ".data");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(JOBS_FILE, "test", "utf-8");
    return false; // 写入成功，非只读
  } catch {
    return true; // 写入失败，只读环境
  }
}

const READONLY = isReadonlyEnv();

function loadJobs(): Map<string, GenerationJob> {
  if (jobsCache) return jobsCache;

  if (READONLY) {
    jobsCache = new Map();
    return jobsCache;
  }

  try {
    const dir = join(process.cwd(), ".data");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(JOBS_FILE)) {
      writeFileSync(JOBS_FILE, "{}", "utf-8");
      jobsCache = new Map();
      return jobsCache;
    }

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
  if (!jobsCache || READONLY) return;
  try {
    const obj = Object.fromEntries(jobsCache);
    writeFileSync(JOBS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // 写入失败，静默忽略（内存已更新）
  }
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

  entries(): IterableIterator<[string, GenerationJob]> {
    return loadJobs().entries();
  },

  [Symbol.iterator](): IterableIterator<[string, GenerationJob]> {
    return loadJobs().entries();
  },
};
