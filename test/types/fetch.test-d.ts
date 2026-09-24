import { describe, expectTypeOf, it } from 'vitest';
import type { Fetch } from '../../src/runtime/fetchTypes';
import type { components, paths } from './petstore';

type Pet = components['schemas']['Pet'];

declare const $fetch: Fetch<paths>;

describe('Fetch: paths', () => {
  it('accepts known paths only', () => {
    $fetch('/pets');
    // @ts-expect-error unknown path
    $fetch('/unknown');
  });
});

describe('Fetch: methods', () => {
  it('makes `method` optional and defaults to GET when the path supports GET', () => {
    expectTypeOf($fetch('/pets')).resolves.toEqualTypeOf<Pet[]>();
    expectTypeOf($fetch('/pets', { method: 'get' })).resolves.toEqualTypeOf<
      Pet[]
    >();
  });

  it('accepts upper case methods', () => {
    expectTypeOf($fetch('/pets', { method: 'GET' })).resolves.toEqualTypeOf<
      Pet[]
    >();
    expectTypeOf(
      $fetch('/pets', { method: 'POST', body: { name: 'Rex' } }),
    ).resolves.toEqualTypeOf<Pet>();
  });

  it('rejects methods the path does not support', () => {
    // @ts-expect-error PUT is not defined for /pets
    $fetch('/pets', { method: 'PUT' });
    // @ts-expect-error not an http method
    $fetch('/pets', { method: 'fetch' });
  });

  it('requires `method` (and thus the options) when the path has no GET', () => {
    // @ts-expect-error /status only supports POST
    $fetch('/status');
    // @ts-expect-error /status only supports POST
    $fetch('/status', {});
    $fetch('/status', { method: 'POST' });
  });
});

describe('Fetch: request body', () => {
  it('requires a typed JSON body when the operation declares one', () => {
    $fetch('/pets', { method: 'POST', body: { name: 'Rex', tag: 'dog' } });
    // @ts-expect-error body is required
    $fetch('/pets', { method: 'POST' });
    // @ts-expect-error `name` is required
    $fetch('/pets', { method: 'POST', body: { tag: 'dog' } });
    // @ts-expect-error `name` must be a string
    $fetch('/pets', { method: 'POST', body: { name: 1 } });
  });

  it('allows any body when the operation declares none', () => {
    $fetch('/status', { method: 'POST', body: { anything: true } });
  });
});

describe('Fetch: path params', () => {
  it('requires typed `pathParams` for templated paths', () => {
    expectTypeOf(
      $fetch('/pets/{petId}', { pathParams: { petId: 'rex' } }),
    ).resolves.toEqualTypeOf<Pet>();
    $fetch('/owners/{ownerId}/pets/{petId}', {
      pathParams: { ownerId: 1, petId: 'rex' },
    });

    // @ts-expect-error pathParams are required
    $fetch('/pets/{petId}');
    // @ts-expect-error pathParams are required
    $fetch('/pets/{petId}', {});
    // @ts-expect-error petId is missing
    $fetch('/owners/{ownerId}/pets/{petId}', { pathParams: { ownerId: 1 } });
    $fetch('/owners/{ownerId}/pets/{petId}', {
      // @ts-expect-error ownerId must be a number
      pathParams: { ownerId: '1', petId: 'rex' },
    });
  });
});

describe('Fetch: query', () => {
  it('requires `query` or `params` when a query parameter is required', () => {
    $fetch('/search', { query: { q: 'rex' } });
    $fetch('/search', { params: { q: 'rex' } });

    // @ts-expect-error q is required
    $fetch('/search');
    // @ts-expect-error q is required
    $fetch('/search', { query: {} });
    // @ts-expect-error q must be a string
    $fetch('/search', { query: { q: 1 } });
  });

  it('keeps optional query parameters optional', () => {
    $fetch('/pets');
    $fetch('/pets', { query: { limit: 10, tag: 'dog' } });
    $fetch('/pets', { params: { limit: 10 } });
  });

  it('allows extra query parameters', () => {
    $fetch('/search', { query: { q: 'rex', page: 2 } });
    $fetch('/pets', { query: { unknown: true } });
  });
});

describe('Fetch: headers', () => {
  it('requires declared required headers', () => {
    $fetch('/pets/{petId}', {
      method: 'DELETE',
      pathParams: { petId: 'rex' },
      headers: { 'X-Request-Id': 'abc' },
    });

    // @ts-expect-error X-Request-Id is required
    $fetch('/pets/{petId}', { method: 'DELETE', pathParams: { petId: 'rex' } });
    $fetch('/pets/{petId}', {
      method: 'DELETE',
      pathParams: { petId: 'rex' },
      // @ts-expect-error X-Request-Id is required
      headers: { other: 'x' },
    });
  });

  it('allows arbitrary headers otherwise', () => {
    $fetch('/pets', { headers: { Authorization: 'Bearer x' } });
  });
});

describe('Fetch: responses', () => {
  it('resolves to the JSON body of the 2xx response, ignoring errors', () => {
    expectTypeOf(
      $fetch('/pets/{petId}', { pathParams: { petId: 'rex' } }),
    ).resolves.toEqualTypeOf<Pet>();
  });

  it('resolves to a union for multiple 2xx responses', () => {
    expectTypeOf($fetch('/status', { method: 'POST' })).resolves.toEqualTypeOf<
      { ok: boolean } | { queued: boolean }
    >();
  });

  it('resolves to void for responses without content', () => {
    expectTypeOf(
      $fetch('/pets/{petId}', {
        method: 'DELETE',
        pathParams: { petId: 'rex' },
        headers: { 'X-Request-Id': 'abc' },
      }),
    ).resolves.toBeVoid();
  });

  it('resolves to unknown for non-JSON content', () => {
    expectTypeOf(
      $fetch('/pets/{petId}/photo', { pathParams: { petId: 'rex' } }),
    ).resolves.toEqualTypeOf<unknown>();
  });
});

describe('Fetch: untyped ofetch options', () => {
  it('accepts regular ofetch options', () => {
    $fetch('/pets', {
      baseURL: 'https://petstore.test',
      retry: 2,
      timeout: 1000,
      onRequest: () => {},
      onResponseError: () => {},
    });
  });

  it('rejects unknown options', () => {
    // @ts-expect-error not an ofetch option
    $fetch('/pets', { notAnOption: true });
  });
});
