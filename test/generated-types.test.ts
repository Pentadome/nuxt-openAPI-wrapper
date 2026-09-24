import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { astToString } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import openapiTS from '../src/lib/openapi-typescript';
import { specUrl } from './helpers/specs';

const fixturePath = path.resolve(import.meta.dirname, 'types', 'petstore.ts');

const header = `// Generated from test/fixtures/specs/petstore.yaml with the module's default openapi-typescript options.
// The type tests (test/types/*.test-d.ts) run against this real generator output.
// Regenerate with: UPDATE_FIXTURES=1 npx vitest run test/generated-types.test.ts

`;

const generateFixture = async () =>
  header +
  astToString(
    await openapiTS(specUrl('petstore.yaml'), {
      ...defaultConfig.openApiTsConfig,
      silent: true,
    }),
  );

describe('generated petstore types fixture', () => {
  it('matches current openapi-typescript output', async () => {
    const expected = await generateFixture();

    if (process.env.UPDATE_FIXTURES) await writeFile(fixturePath, expected);

    expect(await readFile(fixturePath, 'utf8')).toBe(expected);
  });
});
