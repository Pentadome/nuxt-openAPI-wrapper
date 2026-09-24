import type { FetchError } from 'ofetch';
import { describe, expectTypeOf, it } from 'vitest';
import { computed, ref } from 'vue';
import type { UseFetch, UseLazyFetch } from '../../src/runtime/fetchTypes';
import type { components, paths } from './petstore';

type Pet = components['schemas']['Pet'];
type ApiError = components['schemas']['Error'];

declare const useFetch: UseFetch<paths>;
declare const useLazyFetch: UseLazyFetch<paths>;

describe('UseFetch: request', () => {
  it('accepts a path literal, a ref or a getter', () => {
    expectTypeOf(useFetch('/pets').data.value).toEqualTypeOf<
      Pet[] | undefined
    >();
    expectTypeOf(useFetch(ref<'/pets'>('/pets')).data.value).toEqualTypeOf<
      Pet[] | undefined
    >();
    expectTypeOf(useFetch(() => '/pets' as const).data.value).toEqualTypeOf<
      Pet[] | undefined
    >();
    // an inline ref is contextually typed to the literal path
    expectTypeOf(useFetch(ref('/pets')).data.value).toEqualTypeOf<
      Pet[] | undefined
    >();
  });

  it('rejects unknown paths', () => {
    const widened = ref('/pets');

    // @ts-expect-error unknown path
    useFetch('/unknown');
    // @ts-expect-error Ref<string> is not a known path
    useFetch(widened);
  });
});

describe('UseFetch: data and error', () => {
  it('types `data` from the 2xx JSON response', () => {
    const { data } = useFetch('/pets');

    expectTypeOf(data.value).toEqualTypeOf<Pet[] | undefined>();
  });

  it('types `error` from the 4xx/5xx JSON responses', () => {
    const { error } = useFetch('/pets/{petId}', {
      pathParams: { petId: 'rex' },
    });

    expectTypeOf(error.value).toEqualTypeOf<FetchError<ApiError> | undefined>();
  });

  it('narrows `data` with `pick`', () => {
    const { data } = useFetch('/pets/{petId}', {
      pathParams: { petId: 'rex' },
      pick: ['name'],
    });

    expectTypeOf(data.value).toEqualTypeOf<Pick<Pet, 'name'> | undefined>();
  });

  it('rejects picking unknown keys', () => {
    useFetch('/pets/{petId}', {
      pathParams: { petId: 'rex' },
      // @ts-expect-error not a key of Pet
      pick: ['unknown'],
    });
  });
});

describe('UseFetch: methods', () => {
  it('types the operation of the given method, not the GET one', () => {
    expectTypeOf(
      useFetch('/pets', { method: 'POST', body: { name: 'Rex' } }).data.value,
    ).toEqualTypeOf<Pet | undefined>();
    expectTypeOf(
      useFetch('/pets/{petId}', {
        method: 'delete',
        pathParams: { petId: 'rex' },
        headers: { 'X-Request-Id': 'abc' },
      }).data.value,
    ).toEqualTypeOf<void | undefined>(); // eslint-disable-line @typescript-eslint/no-invalid-void-type
    expectTypeOf(
      useFetch('/status', { method: 'POST' }).data.value,
    ).toEqualTypeOf<{ ok: boolean } | { queued: boolean } | undefined>();
  });

  it('accepts a ref method', () => {
    expectTypeOf(
      useFetch('/pets', { method: ref<'POST'>('POST'), body: { name: 'Rex' } })
        .data.value,
    ).toEqualTypeOf<Pet | undefined>();
  });

  it('rejects methods the path does not support', () => {
    // @ts-expect-error PUT is not defined for /pets
    useFetch('/pets', { method: 'PUT' });
  });
});

describe('UseFetch: options', () => {
  it('requires the same typed options as $fetch', () => {
    useFetch('/search', { query: { q: 'rex' } });
    useFetch('/pets', { method: 'POST', body: { name: 'Rex' } });
    useFetch('/pets/{petId}', {
      method: 'DELETE',
      pathParams: { petId: 'rex' },
      headers: { 'X-Request-Id': 'abc' },
    });

    // @ts-expect-error q is required
    useFetch('/search');
    // @ts-expect-error body is required
    useFetch('/pets', { method: 'POST' });
    // @ts-expect-error X-Request-Id is required
    useFetch('/pets/{petId}', {
      method: 'DELETE',
      pathParams: { petId: 'rex' },
    });
    // @ts-expect-error pathParams are required
    useFetch('/pets/{petId}');
    // @ts-expect-error method is required
    useFetch('/status');
  });

  it('accepts refs and computeds for typed options', () => {
    const petId = ref('rex');
    const q = computed(() => 'rex');

    useFetch('/pets/{petId}', { pathParams: { petId } });
    useFetch('/pets/{petId}', { pathParams: ref({ petId: 'rex' }) });
    useFetch('/search', { query: { q } });
    useFetch('/search', { query: ref({ q: 'rex' }) });
    useFetch('/pets', { method: 'POST', body: ref({ name: 'Rex' }) });
  });

  it('rejects wrongly typed refs', () => {
    // @ts-expect-error petId must be a string
    useFetch('/pets/{petId}', { pathParams: { petId: ref(1) } });
  });

  it('accepts regular useFetch options including `lazy`', () => {
    useFetch('/pets', {
      key: 'pets',
      server: false,
      lazy: true,
      immediate: false,
      watch: false,
      default: () => [],
      transform: (pets) => pets,
    });
  });
});

describe('UseLazyFetch', () => {
  it('has the same typing as UseFetch', () => {
    const { data } = useLazyFetch('/pets/{petId}', {
      pathParams: { petId: 'rex' },
    });

    expectTypeOf(data.value).toEqualTypeOf<Pet | undefined>();
    // @ts-expect-error pathParams are required
    useLazyFetch('/pets/{petId}');
  });

  it('infers the method', () => {
    expectTypeOf(
      useLazyFetch('/pets', { method: 'POST', body: { name: 'Rex' } }).data
        .value,
    ).toEqualTypeOf<Pet | undefined>();
    // @ts-expect-error body is required
    useLazyFetch('/pets', { method: 'POST' });
  });
});
