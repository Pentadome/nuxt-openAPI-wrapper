import type { Nuxt } from 'nuxt/schema';
import type { ApiConfig, ResolvedConfig } from './config';
import path from 'node:path';
import { globSync } from 'node:fs';
import assert from 'node:assert';
import openapiTS, {
  astToString,
  type OpenAPITSOptions,
} from 'openapi-typescript';
import {
  addImports,
  addServerImports,
  addTemplate,
  createResolver,
} from '@nuxt/kit';
import { kebabCase, pascalCase, toMerged } from 'es-toolkit';

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

  const addedNuxtClientsDirNames = new Set<string>();
  const addedNitroClientsDirNames = new Set<string>();
  for (const [collectionName, apiConfig] of apis) {
    const collectionKebab = kebabCase(collectionName);
    const openApiTsFilePath = `${moduleFolderName}/${collectionKebab}/${openApiTsFileName}.ts`;

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

    const clientName = `$fetch${pascalCasedName}`;
    const useClientName = `use${pascalCasedName}Fetch`;
    const useLazyClientName = `useLazy${pascalCasedName}Fetch`;

    const clientConfig = resolveClientConfig(
      moduleConfig.clients,
      apiConfig.clients,
    );

    if (clientConfig.nuxt !== false) {
      const nuxtClientPath = `${moduleFolderName}/${collectionKebab}/index.ts`;
      const { dst } = addTemplate({
        filename: nuxtClientPath,
        write: true,
        getContents: () => {
          return `import type { paths as ${pathsTypeName} } from './${openApiTsFileName}';
import type { Fetch, UseFetch, UseLazyFetch, SimplifiedFetchOptions, SimplifiedUseFetchOptions } from '${resolver.resolve('./runtime/fetchTypes')}';
import { useFetch } from 'nuxt/app';
import { handleFetchPathParams, handleUseFetchPathParams } from '${resolver.resolve('./runtime/handlePathParams')}'
import type { Ref } from 'vue'

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

      addedNuxtClientsDirNames.add(collectionKebab);

      if (clientConfig.nuxt.autoImport)
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

    if (clientConfig.nitro !== false) {
      const nitroClientPath = `${moduleFolderName}/${collectionKebab}/nitro`;

      const { dst } = addTemplate({
        filename: `${nitroClientPath}.ts`,
        getContents:
          () => `import type { paths as ${pathsTypeName} } from './${openApiTsFileName}'
import { handleFetchPathParams } from '${resolver.resolve('./runtime/server')}'
import type { NitroFetch, SimplifiedNitroFetchOptions  } from '${resolver.resolve('./runtime/server')}'

export type { paths as ${pathsTypeName}, components as ${componentsTypeName} } from './${openApiTsFileName}'

${tsIgnoreError}
export const ${clientName}: NitroFetch<${pathsTypeName}> = (path, opts) => {
  const options = (opts ?? {}) as SimplifiedNitroFetchOptions
  options.baseURL ??= "${apiConfig.baseUrl}"

  let finalPath = path as string;
  if (options.pathParams) {
      finalPath = handleFetchPathParams(path, options.pathParams)
  }

  const { pathParams, ...rest } = options;
  
  ${tsIgnoreError}
  return $fetch(finalPath, rest)
};`,
        write: true,
      });

      addedNitroClientsDirNames.add(collectionKebab);

      if (clientConfig.nitro.autoImport) {
        addServerImports([
          {
            name: pathsTypeName,
            from: dst,
            type: true,
          },
          {
            name: clientName,
            from: dst,
          },
        ]);
      }
    }
  }

  if (addedNuxtClientsDirNames.size > 0) {
    addTemplate({
      filename: `${moduleFolderName}/index.ts`,
      getContents: () => {
        const result = addedNuxtClientsDirNames
          .values()
          .map((x) => `export * from "./${x}";`)
          .toArray();

        result.unshift(
          `export type * from "${resolver.resolve('./runtime/fetchTypes')}";\nexport * from "${resolver.resolve('./runtime/fetchUtils')}"`,
        );

        return result.join('\n');
      },
      write: true,
    });

    nuxt.options.alias ??= {};
    nuxt.options.alias[`#${moduleFolderName}`] = path.join(
      nuxt.options.buildDir,
      moduleFolderName,
    );
  }

  if (addedNitroClientsDirNames.size > 0) {
    addTemplate({
      filename: `${moduleFolderName}/nitro.ts`,
      getContents: () => {
        const result = addedNitroClientsDirNames
          .values()
          .map((x) => `export * from "./${x}/nitro";`)
          .toArray();

        result.unshift(
          `export * from "${resolver.resolve('./runtime/server')}"`,
        );

        return result.join('\n');
      },
      write: true,
    });

    nuxt.hook('nitro:config', (nitro) => {
      nitro.alias ??= {};
      nitro.alias[`#${moduleFolderName}`] = path.join(
        nuxt.options.buildDir,
        moduleFolderName,
        'nitro',
      );

      for (const client of addedNitroClientsDirNames) {
        nitro.alias[`#${moduleFolderName}/${client}`] = path.join(
          nuxt.options.buildDir,
          moduleFolderName,
          client,
          'nitro',
        );
      }
    });
  }
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
    ? {
        ...toMerged(moduleConfig.openApiTsConfig, apiConfig.openApiTsConfig),
        ...staticOpenApiTsConfig,
      }
    : { ...moduleConfig.openApiTsConfig, ...staticOpenApiTsConfig };

  if (apiConfig.openApi) {
    return await openapiTS(apiConfig.openApi, openApiTsConfig);
  }

  const openAPIFilePath = discoverOpenApiObjectFilePath({
    moduleConfig,
    nuxt,
    collectionName,
  });
  return await openapiTS(new URL(`file://${openAPIFilePath}`), openApiTsConfig);
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

const resolveClientConfig = (
  moduleConfig: ResolvedConfig['clients'],
  apiConfig: ApiConfig['clients'],
) => {
  if (apiConfig) {
    return toMerged(moduleConfig, apiConfig);
  }
  return moduleConfig;
};
