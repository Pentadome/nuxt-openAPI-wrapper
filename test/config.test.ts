import { describe, expect, it } from 'vitest';
import { applyConfig, defaultConfig, type ModuleOptions } from '../src/config';

describe('applyConfig', () => {
  it('fills every default when nothing is configured', () => {
    expect(applyConfig({} as ModuleOptions)).toEqual({
      autoDiscover: {
        dirname: 'openapi',
        openApiFileName: 'openapi.{json,yaml}',
      },
      exposeToMcp: true,
      openApiTsCache: false,
      clients: { nitro: { autoImport: true }, nuxt: { autoImport: true } },
      apis: {},
      openApiTsConfig: {
        generatePathParams: true,
        pathParamsAsTypes: false,
        alphabetize: true,
      },
    });
  });

  it('keeps api configs as provided', () => {
    const github = {
      baseUrl: 'https://api.github.com',
      exposeToMcp: false,
      clients: { nuxt: false as const },
    };

    expect(applyConfig({ apis: { github } }).apis).toEqual({ github });
  });

  it('lets explicit `false` values win over defaults', () => {
    const resolved = applyConfig({
      autoDiscover: false,
      exposeToMcp: false,
      clients: { nuxt: false },
      apis: {},
    });

    expect(resolved.autoDiscover).toBe(false);
    expect(resolved.exposeToMcp).toBe(false);
    expect(resolved.clients).toEqual({
      nuxt: false,
      nitro: { autoImport: true },
    });
  });

  it('deep-merges partial objects with defaults', () => {
    const resolved = applyConfig({
      autoDiscover: { dirname: 'specs' },
      clients: { nitro: { autoImport: false } },
      openApiTsConfig: { alphabetize: false, enum: true },
      openApiTsCache: { version: 3 },
      apis: {},
    });

    expect(resolved.autoDiscover).toEqual({
      dirname: 'specs',
      openApiFileName: 'openapi.{json,yaml}',
    });
    expect(resolved.clients).toEqual({
      nitro: { autoImport: false },
      nuxt: { autoImport: true },
    });
    expect(resolved.openApiTsConfig).toEqual({
      alphabetize: false,
      enum: true,
      generatePathParams: true,
      pathParamsAsTypes: false,
    });
    expect(resolved.openApiTsCache).toEqual({ version: 3 });
  });

  it('does not mutate the input or the shared defaults', () => {
    const input: ModuleOptions = {
      autoDiscover: { dirname: 'specs' },
      apis: { a: { baseUrl: 'https://a.test' } },
    };
    const inputSnapshot = structuredClone(input);
    const defaultsSnapshot = structuredClone(defaultConfig);

    applyConfig(input);

    expect(input).toEqual(inputSnapshot);
    expect(defaultConfig).toEqual(defaultsSnapshot);
  });

  it('rejects an empty `openApi` source array, naming the api', () => {
    expect(() =>
      applyConfig({
        apis: {
          empty: { baseUrl: 'https://example.com', openApi: [] as never },
        },
      }),
    ).toThrow(
      `The api config property 'openApi' for "empty" must contain at least one source`,
    );
  });

  it('accepts single and multiple `openApi` sources', () => {
    expect(() =>
      applyConfig({
        apis: {
          single: {
            baseUrl: 'https://a.test',
            openApi: 'https://a.test/openapi.yaml',
          },
          multiple: {
            baseUrl: 'https://b.test',
            openApi: ['https://b.test/1.yaml', 'https://b.test/2.yaml'],
          },
        },
      }),
    ).not.toThrow();
  });
});
