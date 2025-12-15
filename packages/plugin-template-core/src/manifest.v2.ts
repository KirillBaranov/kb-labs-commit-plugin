import { createManifestV2, defineCommandFlags, generateExamples } from '@kb-labs/plugin-manifest';
import { pluginContractsManifest } from '../../plugin-template-contracts/dist/index';
import { templateHelloFlags } from './cli/commands/flags';

// Level 2: Типизация через contracts для автодополнения и проверки ID
export const manifest = createManifestV2<typeof pluginContractsManifest>({
  schema: 'kb.plugin/2',
  id: '@kb-labs/plugin-template',
  version: '0.1.0',
  display: {
    name: 'Plugin Template',
    description: 'HelloWorld reference plugin demonstrating CLI, REST, and Studio surfaces.',
    tags: ['template', 'hello', 'sample']
  },
  setup: {
    handler: './lifecycle/setup.js#run',
    describe: 'Create starter .kb assets and default config for the template plugin.',
    permissions: {
      fs: {
        mode: 'readWrite',
        allow: ['.kb/template/**', '.gitignore'],
        deny: ['.kb/plugins.json', '.kb/kb-labs.config.json', '.kb/cache/**']
      },
      net: 'none',
      env: {
        allow: []
      },
      quotas: {
        timeoutMs: 5000,
        memoryMb: 64,
        cpuMs: 2500
      }
    }
  },
  cli: {
    commands: [
      {
        id: 'plugin-template:hello',
        group: 'plugin-template',
        describe: 'Print a hello message from the plugin template.',
        longDescription: 'Outputs a scoped greeting and optional target using shared formatting utilities.',
        flags: defineCommandFlags(templateHelloFlags), // Level 2.3+: Переиспользование типов из команды
        examples: generateExamples('hello', 'plugin-template', [
          { description: 'Basic greeting', flags: {} },
          { description: 'Greet specific name', flags: { name: 'Dev' } },
          { description: 'Output as JSON', flags: { json: true } }
        ]),
        handler: './cli/commands/run.js#runHelloCommand'
      }
    ]
  },
  rest: {
    basePath: '/v1/plugins/template',
    routes: [
      {
        method: 'GET',
        path: '/hello',
        input: {
          zod: './rest/schemas/hello-schema.js#HelloRequestSchema'
        },
        output: {
          zod: './rest/schemas/hello-schema.js#HelloResponseSchema'
        },
        handler: './rest/handlers/hello-handler.js#handleHello',
        permissions: {
          fs: {
            mode: 'read',
            allow: [],
            deny: ['**/*.key', '**/*.secret']
          },
          net: 'none',
          env: {
            allow: ['NODE_ENV']
          },
          quotas: {
            timeoutMs: 5000,
            memoryMb: 64,
            cpuMs: 2500
          },
          capabilities: []
        }
      }
    ]
  },
  studio: {
    widgets: [
      {
        id: 'template.hello',
        kind: 'card',
        title: 'Hello Template',
        description: 'Displays greeting output returned by the hello REST route.',
        data: {
          source: {
            type: 'rest',
            routeId: '/hello',
            method: 'GET'
          },
          schema: {
            zod: './rest/schemas/hello-schema.js#HelloResponseSchema'
          }
        },
        layoutHint: {
          w: 3,
          h: 2,
          minW: 2,
          minH: 2
        }
      }
    ],
    menus: [
      {
        id: 'template-hello',
        label: 'Template · Hello',
        target: '/plugins/template/hello',
        order: 0
      }
    ],
    layouts: [
      {
        id: 'template.dashboard',
        kind: 'grid',
        title: 'Template Dashboard',
        description: 'Starter layout that highlights the Hello widget.',
        config: {
          cols: {
            sm: 2,
            md: 4,
            lg: 6
          },
          rowHeight: 6
        }
      }
    ]
  },
  capabilities: [],
  permissions: {
    fs: {
      mode: 'read',
      allow: [],
      deny: ['**/*.key', '**/*.secret']
    },
    net: 'none',
    env: {
      allow: ['NODE_ENV']
    },
    quotas: {
      timeoutMs: 10000,
      memoryMb: 128,
      cpuMs: 5000
    },
    capabilities: []
  },
  artifacts: []
});

export default manifest;
