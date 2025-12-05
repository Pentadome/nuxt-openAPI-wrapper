import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/module'],

  externals: [
    // src/lib/openapi-typescript.ts
    '@redocly/openapi-core',
    'zod',
    '../node_modules/openapi-typescript/src/lib/redoc.js',
    '../node_modules/openapi-typescript/src/lib/utils.js',
    '../node_modules/openapi-typescript/src/transform/index.js',
    '../node_modules/openapi-typescript/src/types.js',
    '../node_modules/openapi-typescript/src/lib/ts.js',
    '../node_modules/openapi-typescript/src/transform/components-object.js',
    '../node_modules/openapi-typescript/src/transform/header-object.js',
    '../node_modules/openapi-typescript/src/transform/media-type-object.js',
    '../node_modules/openapi-typescript/src/transform/operation-object.js',
    '../node_modules/openapi-typescript/src/transform/parameter-object.js',
    '../node_modules/openapi-typescript/src/transform/path-item-object.js',
    '../node_modules/openapi-typescript/src/transform/paths-object.js',
    '../node_modules/openapi-typescript/src/transform/request-body-object.js',
    '../node_modules/openapi-typescript/src/transform/response-object.js',
    '../node_modules/openapi-typescript/src/transform/responses-object.js',
    '../node_modules/openapi-typescript/src/transform/schema-object.js',
  ],
});
