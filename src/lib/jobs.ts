// 共享任务存储（Phase 1 用内存，Phase 2 迁移到 Redis/DB）
import type { GenerationJob } from './types';

export const jobs = new Map<string, GenerationJob>();
