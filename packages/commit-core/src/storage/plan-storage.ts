/**
 * Commit plan storage in .kb/commit/
 */

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { CommitPlan, ApplyResult, GitStatusSnapshot } from '@kb-labs/commit-contracts';
import { CommitPlanSchema, GitStatusSnapshotSchema } from '@kb-labs/commit-contracts';
import { getGitStatus } from '../analyzer/git-status';
import { getFileSummaries } from '../analyzer/file-summary';

const COMMIT_DIR = '.kb/commit';
const CURRENT_DIR = 'current';
const HISTORY_DIR = 'history';
const PLAN_FILE = 'plan.json';
const STATUS_FILE = 'status.json';
const RESULT_FILE = 'result.json';

/**
 * Get path to commit storage directory
 */
export function getCommitStoragePath(cwd: string): string {
  return join(cwd, COMMIT_DIR);
}

/**
 * Get path to current plan file
 */
export function getCurrentPlanPath(cwd: string): string {
  return join(cwd, COMMIT_DIR, CURRENT_DIR, PLAN_FILE);
}

/**
 * Get path to current status file
 */
export function getCurrentStatusPath(cwd: string): string {
  return join(cwd, COMMIT_DIR, CURRENT_DIR, STATUS_FILE);
}

/**
 * Save commit plan to storage
 */
export async function savePlan(cwd: string, plan: CommitPlan): Promise<void> {
  const planPath = getCurrentPlanPath(cwd);
  const statusPath = getCurrentStatusPath(cwd);

  // Ensure directory exists
  await mkdir(dirname(planPath), { recursive: true });

  // Save plan
  await writeFile(planPath, JSON.stringify(plan, null, 2));

  // Save status snapshot
  const status = await getGitStatus(cwd);
  const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];
  const summaries = await getFileSummaries(cwd, allFiles);

  const snapshot: GitStatusSnapshot = {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    status,
    summaries,
  };

  await writeFile(statusPath, JSON.stringify(snapshot, null, 2));
}

/**
 * Load current commit plan from storage
 */
export async function loadPlan(cwd: string): Promise<CommitPlan | null> {
  const planPath = getCurrentPlanPath(cwd);

  try {
    const content = await readFile(planPath, 'utf-8');
    const data = JSON.parse(content);

    // Validate with schema
    const result = CommitPlanSchema.safeParse(data);
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

/**
 * Load current status snapshot from storage
 */
export async function loadStatus(cwd: string): Promise<GitStatusSnapshot | null> {
  const statusPath = getCurrentStatusPath(cwd);

  try {
    const content = await readFile(statusPath, 'utf-8');
    const data = JSON.parse(content);

    const result = GitStatusSnapshotSchema.safeParse(data);
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

/**
 * Check if a plan exists
 */
export async function hasPlan(cwd: string): Promise<boolean> {
  const plan = await loadPlan(cwd);
  return plan !== null;
}

/**
 * Clear current commit plan
 */
export async function clearPlan(cwd: string): Promise<void> {
  const currentDir = join(cwd, COMMIT_DIR, CURRENT_DIR);

  try {
    await rm(currentDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}

/**
 * Save plan and result to history
 */
export async function saveToHistory(
  cwd: string,
  plan: CommitPlan,
  result: ApplyResult
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const historyDir = join(cwd, COMMIT_DIR, HISTORY_DIR, timestamp);

  await mkdir(historyDir, { recursive: true });

  await writeFile(join(historyDir, PLAN_FILE), JSON.stringify(plan, null, 2));
  await writeFile(join(historyDir, RESULT_FILE), JSON.stringify(result, null, 2));
}

/**
 * List history entries
 */
export async function listHistory(
  cwd: string
): Promise<Array<{ timestamp: string; path: string }>> {
  const historyDir = join(cwd, COMMIT_DIR, HISTORY_DIR);

  try {
    const entries = await readdir(historyDir, { withFileTypes: true });

    return entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        timestamp: e.name,
        path: join(historyDir, e.name),
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Newest first
  } catch {
    return [];
  }
}

/**
 * Initialize storage directory structure
 */
export async function initStorage(cwd: string): Promise<void> {
  const dirs = [
    join(cwd, COMMIT_DIR, CURRENT_DIR),
    join(cwd, COMMIT_DIR, HISTORY_DIR),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
