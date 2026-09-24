import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConfig } from '@redocly/openapi-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenAPI3, OpenAPITSOptions } from 'openapi-typescript';
import {
  canonicalize,
  getCachedOpenApiGeneration,
} from '../src/lib/openapi-cache';
import { staticRoutes, useHttpServers } from './helpers/http-server';
import { minimalDocument, minimalYaml } from './helpers/specs';
import { useTempDirectories } from './helpers/temp-dir';

const makeTempDirectory = useTempDirectories();
const startServer = useHttpServers();

afterEach(() => {
  vi.restoreAllMocks();
});

type Generate = Parameters<typeof getCachedOpenApiGeneration>[0]['generate'];

let collectionCounter = 0;
const uniqueCollection = () => `edge-case-${collectionCounter++}`;

const setup = async () => {
  const directory = await makeTempDirectory();
  const cacheFilePath = path.join(directory, 'cache', 'cache.json');
  const generate = vi.fn<Generate>(async () => ({
    declaration: 'export type X = 1;',
  }));
  const run = (
    overrides: Partial<Parameters<typeof getCachedOpenApiGeneration>[0]> = {},
  ) =>
    getCachedOpenApiGeneration({
      source: structuredClone(minimalDocument) as unknown as OpenAPI3,
      options: {},
      keyOptions: {},
      cacheFilePath,
      collectionName: uniqueCollection(),
      generate,
      ...overrides,
    });
  return { directory, cacheFilePath, generate, run };
};

describe('generation cache edge cases', () => {
  it('shares one in-flight generation between concurrent identical requests', async () => {
    const { run, generate } = await setup();
    let release!: () => void;
    generate.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ declaration: 'export type Shared = 1;' });
        }),
    );

    const first = run({ collectionName: 'shared' });
    const second = run({ collectionName: 'shared' });
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      'export type Shared = 1;',
      'export type Shared = 1;',
    ]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('replays the schema to every concurrent caller that asked for it', async () => {
    const { run, generate } = await setup();
    const schema = { openapi: '3.1.0' } as OpenAPI3;
    let release!: () => void;
    generate.mockImplementation(
      (_source, _options, onSchemaCreated) =>
        new Promise((resolve) => {
          release = () => {
            onSchemaCreated?.(schema);
            resolve({ declaration: 'x' });
          };
        }),
    );
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const first = run({ onSchemaCreated: firstCallback });
    const second = run({ onSchemaCreated: secondCallback });
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    release();
    await Promise.all([first, second]);

    expect(firstCallback).toHaveBeenCalledWith(schema);
    expect(secondCallback).toHaveBeenCalledWith(schema);
  });

  it('regenerates when the cached entry has no schema but one is requested', async () => {
    const { run, generate } = await setup();
    await run();
    expect(generate).toHaveBeenCalledTimes(1);

    await run({ onSchemaCreated: vi.fn() });

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('generates without caching when the options cannot be canonicalized', async () => {
    const { run, generate, cacheFilePath } = await setup();
    const keyOptions = Object.defineProperty({}, 'broken', {
      enumerable: true,
      get: () => {
        throw new Error('nope');
      },
    }) as OpenAPITSOptions;

    await run({ keyOptions });
    await run({ keyOptions });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(existsSync(cacheFilePath)).toBe(false);
  });

  it('generates without caching when the source cannot be resolved', async () => {
    const { run, generate, cacheFilePath, directory } = await setup();
    const source = pathToFileURL(path.join(directory, 'missing.yaml'));

    await expect(run({ source })).resolves.toBe('export type X = 1;');

    expect(generate).toHaveBeenCalledWith(source, {}, undefined);
    expect(existsSync(cacheFilePath)).toBe(false);
  });

  it('generates without caching when an external reference cannot be resolved', async () => {
    const { run, generate, cacheFilePath, directory } = await setup();
    const rootPath = path.join(directory, 'root.yaml');
    await writeFile(
      rootPath,
      minimalYaml.replace(
        'paths:',
        "paths:\n  /missing:\n    $ref: './missing.yaml'",
      ),
    );

    await run({ source: pathToFileURL(rootPath) });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(existsSync(cacheFilePath)).toBe(false);
  });

  it('passes a provided redocly config through to the generator', async () => {
    const { run, generate } = await setup();
    const redocly = await createConfig({});

    await run({ options: { redocly } });

    expect(generate.mock.calls[0]![1]).toMatchObject({ redocly });
  });

  it('fetches http documents through a configured custom fetch', async () => {
    const { run } = await setup();
    const server = await startServer(
      staticRoutes({ '/openapi.yaml': minimalYaml }),
    );
    // the local test server only.
    const customFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init),
    );
    const redocly = await createConfig({});
    redocly.resolve = {
      ...redocly.resolve,
      http: { ...redocly.resolve.http, customFetch: customFetch as never },
    };

    await run({ source: server.url('/openapi.yaml'), options: { redocly } });

    expect(customFetch).toHaveBeenCalled();
  });

  it('warns about function options once per collection, with a version hint', async () => {
    const { run } = await setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const keyOptions = { transform: () => undefined };

    await run({ keyOptions, collectionName: 'warn-once' });
    await run({ keyOptions, collectionName: 'warn-once' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('Set openApiTsCache.version');
  });

  it.each([
    ['an http string', 'http'],
    ['a file:// string', 'file'],
    ['a YAML string resolved against a cwd URL', 'cwd-url'],
    ['a YAML string resolved against a cwd string', 'cwd-string'],
    ['a Buffer', 'buffer'],
  ] as const)('keys %s source', async (_name, kind) => {
    const { run, generate, directory } = await setup();
    const documentPath = path.join(directory, 'docs', 'openapi.yaml');
    await mkdir(path.dirname(documentPath), { recursive: true });
    await writeFile(documentPath, minimalYaml);
    const server = await startServer(
      staticRoutes({ '/openapi.yaml': minimalYaml }),
    );

    const argsByKind = {
      http: { source: server.url('/openapi.yaml').href },
      file: { source: pathToFileURL(documentPath).href },
      'cwd-url': {
        source: minimalYaml,
        options: { cwd: pathToFileURL(documentPath) },
      },
      'cwd-string': {
        source: minimalYaml,
        options: { cwd: path.dirname(documentPath) },
      },
      buffer: { source: Buffer.from(minimalYaml) },
    };

    await run(argsByKind[kind]);
    await run(argsByKind[kind]);

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('ignores cache records with an invalid schema', async () => {
    const { run, generate, cacheFilePath } = await setup();
    const onSchemaCreated = vi.fn();
    await run({ onSchemaCreated });
    const record = JSON.parse(
      await import('node:fs/promises').then((fs) =>
        fs.readFile(cacheFilePath, 'utf8'),
      ),
    );
    await writeFile(cacheFilePath, JSON.stringify({ ...record, schema: [] }));

    await run({ onSchemaCreated });

    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe('canonicalize', () => {
  const canonical = (value: unknown) =>
    JSON.stringify(canonicalize(value, { containsFunctions: false }));

  it('encodes special values distinctly', () => {
    expect(canonicalize(10n, { containsFunctions: false })).toBe('10n');
    expect(canonicalize(Symbol('s'), { containsFunctions: false })).toBe(
      'Symbol(s)',
    );
    expect(canonicalize(undefined, { containsFunctions: false })).toBe(
      '[undefined]',
    );
    expect(canonicalize(null, { containsFunctions: false })).toBeNull();
    expect(
      canonicalize(new URL('https://a.test/x'), { containsFunctions: false }),
    ).toEqual({
      $url: 'https://a.test/x',
    });
    expect(
      canonicalize(Buffer.from('hi'), { containsFunctions: false }),
    ).toEqual({
      $buffer: Buffer.from('hi').toString('base64'),
    });
    expect(canonicalize(new Date(0), { containsFunctions: false })).toEqual({
      $date: '1970-01-01T00:00:00.000Z',
    });
    expect(canonicalize(/a+/gi, { containsFunctions: false })).toEqual({
      $regexp: 'a+',
      flags: 'gi',
    });
  });

  it('keeps array order but ignores Map, Set and object key order', () => {
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
    expect(
      canonical(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    ).toBe(
      canonical(
        new Map([
          ['b', 2],
          ['a', 1],
        ]),
      ),
    );
    expect(canonical(new Set([1, 2]))).toBe(canonical(new Set([2, 1])));
    expect(canonical({ a: 1, b: { c: 1, d: 2 } })).toBe(
      canonical({ b: { d: 2, c: 1 }, a: 1 }),
    );
  });

  it('marks circular references instead of recursing forever', () => {
    const value: Record<string, unknown> = { a: 1 };
    value.self = value;

    expect(canonicalize(value, { containsFunctions: false })).toEqual({
      a: 1,
      self: '[circular]',
    });
  });

  it('allows the same object in sibling positions', () => {
    const shared = { x: 1 };

    expect(
      canonicalize({ a: shared, b: shared }, { containsFunctions: false }),
    ).toEqual({
      a: { x: 1 },
      b: { x: 1 },
    });
  });
});
