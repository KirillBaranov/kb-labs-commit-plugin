/**
 * @module Logger adapter for Plugin Template
 *
 * DEPRECATED: Modern plugins should use ctx.logger provided by the runtime.
 * This module exists for backward compatibility only.
 *
 * @example Modern approach (RECOMMENDED):
 * ```typescript
 * export const run = defineCommand({
 *   async handler(ctx, argv, flags) {
 *     ctx.logger?.info('Hello started', { name: flags.name });
 *     // ctx.logger is provided by runtime, no manual creation needed
 *   }
 * });
 * ```
 *
 * @deprecated Use ctx.logger instead. Will be removed in v1.0.0
 */

import { getLogger, type Logger as CoreLogger } from '@kb-labs/core-sys/logging';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

/**
 * Create console logger adapter
 *
 * @deprecated Use ctx.logger from CliContext instead.
 * Modern plugins receive logger from runtime: `ctx.logger?.info(message, meta)`
 *
 * This function will be removed in v1.0.0
 */
export function createConsoleLogger(prefix = 'plugin-template'): Logger {
  const coreLogger = getLogger(`plugin-template:${prefix}`);

  return {
    log(level, message, meta) {
      switch (level) {
        case 'debug':
          coreLogger.debug(message, meta);
          break;
        case 'info':
          coreLogger.info(message, meta);
          break;
        case 'warn':
          coreLogger.warn(message, meta);
          break;
        case 'error':
          coreLogger.error(message, meta);
          break;
      }
    }
  };
}


