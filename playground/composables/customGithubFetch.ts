/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  $fetchGithub,
  ensureArray,
  ensureArrayComputed,
  useGithubFetch,
  useLazyGithubFetch,
  type ComputedUntypedFetchOptions,
  type SimplifiedFetchOptions,
  type SimplifiedUseFetchOptions,
} from '#build/openapi-wrapper';
import type { FetchHook } from 'ofetch';

// @ts-expect-error
export const $fetchCustomGithub: typeof $fetchGithub = (path, opts?) => {
  const options = (opts ?? {}) as SimplifiedFetchOptions;

  options.onRequest = ensureArray(options.onRequest);

  options.onRequest.push(addAuthHeader);

  // @ts-expect-error
  return $fetchGithub(path, options);
};

// @ts-expect-error
export const useCustomGithubFetch: typeof useGithubFetch = (path, opts?) => {
  opts = configureUseFetchOptions(opts);

  // @ts-expect-error
  return useGithubFetch(path, opts);
};

// @ts-expect-error
export const useLazyCustomGithubFetch: typeof useLazyGithubFetch = (
  path,
  opts?,
) => {
  opts = configureUseFetchOptions(opts);

  // @ts-expect-error
  return useLazyGithubFetch(path, opts);
};

const configureUseFetchOptions = <
  T extends ComputedUntypedFetchOptions | undefined,
>(
  opts: T,
) => {
  const options = (opts ?? {}) as SimplifiedUseFetchOptions;

  const existingOnRequestHooks = ensureArrayComputed(options.onRequest);

  options.onRequest = computed(() => [
    ...existingOnRequestHooks.value,
    addAuthHeader,
  ]);

  return options as T & {};
};

const addAuthHeader: FetchHook = (ctx) => {
  ctx.options.headers.append('Authorization', 'Bearer 1234');
};
