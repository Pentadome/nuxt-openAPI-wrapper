import path from 'node:path';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfig, type ModuleOptions } from '../src/config';
import { generate } from '../src/generate';
import { createFakeNuxt, type FakeNuxt } from './helpers/fake-nuxt';
import { kit } from './helpers/kit-recorder';
import { minimalDocument, minimalYaml } from './helpers/specs';
import { useTempDirectories } from './helpers/temp-dir';

vi.mock('@nuxt/kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/kit')>()),
  ...(await import('./helpers/kit-recorder')).kitMocks,
}));

vi.mock('../src/mcp', () => ({
  recordInfoForMcp: vi.fn(),
  setupMCPTools: vi.fn(),
}));

const makeTempDirectory = useTempDirectories();

const rootYaml = (ref: string) => `
openapi: 3.0.3
info:
  title: With external ref
  version: 1.0.0
paths:
  /things:
    get:
      operationId: listThings
      responses:
        '200':
          description: things
          content:
            application/json:
              schema:
                $ref: '${ref}#/Thing'
`;

const thingYaml = `
Thing:
  type: object
  properties:
    id:
      type: string
`;

let rootDir: string;
let nuxt: FakeNuxt;

/** `<rootDir>/specs/root.yaml` referencing `<rootDir>/specs/shared/schemas.yaml`. */
let rootFile: string;
let schemasFile: string;

beforeEach(async () => {
  rootDir = await makeTempDirectory();
  nuxt = createFakeNuxt({ rootDir, dev: true });
  kit.reset(path.join(rootDir, '.nuxt'));

  rootFile = path.join(rootDir, 'specs', 'root.yaml');
  schemasFile = path.join(rootDir, 'specs', 'shared', 'schemas.yaml');
  await mkdir(path.dirname(schemasFile), { recursive: true });
  await writeFile(rootFile, rootYaml('./shared/schemas.yaml'));
  await writeFile(schemasFile, thingYaml);
});

const api = (options: Partial<ModuleOptions['apis'][string]> = {}) => ({
  baseUrl: 'https://things.test',
  openApi: pathToFileURL(rootFile),
  ...options,
});

const run = async (options: Partial<ModuleOptions>) => {
  await generate({
    moduleConfig: applyConfig({ apis: {}, ...options } as ModuleOptions),
    nuxt,
  });
  // Nuxt generates the templates before it starts watching.
  const results = await Promise.allSettled(
    kit.typeTemplates
      .filter((x) => x.filename.endsWith('/openapi.d.ts'))
      .map((x) => x.getContents()),
  );
  const failure = results.find((x) => x.status === 'rejected');
  if (failure) throw failure.reason;
};

const watched = () => [...nuxt.options.watch].sort();

describe('watch local openapi documents', () => {
  it('watches the directories of local documents and their $refs by default', async () => {
    await run({ apis: { things: api() } });

    expect(watched()).toEqual(
      [path.dirname(rootFile), path.dirname(schemasFile)].sort(),
    );
  });

  it('watches auto discovered documents', async () => {
    const discovered = path.join(rootDir, 'openapi', 'things', 'openapi.yaml');
    await mkdir(path.dirname(discovered), { recursive: true });
    await writeFile(discovered, minimalYaml);

    await run({ apis: { things: { baseUrl: 'https://things.test' } } });

    expect(watched()).toEqual([path.dirname(discovered)]);
  });

  it('watches every local fallback source', async () => {
    const fallback = path.join(rootDir, 'fallback', 'openapi.yaml');
    await mkdir(path.dirname(fallback), { recursive: true });
    await writeFile(fallback, minimalYaml);

    await run({
      apis: {
        things: api({
          openApi: [pathToFileURL(rootFile), pathToFileURL(fallback).href],
        }),
      },
    });

    expect(watched()).toContain(path.dirname(fallback));
  });

  it('does not watch outside development', async () => {
    nuxt = createFakeNuxt({ rootDir, dev: false });

    await run({ apis: { things: api() } });

    expect(watched()).toEqual([]);
  });

  it('can be disabled on module level', async () => {
    await run({ watch: false, apis: { things: api() } });

    expect(watched()).toEqual([]);
  });

  it('per-api settings override the module setting', async () => {
    const other = path.join(rootDir, 'other', 'openapi.yaml');
    await mkdir(path.dirname(other), { recursive: true });
    await writeFile(other, minimalYaml);

    await run({
      watch: false,
      apis: {
        things: api({ watch: true }),
        other: api({ openApi: pathToFileURL(other) }),
      },
    });
    expect(watched()).toEqual(
      [path.dirname(rootFile), path.dirname(schemasFile)].sort(),
    );

    nuxt = createFakeNuxt({ rootDir, dev: true });
    kit.reset(path.join(rootDir, '.nuxt'));
    await run({
      apis: {
        things: api({ watch: false }),
        other: api({ openApi: pathToFileURL(other) }),
      },
    });
    expect(watched()).toEqual([path.dirname(other)]);
  });

  it('ignores inline and remote sources', async () => {
    await run({
      apis: {
        inline: api({ openApi: minimalYaml }),
        object: api({ openApi: structuredClone(minimalDocument) as never }),
        remote: api({ openApi: 'http://127.0.0.1:1/openapi.yaml' }),
      },
    }).catch(() => undefined);

    expect(watched()).toEqual([]);
  });

  it('logs a regeneration when a tracked file changes', async () => {
    await run({ apis: { things: api() } });

    await nuxt.callHook('builder:watch', 'change', schemasFile);
    expect(kit.logger.info).toHaveBeenCalledWith(
      'OpenAPI document changed, regenerating types for "things"',
    );

    kit.logger.info.mockReset();
    await nuxt.callHook(
      'builder:watch',
      'change',
      path.join(path.dirname(schemasFile), 'unrelated.yaml'),
    );
    await nuxt.callHook('builder:watch', 'addDir', schemasFile);
    expect(kit.logger.info).not.toHaveBeenCalled();
  });

  it('tracks $refs added after an edit', async () => {
    await run({ apis: { things: api() } });

    const movedSchemas = path.join(rootDir, 'moved', 'schemas.yaml');
    await mkdir(path.dirname(movedSchemas), { recursive: true });
    await writeFile(movedSchemas, thingYaml);
    await writeFile(rootFile, rootYaml('../moved/schemas.yaml'));
    // make sure the mtime differs on file systems with coarse timestamps.
    const future = new Date(Date.now() + 10_000);
    await utimes(rootFile, future, future);

    await kit
      .typeTemplate('types/openapi-wrapper/things/openapi.d.ts')
      .getContents();

    expect(watched()).toContain(path.dirname(movedSchemas));
    await nuxt.callHook('builder:watch', 'change', movedSchemas);
    expect(kit.logger.info).toHaveBeenCalledWith(
      'OpenAPI document changed, regenerating types for "things"',
    );
  });

  it('keeps watching a document that fails to generate', async () => {
    await writeFile(rootFile, 'openapi: [broken');

    await run({ apis: { things: api() } }).catch(() => undefined);

    expect(watched()).toEqual([path.dirname(rootFile)]);
  });
});
