/// <reference types="nuxt-mcp-dev" />

import type { Nuxt } from 'nuxt/schema';
import type { ApiConfig, ResolvedConfig } from './config';

export const exposeToMcp = (
  nuxt: Nuxt,
  moduleExpose: ResolvedConfig['exposeToMcp'],
  clientExpose: ApiConfig['exposeToMcp'],
) => {
  const effectiveClientExpose = clientExpose ?? moduleExpose;

  if (effectiveClientExpose !== undefined) return effectiveClientExpose;

  return nuxt.options._installedModules.some(
    (x) => x.meta.name === 'nuxt-mcp-dev',
  );
};
