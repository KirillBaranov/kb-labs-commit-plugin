/**
 * KB Labs Commit Plugin - Manifest V3
 *
 * Migration from V2 to V3 following best practices from V3-MIGRATION-GUIDE.md
 *
 * Key changes:
 * - Schema: kb.plugin/3
 * - Commands use handler#default suffix
 * - Commands have handlerPath field
 * - All imports from @kb-labs/sdk
 */

import {
  defineCommandFlags,
  combinePermissions,
  gitWorkflowPreset,
  kbPlatformPreset,
} from '@kb-labs/sdk';
import { COMMIT_ENV_VARS } from '@kb-labs/commit-contracts';
import {
  runFlags,
  generateFlags,
  applyFlags,
  pushFlags,
  jsonOnlyFlags,
  emptyFlags,
} from './cli/commands/flags';

/**
 * Build permissions using presets:
 * - gitWorkflow: HOME, USER, GIT_*, SSH_* for git operations
 * - kbPlatform: KB_* env vars and .kb/ directory
 * - Custom: COMMIT_ENV_VARS, quotas
 *
 * Note: LLM access goes through platform services, no direct API keys needed.
 */
const pluginPermissions = combinePermissions()
  .with(gitWorkflowPreset)
  .with(kbPlatformPreset)
  .withEnv([...COMMIT_ENV_VARS])
  .withFs({
    mode: 'readWrite',
    allow: ['.kb/commit/**'],
  })
  .withQuotas({
    timeoutMs: 600000, // 10 min for LLM
    memoryMb: 512,
  })
  .build();

export const manifest = {
  schema: 'kb.plugin/3',
  id: '@kb-labs/commit',
  version: '0.1.0',

  display: {
    name: 'Commit Generator',
    description: 'AI-powered commit generation with conventional commit support.',
    tags: ['commit', 'git', 'ai', 'conventional-commits'],
  },

  // Platform requirements (LLM is optional but preferred)
  platform: {
    requires: ['storage'],
    optional: ['llm', 'analytics', 'logger'],
  },

  // TODO: Implement V3 setup handler
  // Setup temporarily disabled during migration - needs proper V3 implementation
  // setup: {
  //   handler: './lifecycle/setup.js#default',
  //   handlerPath: './lifecycle/setup.js',
  //   describe: 'Initialize .kb/commit/ directory structure.',
  //   permissions: permissions.combine(
  //     permissions.presets.pluginWorkspace('commit'),
  //     {
  //       quotas: { timeoutMs: 10000, memoryMb: 128, cpuMs: 3000 },
  //     }
  //   ),
  // },

  // V3: cli wrapper with commands array
  cli: {
    commands: [
      // Main command: commit (default flow)
      {
        id: 'commit:commit',  // ✅ With plugin prefix
        group: 'commit',
        describe: 'Generate and apply commits (default flow).',
        longDescription:
          'Analyzes changes, generates commit plan with LLM, applies commits locally. ' +
          'Use --dry-run to preview without applying, --with-push to push after applying.',

        // ✅ V3: handler with #default suffix
        handler: './cli/commands/run.js#default',
        handlerPath: './cli/commands/run.js',

        flags: defineCommandFlags(runFlags),

        examples: [
          'kb commit commit',
          'kb commit commit --dry-run',
          'kb commit commit --with-push',
          'kb commit commit --scope "src/components/**"',
        ],
      },

      // commit:generate - Generate commit plan
      {
        id: 'commit:generate',
        group: 'commit',
        describe: 'Generate commit plan from git changes.',
        longDescription:
          'Analyzes staged and unstaged changes using git diff, then uses LLM to group ' +
          'related changes and generate conventional commit messages.',

        handler: './cli/commands/generate.js#default',
        handlerPath: './cli/commands/generate.js',

        flags: defineCommandFlags(generateFlags),

        examples: [
          'kb commit generate',
          'kb commit generate --json',
          'kb commit generate --scope "packages/**"',
        ],
      },

      // commit:apply - Apply commit plan
      {
        id: 'commit:apply',
        group: 'commit',
        describe: 'Apply current commit plan (create local commits).',
        longDescription:
          'Creates git commits according to the current plan. Checks for staleness ' +
          '(working tree changes since plan generation) unless --force is used.',

        handler: './cli/commands/apply.js#default',
        handlerPath: './cli/commands/apply.js',

        flags: defineCommandFlags(applyFlags),

        examples: [
          'kb commit apply',
          'kb commit apply --force',
        ],
      },

      // commit:push - Push commits
      {
        id: 'commit:push',
        group: 'commit',
        describe: 'Push commits to remote repository.',
        longDescription:
          'Pushes local commits to the remote. Refuses force push to protected branches ' +
          '(main, master) by default.',

        handler: './cli/commands/push.js#default',
        handlerPath: './cli/commands/push.js',

        flags: defineCommandFlags(pushFlags),

        examples: [
          'kb commit push',
        ],
      },

      // commit:open - Show current plan
      {
        id: 'commit:open',
        group: 'commit',
        describe: 'Show current commit plan.',
        longDescription: 'Displays the current commit plan if one exists.',

        handler: './cli/commands/open.js#default',
        handlerPath: './cli/commands/open.js',

        flags: defineCommandFlags(jsonOnlyFlags),

        examples: [
          'kb commit open',
          'kb commit open --json',
        ],
      },

      // commit:reset - Clear current plan
      {
        id: 'commit:reset',
        group: 'commit',
        describe: 'Clear current commit plan.',
        longDescription: 'Removes the current commit plan from storage.',

        handler: './cli/commands/reset.js#default',
        handlerPath: './cli/commands/reset.js',

        flags: defineCommandFlags(emptyFlags),

        examples: [
          'kb commit reset',
        ],
      },
    ],
  },

  capabilities: [],

  // ✅ V3: Manifest-first permissions using composable presets
  permissions: pluginPermissions,

  // REST API routes (inherit permissions from manifest)
  rest: {
    basePath: '/v1/plugins/commit',
    routes: [
    // GET /workspaces
    {
      method: 'GET',
      path: '/workspaces',
      handler: './rest/handlers/workspaces-handler.js#default',
      output: {
        zod: '@kb-labs/commit-contracts#WorkspacesResponseSchema',
      },
    },
    // GET /status
    {
      method: 'GET',
      path: '/status',
      handler: './rest/handlers/status-handler.js#default',
      output: {
        zod: '@kb-labs/commit-contracts#StatusResponseSchema',
      },
    },
    // POST /generate
    {
      method: 'POST',
      path: '/generate',
      handler: './rest/handlers/generate-handler.js#default',
      input: {
        zod: '@kb-labs/commit-contracts#GenerateRequestSchema',
      },
      output: {
        zod: '@kb-labs/commit-contracts#GenerateResponseSchema',
      },
    },
    // GET /plan
    {
      method: 'GET',
      path: '/plan',
      handler: './rest/handlers/plan-handler.js#default',
      output: {
        zod: '@kb-labs/commit-contracts#PlanResponseSchema',
      },
    },
    // POST /apply
    {
      method: 'POST',
      path: '/apply',
      handler: './rest/handlers/apply-handler.js#default',
      input: {
        zod: '@kb-labs/commit-contracts#ApplyRequestSchema',
      },
      output: {
        zod: '@kb-labs/commit-contracts#ApplyResponseSchema',
      },
    },
    // POST /push
    {
      method: 'POST',
      path: '/push',
      handler: './rest/handlers/push-handler.js#default',
      input: {
        zod: '@kb-labs/commit-contracts#PushRequestSchema',
      },
      output: {
        zod: '@kb-labs/commit-contracts#PushResponseSchema',
      },
    },
    // DELETE /plan
    {
      method: 'DELETE',
      path: '/plan',
      handler: './rest/handlers/reset-handler.js#default',
      output: {
        zod: '@kb-labs/commit-contracts#ResetResponseSchema',
      },
    },
    // GET /git-status
    {
      method: 'GET',
      path: '/git-status',
      handler: './rest/handlers/git-status-handler.js#default',
      output: {
        zod: '@kb-labs/commit-contracts#GitStatusResponseSchema',
      },
    },
    ],
  },

  // Studio UI widgets
  studio: {
    widgets: [
    // Workspace Selector
    {
      id: 'commit.workspace-selector',
      kind: 'select',
      title: 'Select Workspace',
      description: 'Choose monorepo package or repository',
      data: {
        source: {
          type: 'rest',
          routeId: '/v1/plugins/commit/workspaces',
          method: 'GET',
        },
      },
      options: {
        searchable: true,
        placeholder: 'Select workspace...',
      },
      events: {
        emit: ['workspace:changed'],
      },
      layoutHint: { w: 6, h: 1, minH: 1 },
      order: 0,
    },
    // Status Metrics
    {
      id: 'commit.status',
      kind: 'metric-group',
      title: 'Commit Status',
      description: 'Current plan and git status',
      data: {
        source: {
          type: 'rest',
          routeId: '/v1/plugins/commit/status',
          method: 'GET',
        },
      },
      events: {
        subscribe: ['workspace:changed', 'form:submitted'],
      },
      layoutHint: { w: 6, h: 2, minH: 2 },
      order: 1,
    },
    // Plan Viewer
    {
      id: 'commit.plan-viewer',
      kind: 'cardlist',
      title: 'Commit Plan',
      description: 'Generated commits',
      data: {
        source: {
          type: 'rest',
          routeId: '/v1/plugins/commit/plan',
          method: 'GET',
        },
      },
      options: {
        layout: 'list',
        emptyMessage: 'No plan. Click Generate Plan.',
      },
      events: {
        subscribe: ['workspace:changed', 'form:submitted'],
      },
      layoutHint: { w: 3, h: 6, minW: 3, minH: 4 },
      order: 2,
    },
    // Git Files Table
    {
      id: 'commit.git-files',
      kind: 'table',
      title: 'Changed Files',
      description: 'Files with uncommitted changes',
      data: {
        source: {
          type: 'rest',
          routeId: '/v1/plugins/commit/git-status',
          method: 'GET',
        },
      },
      options: {
        columns: [
          { key: 'path', label: 'File', sortable: true },
          { key: 'status', label: 'Status', width: 80 },
          { key: 'additions', label: '+', width: 60 },
          { key: 'deletions', label: '-', width: 60 },
        ],
        sortable: true,
        pageSize: 20,
      },
      events: {
        subscribe: ['workspace:changed'],
      },
      layoutHint: { w: 3, h: 6, minW: 3 },
      order: 3,
    },
    // Actions
    {
      id: 'commit.actions',
      kind: 'form',
      title: 'Actions',
      description: 'Commit operations',
      actions: [
        {
          id: 'generate',
          label: 'Generate Plan',
          icon: 'magic',
          variant: 'primary',
          endpoint: { type: 'rest', routeId: '/v1/plugins/commit/generate', method: 'POST' },
        },
        {
          id: 'apply',
          label: 'Apply Commits',
          icon: 'check',
          variant: 'success',
          endpoint: { type: 'rest', routeId: '/v1/plugins/commit/apply', method: 'POST' },
          confirm: { message: 'Apply commits?' },
        },
        {
          id: 'push',
          label: 'Push',
          icon: 'upload',
          endpoint: { type: 'rest', routeId: '/v1/plugins/commit/push', method: 'POST' },
          confirm: { message: 'Push to remote?' },
        },
        {
          id: 'reset',
          label: 'Reset',
          icon: 'trash',
          variant: 'danger',
          endpoint: { type: 'rest', routeId: '/v1/plugins/commit/plan', method: 'DELETE' },
          confirm: { message: 'Delete plan?' },
        },
      ],
      events: {
        subscribe: ['workspace:changed'],
        emit: ['form:submitted'],
      },
      layoutHint: { w: 6, h: 1 },
      order: 4,
    },
    ],
  },

  // Artifacts
  artifacts: [
    {
      id: 'commit.plan.json',
      pathTemplate: '.kb/commit/current/plan.json',
      description: 'Current commit plan.',
    },
    {
      id: 'commit.status.json',
      pathTemplate: '.kb/commit/current/status.json',
      description: 'Git status snapshot at plan generation time.',
    },
  ],
};

export default manifest;
