import { configDefaults, defineConfig } from 'vitest/config';

// e2e tests build Nuxt fixtures in-process, which loads `src` through jiti.
// That copy breaks v8 coverage merging, so coverage only runs for the unit project.
const e2eTests = ['test/basic.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...e2eTests],
          typecheck: {
            enabled: true,
            include: ['test/**/*.test-d.ts'],
            // some dependencies ship .ts sources that don't pass our strict settings.
            // Sources are checked by `npm run test:types`; this only reports errors in type tests.
            ignoreSourceErrors: true,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: e2eTests,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        // MCP tools are out of scope for the test suite.
        'src/mcp.ts',
        // type-only modules, covered by the type tests.
        'src/runtime/fetchTypes.ts',
        'src/runtime/typeUtils.ts',
        '**/*.d.ts',
        '**/tsconfig.json',
      ],
      // achieved coverage, rounded down. Raise when coverage improves.
      thresholds: {
        statements: 97,
        branches: 93,
        functions: 98,
        lines: 98,
      },
    },
  },
});
