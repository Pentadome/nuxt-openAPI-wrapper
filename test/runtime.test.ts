import { describe, expect, it } from 'vitest';
import { computed, isRef, nextTick, reactive, ref } from 'vue';
import { ensureArray, ensureArrayComputed } from '../src/runtime/fetchUtils';
import {
  handleFetchPathParams,
  handleUseFetchPathParams,
} from '../src/runtime/handlePathParams';
import * as serverRuntime from '../src/runtime/server';

describe('handleFetchPathParams', () => {
  it('substitutes every param', () => {
    expect(
      handleFetchPathParams('/owners/{ownerId}/pets/{petId}', {
        ownerId: 7,
        petId: 'rex',
      }),
    ).toBe('/owners/7/pets/rex');
  });

  it('substitutes repeated placeholders', () => {
    expect(handleFetchPathParams('/{id}/copy/{id}', { id: 1 })).toBe(
      '/1/copy/1',
    );
  });

  it('leaves unknown placeholders and ignores extra params', () => {
    expect(
      handleFetchPathParams('/pets/{petId}/{other}', { petId: 1, unused: 2 }),
    ).toBe('/pets/1/{other}');
  });

  it('inserts values verbatim (no URL encoding), so `/` in params keeps working', () => {
    expect(
      handleFetchPathParams('/repos/{owner}/{repo}/contents/{path}', {
        owner: 'o',
        repo: 'r',
        path: 'docs/read me.md',
      }),
    ).toBe('/repos/o/r/contents/docs/read me.md');
  });

  it('does not treat param values as replacement patterns', () => {
    expect(handleFetchPathParams('/pets/{petId}', { petId: '$&$$' })).toBe(
      '/pets/$&$$',
    );
  });

  it('returns the path unchanged without params', () => {
    expect(handleFetchPathParams('/pets', {})).toBe('/pets');
  });
});

describe('handleUseFetchPathParams', () => {
  it('returns a computed path', () => {
    const result = handleUseFetchPathParams('/pets/{petId}', { petId: 1 });

    expect(isRef(result)).toBe(true);
    expect(result.value).toBe('/pets/1');
  });

  it('accepts a ref or getter path and follows its changes', () => {
    const path = ref('/pets/{petId}');
    const fromRef = handleUseFetchPathParams(path, { petId: 1 });
    const fromGetter = handleUseFetchPathParams(() => path.value, { petId: 1 });

    path.value = '/pets/{petId}/photo';

    expect(fromRef.value).toBe('/pets/1/photo');
    expect(fromGetter.value).toBe('/pets/1/photo');
  });

  it('unwraps refs and computeds inside the params object', () => {
    const petId = ref(1);
    const ownerId = computed(() => petId.value * 10);
    const result = handleUseFetchPathParams('/owners/{ownerId}/pets/{petId}', {
      petId,
      ownerId,
    });

    expect(result.value).toBe('/owners/10/pets/1');
    petId.value = 2;
    expect(result.value).toBe('/owners/20/pets/2');
  });

  it('follows a ref holding the whole params object', () => {
    const params = ref<Record<string, string | number>>({ petId: 1 });
    const result = handleUseFetchPathParams('/pets/{petId}', params);

    params.value = { petId: 3 };

    expect(result.value).toBe('/pets/3');
  });

  it('follows mutations of a reactive params object', async () => {
    const params = reactive({ petId: 1 });
    const result = handleUseFetchPathParams('/pets/{petId}', params);

    params.petId = 5;
    await nextTick();

    expect(result.value).toBe('/pets/5');
  });
});

describe('ensureArray', () => {
  it('returns an empty array for undefined', () => {
    expect(ensureArray(undefined)).toEqual([]);
  });

  it('wraps a single value', () => {
    const hook = () => {};
    expect(ensureArray(hook)).toEqual([hook]);
  });

  it('returns the same array instance', () => {
    const hooks = [() => {}];
    expect(ensureArray(hooks)).toBe(hooks);
  });
});

describe('ensureArrayComputed', () => {
  it('handles plain values', () => {
    const hook = () => {};

    expect(ensureArrayComputed(undefined).value).toEqual([]);
    expect(ensureArrayComputed(hook).value).toEqual([hook]);
  });

  it('follows ref changes', () => {
    const first = () => {};
    const second = () => {};
    const hooks = ref<(() => void) | (() => void)[] | undefined>(undefined);
    const result = ensureArrayComputed(hooks);

    expect(result.value).toEqual([]);
    hooks.value = first;
    expect(result.value).toEqual([first]);
    hooks.value = [first, second];
    expect(result.value).toEqual([first, second]);
  });
});

describe('server runtime entry', () => {
  it('re-exports the server-safe helpers', () => {
    expect(serverRuntime.handleFetchPathParams).toBe(handleFetchPathParams);
    expect(serverRuntime.ensureArray).toBe(ensureArray);
    expect(serverRuntime.ensureArrayComputed).toBe(ensureArrayComputed);
    expect(Object.keys(serverRuntime).sort()).toEqual([
      'ensureArray',
      'ensureArrayComputed',
      'handleFetchPathParams',
    ]);
  });
});
