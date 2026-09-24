import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenAPI3, OpenAPITSOptions } from 'openapi-typescript';
import {
  canonicalize,
  getCachedOpenApiGeneration,
  resolveOpenApiTsCacheOptions,
} from '../src/lib/openapi-cache';

const tempDirectories: string[] = [];
const closeServers: Array<() => Promise<void>> = [];

const makeTempDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'openapi-cache-test-'));
  tempDirectories.push(directory);
  return directory;
};

const makeCachedGeneration = (
  options: {
    source?: string | URL | OpenAPI3 | Buffer | Readable;
    keyOptions?: OpenAPITSOptions;
    version?: string | number;
    onSchemaCreated?: (schema: OpenAPI3) => void;
    generate: (
      source: string | URL | OpenAPI3 | Buffer | Readable,
      options: OpenAPITSOptions,
      onSchemaCreated?: (schema: OpenAPI3) => void,
    ) => Promise<{ declaration: string; schema?: OpenAPI3 }>;
  },
) =>
  getCachedOpenApiGeneration({
    source: options.source ?? {
      openapi: '3.1.0',
      info: { title: 'Cache fixture', version: '1.0.0' },
      paths: {},
    },
    options: options.keyOptions ?? {},
    keyOptions: options.keyOptions ?? {},
    cacheFilePath: path.join(
      testCacheDirectory,
      'fixture',
      'cache.json',
    ),
    version: options.version,
    collectionName: `cache-test-${Math.random()}`,
    onSchemaCreated: options.onSchemaCreated,
    generate: options.generate,
  });

let testCacheDirectory = '';

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(closeServers.splice(0).map((close) => close()));
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('openapi generation cache', () => {
  it('uses same generated declaration on a matching key without rerunning generator', async () => {
    testCacheDirectory = await makeTempDirectory();
    const generate = vi.fn(async () => ({ declaration: 'export type Cached = true;' }));
    const source = {
      openapi: '3.1.0',
      info: { title: 'Cache fixture', version: '1.0.0' },
      paths: {},
    } satisfies OpenAPI3;

    const first = await makeCachedGeneration({ source, generate });
    const second = await makeCachedGeneration({ source, generate });

    expect(first).toBe('export type Cached = true;');
    expect(second).toBe(first);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('invalidates for config and custom version changes', async () => {
    testCacheDirectory = await makeTempDirectory();
    const generate = vi.fn(async () => ({ declaration: `generation-${generate.mock.calls.length}` }));

    await makeCachedGeneration({
      keyOptions: { alphabetize: true },
      generate,
    });
    await makeCachedGeneration({
      keyOptions: { alphabetize: false },
      generate,
    });
    await makeCachedGeneration({
      keyOptions: { alphabetize: false },
      version: 'custom-2',
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('omits function identity from keys, warns with custom-version guidance, and supports suppression', async () => {
    testCacheDirectory = await makeTempDirectory();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const generate = vi.fn(async () => ({ declaration: 'export type Fn = true;' }));
    const source = {
      openapi: '3.1.0',
      info: { title: 'Cache fixture', version: '1.0.0' },
      paths: {},
    } satisfies OpenAPI3;

    const call = (transform: () => unknown, suppressFunctionWarning = false) =>
      getCachedOpenApiGeneration({
        source,
        options: { transform: transform as OpenAPITSOptions['transform'] },
        keyOptions: { transform: transform as OpenAPITSOptions['transform'] },
        cacheFilePath: path.join(testCacheDirectory, 'functions', 'cache.json'),
        collectionName: 'function-warning-test',
        suppressFunctionWarning,
        generate,
      });

    await call(() => 'first');
    await call(() => 'changed');
    await call(() => 'ignored', true);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'openApiTsCache.version',
    );
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'suppressFunctionWarning: true',
    );
  });

  it('replays the cached bundled schema callback on cache hit', async () => {
    testCacheDirectory = await makeTempDirectory();
    const schema = {
      openapi: '3.1.0',
      info: { title: 'Cached schema', version: '1.0.0' },
      paths: {},
    } satisfies OpenAPI3;
    const generate = vi.fn(async (_source, _options, callback) => {
      callback?.(schema);
      return { declaration: 'export type Mcp = true;' };
    });
    const callback = vi.fn();

    await makeCachedGeneration({ generate, onSchemaCreated: callback });
    await makeCachedGeneration({ generate, onSchemaCreated: callback });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenNthCalledWith(1, schema);
    expect(callback).toHaveBeenNthCalledWith(2, schema);
  });

  it('treats malformed cache records and unwritable cache locations as misses', async () => {
    testCacheDirectory = await makeTempDirectory();
    const cacheFilePath = path.join(testCacheDirectory, 'corrupt', 'cache.json');
    await mkdir(path.dirname(cacheFilePath), { recursive: true });
    await writeFile(cacheFilePath, 'not-json');
    const generate = vi.fn(async () => ({ declaration: 'export type Recovered = true;' }));

    await expect(
      getCachedOpenApiGeneration({
        source: {
          openapi: '3.1.0',
          info: { title: 'Cache fixture', version: '1.0.0' },
          paths: {},
        },
        options: {},
        keyOptions: {},
        cacheFilePath,
        collectionName: 'corrupt-cache-test',
        generate,
      }),
    ).resolves.toBe('export type Recovered = true;');

    const record = JSON.parse(await readFile(cacheFilePath, 'utf8')) as {
      declaration: string;
    };
    expect(record.declaration).toBe('export type Recovered = true;');

    const blockedCachePath = path.join(testCacheDirectory, 'blocked');
    await mkdir(blockedCachePath);
    await expect(
      getCachedOpenApiGeneration({
        source: {
          openapi: '3.1.0',
          info: { title: 'Cache fixture', version: '1.0.0' },
          paths: {},
        },
        options: {},
        keyOptions: {},
        cacheFilePath: blockedCachePath,
        collectionName: 'write-failure-test',
        generate,
      }),
    ).resolves.toBe('export type Recovered = true;');
  });

  it('buffers one-shot readable sources before passing them to generation', async () => {
    testCacheDirectory = await makeTempDirectory();
    let generatorSource: unknown;
    await makeCachedGeneration({
      source: Readable.from(['openapi: 3.1.0\ninfo: {title: stream, version: 1}\npaths: {}\n']),
      generate: async (source) => {
        generatorSource = source;
        return { declaration: 'export type Stream = true;' };
      },
    });

    expect(Buffer.isBuffer(generatorSource)).toBe(true);
    expect((generatorSource as Buffer).toString()).toContain('openapi: 3.1.0');
  });

  it('invalidates when transitive HTTP `$ref` ETags change', async () => {
    testCacheDirectory = await makeTempDirectory();
    let rootVersion = 1;
    let nestedVersion = 1;
    const server = createServer((request, response) => {
      const route = request.url;
      if (route === '/root.json') {
        response.setHeader('etag', `"root-v${rootVersion}"`);
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            openapi: '3.1.0',
            info: { title: 'Remote', version: '1.0.0' },
            paths: { '/pets': { $ref: './path.json' } },
          }),
        );
      } else if (route === '/path.json') {
        response.setHeader('etag', '"path-v1"');
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            get: {
              parameters: [{ $ref: './parameter.json#/parameters/Pet' }],
              responses: { '200': { description: 'ok' } },
            },
          }),
        );
      } else if (route === '/parameter.json') {
        response.setHeader('etag', `"parameter-v${nestedVersion}"`);
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            parameters: {
              Pet: {
                name: `pet-${nestedVersion}`,
                in: 'query',
                schema: { type: 'string' },
              },
            },
          }),
        );
      } else {
        response.statusCode = 404;
        response.end('missing');
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    closeServers.push(
      () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    );
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP test address');
    const source = new URL(`http://127.0.0.1:${address.port}/root.json`);
    const generate = vi.fn(async () => ({ declaration: 'export type Remote = true;' }));

    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'remote', 'cache.json'),
      collectionName: 'remote-reference-test',
      generate,
    });
    nestedVersion++;
    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'remote', 'cache.json'),
      collectionName: 'remote-reference-test',
      generate,
    });
    rootVersion++;
    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'remote', 'cache.json'),
      collectionName: 'remote-reference-test',
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('hashes HTTP document content when no ETag is present', async () => {
    testCacheDirectory = await makeTempDirectory();
    let title = 'First';
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          openapi: '3.1.0',
          info: { title, version: '1.0.0' },
          paths: {},
        }),
      );
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    closeServers.push(
      () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    );
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP test address');
    const source = new URL(`http://127.0.0.1:${address.port}/root.json`);
    const generate = vi.fn(async () => ({ declaration: 'export type NoEtag = true;' }));

    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'no-etag', 'cache.json'),
      collectionName: 'no-etag-test',
      generate,
    });
    title = 'Changed';
    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'no-etag', 'cache.json'),
      collectionName: 'no-etag-test',
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('hashes local root and referenced documents', async () => {
    testCacheDirectory = await makeTempDirectory();
    const docsDirectory = path.join(testCacheDirectory, 'docs');
    await mkdir(docsDirectory, { recursive: true });
    const rootPath = path.join(docsDirectory, 'root.json');
    const childPath = path.join(docsDirectory, 'child.json');
    await writeFile(
      rootPath,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Local', version: '1.0.0' },
        paths: { '/pets': { $ref: './child.json' } },
      }),
    );
    await writeFile(childPath, JSON.stringify({ get: { responses: {} } }));
    const source = pathToFileURL(rootPath);
    const generate = vi.fn(async () => ({ declaration: 'export type Local = true;' }));

    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'local', 'cache.json'),
      collectionName: 'local-reference-test',
      generate,
    });
    await writeFile(childPath, JSON.stringify({ get: { responses: { '200': {} } } }));
    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'local', 'cache.json'),
      collectionName: 'local-reference-test',
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(2);
    await writeFile(rootPath, JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Updated local root', version: '1.0.0' },
      paths: { '/pets': { $ref: './child.json' } },
    }));
    await getCachedOpenApiGeneration({
      source,
      options: {},
      keyOptions: {},
      cacheFilePath: path.join(testCacheDirectory, 'local', 'cache.json'),
      collectionName: 'local-reference-test',
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(await readFile(childPath, 'utf8')).toContain('200');
  });

  it('resolves global and per-API cache settings', () => {
    expect(resolveOpenApiTsCacheOptions(true, { version: 2 })).toEqual({
      version: 2,
    });
    expect(
      resolveOpenApiTsCacheOptions(
        { directory: '.cache', version: 'global' },
        { version: 'api' },
      ),
    ).toEqual({ directory: '.cache', version: 'api' });
    expect(resolveOpenApiTsCacheOptions(true, false)).toBe(false);
    expect(resolveOpenApiTsCacheOptions(false, { version: 1 })).toEqual({
      version: 1,
    });
  });

  it('canonicalizes object keys and ignores function identity', () => {
    const state = { containsFunctions: false };
    const first = canonicalize({ b: 2, fn: () => 1, a: 1 }, state);
    const second = canonicalize({ a: 1, fn: () => 2, b: 2 }, state);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(state.containsFunctions).toBe(true);
  });
});
