import { describe, expectTypeOf, it } from 'vitest';
import type { Ref } from 'vue';
import type {
  ComputedOptions,
  HasRequiredProperties,
  KeysOf,
  PickFrom,
} from '../../src/runtime/typeUtils';

describe('HasRequiredProperties', () => {
  it('is true only when a property is required', () => {
    expectTypeOf<HasRequiredProperties<{ a: string }>>().toEqualTypeOf<true>();
    expectTypeOf<
      HasRequiredProperties<{ a: string; b?: string }>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      HasRequiredProperties<{ a?: string }>
    >().toEqualTypeOf<false>();
    expectTypeOf<HasRequiredProperties<{}>>().toEqualTypeOf<false>(); // eslint-disable-line @typescript-eslint/no-empty-object-type
    expectTypeOf<
      HasRequiredProperties<{ a: string } | undefined>
    >().toEqualTypeOf<false>();
    expectTypeOf<
      HasRequiredProperties<{ a: string } | null>
    >().toEqualTypeOf<false>();
  });
});

describe('PickFrom', () => {
  type Pet = { id: string; name: string; tag?: string };

  it('picks the listed keys', () => {
    expectTypeOf<PickFrom<Pet, ['name']>>().toEqualTypeOf<Pick<Pet, 'name'>>();
  });

  it('keeps the type when all keys or no keys are listed', () => {
    expectTypeOf<PickFrom<Pet, ['id', 'name', 'tag']>>().toEqualTypeOf<Pet>();
    expectTypeOf<PickFrom<Pet, []>>().toEqualTypeOf<Pet>();
  });

  it('keeps arrays and primitives', () => {
    expectTypeOf<PickFrom<Pet[], ['name']>>().toEqualTypeOf<Pet[]>();
    expectTypeOf<PickFrom<string, ['length']>>().toEqualTypeOf<string>();
  });
});

describe('KeysOf', () => {
  it('lists the keys of every union member', () => {
    expectTypeOf<KeysOf<{ a: 1 } | { b: 2 }>>().toEqualTypeOf<
      Array<'a' | 'b'>
    >();
  });
});

describe('ComputedOptions', () => {
  it('allows every value to be a ref, recursively, but keeps functions as-is', () => {
    type Options = ComputedOptions<{
      a: string;
      nested: { b: number };
      fn: () => void;
    }>;

    expectTypeOf<{
      a: Ref<string>;
      nested: { b: Ref<number> };
      fn: () => void;
    }>().toExtend<Options>();
    expectTypeOf<{
      a: 'x';
      nested: Ref<{ b: number }>;
      fn: () => void;
    }>().toExtend<Options>();
    expectTypeOf<{
      a: string;
      nested: { b: number };
      fn: Ref<() => void>;
    }>().not.toExtend<Options>();
  });
});
