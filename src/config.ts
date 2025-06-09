import defu from 'defu';
import type { OpenAPITSOptions } from 'openapi-typescript';
import type openapiTS from 'openapi-typescript';

export type AutoDiscoverConfig = {
  /**
   * The name of the directory to look for openapi documents
   *  @default 'openapi' */
  dirname?: string;
  /**
   * The file name glob pattern of the openapi documents.
   * @see AutoDiscoverConfig#dirname
   * @default 'openapi.{json,yaml}' */
  openApiFileName?: string;
};

// Module options TypeScript interface definition
export type ModuleOptions = GlobalOrSpecificOptions & {
  /**
   * Enable/disable the auto import of clients
   * @default true */
  autoImport?: boolean;
} & (
    | {
        /**
         * Either the {@link AutoDiscoverConfig} to use for autodiscovering openapi documents -- or -- `false` to disable auto discovery completely.
         * @default
         * {
         *   dirname: 'openapi',
         *   openApiFileName: 'openapi.{json,yaml}',
         * }
         */
        autoDiscover?: AutoDiscoverConfig;
        /**
         * The api clients to generate api clients for.
         * @example
         * apis: {
         *  github: {
         *    baseUrl: 'https://api.github.com',
         *    autoImport: false,
         *   },
         * }
         */
        apis: {
          [key: string]: ApiConfig<false>;
        };
      }
    | {
        /**
         * Either the {@link AutoDiscoverConfig} to use for autodiscovering openapi documents -- or -- `false` to disable auto discovery completely.
         * @default
         * {
         *   dirname: 'openapi',
         *   openApiFileName: 'openapi.{json,yaml}',
         * }
         */
        autoDiscover: false;
        /**
         * The api clients to generate api clients for.
         * @example
         * apis: {
         *  github: {
         *    baseUrl: 'https://api.github.com',
         *    autoImport: false,
         *   },
         * }
         */
        apis: {
          [key: string]: ApiConfig<true>;
        };
      }
  );

export type GlobalOrSpecificOptions = {
  /**
   * The [openapi-ts config]{@link https://openapi-ts.dev/cli#flags} to pass to the generator
   * @default { generatePathParams: true, pathParamsAsTypes: false, alphabetize: true, } */
  openApiTsConfig?: OpenAPITSOptions & {
    /** this value can not be set to `false`. */
    generatePathParams?: true;
    /** this value can not be set to `true`. */
    pathParamsAsTypes?: false;
  };
};

type OpenApiDocument = Parameters<typeof openapiTS>[0];

export type ApiConfig<RequireOpenApiObject extends boolean = false> =
  GlobalOrSpecificOptions & {
    /** The base url for the api client to use. */
    baseUrl: string;
    /**
     * undefined = use global option
     * @default undefined */
    autoImport?: boolean;
  } & (true extends RequireOpenApiObject
      ? {
          /** The explicitly provided openapi document to use.
           * Required when auto discovery is disabled.
           */
          openApi: OpenApiDocument;
        }
      : {
          /** The explicitly provided openapi document to use.
           * Required when auto discovery is disabled.
           */
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
