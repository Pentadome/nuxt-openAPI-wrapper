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

/** @see {@link https://github.com/nuxt/nuxt/blob/017d1bed05b83e889d51c27d251a69c326ca7beb/packages/nuxt/src/app/composables/asyncData.ts#L21} */
export type PickFrom<T, K extends Array<string>> =
  T extends Array<any>
    ? T
    : T extends Record<string, any>
      ? keyof T extends K[number]
        ? T
        : K[number] extends never
          ? T
          : Pick<T, K[number]>
      : T;

/** @see {@link https://github.com/nuxt/nuxt/blob/017d1bed05b83e889d51c27d251a69c326ca7beb/packages/nuxt/src/app/composables/asyncData.ts#L21} */
export type KeysOf<T> = Array<
  T extends T // Include all keys of union types, not just common keys
    ? keyof T extends string
      ? keyof T
      : never
    : never
>;
