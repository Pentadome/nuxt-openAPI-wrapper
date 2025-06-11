<!--
Get your module up and running quickly.

Find and replace all on all files (CMD+SHIFT+F):
- Name: Nuxt OpenAPI wrapper
- Package name: nuxt-openAPI-wrapper
- Description: My new Nuxt module
-->

# Nuxt typesafe OpenAPI wrapper

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Generates a typesafe fetch client for Nuxt using [Openapi-ts](https://github.com/openapi-ts/openapi-typescript).

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
  modules: ['nuxt-openAPI-wrapper'],
  openAPIWrapper: {
    autoImport: true,
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
  modules: ['nuxt-openAPI-wrapper'],
  openAPIWrapper: {
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        autoImport: false
        ...
```

Add a new ts file to your composables folder, e.g. `./composables/githubClient.ts`.

```ts
// import the base client explicitly
import {
  $fetchGithub as _$fetchGithub,
  useGithubFetch as _useGithubFetch,
  useLazyGithubFetch as _useLazyGithubFetch,
} from '#build/openapi-wrapper';

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

[Full example here](playground/composables/customGithubFetch.ts)

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
