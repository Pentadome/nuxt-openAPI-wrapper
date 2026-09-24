import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyConfig, type ModuleOptions } from '../src/config';
import { discoverOpenApiObjectFilePath } from '../src/generate';
import { createFakeNuxt } from './helpers/fake-nuxt';
import { minimalYaml } from './helpers/specs';
import { useTempDirectories } from './helpers/temp-dir';

const makeTempDirectory = useTempDirectories();

const writeDocument = async (...segments: string[]) => {
  const filePath = path.join(...segments);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, minimalYaml);
  return filePath;
};

const discover = (
  layers: string[],
  collectionName: string,
  options: Partial<ModuleOptions> = {},
) =>
  discoverOpenApiObjectFilePath({
    moduleConfig: applyConfig({ apis: {}, ...options } as ModuleOptions),
    nuxt: createFakeNuxt({ rootDir: layers[0]!, layers }),
    collectionName,
  });

describe('discoverOpenApiObjectFilePath', () => {
  it.each(['openapi.yaml', 'openapi.json'])(
    'finds <root>/openapi/<name>/%s by default',
    async (fileName) => {
      const root = await makeTempDirectory();
      const expected = await writeDocument(
        root,
        'openapi',
        'catalog',
        fileName,
      );

      expect(discover([root], 'catalog')).toBe(expected);
    },
  );

  it('uses the api name verbatim as folder name', async () => {
    const root = await makeTempDirectory();
    const expected = await writeDocument(
      root,
      'openapi',
      'myApi',
      'openapi.yaml',
    );

    expect(discover([root], 'myApi')).toBe(expected);
  });

  it('does not match other extensions with the default pattern', async () => {
    const root = await makeTempDirectory();
    await writeDocument(root, 'openapi', 'catalog', 'openapi.yml');

    expect(() => discover([root], 'catalog')).toThrow(
      'no openapi file found for "catalog"',
    );
  });

  it('honors a custom `dirname` and `openApiFileName` glob', async () => {
    const root = await makeTempDirectory();
    const expected = await writeDocument(
      root,
      'specs',
      'catalog',
      'catalog.v2.yml',
    );

    expect(
      discover([root], 'catalog', {
        autoDiscover: { dirname: 'specs', openApiFileName: '*.yml' },
      }),
    ).toBe(expected);
  });

  it('prefers the first (highest priority) layer', async () => {
    const app = await makeTempDirectory();
    const base = await makeTempDirectory();
    const expected = await writeDocument(
      app,
      'openapi',
      'catalog',
      'openapi.yaml',
    );
    await writeDocument(base, 'openapi', 'catalog', 'openapi.yaml');

    expect(discover([app, base], 'catalog')).toBe(expected);
  });

  it('falls back to later layers', async () => {
    const app = await makeTempDirectory();
    const base = await makeTempDirectory();
    const expected = await writeDocument(
      base,
      'openapi',
      'catalog',
      'openapi.json',
    );

    expect(discover([app, base], 'catalog')).toBe(expected);
  });

  it('rejects ambiguous matches, listing every match', async () => {
    const root = await makeTempDirectory();
    const yaml = await writeDocument(
      root,
      'openapi',
      'catalog',
      'openapi.yaml',
    );
    const json = await writeDocument(
      root,
      'openapi',
      'catalog',
      'openapi.json',
    );

    const error = (() => {
      try {
        discover([root], 'catalog');
      } catch (error) {
        return error as Error;
      }
    })();

    expect(error?.message).toContain('Ambiguous open api object match');
    expect(error?.message).toContain(JSON.stringify(yaml).slice(1, -1));
    expect(error?.message).toContain(JSON.stringify(json).slice(1, -1));
  });

  it('reports every tried path when nothing is found', async () => {
    const app = await makeTempDirectory();
    const base = await makeTempDirectory();

    expect(() => discover([app, base], 'catalog')).toThrow(
      `no openapi file found for "catalog". Used file paths: ${JSON.stringify([
        path.join(app, 'openapi', 'catalog', 'openapi.{json,yaml}'),
        path.join(base, 'openapi', 'catalog', 'openapi.{json,yaml}'),
      ])}`,
    );
  });

  it('asserts auto discovery is enabled', async () => {
    const root = await makeTempDirectory();

    expect(() =>
      discover([root], 'catalog', { autoDiscover: false } as never),
    ).toThrow();
  });
});
