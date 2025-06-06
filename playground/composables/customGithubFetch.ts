import {
  $fetchGithub,
  useGithubFetch,
  useLazyGithubFetch,
  type ComputedUntypedFetchOptions,
} from '#build/nuxt-open-api';
import type { FetchHook } from 'ofetch';

// @ts-expect-error -- limitation in typescript
export const $fetchCustomGithub: typeof $fetchGithub = (path, opts?) => {
  opts ??= {} as NonNullable<typeof opts>;

  opts.onRequest = opts.onRequest
    ? Array.isArray(opts.onRequest)
      ? opts.onRequest
      : [opts.onRequest]
    : [];

  opts.onRequest.push(addAuthHeader);

  // @ts-expect-error -- limitation in typescript
  return $fetchGithub(path, opts);
};

// @ts-expect-error -- limitation in typescript
export const useCustomGithubFetch: typeof useGithubFetch = (path, opts?) => {
  opts = configureUseFetchOptions(opts);

  // @ts-expect-error -- limitation in typescript
  return useGithubFetch(path, opts);
};

// @ts-expect-error -- limitation in typescript
export const useLazyCustomGithubFetch: typeof useLazyGithubFetch = (
  path,
  opts?,
) => {
  opts = configureUseFetchOptions(opts);

  // @ts-expect-error -- limitation in typescript
  return useLazyGithubFetch(path, opts);
};

const configureUseFetchOptions = <
  T extends ComputedUntypedFetchOptions | undefined,
>(
  opts: T,
) => {
  opts ??= {} as NonNullable<T>;

  // value may be ref
  const onRequestArray = computed(() => {
    const rawValue = toValue(opts.onRequest);

    return rawValue ? (Array.isArray(rawValue) ? rawValue : [rawValue]) : [];
  });

  opts.onRequest = computed(() => [...onRequestArray.value, addAuthHeader]);

  return opts;
};

const addAuthHeader: FetchHook = (ctx) => {
  ctx.options.headers.append('Authorization', 'Bearer 1234');
};
