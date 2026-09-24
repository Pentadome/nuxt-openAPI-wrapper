import path from 'node:path';
import { describe, expect, it } from 'vitest';
import OpenApiWrapperModule from '../src/module';
import { installModule, useNuxtFixture } from './helpers/load-nuxt';
import { specUrl } from './helpers/specs';

const loadFixture = useNuxtFixture();

const petstore = {
  baseUrl: 'https://petstore.test',
  openApi: specUrl('petstore.yaml'),
};

const templateNames = (nuxt: Awaited<ReturnType<typeof loadFixture>>) =>
  nuxt.options.build.templates.map((x) => x.filename);

describe('module', () => {
  it('exposes its meta', async () => {
    await expect(OpenApiWrapperModule.getMeta?.()).resolves.toMatchObject({
      name: 'nuxt-openAPI-wrapper',
      configKey: 'openAPIWrapper',
    });
  });

  it('reads its options from the `openAPIWrapper` config key', async () => {
    const nuxt = await loadFixture({ openAPIWrapper: { apis: { petstore } } });

    await installModule(OpenApiWrapperModule, nuxt);

    expect(templateNames(nuxt)).toEqual(
      expect.arrayContaining([
        'openapi-wrapper/petstore/index.ts',
        'openapi-wrapper/index.ts',
        'types/openapi-wrapper/petstore/openapi.d.ts',
      ]),
    );
    expect(nuxt.options.alias['#openapi-wrapper']).toBe(
      path.join(nuxt.options.buildDir, 'openapi-wrapper'),
    );
  });

  it('accepts inline options', async () => {
    const nuxt = await loadFixture();

    await installModule(OpenApiWrapperModule, nuxt, {
      apis: { inline: petstore },
    });

    expect(templateNames(nuxt)).toContain('openapi-wrapper/inline/index.ts');
  });

  it('registers nothing without apis', async () => {
    const nuxt = await loadFixture();
    const before = templateNames(nuxt);

    await installModule(OpenApiWrapperModule, nuxt);

    expect(templateNames(nuxt)).toEqual(before);
    expect(nuxt.options.alias['#openapi-wrapper']).toBeUndefined();
  });

  it('rejects invalid config during setup', async () => {
    const nuxt = await loadFixture();

    await expect(
      installModule(OpenApiWrapperModule, nuxt, {
        apis: { empty: { baseUrl: 'https://a.test', openApi: [] as never } },
      }),
    ).rejects.toThrow('must contain at least one source');
  });
});
