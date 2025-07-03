/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  ensureArray,
  type SimplifiedNitroFetchOptions,
} from '#openapi-wrapper';
import { $fetchGitlab as _$fetchGitlab } from '#openapi-wrapper';

// @ts-expect-error
export const $fetchGitlab: typeof _$fetchGitlab = (path, opts) => {
  const options = (opts ?? {}) as SimplifiedNitroFetchOptions;

  options.onRequest = ensureArray(options.onRequest);

  options.onRequest.push((ctx) =>
    ctx.options.headers.append('Authorization', 'Bearer 12345'),
  );

  // @ts-expect-error
  return _$fetchGitlab(path, options);
};
