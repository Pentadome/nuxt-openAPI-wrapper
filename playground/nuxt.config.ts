import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: ['../src/module'],
  nuxtOpenApi: {
    autoImport: true,
    openApiTsConfig: {},
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        autoImport: false,
      },
    },
  },
  devtools: { enabled: true },
});
