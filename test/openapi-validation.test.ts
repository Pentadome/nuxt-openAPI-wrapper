import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { createConfig } from '@redocly/openapi-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OpenAPI3 } from 'openapi-typescript';
import {
  OpenApiSourceLoadError,
  validateAndBundle,
} from '../src/lib/openapi-validation';
import { staticRoutes, useHttpServers } from './helpers/http-server';
import {
  minimalDocument,
  minimalYaml,
  specPath,
  specUrl,
} from './helpers/specs';

const startServer = useHttpServers();

let redoc: Awaited<ReturnType<typeof createConfig>>;
beforeAll(async () => {
  redoc = await createConfig({}, { extends: ['minimal'] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const bundle = (
  source: Parameters<typeof validateAndBundle>[0],
  options: Partial<Parameters<typeof validateAndBundle>[1]> = {},
) => validateAndBundle(source, { redoc, silent: true, ...options });

const expectMinimal = (schema: OpenAPI3) => {
  expect(schema.info.title).toBe('Minimal');
  expect(schema.paths?.['/health']).toBeDefined();
};

describe('validateAndBundle source forms', () => {
  it('loads a file URL', async () => {
    const schema = await bundle(specUrl('petstore.yaml'));
    expect(schema.info.title).toBe('Petstore');
  });

  it('loads a `file://` string', async () => {
    const schema = await bundle(
      pathToFileURL(specPath('with-ref', 'root.yaml')).href,
    );
    expect(schema.info.title).toBe('With external ref');
  });

  it('loads an http URL and an http string', async () => {
    const server = await startServer(
      staticRoutes({ '/openapi.yaml': minimalYaml }),
    );

    expectMinimal(await bundle(server.url('/openapi.yaml')));
    expectMinimal(await bundle(server.url('/openapi.yaml').href));
  });

  it('parses a YAML string', async () => {
    expectMinimal(await bundle(minimalYaml));
  });

  it('parses a JSON string', async () => {
    expectMinimal(await bundle(JSON.stringify(minimalDocument)));
  });

  it('accepts a parsed object', async () => {
    expectMinimal(
      await bundle(structuredClone(minimalDocument) as unknown as OpenAPI3),
    );
  });

  it('accepts a Buffer', async () => {
    expectMinimal(await bundle(Buffer.from(minimalYaml)));
  });

  it('accepts a Readable stream', async () => {
    expectMinimal(await bundle(Readable.from([minimalYaml])));
  });

  it('rejects an empty source', async () => {
    await expect(bundle('')).rejects.toThrow('Can’t parse empty schema');
  });

  it('rejects arrays', async () => {
    await expect(bundle([] as never)).rejects.toThrow(
      'Expected string, object, or Buffer. Got Array',
    );
  });
});

describe('validateAndBundle references', () => {
  it('bundles external file references into the document', async () => {
    const schema = await bundle(specUrl('with-ref', 'root.yaml'));

    expect(JSON.stringify(schema)).not.toContain('schemas.yaml');
    expect(schema.components?.schemas?.Thing).toMatchObject({
      required: ['thingId'],
    });
  });

  // Same as upstream openapi-typescript: `cwd` is treated as the document location,
  // so refs resolve against its directory (a trailing-slash `cwd` resolves against the parent).
  it('resolves relative references of string sources against the `cwd` location', async () => {
    const yaml = await readFile(specPath('with-ref', 'root.yaml'), 'utf8');

    const schema = await bundle(yaml, {
      cwd: specUrl('with-ref', 'inline.yaml'),
    });
    expect(schema.components?.schemas?.Thing).toBeDefined();

    await expect(
      bundle(yaml, { cwd: pathToFileURL(`${specPath('with-ref')}/`) }),
    ).rejects.toBeInstanceOf(OpenApiSourceLoadError);
  });

  it('bundles remote references', async () => {
    const server = await startServer(
      staticRoutes({
        '/root.yaml': await readFile(specPath('with-ref', 'root.yaml'), 'utf8'),
        '/schemas.yaml': await readFile(
          specPath('with-ref', 'schemas.yaml'),
          'utf8',
        ),
      }),
    );

    const schema = await bundle(server.url('/root.yaml'));

    expect(schema.components?.schemas?.Thing).toBeDefined();
  });
});

describe('validateAndBundle errors', () => {
  it('throws a load error for a missing file', async () => {
    const error = await bundle(specUrl('does-not-exist.yaml')).catch((e) => e);

    expect(error).toBeInstanceOf(OpenApiSourceLoadError);
    expect(error.loadErrors).toHaveLength(1);
  });

  it('throws a load error for a failing Readable stream', async () => {
    const stream = new Readable({
      read() {
        this.destroy(new Error('stream broke'));
      },
    });

    const error = await bundle(stream).catch((e) => e);

    expect(error).toBeInstanceOf(OpenApiSourceLoadError);
    expect(error.message).toBe('stream broke');
  });

  it('throws a load error for an unreachable http document', async () => {
    const server = await startServer(staticRoutes({}));

    await expect(bundle(server.url('/missing.yaml'))).rejects.toBeInstanceOf(
      OpenApiSourceLoadError,
    );
  });

  it('throws a load error for a missing external reference', async () => {
    const yaml = minimalYaml.replace(
      'description: healthy',
      "description: healthy\n          content:\n            application/json:\n              schema:\n                $ref: './missing.yaml#/Thing'",
    );

    await expect(
      bundle(yaml, { cwd: specUrl('with-ref', 'inline.yaml') }),
    ).rejects.toBeInstanceOf(OpenApiSourceLoadError);
  });

  it('throws the parse error (not a load error) for invalid YAML', async () => {
    const error = await bundle('openapi: 3.0.3\n  info: [broken').catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(OpenApiSourceLoadError);
  });

  it('rejects Swagger 2 documents', async () => {
    await expect(
      bundle({
        swagger: '2.0',
        info: { title: 'x', version: '1' },
        paths: {},
      } as never),
    ).rejects.toThrow(
      'Unsupported Swagger version: 2.x. Use OpenAPI 3.x instead.',
    );
  });

  it.each(['2.0.0', '4.0.0', 'banana'])(
    'rejects `openapi: %s`',
    async (version) => {
      await expect(
        bundle({ ...minimalDocument, openapi: version } as never),
      ).rejects.toThrow(`Unsupported OpenAPI version: ${version}`);
    },
  );

  it('rejects documents without an `openapi` field', async () => {
    await expect(
      bundle({ info: minimalDocument.info, paths: {} } as never),
    ).rejects.toThrow('Unsupported schema format, expected `openapi: 3.x`');
  });
});

describe('validateAndBundle lint problems', () => {
  const unlicensed = structuredClone(minimalDocument) as unknown as OpenAPI3;

  it('throws on error-severity problems, including the pointer', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const strict = await createConfig({ rules: { 'info-license': 'error' } });

    await expect(bundle(unlicensed, { redoc: strict })).rejects.toThrow(
      /license.* at #\/info/i,
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it('warns on warn-severity problems and continues', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lenient = await createConfig({ rules: { 'info-license': 'warn' } });

    const schema = await bundle(unlicensed, { redoc: lenient, silent: false });

    expect(schema.info.title).toBe('Minimal');
    expect(consoleWarn.mock.calls.flat().join('\n')).toMatch(/license/i);
  });

  it('suppresses warnings when `silent`', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lenient = await createConfig({ rules: { 'info-license': 'warn' } });

    await bundle(unlicensed, { redoc: lenient, silent: true });

    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
