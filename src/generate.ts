import type { Nuxt } from 'nuxt/schema';
import type { ApiConfig, ResolvedConfig } from './config';
import path from 'node:path';
import { globSync } from 'node:fs';
import assert from 'node:assert';
import openapiTS, { astToString } from 'openapi-typescript';
import { addImports, addTemplate } from '@nuxt/kit';
import { pascalCase } from 'es-toolkit';
import { moduleFolderName } from './constants';

type GenerateArgs = {
  moduleConfig: ResolvedConfig;
  nuxt: Nuxt;
};

const openApiTsFileName = 'openapi-ts';

export const generate = async ({ moduleConfig, nuxt }: GenerateArgs) => {
  const apis = Object.entries(moduleConfig.apis);

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

    const clientPath = `${moduleFolderName}/${collectionName}/client.ts`;
    const clientName = `$fetch${pascalCasedName}`;
    const useClientName = `use${pascalCasedName}Fetch`;
    const useLazyClientName = `useLazy${pascalCasedName}Fetch`;

    const { filename } = addTemplate({
      filename: clientPath,
      write: true,
      getContents: () => {
        return `import type { paths as ${pathsTypeName} } from './${openApiTsFileName};
import type { Fetch, UseFetch, UseLazyFetch } from '#nuxt-open-api';
import { useFetch, useLazyFetch } from '#app';

export type ${pathsTypeName};

export const ${clientName} = $fetch as unknown as Fetch<${pathsTypeName}>;

export const ${useClientName} = useFetch as unknown as UseFetch<${pathsTypeName}>;

export const ${useLazyClientName} = useLazyFetch as unknown as UseLazyFetch<${pathsTypeName}>;
`;
      },
    });

    if (apiConfig.autoImport ?? moduleConfig.autoImport)
      addImports([
        {
          name: pathsTypeName,
          from: filename,
          type: true,
        },
        {
          name: clientName,
          from: filename,
        },
        {
          name: useClientName,
          from: filename,
        },
        {
          name: useLazyClientName,
          from: filename,
        },
      ]);
  }
};

type GetOpenApiTsConfigArgs = {
  moduleConfig: ResolvedConfig;
  nuxt: Nuxt;
  collectionName: string;
  apiConfig: ApiConfig<boolean>;
  //redoc: RedocConfig | undefined;
};

const getOpenApiTs = async ({
  apiConfig,
  collectionName,
  moduleConfig,
  nuxt,
}: GetOpenApiTsConfigArgs) => {
  if (!apiConfig.openApi && moduleConfig.autoDiscover === false) {
    throw new Error('apiConfig is required when auto discovery is disabled');
  }

  if (apiConfig.openApi) {
    return await openapiTS(
      apiConfig.openApi,
      moduleConfig.openApiTsConfig ?? apiConfig.openApiTsConfig,
    );
  }

  const optionsFilePath = discoverOpenApiObjectFilePath({
    moduleConfig,
    nuxt,
    collectionName,
  });

  return await openapiTS(
    optionsFilePath,
    moduleConfig.openApiTsConfig ?? apiConfig.openApiTsConfig,
  );
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
    const globFilePath = path.join(
      layer.cwd,
      dirname,
      collectionName,
      openApiFileName,
    );
    const findResult = globSync(globFilePath);
    if (findResult.length === 0) {
      triedPaths.push(globFilePath);
      continue;
    }
    if (findResult.length > 1)
      throw new Error(
        `Ambiguous open api object match: \n${JSON.stringify(findResult)}`,
      );

    return findResult[0];
  }

  throw new Error(
    `no openapi file found for "${collectionName}". Used file paths: ${JSON.stringify(triedPaths)}`,
  );
};
