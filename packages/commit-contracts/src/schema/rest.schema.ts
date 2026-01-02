import { z } from 'zod';
import {
  CommitPlanSchema,
  GitStatusSchema,
  FileSummarySchema,
  ApplyResultSchema,
  PushResultSchema,
} from '../schema';

// ============================================================================
// Workspace Management
// ============================================================================

/**
 * Single workspace entry
 */
export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

/**
 * GET /workspaces response
 */
export const WorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
});

export type WorkspacesResponse = z.infer<typeof WorkspacesResponseSchema>;

// ============================================================================
// Status
// ============================================================================

/**
 * GET /status?workspace=X response
 */
export const StatusResponseSchema = z.object({
  workspace: z.string(),
  hasPlan: z.boolean(),
  planTimestamp: z.string().datetime().optional(),
  gitStatus: GitStatusSchema.optional(),
  filesChanged: z.number().int().min(0).default(0),
  commitsInPlan: z.number().int().min(0).default(0),
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// ============================================================================
// Generate Plan
// ============================================================================

/**
 * POST /generate request body
 */
export const GenerateRequestSchema = z.object({
  workspace: z.string().min(1),
  scope: z.string().optional(),
  dryRun: z.boolean().default(false),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * POST /generate response
 */
export const GenerateResponseSchema = z.object({
  plan: CommitPlanSchema,
  planPath: z.string(),
  workspace: z.string(),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

// ============================================================================
// Get Plan
// ============================================================================

/**
 * GET /plan?workspace=X response
 */
export const PlanResponseSchema = z.object({
  hasPlan: z.boolean(),
  plan: CommitPlanSchema.optional(),
  workspace: z.string(),
});

export type PlanResponse = z.infer<typeof PlanResponseSchema>;

// ============================================================================
// Apply Commits
// ============================================================================

/**
 * POST /apply request body
 */
export const ApplyRequestSchema = z.object({
  workspace: z.string().min(1),
  force: z.boolean().default(false),
});

export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;

/**
 * POST /apply response
 */
export const ApplyResponseSchema = z.object({
  result: ApplyResultSchema,
  workspace: z.string(),
});

export type ApplyResponse = z.infer<typeof ApplyResponseSchema>;

// ============================================================================
// Push Commits
// ============================================================================

/**
 * POST /push request body
 */
export const PushRequestSchema = z.object({
  workspace: z.string().min(1),
  remote: z.string().default('origin'),
  force: z.boolean().default(false),
});

export type PushRequest = z.infer<typeof PushRequestSchema>;

/**
 * POST /push response
 */
export const PushResponseSchema = z.object({
  result: PushResultSchema,
  workspace: z.string(),
});

export type PushResponse = z.infer<typeof PushResponseSchema>;

// ============================================================================
// Reset Plan
// ============================================================================

/**
 * DELETE /plan response
 */
export const ResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  workspace: z.string(),
});

export type ResetResponse = z.infer<typeof ResetResponseSchema>;

// ============================================================================
// Git Status
// ============================================================================

/**
 * GET /git-status?workspace=X response
 */
export const GitStatusResponseSchema = z.object({
  workspace: z.string(),
  status: GitStatusSchema,
  summaries: z.array(FileSummarySchema),
  totalFiles: z.number().int().min(0),
});

export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;

// ============================================================================
// File Diff
// ============================================================================

/**
 * GET /diff?workspace=X&file=Y response
 */
export const FileDiffResponseSchema = z.object({
  workspace: z.string(),
  file: z.string(),
  diff: z.string(),
  additions: z.number().int().min(0).default(0),
  deletions: z.number().int().min(0).default(0),
});

export type FileDiffResponse = z.infer<typeof FileDiffResponseSchema>;

// ============================================================================
// Summarize Changes
// ============================================================================

/**
 * POST /summarize request body
 */
export const SummarizeRequestSchema = z.object({
  workspace: z.string().min(1),
  /** Optional file path - if provided, summarize only this file */
  file: z.string().optional(),
});

export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

/**
 * POST /summarize response
 */
export const SummarizeResponseSchema = z.object({
  workspace: z.string(),
  file: z.string().optional(),
  summary: z.string(),
  /** Token usage for the LLM call */
  tokensUsed: z.number().int().min(0).optional(),
});

export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;
