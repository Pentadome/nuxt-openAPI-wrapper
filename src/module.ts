import { defineNuxtModule } from '@nuxt/kit';
import { applyConfig, type ModuleOptions } from './config';
import { generate } from './generate';

// public facing types need to be exported from this file
export type { ModuleOptions } from './config';
export type {
  ComputedUntypedFetchOptions,
  Fetch,
  FetchOptions,
  SimplifiedFetchOptions,
  SimplifiedUseFetchOptions,
  UntypedFetchOptions,
  UseFetch,
  UseLazyFetch,
} from './fetchTypes';

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-open-api',
    configKey: 'nuxtOpenApi',
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  async setup(options, nuxt) {
    //const resolver = createResolver(import.meta.url);

    const resolvedConfig = applyConfig(options);

    generate({ moduleConfig: resolvedConfig, nuxt });

    // // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
    // addPlugin(resolver.resolve('./runtime/plugin'));
  },
});
