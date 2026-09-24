import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRef, ref, type Ref } from 'vue';
import { applyConfig } from '../src/config';
import { generate } from '../src/generate';
import { createFakeNuxt } from './helpers/fake-nuxt';
import { kit } from './helpers/kit-recorder';
import { specUrl } from './helpers/specs';
import { repoTempRoot, useTempDirectories } from './helpers/temp-dir';

vi.mock('@nuxt/kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nuxt/kit')>()),
  ...(await import('./helpers/kit-recorder')).kitMocks,
}));
vi.mock('../src/mcp', () => ({
  recordInfoForMcp: vi.fn(),
  setupMCPTools: vi.fn(),
}));

const { useFetchMock } = vi.hoisted(() => ({ useFetchMock: vi.fn() }));
vi.mock('nuxt/app', () => ({ useFetch: useFetchMock }));

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);

// inside the repo, so generated relative imports resolve to src/runtime.
const makeTempDirectory = useTempDirectories(repoTempRoot);

type AnyFn = (...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

type NuxtClient = {
  $fetchPetstore: AnyFn;
  usePetstoreFetch: AnyFn;
  useLazyPetstoreFetch: AnyFn;
};
type NitroClient = { $fetchPetstore: AnyFn };

const writeAndImport = async <T>(filePath: string, code: string) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, code);
  return (await import(pathToFileURL(filePath).href)) as T;
};

const loadClients = async (baseUrl = 'https://petstore.test/v1') => {
  const rootDir = await makeTempDirectory('generated-clients-');
  const buildDir = path.join(rootDir, '.nuxt');
  kit.reset(buildDir);
  await generate({
    moduleConfig: applyConfig({
      apis: { petstore: { baseUrl, openApi: specUrl('petstore.yaml') } },
    }),
    nuxt: createFakeNuxt({ rootDir, buildDir }),
  });

  const nuxtFile = 'openapi-wrapper/petstore/index.ts';
  const nuxt = await writeAndImport<NuxtClient>(
    path.join(buildDir, nuxtFile),
    await kit.template(nuxtFile).getContents(),
  );
  const nitro = await writeAndImport<NitroClient>(
    path.join(buildDir, 'nitro', 'petstore.mjs'),
    await kit.serverTemplate('#openapi-wrapper/petstore').getContents(),
  );
  return { nuxt, nitro };
};

let clients: Awaited<ReturnType<typeof loadClients>>;

beforeEach(async () => {
  fetchMock.mockReset().mockResolvedValue('fetch result');
  useFetchMock.mockReset().mockReturnValue('useFetch result');
  clients ??= await loadClients();
});

const lastFetch = () => fetchMock.mock.lastCall!;
const lastUseFetch = () =>
  useFetchMock.mock.lastCall! as [unknown, Record<string, unknown>];

describe.each([
  ['nuxt', () => clients.nuxt.$fetchPetstore],
  ['nitro', () => clients.nitro.$fetchPetstore],
] as const)('%s $fetchPetstore', (_side, getClient) => {
  it('defaults the base url and returns the $fetch result', async () => {
    await expect(getClient()('/pets')).resolves.toBe('fetch result');

    expect(lastFetch()).toEqual([
      '/pets',
      { baseURL: 'https://petstore.test/v1' },
    ]);
  });

  it('keeps an explicit base url', async () => {
    await getClient()('/pets', { baseURL: 'https://override.test' });

    expect(lastFetch()[1]).toEqual({ baseURL: 'https://override.test' });
  });

  it('substitutes and strips `pathParams`, passing everything else through', async () => {
    const onRequest = vi.fn();
    await getClient()('/owners/{ownerId}/pets/{petId}', {
      method: 'GET',
      pathParams: { ownerId: 7, petId: 'rex' },
      query: { limit: 1 },
      headers: { 'X-Request-Id': 'abc' },
      onRequest,
    });

    expect(lastFetch()).toEqual([
      '/owners/7/pets/rex',
      {
        baseURL: 'https://petstore.test/v1',
        method: 'GET',
        query: { limit: 1 },
        headers: { 'X-Request-Id': 'abc' },
        onRequest,
      },
    ]);
  });

  it('passes the body', async () => {
    await getClient()('/pets', { method: 'POST', body: { name: 'Rex' } });

    expect(lastFetch()[1]).toMatchObject({
      method: 'POST',
      body: { name: 'Rex' },
    });
  });

  it('does not mutate the caller options', async () => {
    const options = { pathParams: { petId: 1 }, query: { a: 1 } };
    const snapshot = structuredClone(options);

    await getClient()('/pets/{petId}', options);

    expect(options).toEqual(snapshot);
  });
});

describe('nuxt usePetstoreFetch', () => {
  it('defaults the base url and returns the useFetch result', () => {
    expect(clients.nuxt.usePetstoreFetch('/pets')).toBe('useFetch result');

    expect(lastUseFetch()).toEqual([
      '/pets',
      { baseURL: 'https://petstore.test/v1' },
    ]);
  });

  it('keeps an explicit base url and other options', () => {
    const transform = vi.fn();
    clients.nuxt.usePetstoreFetch('/pets', {
      baseURL: 'https://override.test',
      key: 'pets',
      transform,
    });

    expect(lastUseFetch()[1]).toEqual({
      baseURL: 'https://override.test',
      key: 'pets',
      transform,
    });
  });

  it('passes ref and getter paths through untouched without `pathParams`', () => {
    const path = ref('/pets');
    const getter = () => '/pets';

    clients.nuxt.usePetstoreFetch(path);
    expect(lastUseFetch()[0]).toBe(path);
    clients.nuxt.usePetstoreFetch(getter);
    expect(lastUseFetch()[0]).toBe(getter);
  });

  it('turns `pathParams` into a reactive computed path and strips them', () => {
    const petId = ref(1);

    clients.nuxt.usePetstoreFetch('/pets/{petId}', { pathParams: { petId } });

    const [request, options] = lastUseFetch();
    expect(isRef(request)).toBe(true);
    expect((request as Ref<string>).value).toBe('/pets/1');
    petId.value = 2;
    expect((request as Ref<string>).value).toBe('/pets/2');
    expect(options).toEqual({ baseURL: 'https://petstore.test/v1' });
  });

  it('supports a ref path together with `pathParams`', () => {
    const path = ref('/pets/{petId}');

    clients.nuxt.usePetstoreFetch(path, { pathParams: { petId: 3 } });
    path.value = '/pets/{petId}/photo';

    expect((lastUseFetch()[0] as Ref<string>).value).toBe('/pets/3/photo');
  });

  it('does not mutate the caller options', () => {
    const options = { pathParams: { petId: 1 }, key: 'k' };
    const snapshot = structuredClone(options);

    clients.nuxt.usePetstoreFetch('/pets/{petId}', options);

    expect(options).toEqual(snapshot);
  });
});

describe('nuxt useLazyPetstoreFetch', () => {
  it('calls useFetch with `lazy: true`', () => {
    expect(clients.nuxt.useLazyPetstoreFetch('/pets')).toBe('useFetch result');

    expect(lastUseFetch()).toEqual([
      '/pets',
      { baseURL: 'https://petstore.test/v1', lazy: true },
    ]);
  });

  it('applies `pathParams` like usePetstoreFetch', () => {
    clients.nuxt.useLazyPetstoreFetch('/pets/{petId}', {
      pathParams: { petId: 9 },
    });

    const [request, options] = lastUseFetch();
    expect((request as Ref<string>).value).toBe('/pets/9');
    expect(options).toEqual({
      baseURL: 'https://petstore.test/v1',
      lazy: true,
    });
  });

  it('does not mutate the caller options', () => {
    const options = { key: 'k' };

    clients.nuxt.useLazyPetstoreFetch('/pets', options);

    expect(options).toEqual({ key: 'k' });
  });
});

describe('shared options across clients', () => {
  it('does not leak the base url of one client into another', async () => {
    const other = await loadClients('https://other.test');
    const shared = {};

    await clients.nuxt.$fetchPetstore('/pets', shared);
    await other.nuxt.$fetchPetstore('/pets', shared);

    expect(fetchMock.mock.calls.map(([, options]) => options.baseURL)).toEqual([
      'https://petstore.test/v1',
      'https://other.test',
    ]);
  });
});
