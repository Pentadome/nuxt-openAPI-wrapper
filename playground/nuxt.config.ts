import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-22',
  modules: ['../src/module', 'nuxt-mcp-dev'],
  openAPIWrapper: {
    apis: {
      github: {
        baseUrl: 'https://api.github.com',
        clients: { nuxt: { autoImport: false }, nitro: { autoImport: true } },
      },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        openApi:
          'https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi_v3.yaml',
        clients: { nitro: { autoImport: false } },
      },
    },
  },
  devtools: { enabled: true },
  mcp: {},
});
