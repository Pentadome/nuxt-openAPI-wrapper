import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, rename, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import path from 'node:path';
import {
  BaseResolver,
  createConfig,
  type Document,
  type Source,
} from '@redocly/openapi-core';
import type { OpenApiTsCacheConfig } from '../config';
import type { OpenAPI3, OpenAPITSOptions } from 'openapi-typescript';
import { parseSchema } from 'openapi-typescript/src/lib/redoc.ts';

export type OpenApiDocument = string | URL | OpenAPI3 | Buffer | Readable;

type CachedGeneration = {
  formatVersion: 1;
  key: string;
  declaration: string;
  schema?: OpenAPI3;
};

type SourceIdentity = {
  locator: string;
  etag?: string;
  hash?: string;
};

type GenerateResult = {
  declaration: string;
  schema?: OpenAPI3;
  /** Set to false when the output did not come from `source` (e.g. a fallback was used). */
  cacheable?: boolean;
};

type Generate = (
  source: OpenApiDocument,
  options: OpenAPITSOptions,
  onSchemaCreated?: (schema: OpenAPI3) => void,
) => Promise<GenerateResult>;

type GetCachedGenerationArgs = {
  source: OpenApiDocument;
  options: OpenAPITSOptions;
  keyOptions: OpenAPITSOptions;
  cacheFilePath: string;
  version?: string | number;
  suppressFunctionWarning?: boolean;
  collectionName: string;
  onSchemaCreated?: (schema: OpenAPI3) => void;
  generate: Generate;
};

type CanonicalState = { containsFunctions: boolean };

const inFlightGenerations = new Map<string, Promise<CachedGeneration>>();
const warnedCollections = new Set<string>();
const omittedFunction = '[function omitted]';

export const getCachedOpenApiGeneration = async ({
  source,
  options,
  keyOptions,
  cacheFilePath,
  version,
  suppressFunctionWarning,
  collectionName,
  onSchemaCreated,
  generate,
}: GetCachedGenerationArgs): Promise<string> => {
  const bufferedSource = await bufferReadableSource(source);
  const state: CanonicalState = { containsFunctions: false };
  let canonicalOptions: unknown;
  try {
    canonicalOptions = canonicalize(keyOptions, state);
  } catch {
    const generated = await generate(bufferedSource, options, onSchemaCreated);
    return generated.declaration;
  }

  if (state.containsFunctions && !suppressFunctionWarning) {
    warnAboutFunctions(collectionName, version);
  }

  let key: string;
  let sourceIdentities: SourceIdentity[];
  let generatorOptions = options;

  try {
    const redocly = await resolveRedoclyConfig(options.redocly);
    generatorOptions = { ...options, redocly };
    sourceIdentities = await collectSourceIdentities(
      bufferedSource,
      generatorOptions,
    );
    key = hashValue({
      formatVersion: 1,
      libraryVersion: getPackageVersion('nuxt-openapi-wrapper'),
      openapiTypescriptVersion: getPackageVersion('openapi-typescript'),
      typescriptVersion: getPackageVersion('typescript'),
      redoclyVersion: getPackageVersion('@redocly/openapi-core'),
      version,
      options: canonicalOptions,
      sources: sourceIdentities,
    });
  } catch {
    // Source resolution or version lookup failed. Do not let cache bookkeeping
    // change generation behavior; let openapi-typescript report any real error.
    const generated = await generate(bufferedSource, options, onSchemaCreated);
    return generated.declaration;
  }

  const cached = await readCache(cacheFilePath);
  if (
    cached?.key === key &&
    (!onSchemaCreated || cached.schema !== undefined)
  ) {
    if (onSchemaCreated && cached.schema) onSchemaCreated(cached.schema);
    return cached.declaration;
  }

  const inflightKey = `${cacheFilePath}:${key}:${onSchemaCreated ? 'schema' : 'types'}`;
  const existingGeneration = inFlightGenerations.get(inflightKey);
  if (existingGeneration) {
    const result = await existingGeneration;
    if (onSchemaCreated && result.schema) onSchemaCreated(result.schema);
    return result.declaration;
  }

  const generation = (async () => {
    let schema: OpenAPI3 | undefined;
    const generated = await generate(
      bufferedSource,
      generatorOptions,
      onSchemaCreated
        ? (value) => {
            schema = value;
            onSchemaCreated(value);
          }
        : undefined,
    );
    const record: CachedGeneration = {
      formatVersion: 1,
      key,
      declaration: generated.declaration,
      schema: generated.schema ?? schema,
    };
    if (generated.cacheable !== false) await writeCache(cacheFilePath, record);
    return record;
  })();

  inFlightGenerations.set(inflightKey, generation);
  try {
    const result = await generation;
    return result.declaration;
  } finally {
    inFlightGenerations.delete(inflightKey);
  }
};

export const resolveOpenApiTsCacheOptions = (
  moduleOption: boolean | OpenApiTsCacheConfig | undefined,
  apiOption: boolean | OpenApiTsCacheConfig | undefined,
): false | OpenApiTsCacheConfig => {
  if (apiOption === false) return false;

  const moduleEnabled = moduleOption !== undefined && moduleOption !== false;
  const apiEnabled = apiOption !== undefined;
  if (!moduleEnabled && !apiEnabled) return false;

  const moduleOptions =
    moduleOption && typeof moduleOption === 'object' ? moduleOption : {};
  const apiOptions =
    apiOption && typeof apiOption === 'object' ? apiOption : {};
  return { ...moduleOptions, ...apiOptions };
};

export const canonicalize = (
  value: unknown,
  state: CanonicalState,
  ancestors = new WeakSet<object>(),
): unknown => {
  if (typeof value === 'function') {
    state.containsFunctions = true;
    return omittedFunction;
  }
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol') return value.toString();
  if (value === undefined) return '[undefined]';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof URL) return { $url: value.href };
  if (Buffer.isBuffer(value)) return { $buffer: value.toString('base64') };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof RegExp)
    return { $regexp: value.source, flags: value.flags };

  if (ancestors.has(value)) return '[circular]';
  ancestors.add(value);

  let canonical: unknown;
  if (Array.isArray(value)) {
    canonical = value.map((entry) => canonicalize(entry, state, ancestors));
  } else if (value instanceof Map) {
    canonical = {
      $map: [...value.entries()]
        .map(([key, entry]) => [
          canonicalize(key, state, ancestors),
          canonicalize(entry, state, ancestors),
        ])
        .sort((a, b) =>
          JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])),
        ),
    };
  } else if (value instanceof Set) {
    canonical = {
      $set: [...value]
        .map((entry) => canonicalize(entry, state, ancestors))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    };
  } else {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(
        (value as Record<string, unknown>)[key],
        state,
        ancestors,
      );
    }
    canonical = result;
  }

  ancestors.delete(value);
  return canonical;
};

const resolveRedoclyConfig = async (
  config: OpenAPITSOptions['redocly'],
): Promise<NonNullable<OpenAPITSOptions['redocly']>> => {
  return (
    config ??
    (await createConfig(
      {
        rules: {
          'operation-operationId-unique': { severity: 'error' },
        },
      },
      { extends: ['minimal'] },
    ))
  );
};

const bufferReadableSource = async (
  source: OpenApiDocument,
): Promise<OpenApiDocument> => {
  if (!(source instanceof Readable)) return source;
  const chunks: Buffer[] = [];
  for await (const chunk of source) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const collectSourceIdentities = async (
  source: OpenApiDocument,
  options: OpenAPITSOptions,
): Promise<SourceIdentity[]> => {
  const etags = new Map<string, string | undefined>();
  const redocly = options.redocly!;
  const resolveConfig = redocly.resolve;
  const httpConfig = resolveConfig?.http;
  const fetchImpl =
    (httpConfig?.customFetch as typeof fetch | undefined) ?? globalThis.fetch;
  const trackedResolveConfig = {
    ...resolveConfig,
    http: {
      ...httpConfig,
      customFetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await fetchImpl(input, init);
        const locator = normalizeHttpLocator(
          input instanceof URL ? input.href : String(input),
        );
        if (locator)
          etags.set(locator, response.headers.get('etag') ?? undefined);
        return response;
      },
    },
  };
  const resolver = new BaseResolver(trackedResolveConfig);
  const absoluteRef = getAbsoluteRef(source, options.cwd);
  const rootDocument = await parseSchema(source, { absoluteRef, resolver });
  const sources = new Map<string, SourceIdentity>();
  const documentsToVisit: Document[] = [rootDocument];
  const processedLocators = new Set<string>();
  const scheduledLocators = new Set<string>();

  while (documentsToVisit.length > 0) {
    const referencesToLoad: Array<{ base: string; ref: string }> = [];

    for (const document of documentsToVisit.splice(0)) {
      const locator = normalizeDocumentLocator(document.source.absoluteRef);
      if (processedLocators.has(locator)) continue;
      processedLocators.add(locator);
      sources.set(locator, identityForSource(document.source, locator, etags));

      for (const ref of findExternalReferences(document.parsed)) {
        const resolvedLocator = normalizeDocumentLocator(
          resolver.resolveExternalRef(document.source.absoluteRef, ref),
        );
        if (
          processedLocators.has(resolvedLocator) ||
          scheduledLocators.has(resolvedLocator)
        ) {
          continue;
        }
        scheduledLocators.add(resolvedLocator);
        referencesToLoad.push({ base: document.source.absoluteRef, ref });
      }
    }

    for (let index = 0; index < referencesToLoad.length; index += 8) {
      const batch = referencesToLoad.slice(index, index + 8);
      const resolvedDocuments = await Promise.all(
        batch.map(async ({ base, ref }) => {
          const resolved = await resolver.resolveDocument(base, ref);
          if (!('parsed' in resolved)) {
            throw resolved.originalError ?? resolved;
          }
          return resolved;
        }),
      );
      documentsToVisit.push(...resolvedDocuments);
    }
  }

  return [...sources.values()].sort((a, b) =>
    a.locator.localeCompare(b.locator),
  );
};

const findExternalReferences = (document: unknown): string[] => {
  const references = new Set<string>();
  const visited = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }

    const object = value as Record<string, unknown>;
    for (const refKey of ['$ref', '$dynamicRef', '$recursiveRef']) {
      const ref = object[refKey];
      if (typeof ref !== 'string') continue;
      const externalPart = ref.split('#', 1)[0];
      if (externalPart) references.add(externalPart);
    }
    for (const entry of Object.values(object)) visit(entry);
  };
  visit(document);
  return [...references];
};

const identityForSource = (
  source: Source,
  locator: string,
  etags: Map<string, string | undefined>,
): SourceIdentity => {
  const etag = etags.get(locator);
  if (isHttpLocator(locator) && etag) return { locator, etag };
  return {
    locator,
    hash: createHash('sha256').update(source.body).digest('hex'),
  };
};

const getAbsoluteRef = (
  source: OpenApiDocument,
  cwd?: OpenAPITSOptions['cwd'],
): string => {
  if (source instanceof URL) {
    return source.protocol === 'file:' ? fileURLToPath(source) : source.href;
  }
  if (
    typeof source === 'string' &&
    (source.startsWith('http://') ||
      source.startsWith('https://') ||
      source.startsWith('file://'))
  ) {
    const url = new URL(source);
    return url.protocol === 'file:' ? fileURLToPath(url) : url.href;
  }

  if (cwd instanceof URL) {
    return cwd.protocol === 'file:' ? fileURLToPath(cwd) : cwd.href;
  }
  return path.resolve(
    typeof cwd === 'string'
      ? cwd
      : Buffer.isBuffer(cwd)
        ? cwd.toString()
        : process.cwd(),
  );
};

const normalizeDocumentLocator = (locator: string): string => {
  if (isHttpLocator(locator)) {
    const url = new URL(locator);
    url.hash = '';
    return url.href;
  }
  if (locator.startsWith('file://')) {
    return path.resolve(fileURLToPath(locator));
  }
  return path.resolve(locator);
};

const normalizeHttpLocator = (locator: string): string | undefined => {
  try {
    const url = new URL(locator);
    if (!isHttpLocator(url.href)) return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
};

const isHttpLocator = (locator: string): boolean =>
  locator.startsWith('http://') || locator.startsWith('https://');

const hashValue = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const getPackageVersion = (packageName: string): string => {
  const entryUrl = import.meta.resolve(packageName);
  if (!entryUrl.startsWith('file:')) {
    throw new Error(`Cannot resolve package metadata for ${packageName}`);
  }

  const entryPath = fileURLToPath(entryUrl);
  let directory = path.dirname(entryPath);
  while (true) {
    const packageJsonPath = path.join(directory, 'package.json');
    try {
      const packageMetadata = JSON.parse(
        // package metadata is small; read synchronously during key creation.
        readFileSync(packageJsonPath, 'utf8'),
      ) as { name?: string; version?: string };
      if (packageMetadata.name === packageName && packageMetadata.version) {
        return packageMetadata.version;
      }
    } catch {
      // Keep walking toward the package root.
    }

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Cannot read package version for ${packageName}`);
};

const warnAboutFunctions = (
  collectionName: string,
  version?: string | number,
) => {
  if (warnedCollections.has(collectionName)) return;
  warnedCollections.add(collectionName);
  const versionHint =
    version === undefined
      ? 'Set openApiTsCache.version when function behavior changes to invalidate cached output.'
      : 'Change openApiTsCache.version whenever function behavior changes to invalidate cached output.';
  console.warn(
    `[nuxt-openapi-wrapper] openApiTsConfig for API "${collectionName}" contains function(s). Cache key generation ignores functions, so changing function behavior can reuse stale output. ${versionHint} Set suppressFunctionWarning: true to silence this warning.`,
  );
};

const readCache = async (
  cacheFilePath: string,
): Promise<CachedGeneration | undefined> => {
  try {
    const parsed = JSON.parse(
      await readFile(cacheFilePath, 'utf8'),
    ) as Partial<CachedGeneration>;
    const schemaIsValid =
      parsed.schema === undefined ||
      (typeof parsed.schema === 'object' &&
        parsed.schema !== null &&
        !Array.isArray(parsed.schema));
    if (
      parsed.formatVersion !== 1 ||
      typeof parsed.key !== 'string' ||
      typeof parsed.declaration !== 'string' ||
      !schemaIsValid
    ) {
      return undefined;
    }
    return parsed as CachedGeneration;
  } catch {
    return undefined;
  }
};

const writeCache = async (
  cacheFilePath: string,
  record: CachedGeneration,
): Promise<void> => {
  const temporaryPath = `${cacheFilePath}.${randomUUID()}.tmp`;
  try {
    await mkdir(path.dirname(cacheFilePath), { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(record), 'utf8');
    await rename(temporaryPath, cacheFilePath);
  } catch {
    // Cache persistence is best-effort; generated output remains valid.
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};
