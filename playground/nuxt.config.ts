import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: ['../src/module'],
  nuxtOpenApi: {
    apis: {
      github: { baseUrl: 'https://api.github.com' },
    },
  },
  devtools: { enabled: true },
});
