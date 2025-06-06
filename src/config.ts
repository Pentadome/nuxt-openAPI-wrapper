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
export type ModuleOptions = GlobalOrSpecificOptions & {
  /** @default true */
  autoImport?: boolean;
} & (
    | {
        autoDiscover?: AutoDiscoverConfig;
        apis: {
          [key: string]: ApiConfig<false>;
        };
      }
    | {
        autoDiscover: false;
        apis: {
          [key: string]: ApiConfig<true>;
        };
      }
  );

export type GlobalOrSpecificOptions = {
  /** @default { generatePathParams: true } */
  openApiTsConfig?: OmitStrict<
    OpenAPITSOptions,
    'pathParamsAsTypes' | 'generatePathParams'
  >;
};

export type ApiConfig<RequireOpenApiObject extends boolean = false> =
  GlobalOrSpecificOptions & {
    baseUrl: string;
    /**
     * undefined = use global option
     * @default undefined */
    autoImport?: boolean;
  } & (true extends RequireOpenApiObject
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
} as const satisfies ModuleOptions & {
  openApiTsConfig: { generatePathParams: boolean };
};

export const applyConfig = (config: ModuleOptions) => {
  return defu(config, defaultConfig);
};

export type ResolvedConfig = ReturnType<typeof applyConfig>;
