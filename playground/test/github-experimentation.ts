/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Path } from 'typescript';
import type { components, operations, paths } from './github.js';

export type GithubPath = keyof paths;

type HTTPMethod =
  | 'GET'
  | 'HEAD'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'CONNECT'
  | 'OPTIONS'
  | 'TRACE';

type SupportedHttpMethod<
  Paths extends Record<string, any>,
  Path extends keyof Paths,
> = {
  [key in keyof Paths[Path]]: Paths[Path][key] extends never
    ? never
    : key extends Lowercase<HTTPMethod>
      ? key
      : never;
}[keyof Paths[Path]];

type StartWith2<StatusCode extends number> =
  `${StatusCode}` extends `2${string}` ? StatusCode : never;

type Get2xxReponses<Responses extends Record<number, unknown>> = {
  [key in keyof Responses]: key extends number
    ? StartWith2<key> extends never
      ? never
      : Responses[key] extends {
            content: {
              'application/json': Record<string, any>;
            };
          }
        ? Responses[key]['content']['application/json']
        : never
    : never;
}[keyof Responses];

type ToQueryOptions<Object extends Record<string, unknown>> = Object extends
  | never
  | Record<string, never>
  ? {}
  : /* query and params are the same in ofetch */
    { params: Object } | { query: Object };

type Fetch = <
  Paths extends Record<string, any>,
  Path extends keyof Paths = keyof Paths,
  Method extends SupportedHttpMethod<Paths, Path> = SupportedHttpMethod<
    Paths,
    Path
  >,
  Operation extends Paths[Path][Method] = Paths[Path][Method],
  Body extends Operation extends { requestBody: unknown }
    ? { body: Operation['requestBody'] }
    : {} = Operation extends { requestBody: unknown }
    ? { body: Operation['requestBody'] }
    : {},
  Query extends Operation extends {
    parameters: { query: Record<string, unknown> };
  }
    ? ToQueryOptions<Operation['parameters']['query']>
    : {} = Operation extends {
    parameters: { query: Record<string, unknown> };
  }
    ? ToQueryOptions<Operation['parameters']['query']>
    : {},
  Response extends Operation extends { responses: Record<number, unknown> }
    ? Get2xxReponses<Operation['responses']>
    : unknown = Operation extends { responses: Record<number, unknown> }
    ? Get2xxReponses<Operation['responses']>
    : unknown,
>(
  path: Path,
  config: NormalFetchOptions & {
    method: Method | Uppercase<Method>;
  } & Body &
    Query,
) => Promise<Response>;

type Test = SupportedHttpMethod<paths, '/'>;

const _: Test = 'get';

interface NormalFetchOptions {
  //baseURL?: string;
  //body?: RequestInit["body"] | Record<string, any>;
  ignoreResponseError?: boolean;
  //params?: Record<string, any>;
  //query?: Record<string, any>;
  parseResponse?: (responseText: string) => any;
  //responseType?: R;
  /**
   * @experimental Set to "half" to enable duplex streaming.
   * Will be automatically set to "half" when using a ReadableStream as body.
   * @see https://fetch.spec.whatwg.org/#enumdef-requestduplex
   */
  duplex?: 'half' | undefined;
  /**
   * Only supported in Node.js >= 18 using undici
   *
   * @see https://undici.nodejs.org/#/docs/api/Dispatcher
   */
  //dispatcher?: InstanceType<typeof undici.Dispatcher>;
  /**
   * Only supported older Node.js versions using node-fetch-native polyfill.
   */
  agent?: unknown;
  /** timeout in milliseconds */
  timeout?: number;
  retry?: number | false;
  /** Delay between retries in milliseconds. */
  retryDelay?: number; //| ((context: FetchContext<T, R>) => number);
  /** Default is [408, 409, 425, 429, 500, 502, 503, 504] */
  retryStatusCodes?: number[];
}

const fetch: Fetch = undefined!;

const result = await fetch<paths>('/', {
  method: 'GET',
});
