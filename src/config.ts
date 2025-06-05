import defu from 'defu';
import type { OpenAPITSOptions, OpenAPI3 } from 'openapi-typescript';
import type { OmitStrict } from './typeUtils';

export type AutoDiscoverConfig = {
  /** @default 'openapi' */
  dirname?: string;
  /** @default 'openapi.{json,yaml}' */
  openApiFileName?: string;
};

// Module options TypeScript interface definition
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

export type GlobalOrSpecificOptions = {
  /** @default { generatePathParams: true } */
  openApiTsConfig?: OmitStrict<OpenAPITSOptions, 'pathParamsAsTypes'>;
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

export const defaultConfig = {
  autoDiscover: {
    dirname: 'openapi',
    openApiFileName: 'openapi.{json,yaml}',
  },
  apis: {},
  openApiTsConfig: { generatePathParams: true },
  autoImport: true,
} as const satisfies ModuleOptions<AutoDiscoverConfig, false>;

export const applyConfig = (
  config: ModuleOptions<false | AutoDiscoverConfig>,
) => {
  return defu(config, defaultConfig);
};

export type ResolvedConfig = ReturnType<typeof applyConfig>;
