/**
 * KB Labs Commit Plugin - Manifest V2
 *
 * Uses only @kb-labs/sdk as the single dependency on platform.
 */

import {
  defineManifest,
  defineCommandFlags,
  permissions,
  generateExamples,
} from '@kb-labs/sdk';
import { pluginContractsManifest, COMMIT_ENV_VARS } from '@kb-labs/commit-contracts';
import {
  generateFlags,
  applyFlags,
  pushFlags,
  runFlags,
  jsonOnlyFlags,
  emptyFlags,
} from './cli/commands/flags';

export const manifest = defineManifest<typeof pluginContractsManifest>({
  schema: 'kb.plugin/2',
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

  // Setup handler - initialize .kb/commit/ directory
  setup: {
    handler: './lifecycle/setup.js#run',
    describe: 'Initialize .kb/commit/ directory structure.',
    permissions: permissions.combine(
      permissions.presets.pluginWorkspace('commit'),
      {
        quotas: { timeoutMs: 10000, memoryMb: 128, cpuMs: 3000 },
      }
    ),
  },

  cli: {
    commands: [
      // Main command: commit (default flow)
      {
        id: 'commit',
        group: 'commit',
        describe: 'Generate and apply commits (default flow).',
        longDescription:
          'Analyzes changes, generates commit plan with LLM, applies commits locally. ' +
          'Use --dry-run to preview without applying, --with-push to push after applying.',
        flags: defineCommandFlags(runFlags),
        examples: generateExamples('commit', 'commit', [
          { description: 'Default flow', flags: {} },
          { description: 'Dry run (generate only)', flags: { 'dry-run': true } },
          { description: 'With automatic push', flags: { 'with-push': true } },
          { description: 'Scope to specific path', flags: { scope: 'src/components/**' } },
        ]),
        handler: './cli/commands/run.js#runCommand',
      },

      // commit:generate - Generate commit plan
      {
        id: 'commit:generate',
        group: 'commit',
        describe: 'Generate commit plan from git changes.',
        longDescription:
          'Analyzes staged and unstaged changes using git diff, then uses LLM to group ' +
          'related changes and generate conventional commit messages.',
        flags: defineCommandFlags(generateFlags),
        examples: generateExamples('generate', 'commit', [
          { description: 'Generate plan', flags: {} },
          { description: 'JSON output', flags: { json: true } },
          { description: 'Scope to path', flags: { scope: 'packages/**' } },
        ]),
        handler: './cli/commands/generate.js#generateCommand',
      },

      // commit:apply - Apply commit plan
      {
        id: 'commit:apply',
        group: 'commit',
        describe: 'Apply current commit plan (create local commits).',
        longDescription:
          'Creates git commits according to the current plan. Checks for staleness ' +
          '(working tree changes since plan generation) unless --force is used.',
        flags: defineCommandFlags(applyFlags),
        examples: generateExamples('apply', 'commit', [
          { description: 'Apply plan', flags: {} },
          { description: 'Force apply', flags: { force: true } },
        ]),
        handler: './cli/commands/apply.js#applyCommand',
      },

      // commit:push - Push commits
      {
        id: 'commit:push',
        group: 'commit',
        describe: 'Push commits to remote repository.',
        longDescription:
          'Pushes local commits to the remote. Refuses force push to protected branches ' +
          '(main, master) by default.',
        flags: defineCommandFlags(pushFlags),
        examples: generateExamples('push', 'commit', [
          { description: 'Push commits', flags: {} },
        ]),
        handler: './cli/commands/push.js#pushCommand',
      },

      // commit:open - Show current plan
      {
        id: 'commit:open',
        group: 'commit',
        describe: 'Show current commit plan.',
        longDescription: 'Displays the current commit plan if one exists.',
        flags: defineCommandFlags(jsonOnlyFlags),
        examples: generateExamples('open', 'commit', [
          { description: 'View plan', flags: {} },
          { description: 'JSON output', flags: { json: true } },
        ]),
        handler: './cli/commands/open.js#openCommand',
      },

      // commit:reset - Clear current plan
      {
        id: 'commit:reset',
        group: 'commit',
        describe: 'Clear current commit plan.',
        longDescription: 'Removes the current commit plan from storage.',
        flags: defineCommandFlags(emptyFlags),
        examples: ['kb commit reset'],
        handler: './cli/commands/reset.js#resetCommand',
      },
    ],
  },

  capabilities: [],

  // Global permissions using presets
  permissions: permissions.combine(
    permissions.presets.pluginWorkspace('commit'),
    permissions.presets.llmApi(['openai', 'anthropic']),
    {
      fs: {
        mode: 'readWrite',
        allow: ['.git/**'], // Git access for commit operations
      },
      env: {
        allow: [...COMMIT_ENV_VARS], // Environment variable overrides
      },
      quotas: {
        timeoutMs: 120000, // 2 min for LLM
        memoryMb: 512,
        cpuMs: 30000,
      },
    }
  ),

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
});

export default manifest;
