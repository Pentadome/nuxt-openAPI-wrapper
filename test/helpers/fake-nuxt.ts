import path from 'node:path';
import type { Nuxt } from 'nuxt/schema';
import { vi } from 'vitest';

type FakeNuxtOptions = {
  rootDir: string;
  buildDir?: string;
  /** Layer cwd's, highest priority first (like `nuxt.options._layers`). Defaults to `[rootDir]`. */
  layers?: string[];
  /** Whether Nuxt runs in development mode. Defaults to `false`. */
  dev?: boolean;
};

export type FakeNuxt = Nuxt & {
  /** Runs every handler registered for `name` with `args`. */
  callHook: (name: string, ...args: unknown[]) => Promise<void>;
};

/** Minimal `Nuxt` stand-in with just the parts the module touches. */
export const createFakeNuxt = ({
  rootDir,
  buildDir = path.join(rootDir, '.nuxt'),
  layers = [rootDir],
  dev = false,
}: FakeNuxtOptions): FakeNuxt => {
  const hooks = new Map<string, Array<(...args: unknown[]) => unknown>>();

  const nuxt = {
    options: {
      rootDir,
      srcDir: path.join(rootDir, 'app'),
      buildDir,
      dev,
      watch: [],
      alias: {},
      _layers: layers.map((cwd) => ({ cwd, config: {} })),
    },
    hook: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
      return () => {};
    }),
    callHook: async (name: string, ...args: unknown[]) => {
      for (const handler of hooks.get(name) ?? []) await handler(...args);
    },
  };

  return nuxt as unknown as FakeNuxt;
};
