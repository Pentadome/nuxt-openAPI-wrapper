/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { Ref } from 'vue';

export type OmitStrict<Object, Key extends keyof Object> = Omit<Object, Key>;

export type HasRequiredProperties<Object> = {} extends Object ? false : true;

/** @see {@link https://github.com/nuxt/nuxt/blob/42114f44a60ae326b58c05afe92ad535227d8f37/packages/nuxt/src/app/composables/fetch.ts#L20} */
export type ComputedOptions<T extends Record<string, any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function
    ? T[K]
    : ComputedOptions<T[K]> | Ref<T[K]> | T[K];
};

export type PlainObject = { [key: string]: any };
