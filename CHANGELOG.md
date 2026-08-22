# Changelog

## v3.1.1

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v3.1.0...v3.1.1)

### 💅 Refactors

- Update API endpoints and improve type handling in fetch functions ([b71777c](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/b71777c))

### 🏡 Chore

- Updated dependencies ([49a48dc](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/49a48dc))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v3.1.0-rc.1

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v3.0.5...v3.1.0-rc.1)

### 🚀 Enhancements

- Alpha release mcp tool support ([f63d02e](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/f63d02e))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v3.0.5

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v3.0.2...v3.0.5)

### 🩹 Fixes

- "module augmentation" instead of "ambient module declaration" in nitro.d.ts file ([4e35051](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/4e35051))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v3.0.2

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v3.0.1...v3.0.2)

### 🩹 Fixes

- Possible conflict with import ids of nuxt and nitro clients ([6e7643e](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/6e7643e))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v3.0.1

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v3.0.0...v3.0.1)

### 🩹 Fixes

- Change default type for UseFetch<DefaultT> to undefined ([cf31ec7](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/cf31ec7))
- Link in readme.md ([55afec8](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/55afec8))

### 💅 Refactors

- Remove commented-out useFetch function for clarity ([ee97b0f](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/ee97b0f))

### 🏡 Chore

- **release:** V3.0.0 ([bd1f304](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/bd1f304))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v3.0.0

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v2.0.4...v3.0.0)

### 🏡 Chore

- **release:** V2.0.4 ([98744ec](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/98744ec))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v2.0.4

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v2.0.3...v2.0.4)

### 🩹 Fixes

- Allow setting query and header when they are defined as undefined ([f0eb55d](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/f0eb55d))

### 🏡 Chore

- **release:** V2.0.3 ([b6497c6](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/b6497c6))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v2.0.3

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v2.0.2...v2.0.3)

### 🩹 Fixes

- Mistake in HasRequiredProperties type ([1e5be5a](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/1e5be5a))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v2.0.2

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v2.0.1...v2.0.2)

### 🩹 Fixes

- Missing autocomplete for query params when all query params are optional ([c12959f](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/c12959f))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v2.0.1

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v2.0.0...v2.0.1)

### 🩹 Fixes

- Sometimes not working in docker. chore: removed useless code ([37510a9](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/37510a9))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v2.0.0

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.1.1...v2.0.0)

### Breaking changes

#### Removed `autoImport` property from module and api config.

Use `clients: { nuxt: { autoImport: false }}` to disable auto imports instead.

#### The openAPITS config of the api config now gets merged with the module config.

Example:

```ts
openAPIWrapper: {
    openApiTsConfig: { immutable: true },
    apis: {
      github: {
        openApiTsConfig: { additionalProperties: true }
    },
  },
```

#### Before 2.0.0

effective config: `{ additionalProperties: true }`

#### After 2.0.0

effective config: `{ immutable: true, additionalProperties: true }`

### 🚀 Enhancements

- Nitro support ([0e63ce2](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/0e63ce2))

### 🩹 Fixes

- Minor mistake in readme.md ([dcaf1d8](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/dcaf1d8))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.1.1

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.1.0...v1.1.1)

### 🩹 Fixes

- Sometimes type error while using refs with queries ([de6b7d2](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/de6b7d2))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.1.0

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.16...v1.1.0)

### 🚀 Enhancements

- Add typesafe error response ([2114d7b](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/2114d7b))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.16

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.15...v1.0.16)

### 🩹 Fixes

- Uppercase method not working in useFetch functions ([c026090](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/c026090))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.15

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.14...v1.0.15)

### 🩹 Fixes

- Wrong overload resolution ([4a7b6cc](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/4a7b6cc))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.14

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.13...v1.0.14)

### 🩹 Fixes

- Logic error in ensureArray ([8eb553a](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/8eb553a))
- Result type sometimes incorrrectly an union of types ([fb69d6f](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/fb69d6f))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.13

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.12...v1.0.13)

### 🩹 Fixes

- Minor mistake in readme.me ([0b22f01](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/0b22f01))
- Lazy fetch not being lazy ([af4b383](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/af4b383))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.12

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.11...v1.0.12)

### 🩹 Fixes

- Undo unnecessary change ([8c9a2eb](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/8c9a2eb))
- Type error caused by missing nuxt type ([03ce764](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/03ce764))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.11

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.10...v1.0.11)

### 🩹 Fixes

- Return type any sometimes well using 'use...Fetch' functions. feat: expose ensureArray and ensureArrayComputed util functions ([cfdd120](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/cfdd120))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.10

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.9...v1.0.10)

### 🏡 Chore

- Minor update to readme ([13194f3](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/13194f3))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.9

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.8...v1.0.9)

## v1.0.8

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.7...v1.0.8)

### 🩹 Fixes

- Return type for non-get api not working ([4ae16ee](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/4ae16ee))

### 🏡 Chore

- **release:** V1.0.7 ([e9bb5ae](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/e9bb5ae))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.7

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.6...v1.0.7)

### 🩹 Fixes

- Broken links in readme.md ([730eb0a](https://github.com/Pentadome/nuxt-openAPI-wrapper/commit/730eb0a))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.6

[compare changes](https://github.com/Pentadome/nuxt-openAPI-wrapper/compare/v1.0.5...v1.0.6)

## v1.0.5

[compare changes](https://github.com/Pentadome/nuxt-open-api/compare/v1.0.4...v1.0.5)

## v1.0.4

[compare changes](https://github.com/Pentadome/nuxt-open-api/compare/v1.0.3...v1.0.4)

## v1.0.3

[compare changes](https://github.com/Pentadome/nuxt-open-api/compare/v1.0.2...v1.0.3)

### 🩹 Fixes

- Type missing in release ([f6df35e](https://github.com/Pentadome/nuxt-open-api/commit/f6df35e))

### 🏡 Chore

- **release:** V1.0.2 ([8bb3610](https://github.com/Pentadome/nuxt-open-api/commit/8bb3610))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.2

[compare changes](https://github.com/Pentadome/nuxt-open-api/compare/v1.0.1...v1.0.2)

### 🩹 Fixes

- Update module description and repository information ([df4aeb3](https://github.com/Pentadome/nuxt-open-api/commit/df4aeb3))

### ❤️ Contributors

- Pentadome ([@Pentadome](https://github.com/Pentadome))

## v1.0.1
