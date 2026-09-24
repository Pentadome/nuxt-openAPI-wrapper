import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import {
  BaseResolver,
  bundle,
  lintDocument,
  makeDocumentFromString,
  Source,
  type Document,
  type NormalizedProblem,
} from '@redocly/openapi-core';
import { error, warn } from 'openapi-typescript/src/lib/utils.ts';
import type { OpenAPI3 } from 'openapi-typescript/src/types.ts';

export class OpenApiSourceLoadError extends Error {
  constructor(readonly loadErrors: Error[]) {
    super(loadErrors.map((loadError) => loadError.message).join('; '));
    this.name = 'OpenApiSourceLoadError';
  }
}

class TrackingResolver extends BaseResolver {
  readonly loadErrors: Error[] = [];
  readonly parseErrors: Error[] = [];

  override async loadExternalRef(absoluteRef: string) {
    try {
      return await super.loadExternalRef(absoluteRef);
    } catch (loadError) {
      this.loadErrors.push(
        loadError instanceof Error ? loadError : new Error(String(loadError)),
      );
      throw loadError;
    }
  }

  override parseDocument(source: Source, isRoot = false) {
    try {
      return super.parseDocument(source, isRoot);
    } catch (parseError) {
      this.parseErrors.push(
        parseError instanceof Error ? parseError : new Error(String(parseError)),
      );
      throw parseError;
    }
  }
}

type ValidateAndBundleOptions = {
  redoc: Awaited<ReturnType<typeof import('@redocly/openapi-core').createConfig>>;
  silent: boolean;
  cwd?: URL;
};

const parseSchema = async (
  schema: string | URL | OpenAPI3 | Buffer | Readable,
  absoluteRef: string,
  resolver: TrackingResolver,
): Promise<Document> => {
  if (!schema) throw new Error('Can’t parse empty schema');

  if (schema instanceof URL) {
    const resolved = await resolver.resolveDocument(
      null,
      schema.protocol === 'file:' ? fileURLToPath(schema) : schema.href,
      true,
    );
    if ('parsed' in resolved) return resolved;
    throw resolved.originalError;
  }

  if (schema instanceof Readable) {
    const contents = await new Promise<string>((resolve, reject) => {
      schema.setEncoding('utf8');
      let content = '';
      schema.on('data', (chunk: string) => {
        content += chunk;
      });
      schema.on('end', () => resolve(content.trim()));
      schema.on('error', reject);
      schema.resume();
    }).catch((loadError: unknown) => {
      throw new OpenApiSourceLoadError([
        loadError instanceof Error ? loadError : new Error(String(loadError)),
      ]);
    });
    return parseSchema(contents, absoluteRef, resolver);
  }

  if (schema instanceof Buffer) {
    return parseSchema(schema.toString('utf8'), absoluteRef, resolver);
  }

  if (typeof schema === 'string') {
    if (/^(?:https?:\/\/|file:\/\/)/.test(schema)) {
      return parseSchema(new URL(schema), absoluteRef, resolver);
    }

    if (schema[0] === '{') {
      return {
        source: new Source(absoluteRef, schema, 'application/json'),
        parsed: JSON.parse(schema),
      };
    }

    return makeDocumentFromString(schema, absoluteRef);
  }

  if (typeof schema === 'object' && !Array.isArray(schema)) {
    return {
      source: new Source(absoluteRef, JSON.stringify(schema), 'application/json'),
      parsed: schema,
    };
  }

  throw new Error(
    `Expected string, object, or Buffer. Got ${Array.isArray(schema) ? 'Array' : typeof schema}`,
  );
};

const processProblems = (problems: NormalizedProblem[], silent: boolean) => {
  let errorMessage: string | undefined;
  for (const problem of problems) {
    const problemLocation = problem.location?.[0]?.pointer;
    const problemMessage = problemLocation
      ? `${problem.message} at ${problemLocation}`
      : problem.message;
    if (problem.severity === 'error') {
      errorMessage = problemMessage;
      error(problemMessage);
    } else {
      warn(problemMessage, silent);
    }
  }
  if (errorMessage) throw new Error(errorMessage);
};

/** Validate and bundle OpenAPI while retaining resolver load-vs-parse errors. */
export const validateAndBundle = async (
  source: string | URL | OpenAPI3 | Readable | Buffer,
  options: ValidateAndBundleOptions,
) => {
  const absoluteRef =
    source instanceof URL
      ? source.protocol === 'file:'
        ? fileURLToPath(source)
        : source.href
      : fileURLToPath(
          options.cwd instanceof URL
            ? options.cwd
            : new URL(`file://${options.cwd ?? process.cwd()}/`),
        );
  const resolver = new TrackingResolver(options.redoc.resolve);

  try {
    const document = await parseSchema(source, absoluteRef, resolver);

    const openapiVersion = Number.parseFloat(document.parsed.openapi);
    if (
      document.parsed.swagger ||
      !document.parsed.openapi ||
      Number.isNaN(openapiVersion) ||
      openapiVersion < 3 ||
      openapiVersion >= 4
    ) {
      if (document.parsed.swagger) {
        throw new Error(
          'Unsupported Swagger version: 2.x. Use OpenAPI 3.x instead.',
        );
      }
      if (
        document.parsed.openapi ||
        openapiVersion < 3 ||
        openapiVersion >= 4
      ) {
        throw new Error(`Unsupported OpenAPI version: ${document.parsed.openapi}`);
      }
      throw new Error('Unsupported schema format, expected `openapi: 3.x`');
    }

    const problems = await lintDocument({
      document,
      config: options.redoc.styleguide,
      externalRefResolver: resolver,
    });
    throwIfParseErrors(resolver);
    throwIfLoadErrors(resolver);
    processProblems(problems, options.silent);

    const bundled = await bundle({
      config: options.redoc,
      dereference: false,
      doc: document,
      externalRefResolver: resolver,
    });
    throwIfParseErrors(resolver);
    throwIfLoadErrors(resolver);
    processProblems(bundled.problems, options.silent);

    return bundled.bundle.parsed;
  } catch (validationError) {
    throwIfParseErrors(resolver);
    throwIfLoadErrors(resolver);
    throw validationError;
  }
};

const throwIfParseErrors = (resolver: TrackingResolver) => {
  if (resolver.parseErrors.length > 0) {
    throw resolver.parseErrors[0]!;
  }
};

const throwIfLoadErrors = (resolver: TrackingResolver) => {
  if (resolver.loadErrors.length > 0) {
    throw new OpenApiSourceLoadError(resolver.loadErrors);
  }
};
