import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenAPI3 } from 'openapi-typescript';
import { applyConfig, type ApiConfig, type ModuleOptions } from '../src/config';
import { getOpenApiTs } from '../src/generate';
import { createFakeNuxt } from './helpers/fake-nuxt';
import { minimalDocument, minimalYaml } from './helpers/specs';
import { useTempDirectories } from './helpers/temp-dir';

const { openapiTSWithFallbackMock } = vi.hoisted(() => ({
  openapiTSWithFallbackMock: vi.fn(),
}));
vi.mock('../src/lib/openapi-typescript', () => ({
  openapiTSWithFallback: openapiTSWithFallbackMock,
}));

const makeTempDirectory = useTempDirectories();

const typeAlias = (name: string) =>
  ts.factory.createTypeAliasDeclaration(
    undefined,
    name,
    undefined,
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  );

openapiTSWithFallbackMock.mockImplementation(async () => [
  typeAlias('Generated'),
]);

afterEach(() => {
  openapiTSWithFallbackMock.mockClear();
});

type Args = {
  moduleOptions?: Partial<ModuleOptions>;
  apiConfig?: Partial<ApiConfig>;
  collectionName?: string;
  rootDir?: string;
  onSchemaCreated?: (schema: OpenAPI3) => void;
};

const run = async ({
  moduleOptions = {},
  apiConfig = {},
  collectionName = 'petstore',
  rootDir,
  onSchemaCreated,
}: Args = {}) => {
  rootDir ??= await makeTempDirectory();
  return getOpenApiTs({
    moduleConfig: applyConfig({ apis: {}, ...moduleOptions } as ModuleOptions),
    apiConfig: {
      baseUrl: 'https://example.test',
      openApi: minimalDocument as unknown as OpenAPI3,
      ...apiConfig,
    } as ApiConfig,
    collectionName,
    nuxt: createFakeNuxt({ rootDir }),
    onSchemaCreated,
  });
};

const lastCall = () => {
  const [sources, options, onSchemaCreated] =
    openapiTSWithFallbackMock.mock.lastCall!;
  return { sources, options, onSchemaCreated };
};

describe('getOpenApiTs', () => {
  it('returns the printed declaration of the generated AST', async () => {
    await expect(run()).resolves.toContain('type Generated = string;');
  });

  it('requires `openApi` when auto discovery is disabled', async () => {
    await expect(
      run({
        moduleOptions: { autoDiscover: false },
        apiConfig: { openApi: undefined },
      }),
    ).rejects.toThrow(
      "The api config property 'openApi' is required when auto discovery is disabled",
    );
    expect(openapiTSWithFallbackMock).not.toHaveBeenCalled();
  });

  describe('openapi-typescript options', () => {
    it('uses the default options', async () => {
      await run();

      expect(lastCall().options).toEqual({
        alphabetize: true,
        generatePathParams: true,
        pathParamsAsTypes: false,
      });
    });

    it('merges module options with api options, api options winning', async () => {
      await run({
        moduleOptions: { openApiTsConfig: { alphabetize: false, enum: true } },
        apiConfig: { openApiTsConfig: { enum: false, immutable: true } },
      });

      expect(lastCall().options).toEqual({
        alphabetize: false,
        enum: false,
        immutable: true,
        generatePathParams: true,
        pathParamsAsTypes: false,
      });
    });

    it('always forces `generatePathParams: true` and `pathParamsAsTypes: false`', async () => {
      const forbidden = {
        generatePathParams: false,
        pathParamsAsTypes: true,
      } as never;

      await run({ moduleOptions: { openApiTsConfig: forbidden } });
      expect(lastCall().options).toMatchObject({
        generatePathParams: true,
        pathParamsAsTypes: false,
      });

      await run({ apiConfig: { openApiTsConfig: forbidden } });
      expect(lastCall().options).toMatchObject({
        generatePathParams: true,
        pathParamsAsTypes: false,
      });
    });

    it('does not mutate the module options', async () => {
      const openApiTsConfig = { alphabetize: false };
      await run({
        moduleOptions: { openApiTsConfig },
        apiConfig: { openApiTsConfig: { enum: true } },
      });

      expect(openApiTsConfig).toEqual({ alphabetize: false });
    });
  });

  describe('sources', () => {
    it('wraps a single source in an array', async () => {
      await run({ apiConfig: { openApi: minimalYaml } });

      expect(lastCall().sources).toEqual([minimalYaml]);
    });

    it('passes a source array in order', async () => {
      const sources = [
        'https://a.test/1.yaml',
        'https://a.test/2.yaml',
      ] as const;
      await run({ apiConfig: { openApi: sources } });

      expect(lastCall().sources).toEqual(sources);
    });

    it('auto-discovers a file URL when `openApi` is omitted', async () => {
      const rootDir = await makeTempDirectory();
      const documentPath = path.join(
        rootDir,
        'openapi',
        'petstore',
        'openapi.yaml',
      );
      await mkdir(path.dirname(documentPath), { recursive: true });
      await writeFile(documentPath, minimalYaml);

      await run({ rootDir, apiConfig: { openApi: undefined } });

      const [source] = lastCall().sources as URL[];
      expect(source).toBeInstanceOf(URL);
      expect(source!.protocol).toBe('file:');
      expect(fileURLToPath(source!)).toBe(documentPath);
    });

    it('forwards `onSchemaCreated`', async () => {
      const onSchemaCreated = vi.fn();
      await run({ onSchemaCreated });

      expect(lastCall().onSchemaCreated).toBe(onSchemaCreated);
    });
  });

  describe('cache', () => {
    const defaultCacheFile = (rootDir: string, collection: string) =>
      path.join(
        rootDir,
        'node_modules',
        '.cache',
        'nuxt-openAPI-wrapper',
        collection,
        'cache.json',
      );

    it('regenerates on every call when caching is disabled', async () => {
      const rootDir = await makeTempDirectory();
      await run({ rootDir });
      await run({ rootDir });

      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(2);
      expect(existsSync(defaultCacheFile(rootDir, 'petstore'))).toBe(false);
    });

    it('caches under node_modules/.cache/nuxt-openAPI-wrapper/<kebab-name> by default', async () => {
      const rootDir = await makeTempDirectory();
      const args = {
        rootDir,
        collectionName: 'myPetstore',
        moduleOptions: { openApiTsCache: true },
      };

      const first = await run(args);
      const second = await run(args);

      expect(second).toBe(first);
      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(1);
      expect(existsSync(defaultCacheFile(rootDir, 'my-petstore'))).toBe(true);
    });

    it('resolves a custom cache directory from the Nuxt root', async () => {
      const rootDir = await makeTempDirectory();
      await run({
        rootDir,
        moduleOptions: { openApiTsCache: { directory: 'custom-cache' } },
      });

      expect(
        existsSync(
          path.join(rootDir, 'custom-cache', 'petstore', 'cache.json'),
        ),
      ).toBe(true);
    });

    it('lets the api setting override the module setting', async () => {
      const rootDir = await makeTempDirectory();
      const args = {
        rootDir,
        moduleOptions: { openApiTsCache: true },
        apiConfig: { openApiTsCache: false },
      };
      await run(args);
      await run(args);

      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(2);
      expect(existsSync(defaultCacheFile(rootDir, 'petstore'))).toBe(false);
    });

    it('can be enabled per api only', async () => {
      const rootDir = await makeTempDirectory();
      const args = { rootDir, apiConfig: { openApiTsCache: true } };
      await run(args);
      await run(args);

      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(1);
    });

    it('caches output generated from the first of multiple sources', async () => {
      const rootDir = await makeTempDirectory();
      const args = {
        rootDir,
        moduleOptions: { openApiTsCache: true },
        apiConfig: { openApi: [minimalYaml, minimalYaml] as const },
      };
      await run(args);
      await run(args);

      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(1);
      expect(lastCall().sources).toEqual([minimalYaml, minimalYaml]);
      expect(existsSync(defaultCacheFile(rootDir, 'petstore'))).toBe(true);
    });

    it('does not cache output generated from a fallback source', async () => {
      openapiTSWithFallbackMock.mockImplementation(
        async (_sources, _options, _onSchemaCreated, onSourceUsed) => {
          onSourceUsed?.(1);
          return [typeAlias('Generated')];
        },
      );
      const rootDir = await makeTempDirectory();
      const args = {
        rootDir,
        moduleOptions: { openApiTsCache: true },
        apiConfig: { openApi: [minimalYaml, minimalYaml] as const },
      };
      try {
        await run(args);
        await run(args);
      } finally {
        openapiTSWithFallbackMock.mockImplementation(async () => [
          typeAlias('Generated'),
        ]);
      }

      expect(openapiTSWithFallbackMock).toHaveBeenCalledTimes(2);
      expect(existsSync(defaultCacheFile(rootDir, 'petstore'))).toBe(false);
    });
  });
});
