import { SetupBuilder } from '@kb-labs/setup-engine-operations';

type SetupInput = {
  force?: boolean;
};

type SetupContext = {
  logger?: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  runtime?: {
    fs?: {
      mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
      writeFile(
        path: string,
        data: string | Buffer,
        options?: { encoding?: BufferEncoding },
      ): Promise<void>;
    };
    config?: {
      ensureSection?: (
        pointer: string,
        value: unknown,
        options?: { strategy?: 'shallow' | 'deep' | 'replace' },
      ) => Promise<void>;
    };
  };
  dryRun?: boolean;
};

const TEMPLATE_DIR = '.kb/template';
const CONFIG_PATH = `${TEMPLATE_DIR}/hello-config.json`;
const README_HINT = `${TEMPLATE_DIR}/README.md`;

export async function run(input: SetupInput = {}, ctx: SetupContext = {}) {
  const logger = ctx.logger;
  const fs = ctx.runtime?.fs;

  const configPayload = {
    greeting: 'Welcome to your KB Labs plugin workspace! 🎉',
    hint: 'Edit this file to customise messages produced by template surfaces.',
    updatedAt: new Date().toISOString(),
  };
  const serializedConfig = `${JSON.stringify(configPayload, null, 2)}\n`;

  // 1. Declarative builder API — operations are analyzed/diffed by kb setup-engine.
  const builder = new SetupBuilder();
  builder.ensureFile(CONFIG_PATH, serializedConfig, {
    metadata: { description: 'Seed hello-config.json with defaults' },
  });
  builder.ensureConfigSection('plugins.template', {
    enabled: true,
    greeting: {
      configPath: CONFIG_PATH,
      defaultName: 'KB Labs',
    },
    output: {
      directory: '.kb/template/output',
    },
  });
  builder.suggestScript('template:hello', {
    command: 'kb template hello',
    description: 'Say hello from the template plugin',
  });

  // 2. Imperative API — still supported, operations auto-tracked via ctx.runtime.fs.
  if (fs?.mkdir && fs.writeFile) {
    const readmeContent = [
      '# Template plugin workspace files',
      '',
      '- `hello-config.json` — example configuration read by CLI/REST/Studio surfaces.',
      '- Extend this folder with rules, profiles, or other assets required by your plugin.',
      '',
      'Re-run `kb template setup --force` whenever you want to regenerate defaults.',
    ].join('\n');

    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    await fs.writeFile(README_HINT, `${readmeContent}\n`);
    logger?.info('README hints created via imperative fs API.');
  } else {
    logger?.warn(
      'ctx.runtime.fs is unavailable. README hints will not be created imperatively.',
    );
  }

  // Optional: use runtime config helper when available (idempotent merge).
  await ctx.runtime?.config?.ensureSection?.('plugins.template.notes', {
    createdBy: '@kb-labs/plugin-template',
    force: input.force === true,
  });

  logger?.info('Template setup populated .kb/template assets.', {
    dryRun: ctx.dryRun === true,
    force: input.force === true,
  });

  return {
    message: 'Template setup completed. Try `kb template hello` to see it in action!',
    operations: builder.build().operations,
    configDefaults: {
      enabled: true,
      greeting: {
        configPath: CONFIG_PATH,
        defaultName: 'KB Labs',
      },
      output: {
        directory: '.kb/template/output',
      },
    },
    suggestions: {
      scripts: {
        'template:setup': 'kb template setup --force',
      },
      gitignore: ['.kb/template/output/', '.kb/template/cache/'],
      notes: [
        'Adjust hello-config.json to plug into your own CLI/REST logic.',
        'Use --kb-only if you customise permissions to touch project files.',
      ],
    },
  };
}

export default run;
