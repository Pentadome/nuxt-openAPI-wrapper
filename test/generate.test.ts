import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfig, type ModuleOptions } from '../src/config';
import { generate } from '../src/generate';
import { createFakeNuxt, type FakeNuxt } from './helpers/fake-nuxt';
import { kit } from './helpers/kit-recorder';
import { specUrl } from './helpers/specs';
import { repoTempRoot, useTempDirectories } from './helpers/temp-dir';

vi.mock('@nuxt/kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/kit')>()),
  ...(await import('./helpers/kit-recorder')).kitMocks,
}));

const { mcp } = vi.hoisted(() => ({
  mcp: { recordInfoForMcp: vi.fn(), setupMCPTools: vi.fn() },
}));
vi.mock('../src/mcp', () => mcp);

const srcDirectory = fileURLToPath(new URL('../src', import.meta.url));
const makeTempDirectory = useTempDirectories();
const makeRepoTempDirectory = useTempDirectories(repoTempRoot);

let nuxt: FakeNuxt;
let buildDir: string;

beforeEach(async () => {
  const rootDir = await makeTempDirectory();
  buildDir = path.join(rootDir, '.nuxt');
  nuxt = createFakeNuxt({ rootDir, buildDir });
  kit.reset(buildDir);
  mcp.recordInfoForMcp.mockReset();
  mcp.setupMCPTools.mockReset();
});

const petstore = {
  baseUrl: 'https://petstore.test/v1',
  openApi: specUrl('petstore.yaml'),
};

const run = (options: Partial<ModuleOptions>) =>
  generate({
    moduleConfig: applyConfig({ apis: {}, ...options } as ModuleOptions),
    nuxt,
  });

const filenames = (list: Array<{ filename: string }>) =>
  list.map((x) => x.filename).sort();

/** Resolves a relative import found in generated code of `fromFile` (relative to buildDir). */
const resolveImport = (fromFile: string, specifier: string) =>
  path.resolve(path.dirname(path.join(buildDir, fromFile)), specifier);

const contents = async (template: { getContents: () => unknown }) =>
  String(await template.getContents());

describe('generate: registered templates', () => {
  it('registers nothing without apis', async () => {
    await run({ apis: {} });

    expect(kit.templates).toEqual([]);
    expect(kit.typeTemplates).toEqual([]);
    expect(kit.serverTemplates).toEqual([]);
    expect(kit.imports).toEqual([]);
    expect(kit.serverImports).toEqual([]);
    expect(nuxt.options.alias).toEqual({});
    expect(mcp.setupMCPTools).not.toHaveBeenCalled();
  });

  it('registers nuxt, nitro and type templates for an api', async () => {
    await run({ apis: { petstore } });

    expect(filenames(kit.templates)).toEqual([
      'openapi-wrapper/index.ts',
      'openapi-wrapper/petstore/index.ts',
    ]);
    expect(filenames(kit.typeTemplates)).toEqual([
      'types/openapi-wrapper/nitro.d.ts',
      'types/openapi-wrapper/petstore/nitro.d.ts',
      'types/openapi-wrapper/petstore/openapi.d.ts',
    ]);
    expect(filenames(kit.serverTemplates)).toEqual([
      '#openapi-wrapper',
      '#openapi-wrapper/petstore',
    ]);
  });

  it('writes the nuxt templates and nitro type templates to disk', async () => {
    await run({ apis: { petstore } });

    expect(kit.template('openapi-wrapper/index.ts').write).toBe(true);
    expect(kit.template('openapi-wrapper/petstore/index.ts').write).toBe(true);
    expect(kit.typeTemplate('types/openapi-wrapper/nitro.d.ts').write).toBe(
      true,
    );
    expect(
      kit.typeTemplate('types/openapi-wrapper/petstore/nitro.d.ts').write,
    ).toBe(true);
  });

  it('adds type templates to the right contexts', async () => {
    await run({ apis: { petstore } });

    expect(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts').context,
    ).toEqual({
      nuxt: true,
      nitro: true,
    });
    expect(
      kit.typeTemplate('types/openapi-wrapper/petstore/nitro.d.ts').context,
    ).toEqual({
      nitro: true,
      nuxt: false,
    });
    expect(
      kit.typeTemplate('types/openapi-wrapper/nitro.d.ts').context,
    ).toEqual({
      nitro: true,
      nuxt: false,
    });
  });

  it('registers one set per api and one shared barrel per side', async () => {
    await run({ apis: { petstore, other: { ...petstore } } });

    expect(filenames(kit.templates)).toEqual([
      'openapi-wrapper/index.ts',
      'openapi-wrapper/other/index.ts',
      'openapi-wrapper/petstore/index.ts',
    ]);
    expect(filenames(kit.serverTemplates)).toEqual([
      '#openapi-wrapper',
      '#openapi-wrapper/other',
      '#openapi-wrapper/petstore',
    ]);
  });
});

describe('generate: naming', () => {
  it.each([
    ['petstore', 'petstore', 'Petstore'],
    ['myPetStore', 'my-pet-store', 'MyPetStore'],
    ['my-api', 'my-api', 'MyApi'],
    ['my_api', 'my-api', 'MyApi'],
  ])('%s → folder "%s", identifiers "%s"', async (name, kebab, pascal) => {
    await run({ apis: { [name]: petstore } });

    const nuxtClient = await contents(
      kit.template(`openapi-wrapper/${kebab}/index.ts`),
    );
    expect(nuxtClient).toContain(
      `export const $fetch${pascal}: Fetch<${pascal}Paths>`,
    );
    expect(nuxtClient).toContain(
      `export const use${pascal}Fetch: UseFetch<${pascal}Paths>`,
    );
    expect(nuxtClient).toContain(
      `export const useLazy${pascal}Fetch: UseLazyFetch<${pascal}Paths>`,
    );
    expect(nuxtClient).toContain(
      `export type ${pascal}Schemas = ${pascal}Components['schemas']`,
    );
    expect(nuxtClient).toContain(`from '#openapi-wrapper/${kebab}/types'`);

    const nitroClient = await contents(
      kit.serverTemplate(`#openapi-wrapper/${kebab}`),
    );
    expect(nitroClient).toContain(
      `export const $fetch${pascal} = (path, opts) =>`,
    );

    expect(kit.typeTemplates.map((x) => x.filename)).toContain(
      `types/openapi-wrapper/${kebab}/openapi.d.ts`,
    );
  });
});

describe('generate: clients config', () => {
  it('skips all nuxt templates, imports and the alias when `clients.nuxt` is false', async () => {
    await run({ clients: { nuxt: false }, apis: { petstore } });

    expect(kit.templates).toEqual([]);
    expect(kit.imports).toEqual([]);
    expect(nuxt.options.alias).toEqual({});
    expect(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts').context,
    ).toEqual({
      nuxt: false,
      nitro: true,
    });
    expect(kit.serverTemplates).toHaveLength(2);
  });

  it('skips all nitro templates and imports when `clients.nitro` is false', async () => {
    await run({ clients: { nitro: false }, apis: { petstore } });

    expect(kit.serverTemplates).toEqual([]);
    expect(kit.serverImports).toEqual([]);
    expect(filenames(kit.typeTemplates)).toEqual([
      'types/openapi-wrapper/petstore/openapi.d.ts',
    ]);
    expect(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts').context,
    ).toEqual({
      nuxt: true,
      nitro: false,
    });
    expect(kit.templates).toHaveLength(2);
  });

  it('only registers the types when both clients are disabled', async () => {
    await run({ clients: { nuxt: false, nitro: false }, apis: { petstore } });

    expect(kit.templates).toEqual([]);
    expect(kit.serverTemplates).toEqual([]);
    expect(kit.typeTemplates.map((x) => [x.filename, x.context])).toEqual([
      [
        'types/openapi-wrapper/petstore/openapi.d.ts',
        { nuxt: false, nitro: false },
      ],
    ]);
  });

  it('lets an api re-enable a client disabled at module level', async () => {
    await run({
      clients: { nuxt: false },
      apis: {
        petstore: { ...petstore, clients: { nuxt: { autoImport: true } } },
        other: petstore,
      },
    });

    expect(filenames(kit.templates)).toEqual([
      'openapi-wrapper/index.ts',
      'openapi-wrapper/petstore/index.ts',
    ]);
    expect(
      await contents(kit.template('openapi-wrapper/index.ts')),
    ).not.toContain('./other');
  });

  it('lets an api disable a client enabled at module level', async () => {
    await run({
      apis: {
        petstore: { ...petstore, clients: { nitro: false } },
        other: petstore,
      },
    });

    expect(filenames(kit.serverTemplates)).toEqual([
      '#openapi-wrapper',
      '#openapi-wrapper/other',
    ]);
    expect(
      await contents(kit.serverTemplate('#openapi-wrapper')),
    ).not.toContain('#openapi-wrapper/petstore');
  });

  it('merges api client options over module client options', async () => {
    await run({
      clients: { nuxt: { autoImport: false }, nitro: { autoImport: false } },
      apis: {
        petstore: { ...petstore, clients: { nitro: { autoImport: true } } },
      },
    });

    expect(kit.imports).toEqual([]);
    expect(kit.serverImports).not.toEqual([]);
  });
});

describe('generate: auto imports', () => {
  it('auto-imports the nuxt clients and types from the generated file', async () => {
    await run({ apis: { petstore } });
    const from = path.join(buildDir, 'openapi-wrapper/petstore/index.ts');

    expect(kit.imports).toEqual([
      { name: 'PetstorePaths', from, type: true },
      { name: 'PetstoreComponents', from, type: true },
      { name: 'PetstoreSchemas', from, type: true },
      { name: '$fetchPetstore', from },
      { name: 'usePetstoreFetch', from },
      { name: 'useLazyPetstoreFetch', from },
    ]);
  });

  it('auto-imports the nitro client and types from the virtual module', async () => {
    await run({ apis: { petstore } });
    const from = '#openapi-wrapper/petstore';

    expect(kit.serverImports).toEqual([
      { name: 'PetstorePaths', from, type: true },
      { name: 'PetstoreComponents', from, type: true },
      { name: 'PetstoreSchemas', from, type: true },
      { name: '$fetchPetstore', from, declarationType: 'const' },
    ]);
  });

  it('respects `autoImport: false` per side', async () => {
    await run({ clients: { nuxt: { autoImport: false } }, apis: { petstore } });
    expect(kit.imports).toEqual([]);
    expect(kit.serverImports).toHaveLength(4);

    kit.reset(buildDir);
    await run({
      clients: { nitro: { autoImport: false } },
      apis: { petstore },
    });
    expect(kit.imports).toHaveLength(6);
    expect(kit.serverImports).toEqual([]);
  });
});

describe('generate: #openapi-wrapper alias', () => {
  it('points the app alias at the generated folder', async () => {
    await run({ apis: { petstore } });

    expect(nuxt.options.alias['#openapi-wrapper']).toBe(
      path.join(buildDir, 'openapi-wrapper'),
    );
  });

  it('removes the alias from the nitro config', async () => {
    await run({ apis: { petstore } });
    const nitroConfig = {
      alias: { '#openapi-wrapper': 'app-only', '#other': 'kept' },
    };

    await nuxt.callHook('nitro:config', nitroConfig);

    expect(nitroConfig.alias).toEqual({ '#other': 'kept' });
  });

  it('tolerates a nitro config without aliases', async () => {
    await run({ apis: { petstore } });

    await expect(nuxt.callHook('nitro:config', {})).resolves.toBeUndefined();
  });
});

describe('generate: nuxt client templates', () => {
  it('imports the runtime and main module through valid relative paths', async () => {
    await run({ apis: { petstore } });
    const client = await contents(
      kit.template('openapi-wrapper/petstore/index.ts'),
    );

    const runtimeImport = client.match(
      /handleUseFetchPathParams \} from '([^']+)'/,
    )![1]!;
    const mainImport = client.match(
      /SimplifiedUseFetchOptions \} from '([^']+)'/,
    )![1]!;
    expect(runtimeImport).not.toContain('\\');
    expect(
      resolveImport('openapi-wrapper/petstore/index.ts', runtimeImport),
    ).toBe(path.join(srcDirectory, 'runtime', 'handlePathParams'));
    expect(resolveImport('openapi-wrapper/petstore/index.ts', mainImport)).toBe(
      path.join(buildDir, 'openapi-wrapper'),
    );
  });

  // the OS temp dir can be on another drive than the repo (Windows); this one never is.
  it('uses ./-relative imports when the build dir shares a root with the module', async () => {
    buildDir = path.join(await makeRepoTempDirectory(), '.nuxt');
    nuxt = createFakeNuxt({ rootDir: path.dirname(buildDir), buildDir });
    kit.reset(buildDir);
    await run({ apis: { petstore } });
    const client = await contents(
      kit.template('openapi-wrapper/petstore/index.ts'),
    );

    const runtimeImport = client.match(
      /handleUseFetchPathParams \} from '([^']+)'/,
    )![1]!;
    expect(runtimeImport.startsWith('../')).toBe(true);
    expect(
      resolveImport('openapi-wrapper/petstore/index.ts', runtimeImport),
    ).toBe(path.join(srcDirectory, 'runtime', 'handlePathParams'));
  });

  it('bakes the base url into every client', async () => {
    await run({ apis: { petstore } });
    const client = await contents(
      kit.template('openapi-wrapper/petstore/index.ts'),
    );

    expect(
      client.match(/baseURL \?\?= "https:\/\/petstore\.test\/v1"/g),
    ).toHaveLength(2);
    expect(
      await contents(kit.serverTemplate('#openapi-wrapper/petstore')),
    ).toContain('baseURL ??= "https://petstore.test/v1"');
  });

  it('re-exports every nuxt client and the runtime from the barrel', async () => {
    await run({ apis: { petstore, myApi: petstore } });
    const barrel = await contents(kit.template('openapi-wrapper/index.ts'));
    const lines = barrel.split('\n');

    const fetchTypes = lines[0]!.match(/export type \* from "([^"]+)"/)![1]!;
    const fetchUtils = lines[1]!.match(/export \* from "([^"]+)"/)![1]!;
    expect(resolveImport('openapi-wrapper/index.ts', fetchTypes)).toBe(
      path.join(srcDirectory, 'runtime', 'fetchTypes'),
    );
    expect(resolveImport('openapi-wrapper/index.ts', fetchUtils)).toBe(
      path.join(srcDirectory, 'runtime', 'fetchUtils'),
    );
    expect(lines.slice(2)).toEqual([
      'export * from "./petstore";',
      'export * from "./my-api";',
    ]);
  });
});

describe('generate: nitro templates', () => {
  it('re-exports the server runtime and every nitro client from #openapi-wrapper', async () => {
    await run({ apis: { petstore, myApi: petstore } });

    expect(
      (await contents(kit.serverTemplate('#openapi-wrapper'))).split('\n'),
    ).toEqual([
      `export * from "${path.join(srcDirectory, 'runtime', 'server').replaceAll('\\', '/')}"`,
      'export * from "#openapi-wrapper/petstore";',
      'export * from "#openapi-wrapper/my-api";',
    ]);
  });

  it('declares the per-api nitro module', async () => {
    await run({ apis: { petstore } });
    const declaration = await contents(
      kit.typeTemplate('types/openapi-wrapper/petstore/nitro.d.ts'),
    );

    expect(declaration).toContain('/// <reference path="./openapi.d.ts" />');
    expect(declaration).toContain('/// <reference path="../nitro.d.ts" />');
    expect(declaration).toContain(
      'declare module "#openapi-wrapper/petstore" {',
    );
    expect(declaration).toContain(
      "import type { paths, components } from '#openapi-wrapper/petstore/types'",
    );
    expect(declaration).toContain('export type PetstorePaths = paths;');
    expect(declaration).toContain(
      'export type PetstoreComponents = components;',
    );
    expect(declaration).toContain(
      "export type PetstoreSchemas = components['schemas']",
    );
    expect(declaration).toContain(
      'export const $fetchPetstore: import("#openapi-wrapper").NitroFetch<PetstorePaths>;',
    );
  });

  it('declares #openapi-wrapper for nitro with the runtime types and all clients', async () => {
    await run({ apis: { petstore, myApi: petstore } });
    const declaration = await contents(
      kit.typeTemplate('types/openapi-wrapper/nitro.d.ts'),
    );

    expect(declaration).toContain(
      '/// <reference path="./petstore/nitro.d.ts" />',
    );
    expect(declaration).toContain(
      '/// <reference path="./my-api/nitro.d.ts" />',
    );
    expect(declaration).toContain('declare module "#openapi-wrapper" {');
    const runtimeImport = declaration.match(
      /import\('([^']+)'\)\.NitroFetch/,
    )![1]!;
    expect(
      path.resolve(buildDir, 'types', 'openapi-wrapper', runtimeImport),
    ).toBe(path.join(srcDirectory, 'runtime', 'server'));
    for (const name of [
      'NitroFetch',
      'UntypedNitroFetchOptions',
      'SimplifiedNitroFetchOptions',
      'handleFetchPathParams',
      'ensureArray',
    ]) {
      expect(declaration).toContain(name);
    }
    expect(declaration).toContain('export * from "#openapi-wrapper/petstore";');
    expect(declaration).toContain('export * from "#openapi-wrapper/my-api";');
  });
});

describe('generate: openapi.d.ts', () => {
  it('wraps the generated types in the api types module', async () => {
    await run({ apis: { petstore } });
    const declaration = await contents(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts'),
    );

    expect(
      declaration.startsWith(
        "declare module '#openapi-wrapper/petstore/types' {",
      ),
    ).toBe(true);
    expect(declaration.trimEnd().endsWith('}')).toBe(true);
    expect(declaration).toContain('export interface paths');
    expect(declaration).toContain('"/pets/{petId}"');
  });

  it('logs the cause with the api name and rethrows when generation fails', async () => {
    await run({
      apis: { petstore: { ...petstore, openApi: specUrl('missing.yaml') } },
    });
    const template = kit.typeTemplate(
      'types/openapi-wrapper/petstore/openapi.d.ts',
    );

    const error = await Promise.resolve(template.getContents()).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(kit.logger.error).toHaveBeenCalledWith(
      'Failed to generate OpenAPI types for "petstore":',
      error,
    );
  });
});

describe('generate: MCP wiring', () => {
  it('records schemas and sets up the tools by default', async () => {
    await run({ apis: { petstore } });
    await contents(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts'),
    );

    expect(mcp.setupMCPTools).toHaveBeenCalledExactlyOnceWith(nuxt);
    expect(mcp.recordInfoForMcp).toHaveBeenCalledExactlyOnceWith(
      'petstore',
      expect.objectContaining({
        info: expect.objectContaining({ title: 'Petstore' }),
      }),
    );
  });

  it('only records apis that are exposed', async () => {
    await run({
      exposeToMcp: false,
      apis: { petstore: { ...petstore, exposeToMcp: true }, hidden: petstore },
    });
    await contents(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts'),
    );
    await contents(
      kit.typeTemplate('types/openapi-wrapper/hidden/openapi.d.ts'),
    );

    expect(mcp.setupMCPTools).toHaveBeenCalledOnce();
    expect(mcp.recordInfoForMcp).toHaveBeenCalledExactlyOnceWith(
      'petstore',
      expect.anything(),
    );
  });

  it('does not set up MCP when no api is exposed', async () => {
    await run({ apis: { petstore: { ...petstore, exposeToMcp: false } } });
    await contents(
      kit.typeTemplate('types/openapi-wrapper/petstore/openapi.d.ts'),
    );

    expect(mcp.setupMCPTools).not.toHaveBeenCalled();
    expect(mcp.recordInfoForMcp).not.toHaveBeenCalled();
  });
});
