/**
 * Hello Command - Three Implementation Approaches
 * 
 * This file demonstrates three different approaches to implementing CLI commands
 * using @kb-labs/shared-command-kit:
 * 
 * 1. High-level wrapper (defineCommand) - Recommended for most cases
 * 2. Low-level atomic tools - For maximum control
 * 3. Hybrid approach - Combining both
 * 
 * See COMMAND_IMPLEMENTATION_GUIDE.md for detailed explanations.
 */

import {
  pluginContractsManifest,
  type PluginCommandIds,
  type PluginArtifactIds,
  getArtifactId,
  getCommandId,
} from '../../../../plugin-template-contracts/dist/index';
import { createGreetingUseCase } from '../../core/index';
import type { CliContext } from '@kb-labs/cli-core';

// Level 2+: Типизированные artifact ID через contracts
const HELLO_GREETING_ARTIFACT_ID = getArtifactId('template.hello.greeting');

// Command result type (returned from handler)
export interface HelloCommandResult {
  message: string;
  target: string;
}

// ============================================================================
// TYPING LEVELS: Different approaches to typing commands
// ============================================================================
// This file demonstrates three levels of typing for CLI commands:
// 
// LEVEL 1: No typing (minimal) - Quick prototyping, less type safety
// LEVEL 2: Partial typing (flags only) - Good balance, flags are typed
// LEVEL 3: Full typing (flags + result) - Maximum type safety, recommended
//
// Choose based on your needs:
// - Prototyping: Level 1
// - Small commands: Level 2
// - Production commands: Level 3

// ============================================================================
// LEVEL 1: No Typing - Minimal Approach
// ============================================================================
// Best for: Quick prototyping, simple commands
// Pros: Fastest to write, no type definitions needed
// Cons: No type safety, flags and results are `any`
//
// Uncomment to use:
/*
import { defineCommand } from '@kb-labs/shared-command-kit';

export const run = defineCommand({
  name: 'template:hello',
  flags: {
    name: {
      type: 'string',
      description: 'Name to greet.',
      alias: 'n',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON payload instead of formatted text.',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    // flags is typed as Record<string, unknown>
    // No autocomplete for flags.name or flags.json
    const name = flags.name as string | undefined;
    const json = flags.json as boolean | undefined;
    
    ctx.logger?.info('Hello command started', { name });

    const greeting = createGreetingUseCase({ name });
    const payload: HelloCommandResult = {
      message: greeting.message,
      target: greeting.target
    };

    if (json) {
      ctx.output?.json(payload);
    } else {
      ctx.output?.write(`${payload.message}\n`);
    }

    return { ok: true, result: payload };
  },
});
*/

// ============================================================================
// LEVEL 2: Partial Typing - Flags Only
// ============================================================================
// Best for: Small to medium commands, good balance
// Pros: Flags are typed, autocomplete works, less boilerplate
// Cons: Result type not enforced
//
// Uncomment to use:
/*
import { defineCommand } from '@kb-labs/shared-command-kit';

type TemplateHelloFlags = {
  name: { type: 'string'; description?: string; alias?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
};

export const run = defineCommand<TemplateHelloFlags>({
  name: 'template:hello',
  flags: {
    name: {
      type: 'string',
      description: 'Name to greet.',
      alias: 'n',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON payload instead of formatted text.',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    // flags.name and flags.json are now properly typed!
    // TypeScript will autocomplete and check types
    ctx.logger?.info('Hello command started', { name: flags.name });

    const greeting = createGreetingUseCase({ name: flags.name });
    const payload: HelloCommandResult = {
      message: greeting.message,
      target: greeting.target
    };

    if (flags.json) {
      ctx.output?.json(payload);
    } else {
      ctx.output?.write(`${payload.message}\n`);
    }

    return { ok: true, result: payload };
  },
});
*/

// ============================================================================
// LEVEL 3: Full Typing - Flags + Result (RECOMMENDED)
// ============================================================================
// Best for: Production commands, complex logic, team projects
// Pros: Maximum type safety, flags AND result types enforced
// Cons: More boilerplate, but worth it for maintainability

import { defineCommand, type CommandResult, type InferFlags } from '@kb-labs/shared-command-kit';
import { templateHelloFlags, type TemplateHelloFlags } from './flags';

type TemplateHelloResult = CommandResult & {
  result?: HelloCommandResult;
};

export const run = defineCommand<TemplateHelloFlags, TemplateHelloResult>({
  name: getCommandId('plugin-template:hello'), // Level 2+: Проверка command ID против contracts
  flags: templateHelloFlags, // Level 2.3+: Переиспользование типов из flags.ts
  async handler(ctx, argv, flags) {
    // Full type safety:
    // - flags.name is string | undefined (autocomplete works!)
    // - flags.json is boolean (autocomplete works!)
    // - Return type must match TemplateHelloResult
    
    ctx.logger?.info('Hello command started', { name: flags.name });

    ctx.tracker.checkpoint('greeting');

    const greeting = createGreetingUseCase({ name: flags.name });
    const payload: HelloCommandResult = {
      message: greeting.message,
      target: greeting.target
    };

    ctx.tracker.checkpoint('complete');

    if (flags.json) {
      ctx.output?.json(payload);
    } else {
      ctx.output?.write(`${payload.message}\n`);
    }

    ctx.logger?.info('Hello command completed', {
      target: payload.target,
      json: flags.json,
      produces: [HELLO_GREETING_ARTIFACT_ID]
    });

    // TypeScript ensures this matches TemplateHelloResult
    return { ok: true, result: payload };
  },
});

// Export for manifest handler
export async function runHelloCommand(
  ctx: Parameters<typeof run>[0],
  argv: Parameters<typeof run>[1],
  flags: Parameters<typeof run>[2]
) {
  return run(ctx, argv, flags);
}

// ============================================================================
// APPROACH 2: Low-level atomic tools - For maximum control
// ============================================================================
// Best for: Complex commands that need fine-grained control
// Pros: Full control over execution flow, can mix/match tools as needed
// Cons: More boilerplate, need to handle validation/analytics manually

/*
import { defineFlags, validateFlags, type InferFlags } from '@kb-labs/shared-command-kit/flags';
import { runWithOptionalAnalytics } from '@kb-labs/shared-command-kit/analytics';
import { TimingTracker } from '@kb-labs/shared-cli-ui';

// Define flag schema
const flagSchema = defineFlags({
  name: {
    type: 'string',
    description: 'Name to greet.',
    alias: 'n',
  },
  json: {
    type: 'boolean',
    description: 'Emit JSON payload instead of formatted text.',
    default: false,
  },
});

type HelloFlags = InferFlags<typeof flagSchema>;

export async function runHelloCommandLowLevel(
  ctx: CliContext,
  argv: string[],
  rawFlags: Record<string, unknown>
): Promise<HelloCommandResult> {
  // 1. Validate flags manually
  const flags = await validateFlags(rawFlags, flagSchema);
  
  // 2. Setup timing tracker
  const tracker = new TimingTracker();
  
  // 3. Wrap with analytics (optional)
  return runWithOptionalAnalytics(
    ctx.analytics,
    'template:hello',
    async (emit) => {
      ctx.logger?.info('Hello command started', { name: flags.name });
      
      emit({ name: flags.name, json: flags.json });
      
      tracker.checkpoint('greeting');
      
      const greeting = createGreetingUseCase({ name: flags.name });
      const payload: HelloCommandResult = {
        message: greeting.message,
        target: greeting.target
      };
      
      tracker.checkpoint('complete');
      
      if (flags.json) {
        ctx.output?.json(payload);
      } else {
        ctx.output?.write(`${payload.message}\n`);
      }
      
      ctx.logger?.info('Hello command completed', {
        target: payload.target,
        json: flags.json,
        durationMs: tracker.total(),
        produces: [HELLO_GREETING_ARTIFACT_ID]
      });
      
      return payload;
    }
  );
}
*/

// ============================================================================
// APPROACH 3: Hybrid approach - Combining both
// ============================================================================
// Best for: Commands that need defineCommand but also custom logic
// Pros: Get benefits of defineCommand + custom control where needed
// Cons: Slightly more complex than pure defineCommand

/*
import { defineCommand } from '@kb-labs/shared-command-kit';
import { validateFlags } from '@kb-labs/shared-command-kit/flags';
import { TimingTracker } from '@kb-labs/shared-cli-ui';

export const runHybrid = defineCommand({
  name: 'template:hello',
  flags: {
    name: {
      type: 'string',
      description: 'Name to greet.',
      alias: 'n',
    },
    json: {
      type: 'boolean',
      description: 'Emit JSON payload instead of formatted text.',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    // Use defineCommand for validation and analytics
    // But add custom timing tracking
    const customTracker = new TimingTracker();
    
    ctx.logger?.info('Hello command started', { name: flags.name });

    customTracker.checkpoint('custom-step-1');
    
    // Your custom logic here
    const greeting = createGreetingUseCase({ name: flags.name });
    
    customTracker.checkpoint('custom-step-2');
    
    const payload: HelloCommandResult = {
      message: greeting.message,
      target: greeting.target
    };

    if (flags.json) {
      ctx.output?.json(payload);
    } else {
      ctx.output?.write(`${payload.message}\n`);
    }
    
    // Use custom tracker for additional metrics
    ctx.logger?.info('Custom timing', { 
      customDuration: customTracker.total() 
    });

    return { ok: true, result: payload };
  },
});
*/

// Legacy implementation removed - use `run` with CliContext instead
// Modern plugins should always use ctx.logger, not manual logger creation
