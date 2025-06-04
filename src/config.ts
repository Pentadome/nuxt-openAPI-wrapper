import defu from 'defu';
import type { OpenAPITSOptions, OpenAPI3 } from 'openapi-typescript';
import type { ModuleOptions } from './module';

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
