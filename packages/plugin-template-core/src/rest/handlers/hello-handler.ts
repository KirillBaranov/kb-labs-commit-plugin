import {
  getArtifactId,
  type PluginArtifactIds,
} from '../../../../plugin-template-contracts/dist/index';
import { definePluginHandler } from '@kb-labs/plugin-runtime';
import { createGreetingUseCase } from '../../core/index';
import type { HelloRequest } from '../schemas/hello-schema';
import { HelloRequestSchema, HelloResponseSchema } from '../schemas/hello-schema';

// Level 2+: Типизированный artifact ID через contracts
const HELLO_GREETING_ARTIFACT_ID = getArtifactId('template.hello.greeting');

type HelloResponse = {
  message: string;
  target: string;
};

/**
 * Hello REST handler - migrated to new ctx.api/ctx.output pattern
 *
 * @example
 * ```typescript
 * // NEW API pattern
 * export const handleHello = definePluginHandler<HelloRequest, HelloResponse>({
 *   schema: {
 *     input: HelloRequestSchema,
 *     output: HelloResponseSchema
 *   },
 *   async handle(input, ctx) {
 *     ctx.output.info('Processing request');
 *     return { message, target };
 *   }
 * });
 * ```
 */
export const handleHello = definePluginHandler<HelloRequest, HelloResponse>({
  schema: {
    input: HelloRequestSchema,
    output: HelloResponseSchema
  },

  async handle(input, ctx) {
    const greeting = createGreetingUseCase({ name: input.name });

    // NEW: Use ctx.output instead of ctx.logger
    ctx.output.info('Hello REST endpoint executed', {
      requestId: ctx.requestId,
      target: greeting.target,
      produces: [HELLO_GREETING_ARTIFACT_ID]
    });

    return { message: greeting.message, target: greeting.target };
  }
});


