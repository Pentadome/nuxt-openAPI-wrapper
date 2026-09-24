import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyConfig } from '../src/config';
import { openapiTSWithFallback } from '../src/lib/openapi-typescript';

const validDocument = `
openapi: 3.0.0
info:
  title: Fallback test
  version: 1.0.0
paths:
  /health:
    get:
      operationId: getHealth
      responses:
        '200':
          description: healthy
`;

let tempDirectory: string | undefined;

const makeTempDirectory = async () => {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'openapi-fallbacks-'));
  return tempDirectory;
};

afterEach(async () => {
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

describe('OpenAPI source fallbacks', () => {
  it('retains single-source support', async () => {
    const directory = await makeTempDirectory();
    const documentPath = path.join(directory, 'openapi.yaml');
    await writeFile(documentPath, validDocument);

    const generated = await openapiTSWithFallback(
      [pathToFileURL(documentPath)],
      {},
    );

    expect(generated.length).toBeGreaterThan(0);
  });

  it('uses next source when root document cannot be loaded', async () => {
    const directory = await makeTempDirectory();
    const validPath = path.join(directory, 'fallback.yaml');
    await writeFile(validPath, validDocument);

    const generated = await openapiTSWithFallback(
      [
        pathToFileURL(path.join(directory, 'missing.yaml')),
        pathToFileURL(validPath),
      ],
      {},
    );

    expect(generated.length).toBeGreaterThan(0);
  });

  it('uses next source when an external reference cannot be loaded', async () => {
    const directory = await makeTempDirectory();
    const documentWithMissingReference = `
openapi: 3.0.0
info:
  title: Broken external reference
  version: 1.0.0
paths:
  /health:
    get:
      operationId: getHealth
      responses:
        '200':
          description: response
          content:
            application/json:
              schema:
                $ref: ./missing-schema.yaml#/Health
`;
    const primaryPath = path.join(directory, 'primary.yaml');
    const fallbackPath = path.join(directory, 'fallback.yaml');
    await writeFile(primaryPath, documentWithMissingReference);
    await writeFile(fallbackPath, validDocument);

    const generated = await openapiTSWithFallback(
      [pathToFileURL(primaryPath), pathToFileURL(fallbackPath)],
      {},
    );

    expect(generated.length).toBeGreaterThan(0);
  });

  it('does not retry when source parsing fails', async () => {
    const directory = await makeTempDirectory();
    const malformedPath = path.join(directory, 'malformed.yaml');
    const fallbackPath = path.join(directory, 'fallback.yaml');
    await writeFile(malformedPath, 'openapi: [\ninfo: {');
    await writeFile(fallbackPath, validDocument);
    const onSchemaCreated = vi.fn();

    await expect(
      openapiTSWithFallback(
        [pathToFileURL(malformedPath), pathToFileURL(fallbackPath)],
        {},
        onSchemaCreated,
      ),
    ).rejects.toThrow();
    expect(onSchemaCreated).not.toHaveBeenCalled();
  });

  it('does not retry when a loaded document fails OpenAPI validation', async () => {
    const directory = await makeTempDirectory();
    const invalidPath = path.join(directory, 'invalid.yaml');
    const fallbackPath = path.join(directory, 'fallback.yaml');
    await writeFile(
      invalidPath,
      `swagger: '2.0'
info:
  title: Unsupported
  version: 1.0.0
paths: {}
`,
    );
    await writeFile(fallbackPath, validDocument);
    const onSchemaCreated = vi.fn();

    await expect(
      openapiTSWithFallback(
        [pathToFileURL(invalidPath), pathToFileURL(fallbackPath)],
        {},
        onSchemaCreated,
      ),
    ).rejects.toThrow('Unsupported Swagger version');
    expect(onSchemaCreated).not.toHaveBeenCalled();
  });

  it('reports all source failures when no candidate can be loaded', async () => {
    const directory = await makeTempDirectory();
    const firstPath = pathToFileURL(path.join(directory, 'missing-first.yaml'));
    const secondPath = pathToFileURL(
      path.join(directory, 'missing-second.yaml'),
    );

    let failure: unknown;
    try {
      await openapiTSWithFallback([firstPath, secondPath], {});
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).message).toContain(firstPath.href);
    expect((failure as AggregateError).message).toContain(secondPath.href);
    expect((failure as AggregateError).errors).toHaveLength(2);
  });

  it('describes string URLs verbatim and inline documents generically', async () => {
    const directory = await makeTempDirectory();
    const missingHref = pathToFileURL(
      path.join(directory, 'missing.yaml'),
    ).href;
    const inlineWithMissingRef = validDocument.replace(
      'paths:',
      "paths:\n  /other:\n    $ref: './does-not-exist.yaml'",
    );

    const failure = await openapiTSWithFallback(
      [missingHref, inlineWithMissingRef],
      { cwd: pathToFileURL(path.join(directory, 'inline.yaml')) },
    ).catch((error) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.message).toContain(`- Source 1 (${missingHref}):`);
    expect(failure.message).toContain(
      '- Source 2 ([inline OpenAPI document]):',
    );
  });

  it('rejects an empty source list', async () => {
    await expect(openapiTSWithFallback([], {})).rejects.toThrow(
      'At least one OpenAPI source must be provided',
    );
  });

  it('rejects an empty source array with a clear config error', () => {
    expect(() =>
      applyConfig({
        apis: {
          empty: {
            baseUrl: 'https://example.com',
            openApi: [] as never,
          },
        },
      }),
    ).toThrow('must contain at least one source');
  });
});
