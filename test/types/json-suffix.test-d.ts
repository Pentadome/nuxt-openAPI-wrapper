import { describe, expectTypeOf, it } from 'vitest';
import type { FetchError } from 'ofetch';
import type { Fetch, UseFetch } from '../../src/runtime/fetchTypes';

interface Problem {
  type: string;
  title: string;
}

interface Thing {
  id: number;
}

interface paths {
  '/problem': {
    post: {
      requestBody: {
        content: {
          'application/merge-patch+json': { name: string };
        };
      };
      responses: {
        200: {
          content: {
            'application/hal+json': Thing;
          };
        };
        400: {
          content: {
            'application/problem+json': Problem;
          };
        };
      };
    };
  };
  '/both': {
    get: {
      responses: {
        200: {
          content: {
            'application/json': Thing;
            'application/vnd.api+json': { data: Thing };
          };
        };
      };
    };
  };
  '/xml': {
    get: {
      responses: {
        200: {
          content: {
            'application/xml': string;
          };
        };
      };
    };
  };
}

declare const $fetch: Fetch<paths>;
declare const useFetch: UseFetch<paths>;

describe('structured syntax suffix (+json) media types', () => {
  it('types responses with application/*+json', () => {
    expectTypeOf(
      $fetch('/problem', { method: 'POST', body: { name: 'x' } }),
    ).resolves.toEqualTypeOf<Thing>();
  });

  it('types request bodies with application/*+json', () => {
    // @ts-expect-error body is required
    $fetch('/problem', { method: 'POST' });
    // @ts-expect-error `name` must be a string
    $fetch('/problem', { method: 'POST', body: { name: 1 } });
  });

  it('types error responses with application/problem+json', () => {
    const { error } = useFetch('/problem', {
      method: 'POST',
      body: { name: 'x' },
    });
    expectTypeOf(error.value).toEqualTypeOf<
      FetchError<Problem> | undefined
    >();
  });

  it('prefers application/json over +json variants', () => {
    expectTypeOf($fetch('/both')).resolves.toEqualTypeOf<Thing>();
  });

  it('falls back to unknown for non-json media types', () => {
    expectTypeOf($fetch('/xml')).resolves.toEqualTypeOf<unknown>();
  });
});
