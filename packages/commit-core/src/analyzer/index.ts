/**
 * Git analyzer module
 * @module @kb-labs/commit-core/analyzer
 */

export {
  getGitStatus,
  getAllChangedFiles,
  hasChanges,
  getCurrentBranch,
  isProtectedBranch,
} from './git-status';

export { getFileSummaries, formatFileSummary } from './file-summary';

export { getRecentCommits, detectCommitStyle } from './recent-commits';

export { resolveScope, matchesScope, type ResolvedScope, type PackageInfo } from './scope-resolver';

export {
  isSecretFile,
  containsSecrets,
  detectSecretFiles,
  detectSecretsInDiffs,
  formatSecretsWarning,
} from './secrets-detector';
