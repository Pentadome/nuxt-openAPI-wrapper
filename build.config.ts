import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/module'],
  externals: [
    './node_modules/nuxt/dist/app',
    'ofetch',
    'nuxt/app/defaults',
    'nitropack/types',
    './node_modules/nuxt/dist/app/composables/asyncData',
    'vue',
    'nuxt/schema',
    'node:path',
    'node:fs',
    'openapi-typescript',
    '@nuxt/kit',
    'es-toolkit',
  ],
});
