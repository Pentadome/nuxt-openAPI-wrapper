import type { Nuxt } from 'nuxt/schema';
import type { ApiConfig, ResolvedConfig } from './config';
import path from 'node:path';
import { globSync } from 'node:fs';
import assert from 'node:assert';
import openapiTS, {
  astToString,
  type OpenAPITSOptions,
} from 'openapi-typescript';
import { addImports, addTemplate, createResolver } from '@nuxt/kit';
import { pascalCase } from 'es-toolkit';

type GenerateArgs = {
  moduleConfig: ResolvedConfig;
  nuxt: Nuxt;
};

const moduleFolderName = 'openapi-wrapper';

// prevent ide errors when using ts-expect-error is string template.
const tsIgnoreError = '//' + ' @ts-ignore-error';

const openApiTsFileName = 'openapi-ts';

export const generate = async ({ moduleConfig, nuxt }: GenerateArgs) => {
  const apis = Object.entries(moduleConfig.apis);
  const resolver = createResolver(import.meta.url);

  const addedFiles = new Set<string>();
  for (const [collectionName, apiConfig] of apis) {
    const openApiTsFilePath = `${moduleFolderName}/${collectionName}/${openApiTsFileName}.ts`;

    addTemplate({
      filename: openApiTsFilePath,
      getContents: async () => {
        const openApiTs = await getOpenApiTs({
          apiConfig,
          collectionName,
          moduleConfig,
          nuxt,
        });

        return astToString(openApiTs);
      },
      write: true,
    });

    const pascalCasedName = pascalCase(collectionName);
    const pathsTypeName = `${pascalCasedName}Paths`;
    const componentsTypeName = `${pascalCasedName}Components`;

    const clientPath = `${moduleFolderName}/${collectionName}/index.ts`;
    const clientName = `$fetch${pascalCasedName}`;
    const useClientName = `use${pascalCasedName}Fetch`;
    const useLazyClientName = `useLazy${pascalCasedName}Fetch`;

    const { dst } = addTemplate({
      filename: clientPath,
      write: true,
      getContents: () => {
        return `import type { paths as ${pathsTypeName} } from './${openApiTsFileName}';
import type { Fetch, UseFetch, UseLazyFetch, SimplifiedFetchOptions, SimplifiedUseFetchOptions } from '${resolver.resolve('./runtime/fetchTypes')}';
import { useFetch } from 'nuxt/app';
import { handleFetchPathParams, handleUseFetchPathParams } from '${resolver.resolve('./runtime/handlePathParams')}'

export type { paths as ${pathsTypeName}, components as ${componentsTypeName} } from './${openApiTsFileName}'

${tsIgnoreError} 
export const ${clientName}: Fetch<${pathsTypeName}> = (path, opts?) => {
  const options = (opts ?? {}) as SimplifiedFetchOptions
  options.baseURL ??= "${apiConfig.baseUrl}"

  let finalPath = path as string
  if (options.pathParams) {
      finalPath = handleFetchPathParams(path, options.pathParams)
  }

  const { pathParams, ...rest } = options;
  
  ${tsIgnoreError} 
  return $fetch(finalPath, rest)
};

${tsIgnoreError} 
export const ${useClientName}: UseFetch<${pathsTypeName}> =  (path, opts?) => {
  const options = (opts ?? {}) as SimplifiedUseFetchOptions;
  options.baseURL ??= "${apiConfig.baseUrl}"

  let finalPath = path as string | Ref<string> | (() => string)
  if (options.pathParams) {
      finalPath = handleUseFetchPathParams(path, options.pathParams)
  }

  const { pathParams, ...rest } = options;
  
  ${tsIgnoreError} 
  return useFetch(finalPath, rest)
};

${tsIgnoreError}
export const ${useLazyClientName}: UseLazyFetch<${pathsTypeName}> = (path, opts?) => {
  const options = (opts ?? {}) as SimplifiedUseFetchOptions;

  options.lazy = true;

  ${tsIgnoreError}
  return ${useClientName}(path, options);
}
`;
      },
    });

    addedFiles.add(dst);

    if (apiConfig.autoImport ?? moduleConfig.autoImport)
      addImports([
        {
          name: pathsTypeName,
          from: dst,
          type: true,
        },
        {
          name: clientName,
          from: dst,
        },
        {
          name: useClientName,
          from: dst,
        },
        {
          name: useLazyClientName,
          from: dst,
        },
      ]);
  }

  addTemplate({
    filename: `${moduleFolderName}/index.ts`,
    getContents: () => {
      const result = addedFiles
        .values()
        .map((x) => {
          // get rid of '.ts' extension
          const exportFrom = path.join(path.dirname(x), path.parse(x).name);
          return `export * from "${resolver.resolve(exportFrom)}";`;
        })
        .toArray();

      result.unshift(
        `export type * from "${resolver.resolve('./runtime/fetchTypes')}";\nexport * from "${resolver.resolve('./runtime/fetchUtils')}"`,
      );

      return result.join('\n');
    },
    write: true,
  });
};

type GetOpenApiTsConfigArgs = {
  moduleConfig: ResolvedConfig;
  nuxt: Nuxt;
  collectionName: string;
  apiConfig: ApiConfig<false> | ApiConfig<true>;
  //redoc: RedocConfig | undefined;
};

const staticOpenApiTsConfig = {
  generatePathParams: true,
  pathParamsAsTypes: false,
} as const satisfies OpenAPITSOptions;

const getOpenApiTs = async ({
  apiConfig,
  collectionName,
  moduleConfig,
  nuxt,
}: GetOpenApiTsConfigArgs) => {
  if (!apiConfig.openApi && moduleConfig.autoDiscover === false) {
    throw new Error(
      "The api config property 'openApi' is required when auto discovery is disabled",
    );
  }

  const openApiTsConfig = apiConfig.openApiTsConfig
    ? { ...apiConfig.openApiTsConfig, ...staticOpenApiTsConfig }
    : { ...moduleConfig.openApiTsConfig, ...staticOpenApiTsConfig };

  if (apiConfig.openApi) {
    return await openapiTS(apiConfig.openApi, openApiTsConfig);
  }

  const optionsFilePath = discoverOpenApiObjectFilePath({
    moduleConfig,
    nuxt,
    collectionName,
  });

  return await openapiTS(new URL(optionsFilePath), openApiTsConfig);
};

type DiscoverOpenApiObjectFilePathArgs = {
  moduleConfig: ResolvedConfig;
  nuxt: Nuxt;
  collectionName: string;
};

const discoverOpenApiObjectFilePath = ({
  moduleConfig,
  nuxt,
  collectionName,
}: DiscoverOpenApiObjectFilePathArgs) => {
  assert(moduleConfig.autoDiscover !== false);

  const { dirname, openApiFileName } = moduleConfig.autoDiscover;

  const triedPaths = [] as string[];
  for (const layer of nuxt.options._layers) {
    const globCwdPath = path.join(layer.cwd, dirname, collectionName);
    const findResult = globSync(openApiFileName, {
      cwd: globCwdPath,
    });
    if (findResult.length === 0) {
      triedPaths.push(path.join(globCwdPath, openApiFileName));
      continue;
    }
    if (findResult.length > 1)
      throw new Error(
        `Ambiguous open api object match: \n${JSON.stringify(findResult.map((x) => path.join(globCwdPath, x)))}`,
      );

    return path.join(globCwdPath, findResult[0]);
  }

  throw new Error(
    `no openapi file found for "${collectionName}". Used file paths: ${JSON.stringify(triedPaths)}`,
  );
};
