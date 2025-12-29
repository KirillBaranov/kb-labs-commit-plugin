/**
 * @module @kb-labs/commit-contracts/routes
 * REST API route constants for commit plugin
 */

/**
 * REST API base path for commit plugin
 */
export const COMMIT_BASE_PATH = '/v1/plugins/commit' as const;

/**
 * REST API route paths (relative to basePath)
 *
 * These are used in both:
 * - manifest.rest.routes[].path (route definitions)
 * - manifest.studio.widgets[].data.source.routeId (widget data sources)
 * - manifest.studio.widgets[].actions[].endpoint.routeId (widget actions)
 */
export const COMMIT_ROUTES = {
  /** GET /workspaces - List available workspaces */
  WORKSPACES: '/workspaces',

  /** GET /status - Get current status (plan + git) */
  STATUS: '/status',

  /** GET /plan - Get current commit plan */
  PLAN: '/plan',

  /** GET /git-status - Get git status with file details */
  GIT_STATUS: '/git-status',

  /** GET /files - Get file tree with diff statistics */
  FILES: '/files',

  /** POST /generate - Generate new commit plan */
  GENERATE: '/generate',

  /** POST /apply - Apply commit plan */
  APPLY: '/apply',

  /** POST /push - Push commits to remote */
  PUSH: '/push',

  /** DELETE /plan - Delete current plan */
  RESET: '/plan',
} as const;

/**
 * Full REST API URLs (basePath + route)
 * Useful for testing and documentation
 */
export const COMMIT_FULL_ROUTES = {
  WORKSPACES: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.WORKSPACES}`,
  STATUS: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.STATUS}`,
  PLAN: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.PLAN}`,
  GIT_STATUS: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.GIT_STATUS}`,
  FILES: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.FILES}`,
  GENERATE: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.GENERATE}`,
  APPLY: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.APPLY}`,
  PUSH: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.PUSH}`,
  RESET: `${COMMIT_BASE_PATH}${COMMIT_ROUTES.RESET}`,
} as const;

/**
 * Widget-friendly route IDs (without leading slash)
 * Use these in manifest.studio.widgets[].data.source.routeId
 */
export const COMMIT_WIDGET_ROUTES = {
  WORKSPACES: 'workspaces',
  STATUS: 'status',
  PLAN: 'plan',
  GIT_STATUS: 'git-status',
  FILES: 'files',
  GENERATE: 'generate',
  APPLY: 'apply',
  PUSH: 'push',
  RESET: 'plan',
} as const;

export type CommitRoute = typeof COMMIT_ROUTES[keyof typeof COMMIT_ROUTES];
export type CommitWidgetRoute = typeof COMMIT_WIDGET_ROUTES[keyof typeof COMMIT_WIDGET_ROUTES];
