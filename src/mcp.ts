/// <reference types="nuxt-mcp-dev" />

import type { Nuxt } from 'nuxt/schema';
import type { ApiConfig, ResolvedConfig } from './config';
import {
  resolveRef,
  type OpenAPI3,
  type PathItemObject,
} from 'openapi-typescript';
import type { ZodLiteral } from 'zod';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const apiInfos = new Map<string, OpenAPI3>();

export const recordInfoForMcp = (collectionName: string, openAPI: OpenAPI3) => {
  apiInfos.set(collectionName, openAPI);
};

const toolNamePrefix = 'nuxt-openAPI-wrapper__';

export const setupMCPTools = (nuxt: Nuxt) => {
  nuxt.hook('mcp:setup', async ({ mcp }) => {
    // if nuxt-mcp-dev is installed, zod should be installed too.
    const z = await import('zod');

    const defaultAnnotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } as const;

    const apis = apiInfos
      .keys()
      .map((x) => z.literal(x))
      .toArray();

    if (apis.length === 0) return;

    const zodSchemaName = (
      apis.length > 1
        ? z.union(
            apis as [
              ZodLiteral<string>,
              ZodLiteral<string>,
              ...ZodLiteral<string>[],
            ],
          )
        : apis[0]!
    ).describe(
      `Required. The name of the schema. Valid values are: ${apiInfos.keys().toArray().join(', ')}`,
    );

    const getSchemaToolName = `${toolNamePrefix}get-openAPI-schema`;
    mcp.registerTool(
      getSchemaToolName,
      {
        title: 'Get the entire openAPI schema',
        description:
          'Gets the entire openAPI schema. This may be a very large response. Use with caution.',
        annotations: defaultAnnotations,
        inputSchema: z.object({
          schemaName: zodSchemaName,
        }),
      },
      ({ schemaName }) => mcpToolReturn(apiInfos.get(schemaName)!),
    );

    const zodHttpMethods = z.array(
      z.union([
        z.literal('get'),
        z.literal('post'),
        z.literal('put'),
        z.literal('patch'),
        z.literal('delete'),
        z.literal('head'),
        z.literal('options'),
      ]),
    );

    mcp.registerTool(
      `${getSchemaToolName}-paths`,
      {
        title: 'Gets the paths from the openAPI schema',
        description:
          'Gets the paths from the openAPI schema. Optionally filtered by regex and supported http methods.',
        annotations: defaultAnnotations,
        inputSchema: z.object({
          schemaName: zodSchemaName,
          pathRegex: z
            .string()
            .optional()
            .describe(
              'Optional. The regex to filter paths by. Case insensitive.',
            ),
          supportedHTTPMethods: zodHttpMethods
            .optional()
            .describe(
              'Optional. An array of lowercase http methods that a path must support at least one of.',
            ),
        }),
      },
      ({ schemaName, pathRegex, supportedHTTPMethods }) => {
        const schema = apiInfos.get(schemaName)!;

        if (!schema.paths) return mcpToolReturn({});

        const pathRegexConstructed = pathRegex
          ? new RegExp(pathRegex, 'i')
          : undefined;

        const paths = Object.entries(schema.paths).reduce(
          (result, [key, value]) => {
            if ('$ref' in value) {
              value = resolveRef<PathItemObject>(schema, value.$ref, {
                silent: true,
              })!;
            }
            if (
              (!supportedHTTPMethods ||
                supportedHTTPMethods.length === 0 ||
                supportedHTTPMethods.some((x) => !!value[x])) &&
              (!pathRegexConstructed || pathRegexConstructed.test(key))
            ) {
              result[key] = value;
            }
            return result;
          },
          {} as Record<string, PathItemObject>,
        );
        return mcpToolReturn(paths);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-webhooks`,
      {
        title: 'Gets the webhooks from the openAPI schema',
        description:
          'Gets the webhooks from the openAPI schema. Optionally filtered by name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          webhookNameRegex: z
            .string()
            .optional()
            .describe('Webhook regex to filter names. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, webhookNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;

        if (!schema.webhooks) return mcpToolReturn({});

        const webHookNameRegexConstructed = webhookNameRegex
          ? new RegExp(webhookNameRegex, 'i')
          : undefined;
        const filtered = Object.entries(schema.webhooks).reduce(
          (result, [key, value]) => {
            if (
              webHookNameRegexConstructed &&
              !webHookNameRegexConstructed.test(key)
            ) {
              return result;
            }
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, PathItemObject>,
        );
        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-security`,
      {
        title: 'Gets the security schemes from the openAPI schema',
        description:
          'Gets the security schemes and global security requirements from the openAPI schema. Optionally filtered by scheme name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          schemeNameRegex: z
            .string()
            .optional()
            .describe(
              'Security scheme name regex to filter. Case insensitive.',
            ),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, schemeNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;

        const securitySchemes = schema.components?.securitySchemes ?? {};
        const globalSecurity = schema.security ?? [];

        const schemeNameRegexConstructed = schemeNameRegex
          ? new RegExp(schemeNameRegex, 'i')
          : undefined;

        const filteredSchemes = Object.entries(securitySchemes).reduce(
          (result, [key, value]) => {
            if (
              schemeNameRegexConstructed &&
              !schemeNameRegexConstructed.test(key)
            ) {
              return result;
            }
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn({
          securitySchemes: filteredSchemes,
          globalSecurity,
        });
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-tags`,
      {
        title: 'Gets the tags from the openAPI schema',
        description:
          'Gets the tags from the openAPI schema. Optionally filtered by tag name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          tagNameRegex: z
            .string()
            .optional()
            .describe('Tag name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, tagNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;

        const tags = schema.tags ?? [];

        if (!tagNameRegex) return mcpToolReturn(tags);

        const tagNameRegexConstructed = new RegExp(tagNameRegex, 'i');
        const filtered = tags.filter((tag) =>
          tagNameRegexConstructed.test(tag.name),
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-externalDocs`,
      {
        title: 'Gets the external documentation from the openAPI schema',
        description:
          'Gets the external documentation link and description from the openAPI schema.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName }) => {
        const schema = apiInfos.get(schemaName)!;
        return mcpToolReturn(schema.externalDocs ?? null);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-extensions`,
      {
        title: 'Gets the extensions from the openAPI schema',
        description:
          "Gets the extension fields (starting with 'x-') from the openAPI schema. Optionally filtered by extension name regex.",
        inputSchema: z.object({
          schemaName: zodSchemaName,
          extensionNameRegex: z
            .string()
            .optional()
            .describe('Extension name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, extensionNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;

        const extensionNameRegexConstructed = extensionNameRegex
          ? new RegExp(extensionNameRegex, 'i')
          : undefined;

        const extensions = Object.entries(schema).reduce(
          (result, [key, value]) => {
            if (!key.startsWith('x-')) return result;
            if (
              extensionNameRegexConstructed &&
              !extensionNameRegexConstructed.test(key)
            ) {
              return result;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(extensions);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-schemas`,
      {
        title: 'Gets the schemas from the openAPI schema components',
        description:
          'Gets the schemas from the openAPI schema components. Optionally filtered by schema name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          schemaNameRegex: z
            .string()
            .optional()
            .describe('Schema name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, schemaNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const schemas = schema.components?.schemas ?? {};

        if (!schemaNameRegex) return mcpToolReturn(schemas);

        const regexConstructed = new RegExp(schemaNameRegex, 'i');
        const filtered = Object.entries(schemas).reduce(
          (result, [key, value]) => {
            if (!regexConstructed.test(key)) return result;
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-responses`,
      {
        title: 'Gets the responses from the openAPI schema components',
        description:
          'Gets the responses from the openAPI schema components. Optionally filtered by response name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          responseNameRegex: z
            .string()
            .optional()
            .describe('Response name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, responseNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const responses = schema.components?.responses ?? {};

        const regexConstructed = responseNameRegex
          ? new RegExp(responseNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(responses).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-parameters`,
      {
        title: 'Gets the parameters from the openAPI schema components',
        description:
          'Gets the parameters from the openAPI schema components. Optionally filtered by parameter name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          parameterNameRegex: z
            .string()
            .optional()
            .describe('Parameter name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, parameterNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const parameters = schema.components?.parameters ?? {};

        const regexConstructed = parameterNameRegex
          ? new RegExp(parameterNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(parameters).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-examples`,
      {
        title: 'Gets the examples from the openAPI schema components',
        description:
          'Gets the examples from the openAPI schema components. Optionally filtered by example name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          exampleNameRegex: z
            .string()
            .optional()
            .describe('Example name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, exampleNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const examples = schema.components?.examples ?? {};

        const regexConstructed = exampleNameRegex
          ? new RegExp(exampleNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(examples).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-requestBodies`,
      {
        title: 'Gets the request bodies from the openAPI schema components',
        description:
          'Gets the request bodies from the openAPI schema components. Optionally filtered by request body name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          requestBodyNameRegex: z
            .string()
            .optional()
            .describe('Request body name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, requestBodyNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const requestBodies = schema.components?.requestBodies ?? {};

        const regexConstructed = requestBodyNameRegex
          ? new RegExp(requestBodyNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(requestBodies).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-headers`,
      {
        title: 'Gets the headers from the openAPI schema components',
        description:
          'Gets the headers from the openAPI schema components. Optionally filtered by header name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          headerNameRegex: z
            .string()
            .optional()
            .describe('Header name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, headerNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const headers = schema.components?.headers ?? {};

        const regexConstructed = headerNameRegex
          ? new RegExp(headerNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(headers).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-links`,
      {
        title: 'Gets the links from the openAPI schema components',
        description:
          'Gets the links from the openAPI schema components. Optionally filtered by link name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          linkNameRegex: z
            .string()
            .optional()
            .describe('Link name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, linkNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const links = schema.components?.links ?? {};

        const regexConstructed = linkNameRegex
          ? new RegExp(linkNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(links).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-callbacks`,
      {
        title: 'Gets the callbacks from the openAPI schema components',
        description:
          'Gets the callbacks from the openAPI schema components. Optionally filtered by callback name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          callbackNameRegex: z
            .string()
            .optional()
            .describe('Callback name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, callbackNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const callbacks = schema.components?.callbacks ?? {};

        const regexConstructed = callbackNameRegex
          ? new RegExp(callbackNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(callbacks).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value && typeof value.$ref === 'string') {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${getSchemaToolName}-components-pathItems`,
      {
        title: 'Gets the path items from the openAPI schema components',
        description:
          'Gets the path items from the openAPI schema components. Optionally filtered by path item name regex.',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          pathItemNameRegex: z
            .string()
            .optional()
            .describe('Path item name regex to filter. Case insensitive.'),
        }),
        annotations: defaultAnnotations,
      },
      ({ schemaName, pathItemNameRegex }) => {
        const schema = apiInfos.get(schemaName)!;
        const pathItems = schema.components?.pathItems ?? {};

        const regexConstructed = pathItemNameRegex
          ? new RegExp(pathItemNameRegex, 'i')
          : undefined;

        const filtered = Object.entries(pathItems).reduce(
          (result, [key, value]) => {
            if (regexConstructed && !regexConstructed.test(key)) return result;
            if ('$ref' in value) {
              value = resolveRef(schema, value.$ref, { silent: true })!;
            }
            result[key] = value;
            return result;
          },
          {} as Record<string, unknown>,
        );

        return mcpToolReturn(filtered);
      },
    );

    mcp.registerTool(
      `${toolNamePrefix}write-openAPI-schema`,
      {
        title: 'Write the entire openAPI schema to a file path',
        annotations: {
          destructiveHint: true, // with overwrite
          idempotentHint: false,
          openWorldHint: false,
          readOnlyHint: false,
        },
        description:
          'Write the entire openAPI schema to a file path in json format',
        inputSchema: z.object({
          schemaName: zodSchemaName,
          absoluteFilePath: z.string(),
          overwrite: z.boolean().optional().default(false),
        }),
      },
      ({ schemaName, absoluteFilePath, overwrite }) => {
        const schema = apiInfos.get(schemaName)!;

        if (overwrite) {
          rmSync(absoluteFilePath, { force: true });
        }
        const schemaJson = JSON.stringify(schema, null, 2);
        mkdirSync(dirname(absoluteFilePath), { recursive: true });
        writeFileSync(absoluteFilePath, schemaJson, {
          encoding: 'utf-8',
        });
        return { content: [] };
      },
    );
  });
};

const mcpToolReturn = <T>(value: T) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
});
