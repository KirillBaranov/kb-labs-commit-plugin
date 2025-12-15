/**
 * Typed PluginContext wrapper for REST handlers
 * Provides type-safe artifact IDs and other typed utilities
 */

import type { PluginContext } from '@kb-labs/plugin-manifest';
import type { PluginArtifactIds } from 'packages/plugins-contracts/src';

/**
 * Typed PluginContext with artifact ID validation
 * 
 * @example
 * async function handleHello(input: HelloRequest, ctx: TypedPluginContext) {
 *   // ctx.artifacts.write() теперь принимает только валидные artifact IDs
 *   await ctx.artifacts.write('template.hello.greeting', data); // ✅ Типизировано!
 * }
 */
export interface TypedPluginContext extends Omit<PluginContext, 'artifacts'> {
  artifacts: {
    /**
     * Write artifact data (type-safe artifact ID)
     * 
     * @param artifactId - Must be a valid artifact ID from contracts
     * @param data - Artifact data
     */
    write<T extends PluginArtifactIds>(
      artifactId: T,
      data: unknown
    ): Promise<void>;
  };
}

/**
 * Create a typed wrapper around PluginContext
 * 
 * @example
 * function createTypedContext(ctx: PluginContext): TypedPluginContext {
 *   return {
 *     ...ctx,
 *     artifacts: {
 *       write: async (artifactId, data) => {
 *         // Validate artifactId against contracts
 *         if (!hasArtifact(artifactId)) {
 *           throw new Error(`Invalid artifact ID: ${artifactId}`);
 *         }
 *         return ctx.artifacts.write(artifactId, data);
 *       }
 *     }
 *   };
 * }
 */
export function createTypedContext(ctx: PluginContext): TypedPluginContext {
  return {
    ...ctx,
    artifacts: {
      write: async (artifactId: PluginArtifactIds, data: unknown) => {
        return ctx.artifacts.write(artifactId, data);
      },
    },
  };
}

