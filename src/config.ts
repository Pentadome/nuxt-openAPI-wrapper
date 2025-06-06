import defu from 'defu';
import type { OpenAPITSOptions } from 'openapi-typescript';
import type openapiTS from 'openapi-typescript';

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
  /** @default { generatePathParams: true, pathParamsAsTypes: false, alphabetize: true, } */
  openApiTsConfig?: OpenAPITSOptions & {
    generatePathParams?: true;
    pathParamsAsTypes?: false;
  };
};

type OpenApiDocument = Parameters<typeof openapiTS>[0];

export type ApiConfig<RequireOpenApiObject extends boolean = false> =
  GlobalOrSpecificOptions & {
    baseUrl: string;
    /**
     * undefined = use global option
     * @default undefined */
    autoImport?: boolean;
  } & (true extends RequireOpenApiObject
      ? {
          openApi: OpenApiDocument;
        }
      : {
          openApi?: OpenApiDocument;
        });

export const defaultConfig = {
  autoDiscover: {
    dirname: 'openapi',
    openApiFileName: 'openapi.{json,yaml}',
  },
  apis: {},
  openApiTsConfig: {
    generatePathParams: true,
    pathParamsAsTypes: false,
    alphabetize: true,
  },
  autoImport: true,
} as const satisfies ModuleOptions;

export const applyConfig = (config: ModuleOptions) => {
  return defu(config, defaultConfig);
};

export type ResolvedConfig = ReturnType<typeof applyConfig>;
