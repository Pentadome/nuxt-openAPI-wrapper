import type { NitroConfig } from 'nitropack/types';

declare module 'nuxt/schema' {
  interface NuxtHooks {
    'nitro:config': (config: NitroConfig) => void | Promise<void>;
  }
}

declare module '@nuxt/schema' {
  interface NuxtHooks {
    'nitro:config': (config: NitroConfig) => void | Promise<void>;
  }
}
