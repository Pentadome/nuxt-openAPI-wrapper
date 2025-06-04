import { defineNuxtModule } from '@nuxt/kit';

import { generate } from './generate';
import type { OpenAPI3, OpenAPITSOptions } from 'openapi-typescript';
import defu from 'defu';

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

export interface ModuleOptions<
  AutoDiscover extends false | AutoDiscoverConfig = AutoDiscoverConfig,
  RequireOpenApiObject extends AutoDiscover extends false
    ? true
    : false = AutoDiscover extends false ? true : false,
> extends GlobalOrSpecificOptions {
  autoDiscover?: AutoDiscover;
  apis: {
    [key: string]: ApiConfig<RequireOpenApiObject>;
  };
  /** @default true */
  autoImport?: boolean;
}

export type AutoDiscoverConfig = {
  /** @default 'openapi' */
  dirname?: string;
  /** @default 'openapi.{json|yaml}' */
  openApiFileName?: string;
};

// Module options TypeScript interface definition

export type GlobalOrSpecificOptions = {
  /** @default { pathParamsAsTypes: true } */
  openApiTsConfig?: OpenAPITSOptions;
};

export type ApiConfig<RequireOpenApiObject extends boolean = false> =
  GlobalOrSpecificOptions & {
    baseUrl: string;
    /**
     * undefined = use global option
     * @default undefined */
    autoImport?: boolean;
  } & (RequireOpenApiObject extends true
      ? {
          openApi: OpenAPI3 | string;
        }
      : {
          openApi?: OpenAPI3 | string;
        });

const defaultConfig = {
  autoDiscover: {
    dirname: 'openapi',
    openApiFileName: 'openapi.{json|yaml}',
  },
  apis: {},
  openApiTsConfig: { pathParamsAsTypes: true },
  autoImport: true,
} as const satisfies ModuleOptions<AutoDiscoverConfig, false>;

export const applyConfig = (
  config: ModuleOptions<false | AutoDiscoverConfig>,
) => {
  return defu(config, defaultConfig);
};

export type ResolvedConfig = ReturnType<typeof applyConfig>;
