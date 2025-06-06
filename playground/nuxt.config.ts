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
      gitlab: {
        baseUrl: 'https://gitlab.com',
        openApi:
          'https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi.yaml?inline=false',
      },
    },
  },
  devtools: { enabled: true },
});
