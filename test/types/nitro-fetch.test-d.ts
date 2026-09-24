import { describe, expectTypeOf, it } from 'vitest';
import type { NitroFetch } from '../../src/runtime/fetchTypes';
import type { components, paths } from './petstore';

type Pet = components['schemas']['Pet'];

declare const $fetch: NitroFetch<paths>;

describe('NitroFetch', () => {
  it('types paths, methods and responses like Fetch', () => {
    expectTypeOf($fetch('/pets')).resolves.toEqualTypeOf<Pet[]>();
    expectTypeOf(
      $fetch('/pets', { method: 'POST', body: { name: 'Rex' } }),
    ).resolves.toEqualTypeOf<Pet>();
    expectTypeOf($fetch('/status', { method: 'post' })).resolves.toEqualTypeOf<
      { ok: boolean } | { queued: boolean }
    >();

    // @ts-expect-error unknown path
    $fetch('/unknown');
    // @ts-expect-error PUT is not defined for /pets
    $fetch('/pets', { method: 'PUT' });
    // @ts-expect-error method is required
    $fetch('/status');
  });

  it('requires typed body, pathParams, query and headers', () => {
    $fetch('/pets/{petId}', {
      method: 'DELETE',
      pathParams: { petId: 'rex' },
      headers: { 'X-Request-Id': 'abc' },
    });
    $fetch('/search', { query: { q: 'rex' } });

    // @ts-expect-error body is required
    $fetch('/pets', { method: 'POST' });
    // @ts-expect-error pathParams are required
    $fetch('/pets/{petId}');
    // @ts-expect-error q is required
    $fetch('/search', { query: {} });
    // @ts-expect-error X-Request-Id is required
    $fetch('/pets/{petId}', { method: 'DELETE', pathParams: { petId: 'rex' } });
  });

  it('accepts nitro $fetch options', () => {
    $fetch('/pets', {
      baseURL: 'https://petstore.test',
      retry: 1,
      onRequest: () => {},
    });
  });
});
