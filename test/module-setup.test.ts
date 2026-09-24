import { describe, expect, it, vi } from 'vitest';
import OpenApiWrapperModule from '../src/module';
import { installModule, useNuxtFixture } from './helpers/load-nuxt';

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock('../src/generate', () => ({ generate: generateMock }));

const loadFixture = useNuxtFixture();

describe('module setup', () => {
  it('waits for generation and propagates its errors', async () => {
    const nuxt = await loadFixture();
    generateMock.mockRejectedValueOnce(new Error('generation failed'));

    await expect(
      installModule(OpenApiWrapperModule, nuxt, { apis: {} }),
    ).rejects.toThrow('generation failed');
  });

  it('passes the resolved config and nuxt instance to generate', async () => {
    const nuxt = await loadFixture();
    generateMock.mockResolvedValueOnce(undefined);

    await installModule(OpenApiWrapperModule, nuxt, {
      apis: { a: { baseUrl: 'https://a.test' } },
    });

    expect(generateMock).toHaveBeenCalledExactlyOnceWith({
      moduleConfig: expect.objectContaining({
        apis: { a: { baseUrl: 'https://a.test' } },
        exposeToMcp: true,
        autoDiscover: {
          dirname: 'openapi',
          openApiFileName: 'openapi.{json,yaml}',
        },
      }),
      nuxt,
    });
  });
});
