import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nuxt } from 'nuxt/schema';
import type { OpenAPI3 } from 'openapi-typescript';
import type { ApiConfig } from '../src/config';
import { applyConfig } from '../src/config';
import { getOpenApiTs } from '../src/generate';

const { openapiTSMock } = vi.hoisted(() => ({ openapiTSMock: vi.fn() }));
vi.mock('../src/lib/openapi-typescript', () => ({
  openapiTSWithFallback: (
    sources: unknown[],
    options: unknown,
    onSchemaCreated?: (schema: OpenAPI3) => void,
  ) =>
    openapiTSMock(sources[0], options, onSchemaCreated),
}));

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('generation cache integration', () => {
  it('skips openapi-typescript on a cache hit and replays MCP schema callback', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'openapi-cache-integration-'));
    tempDirectories.push(rootDir);
    const schema = {
      openapi: '3.1.0',
      info: { title: 'Integration cache', version: '1.0.0' },
      paths: {},
    } satisfies OpenAPI3;
    const typeAlias = ts.factory.createTypeAliasDeclaration(
      undefined,
      'CachedType',
      undefined,
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    );
    openapiTSMock.mockImplementation(
      async (_source, _options, onSchemaCreated) => {
        onSchemaCreated?.(schema);
        return [typeAlias];
      },
    );
    const apiConfig: ApiConfig<false> = {
      baseUrl: 'https://example.test',
      openApi: schema,
    };
    const moduleConfig = applyConfig({ openApiTsCache: true, apis: {} });
    const nuxt = { options: { rootDir } } as unknown as Nuxt;
    const onSchemaCreated = vi.fn();
    const args = {
      apiConfig,
      collectionName: 'integration',
      moduleConfig,
      nuxt,
      onSchemaCreated,
    };

    const first = await getOpenApiTs(args);
    const second = await getOpenApiTs(args);

    expect(first).toBe(second);
    expect(first).toContain('CachedType');
    expect(openapiTSMock).toHaveBeenCalledTimes(1);
    expect(onSchemaCreated).toHaveBeenNthCalledWith(1, schema);
    expect(onSchemaCreated).toHaveBeenNthCalledWith(2, schema);
  });
});
