import { type MaybeRef, type ComputedRef, computed, unref } from 'vue';

/** Ensures a value is an array.
 * @example ensureArray(undefined) // returns []
 * @example ensureArray('value') // returns ['value']
 * @example ensureArray(['value1', 'value2']) // returns ['value1', 'value2'] (same reference as input)
 */
export const ensureArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

/** Ensures a value is an computed array.
 * @example
 * const existingOnRequest = ensureArrayComputed(hooks.onRequest);
 * hooks.onRequest = computed(() => [
 *   ...existingOnRequest.value,
 *   ...onRequestHooks,
 * ]);
 */
export const ensureArrayComputed = <T>(
  value: MaybeRef<T | T[] | undefined>,
): ComputedRef<T[]> => {
  return computed(() => {
    const rawValue = unref(value);

    return ensureArray(rawValue);
  });
};
