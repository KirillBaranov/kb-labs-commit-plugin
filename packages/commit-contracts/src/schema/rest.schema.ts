import { z } from 'zod';
import {
  CommitPlanSchema,
  GitStatusSchema,
  FileSummarySchema,
  ApplyResultSchema,
  PushResultSchema,
} from '../schema';

// ============================================================================
// Scopes
// ============================================================================

/**
 * Single scope entry
 */
export const ScopeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
});

export type Scope = z.infer<typeof ScopeSchema>;

/**
 * GET /scopes response
 */
export const ScopesResponseSchema = z.object({
  scopes: z.array(ScopeSchema),
});

export type ScopesResponse = z.infer<typeof ScopesResponseSchema>;

// ============================================================================
// Status
// ============================================================================

/**
 * GET /status?scope=X response
 */
export const StatusResponseSchema = z.object({
  scope: z.string().default('root'),
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
  scope: z.string().default('root'),
  dryRun: z.boolean().default(false),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * POST /generate response
 */
export const GenerateResponseSchema = z.object({
  plan: CommitPlanSchema,
  planPath: z.string(),
  scope: z.string().default('root'),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

// ============================================================================
// Get Plan
// ============================================================================

/**
 * GET /plan?scope=X response
 */
export const PlanResponseSchema = z.object({
  hasPlan: z.boolean(),
  plan: CommitPlanSchema.optional(),
  scope: z.string().default('root'),
});

export type PlanResponse = z.infer<typeof PlanResponseSchema>;

// ============================================================================
// Apply Commits
// ============================================================================

/**
 * POST /apply request body
 */
export const ApplyRequestSchema = z.object({
  scope: z.string().default('root'),
  force: z.boolean().default(false),
});

export type ApplyRequest = z.infer<typeof ApplyRequestSchema>;

/**
 * POST /apply response
 */
export const ApplyResponseSchema = z.object({
  result: ApplyResultSchema,
  scope: z.string().default('root'),
});

export type ApplyResponse = z.infer<typeof ApplyResponseSchema>;

// ============================================================================
// Push Commits
// ============================================================================

/**
 * POST /push request body
 */
export const PushRequestSchema = z.object({
  scope: z.string().default('root'),
  remote: z.string().default('origin'),
  force: z.boolean().default(false),
});

export type PushRequest = z.infer<typeof PushRequestSchema>;

/**
 * POST /push response
 */
export const PushResponseSchema = z.object({
  result: PushResultSchema,
  scope: z.string().default('root'),
});

export type PushResponse = z.infer<typeof PushResponseSchema>;

// ============================================================================
// Reset Plan
// ============================================================================

/**
 * DELETE /plan?scope=X response
 */
export const ResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  scope: z.string().default('root'),
});

export type ResetResponse = z.infer<typeof ResetResponseSchema>;

// ============================================================================
// Git Status
// ============================================================================

/**
 * GET /git-status?scope=X response
 */
export const GitStatusResponseSchema = z.object({
  scope: z.string().default('root'),
  status: GitStatusSchema,
  summaries: z.array(FileSummarySchema),
  totalFiles: z.number().int().min(0),
});

export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;

// ============================================================================
// File Diff
// ============================================================================

/**
 * GET /diff?scope=X&file=Y response
 */
export const FileDiffResponseSchema = z.object({
  scope: z.string().default('root'),
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
  scope: z.string().default('root'),
  /** Optional file path - if provided, summarize only this file */
  file: z.string().optional(),
});

export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

/**
 * POST /summarize response
 */
export const SummarizeResponseSchema = z.object({
  scope: z.string().default('root'),
  file: z.string().optional(),
  summary: z.string(),
  /** Token usage for the LLM call */
  tokensUsed: z.number().int().min(0).optional(),
});

export type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;
