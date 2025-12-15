/**
 * Shared flag definitions for hello command
 * Used in both command implementation and manifest
 */

import type { FlagSchemaDefinition } from '@kb-labs/shared-command-kit/flags';

/**
 * Hello command flags schema
 * This type is used in both:
 * 1. defineCommand<TemplateHelloFlags, ...> in run.ts
 * 2. defineCommandFlags(templateHelloFlags) in manifest.v2.ts
 */
export const templateHelloFlags: FlagSchemaDefinition = {
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
} as const satisfies FlagSchemaDefinition;

/**
 * Type extracted from flags schema
 */
export type TemplateHelloFlags = typeof templateHelloFlags;

