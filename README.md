<!--
Get your module up and running quickly.

Find and replace all on all files (CMD+SHIFT+F):
- Name: Nuxt OpenAPI wrapper
- Package name: nuxt-openAPI-wrapper
- Description: My new Nuxt module
-->

# Nuxt Typesafe OpenAPI Fetch wrapper

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Generates a typesafe fetch client for Nuxt and Nitro using [Openapi-ts](https://github.com/openapi-ts/openapi-typescript).

<!-- - [✨ &nbsp;Release Notes](/CHANGELOG.md) -->
  <!-- - [🏀 Online playground](https://stackblitz.com/github/your-org/nuxt-openAPI-wrapper?file=playground%2Fapp.vue) -->
  <!-- - [📖 &nbsp;Documentation](https://example.com) -->

## Usage

Install the module:

```bash
npx nuxi module add nuxt-openapi-wrapper
```

Configure the api clients:

```ts
export default defineNuxtConfig({
  modules: ['nuxt-openapi-wrapper'],
  openAPIWrapper: {
    // config options for openAPI-ts
    openApiTsConfig: {},
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        // no explicit openAPI document. Will look for an openapi.{json,yaml} in the ./openapi/github directory
      },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        // explicit openAPI document.
        openApi:
          'https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi.yaml?inline=false',
      },
    },
  },
});
```

For resilient remote documents, configure an ordered source array. Existing single-source `openApi` values remain supported:

```ts
openApi: [
  'https://api.example.com/openapi.yaml',
  'https://backup.example.com/openapi.yaml',
],
```

Sources are tried in order. Next source is used only when loading the document or one of its external `$ref` files fails. YAML parsing, OpenAPI validation, and type-generation errors stop immediately. If every source fails to load, the error lists each attempted source and its cause. Omitting `openApi` keeps existing auto-discovery behavior.

## Caching generated OpenAPI types

Caching is disabled by default. Enable it for all APIs, then override or disable it per API:

```ts
export default defineNuxtConfig({
  openAPIWrapper: {
    openApiTsCache: {
      // Root directory; client-specific subdirectory is added automatically.
      directory: 'node_modules/.cache/nuxt-openAPI-wrapper',
      // Optional extra invalidation token. Bump when custom function behavior changes.
      version: 'team-api-v1',
    },
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        openApiTsCache: {
          version: 2,
          // Suppress warning if openApiTsConfig contains function values.
          suppressFunctionWarning: true,
        },
      },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        openApiTsCache: false,
      },
    },
  },
});
```

Set `openApiTsCache: true` to use defaults. A per-API object inherits module settings and overrides selected fields; per-API `false` disables caching. Relative `directory` values resolve from Nuxt `rootDir`; the API name is appended so each client gets its own latest cache record. Default directory is `node_modules/.cache/nuxt-openAPI-wrapper`.

Cache keys include this library, `openapi-typescript`, TypeScript, and Redocly versions; optional `version`; resolved `openApiTsConfig` values; and root plus transitive `$ref` document identities. Function-valued config entries are omitted from the key. A warning explains this when caching is enabled; bump `version` whenever function behavior changes, or set `suppressFunctionWarning: true` to silence it.

Local and inline documents use content hashes. HTTP documents use response ETags when present, otherwise content hashes. Cache hits skip `openapi-typescript` generation, but source freshness still needs to be checked, so remote documents may still be fetched. When MCP schema exposure is enabled, cache record also stores bundled schema for MCP tools. Cache files can therefore contain generated API declarations and schema data; keep this in mind when overriding `directory` to a git-tracked path. Default path sits under ignored `node_modules`. APIs configured with multiple fallback sources bypass generation caching.

That's it! You can now use Nuxt OpenAPI wrapper in your Nuxt app ✨

```ts
const x = await $fetchGithub('/advisories/{ghsa_id}' /* auto completion! */, {
  pathParams: {
    // support for path parameters!
    ghsa_id: '2', // typesafety!
  },
});

console.log(x.description); // typesafe response type!
```

## Customizing the client

Often you want to customize the client, e.g. so it always adds an authentication header to requests.

Disable auto import for the base client

```ts
export default defineNuxtConfig({
  modules: ['nuxt-openapi-wrapper'],
  openAPIWrapper: {
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        clients: { nuxt: { autoImport: false }}
        ...
```

Add a new ts file to your composables folder, e.g. `./composables/githubClient.ts`.

```ts
// import the base client explicitly
import {
  $fetchGithub as _$fetchGithub,
  useGithubFetch as _useGithubFetch,
  useLazyGithubFetch as _useLazyGithubFetch,
} from '#openapi-wrapper';

// you might need to add // @ts-ignore error
export const $fetchGithub: typeof _$fetchGithub = (path, opts?) => {
  // customize the request
  opts ??= {};

  opts.onRequest = (ctx) =>
    ctx.options.headers.append('Authorization', 'Bearer 1234');

  opts.onResponse = (ctx) => console.log('response!');

  return _$fetchGithub(path, opts);
};

// Do the same for useGithubFetch and useLazyGithubFetch
```

You can also create a custom Nitro fetch client. E.g. by creating a `./server/utils/githubClient.ts` file.

[Nuxt composable example](playground/app/composables/customGithubFetch.ts)

[Nitro utils example](playground/server/utils/customGitlabFetch.ts)

## MCP Integration (AI Agent Support)

This module integrates with [nuxt-mcp-dev](https://github.com/antfu/nuxt-mcp-dev) to expose your OpenAPI schemas as MCP (Model Context Protocol) tools. This allows AI agents like Claude to query your API schemas during development.

### Enabling MCP

MCP tools are automatically enabled when `nuxt-mcp-dev` is installed. You can explicitly control this behavior:

```ts
export default defineNuxtConfig({
  modules: ['nuxt-openapi-wrapper', 'nuxt-mcp-dev'],
  openAPIWrapper: {
    // Enable/disable MCP tools for all APIs (default: true when nuxt-mcp-dev is installed)
    exposeToMcp: true,
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        // Override at the API level
        exposeToMcp: false,
      },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        // This API will use the module-level setting (true)
      },
    },
  },
});
```

### Available MCP Tools

When enabled, the following tools are registered for AI agents to query your OpenAPI schemas. All tools require `schemaName` to select which API schema to query.

| Tool                                                                | Optional Parameters                 | Description                                            |
| ------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| `nuxt-openAPI-wrapper__get-openAPI-schema`                          | -                                   | Gets the entire OpenAPI schema                         |
| `nuxt-openAPI-wrapper__get-openAPI-schema-paths`                    | `pathRegex`, `supportedHTTPMethods` | Gets API paths, filtered by regex and/or HTTP methods  |
| `nuxt-openAPI-wrapper__get-openAPI-schema-webhooks`                 | `webhookNameRegex`                  | Gets webhooks, filtered by name regex                  |
| `nuxt-openAPI-wrapper__get-openAPI-schema-security`                 | `schemeNameRegex`                   | Gets security schemes and global security requirements |
| `nuxt-openAPI-wrapper__get-openAPI-schema-tags`                     | `tagNameRegex`                      | Gets tags, filtered by name regex                      |
| `nuxt-openAPI-wrapper__get-openAPI-schema-externalDocs`             | -                                   | Gets external documentation links                      |
| `nuxt-openAPI-wrapper__get-openAPI-schema-extensions`               | `extensionNameRegex`                | Gets extension fields (x-*)                            |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-schemas`       | `schemaNameRegex`                   | Gets component schemas                                 |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-responses`     | `responseNameRegex`                 | Gets component responses                               |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-parameters`    | `parameterNameRegex`                | Gets component parameters                              |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-examples`      | `exampleNameRegex`                  | Gets component examples                                |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-requestBodies` | `requestBodyNameRegex`              | Gets component request bodies                          |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-headers`       | `headerNameRegex`                   | Gets component headers                                 |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-links`         | `linkNameRegex`                     | Gets component links                                   |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-callbacks`     | `callbackNameRegex`                 | Gets component callbacks                               |
| `nuxt-openAPI-wrapper__get-openAPI-schema-components-pathItems`     | `pathItemNameRegex`                 | Gets component path items                              |
| `nuxt-openAPI-wrapper__write-openAPI-schema`                        | `overwrite`                         | Writes the schema to `absoluteFilePath` (required)     |

All regex parameters are case-insensitive. The `supportedHTTPMethods` parameter accepts an array of lowercase HTTP methods (e.g., `["get", "post"]`).

## Contribution

<details>
  <summary>Local development</summary>

```bash
# Install dependencies
npm install

# Generate type stubs
npm run dev:prepare

# Develop with the playground
npm run dev

# Build the playground
npm run dev:build

# Run ESLint
npm run lint

# Run Vitest
npm run test
npm run test:watch

# Release new version
npm run release
```

</details>

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/nuxt-openapi-wrapper/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-openapi-wrapper
[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-openapi-wrapper.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-openapi-wrapper
[license-src]: https://img.shields.io/npm/l/nuxt-openapi-wrapper.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-openapi-wrapper
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
