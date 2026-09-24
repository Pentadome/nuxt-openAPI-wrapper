import MyModule from '../../../src/module';

export default defineNuxtConfig({
  modules: [MyModule],
  openAPIWrapper: {
    apis: {
      discovered: {
        baseUrl: 'https://example.com',
      },
      explicit: {
        baseUrl: 'https://example.com',
        openApi: new URL('./openapi-fallback/openapi.yaml', import.meta.url),
      },
      fallback: {
        baseUrl: 'https://example.com',
        openApi: [
          new URL('./openapi-fallback/missing.yaml', import.meta.url),
          new URL('./openapi-fallback/openapi.yaml', import.meta.url),
        ],
      },
    },
  },
});
