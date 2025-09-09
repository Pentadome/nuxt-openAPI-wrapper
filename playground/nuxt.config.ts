import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: ['../src/module'],
  openAPIWrapper: {
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        clients: { nuxt: { autoImport: true }, nitro: { autoImport: true } },
      },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        openApi:
          'https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi.yaml?inline=false',
        clients: { nitro: { autoImport: false } },
      },
    },
  },
  devtools: { enabled: true },
});
