import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/module'],

  externals: [
    // src/lib/openapi-typescript.ts
    '@redocly/openapi-core',
    'zod',
    'openapi-typescript',
  ],

  hooks: {
    'rollup:options'(_ctx, options) {
      options.plugins = options.plugins || [];
      options.plugins.push({
        name: 'openapi-typescript-path-rewrite',
        renderChunk(code) {
          // Remove type-only imports (types.ts has no .mjs equivalent)
          code = code.replace(/import ['"]openapi-typescript\/src\/types\.ts['"];?\n?/g, '');
          // Rewrite openapi-typescript/src/(lib|transform)/**/*.ts → openapi-typescript/dist/**/*.mjs
          return code.replace(
            /openapi-typescript\/src\/((?:lib|transform)\/.+)\.ts/g,
            'openapi-typescript/dist/$1.mjs'
          );
        },
      });
    },
  },
});
