/**
 * Core types for KB Labs Commit Plugin
 *
 * Note: Zod schemas and inferred types are in @kb-labs/commit-contracts.
 * This file contains internal types used within commit-core.
 */

// Re-export types from contracts for convenience
export type {
  ConventionalType,
  ReleaseHint,
  GitStatus,
  FileSummary,
  CommitGroup,
  CommitPlan,
  GitStatusSnapshot,
  ApplyResult,
  PushResult,
} from '@kb-labs/commit-contracts';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Options for generating a commit plan
 *
 * Note: Debug logging is handled via useLogger() from SDK,
 * which can be called anywhere without passing logger through arguments.
 */
export interface GenerateOptions {
  /** Working directory (repo root) */
  cwd: string;
  /** Optional scope pattern to filter files */
  scope?: string;
  /** LLM completion function (if available) */
  llmComplete?: LLMCompleteFunction;
  /** Recent commits for style reference */
  recentCommits?: string[];
  /** Plugin configuration (from kb.config.json + env) */
  config?: import('@kb-labs/commit-contracts').CommitPluginConfig;
  /** Progress callback for UI updates (updates spinner text) */
  onProgress?: (message: string) => void;
}

/**
 * Options for applying a commit plan
 */
export interface ApplyOptions {
  /** Force apply even if working tree changed */
  force?: boolean;
}

/**
 * Options for pushing commits
 */
export interface PushOptions {
  /** Force push (dangerous!) */
  force?: boolean;
  /** Remote name (default: origin) */
  remote?: string;
}

/**
 * LLM completion function signature
 */
export type LLMCompleteFunction = (
  prompt: string,
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }
) => Promise<{
  content: string;
  tokensUsed?: number;
}>;

/**
 * Result of git status check with staleness info
 */
export interface GitStatusWithStaleness {
  status: import('@kb-labs/commit-contracts').GitStatus;
  summaries: import('@kb-labs/commit-contracts').FileSummary[];
  hash: string;
}
