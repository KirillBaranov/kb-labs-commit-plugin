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
