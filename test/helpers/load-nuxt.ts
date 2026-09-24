import { fileURLToPath } from 'node:url';
import { loadNuxt, runWithNuxtContext } from '@nuxt/kit';
import type { Nuxt } from 'nuxt/schema';
import { afterEach } from 'vitest';
import type { ModuleOptions } from '../../src/config';
import type OpenApiWrapperModule from '../../src/module';

const fixtureDirectory = fileURLToPath(
  new URL('../fixtures/module', import.meta.url),
);

/** Registers cleanup and returns a loader for an unbuilt Nuxt instance of the module fixture. */
export const useNuxtFixture = () => {
  const instances: Nuxt[] = [];

  afterEach(async () => {
    await Promise.all(instances.splice(0).map((nuxt) => nuxt.close()));
  });

  return async (overrides: { openAPIWrapper?: ModuleOptions } = {}) => {
    const nuxt = await loadNuxt({
      cwd: fixtureDirectory,
      ready: false,
      overrides: { ...overrides, telemetry: false } as never,
    });
    instances.push(nuxt);
    return nuxt;
  };
};

/** Installs the module the way Nuxt does, but from the test's module graph (so `vi.mock` applies). */
export const installModule = (
  module: typeof OpenApiWrapperModule,
  nuxt: Nuxt,
  inlineOptions?: ModuleOptions,
) =>
  runWithNuxtContext(nuxt, () =>
    module(inlineOptions ?? ({} as ModuleOptions), nuxt),
  );
