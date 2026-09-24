import upstreamOpenapiTS, {
  astToString,
  type OpenAPI3,
  type OpenAPITSOptions,
} from 'openapi-typescript';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import openapiTS from '../src/lib/openapi-typescript';
import { minimalDocument, specUrl } from './helpers/specs';

const kitchenSink = specUrl('kitchen-sink.yaml');

const generate = async (options: OpenAPITSOptions = {}) =>
  astToString(await openapiTS(kitchenSink, { silent: true, ...options }));

const generateUpstream = async (options: OpenAPITSOptions = {}) =>
  astToString(
    await upstreamOpenapiTS(kitchenSink, { silent: true, ...options }),
  );

const stringNode = () =>
  ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);

// [option, baseline it must differ from]
const optionCases: Array<[string, OpenAPITSOptions, OpenAPITSOptions]> = [
  ['additionalProperties', { additionalProperties: true }, {}],
  ['alphabetize', { alphabetize: true }, {}],
  ['arrayLength', { arrayLength: true }, {}],
  ['defaultNonNullable', { defaultNonNullable: false }, {}],
  ['emptyObjectsUnknown', { emptyObjectsUnknown: true }, {}],
  ['enum', { enum: true }, {}],
  ['enumValues', { enumValues: true }, {}],
  ['conditionalEnums', { enum: true, conditionalEnums: true }, { enum: true }],
  ['dedupeEnums', { enum: true, dedupeEnums: true }, { enum: true }],
  ['excludeDeprecated', { excludeDeprecated: true }, {}],
  ['exportType', { exportType: true }, {}],
  ['immutable', { immutable: true }, {}],
  ['rootTypes', { rootTypes: true }, {}],
  [
    'rootTypesNoSchemaPrefix',
    { rootTypes: true, rootTypesNoSchemaPrefix: true },
    { rootTypes: true },
  ],
  [
    'rootTypesKeepCasing',
    { rootTypes: true, rootTypesKeepCasing: true },
    { rootTypes: true },
  ],
  ['pathParamsAsTypes', { pathParamsAsTypes: true }, {}],
  ['propertiesRequiredByDefault', { propertiesRequiredByDefault: true }, {}],
  ['makePathsEnum', { makePathsEnum: true }, {}],
  ['generatePathParams', { generatePathParams: true }, {}],
  ['readWriteMarkers', { readWriteMarkers: true }, {}],
  ['inject', { inject: 'export type Injected = 1;' }, {}],
  [
    'transform',
    {
      transform: (schema) =>
        schema.format === 'binary' || schema.type === 'integer'
          ? stringNode()
          : undefined,
    },
    {},
  ],
  [
    'transformProperty',
    {
      transformProperty: (property) =>
        ts.factory.updatePropertySignature(
          property,
          [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          property.name,
          property.questionToken,
          property.type,
        ),
    },
    {},
  ],
  [
    'postTransform',
    {
      postTransform: (type) =>
        ts.isUnionTypeNode(type) ? stringNode() : undefined,
    },
    {},
  ],
];

describe('openapiTS (fork with onSchemaCreated)', () => {
  it('rejects an empty source', async () => {
    await expect(openapiTS('' as never)).rejects.toThrow(
      'Empty schema. Please specify a URL, file path, or Redocly Config',
    );
  });

  it('generates `paths`, `components` and `operations`', async () => {
    const output = await generate();

    expect(output).toContain('export interface paths');
    expect(output).toContain('export interface components');
    expect(output).toContain('export interface operations');
    expect(output).toContain('"/zebras/{zebraId}"');
  });

  it('matches upstream output with default options', async () => {
    expect(await generate()).toBe(await generateUpstream());
  });

  it.each(optionCases)(
    'honors `%s` exactly like upstream openapi-typescript',
    async (_name, options, baseline) => {
      const output = await generate(options);

      expect(output).toBe(await generateUpstream(options));
      expect(output).not.toBe(await generate(baseline));
    },
  );

  it('fails on duplicate operationIds by default', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const document = structuredClone(minimalDocument) as unknown as OpenAPI3;
    document.paths!['/other'] = {
      get: {
        operationId: 'getHealth',
        responses: { '200': { description: 'duplicate' } },
      },
    };

    await expect(openapiTS(document, { silent: true })).rejects.toThrow(
      /operationId/i,
    );
  });

  it('passes the bundled schema to `onSchemaCreated` before transforming', async () => {
    const onSchemaCreated = vi.fn();

    await openapiTS(
      specUrl('with-ref', 'root.yaml'),
      { silent: true },
      onSchemaCreated,
    );

    expect(onSchemaCreated).toHaveBeenCalledTimes(1);
    const [schema] = onSchemaCreated.mock.calls[0]!;
    expect(schema.info.title).toBe('With external ref');
    expect(schema.components.schemas.Thing).toBeDefined();
    expect(JSON.stringify(schema)).not.toContain('schemas.yaml');
  });

  it('uses a provided redocly config instead of the default one', async () => {
    const { createConfig } = await import('@redocly/openapi-core');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const strict = await createConfig({ rules: { 'info-license': 'error' } });

    await expect(
      openapiTS(structuredClone(minimalDocument) as never, {
        redocly: strict,
        silent: true,
      }),
    ).rejects.toThrow(/license/i);
  });
});
