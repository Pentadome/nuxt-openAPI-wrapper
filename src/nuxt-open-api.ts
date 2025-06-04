/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { FetchOptions, FetchError } from 'ofetch';
import type { UseFetchOptions, AsyncData } from '#app';
import type {
  DefaultAsyncDataErrorValue,
  DefaultAsyncDataValue,
} from 'nuxt/app/defaults';
import type { NitroFetchRequest, AvailableRouterMethod } from 'nitropack/types';
import type {
  PickFrom,
  KeysOf,
} from '../node_modules/nuxt/dist/app/composables/asyncData';

type OmitStrict<Object, Key extends keyof Object> = Omit<Object, Key>;

type UntypedFetchOptions = OmitStrict<
  FetchOptions,
  'body' | 'method' | 'params' | 'query'
>;

// useFetch
type UntypedUseFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DefaultAsyncDataValue,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> = OmitStrict<
  UseFetchOptions<ResT, DataT, PickKeys, DefaultT, R, M>,
  'body' | 'method' | 'params' | 'query'
>;

type UntypedUseLazyFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DefaultAsyncDataValue,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> = OmitStrict<
  UntypedUseFetchOptions<ResT, DataT, PickKeys, DefaultT, R, M>,
  'lazy'
>;

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

export type Fetch = <
  Paths extends Record<string, any>,
  Path extends keyof Paths = keyof Paths,
  Method extends SupportedHttpMethod<
    Paths,
    Path
  > = 'get' extends SupportedHttpMethod<Paths, Path>
    ? 'get'
    : SupportedHttpMethod<Paths, Path>,
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
  config: UntypedFetchOptions &
    (Method extends 'get'
      ? {
          // method is optional when u can do get
          method?: Method | Uppercase<Method>;
        }
      : {
          method: Method | Uppercase<Method>;
        }) &
    Body &
    Query,
) => Promise<Response>;

// useFetch;
// type UseFetch = <
//   ResT = void,
//   ErrorT = FetchError,
//   ReqT extends NitroFetchRequest = NitroFetchRequest,
//   Method extends AvailableRouterMethod<ReqT> = ResT extends void
//     ? 'get' extends AvailableRouterMethod<ReqT>
//       ? 'get'
//       : AvailableRouterMethod<ReqT>
//     : AvailableRouterMethod<ReqT>,
//   _ResT = ResT extends void ? FetchResult<ReqT, Method> : ResT,
//   DataT = _ResT,
//   PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
//   DefaultT = DefaultAsyncDataValue,
// >(
//   request: Ref<ReqT> | ReqT | (() => ReqT),
//   opts?: UseFetchOptions<_ResT, DataT, PickKeys, DefaultT, ReqT, Method>,
// ) => AsyncData<
//   PickFrom<DataT, PickKeys> | DefaultT,
//   ErrorT | DefaultAsyncDataErrorValue
// >;

export type UseFetch = <
  Paths extends Record<string, any>,
  Path extends keyof Paths & string = keyof Paths & string,
  Method extends SupportedHttpMethod<
    Paths,
    Path
  > = 'get' extends SupportedHttpMethod<Paths, Path>
    ? 'get'
    : SupportedHttpMethod<Paths, Path>,
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
  ErrorT = FetchError,
  PickKeys extends KeysOf<Response> = KeysOf<Response>,
  DefaultT = DefaultAsyncDataValue,
>(
  request: Ref<Path> | Path | (() => Path),
  opts: UntypedUseFetchOptions<Response, Response, PickKeys, DefaultT> &
    (Method extends 'get'
      ? {
          // method is optional when u can do get
          method?: Method | Uppercase<Method>;
        }
      : {
          method: Method | Uppercase<Method>;
        }) &
    Body &
    Query,
) => AsyncData<
  PickFrom<Response, PickKeys> | DefaultT,
  ErrorT | DefaultAsyncDataErrorValue
>;

export type UseLazyFetch = <
  Paths extends Record<string, any>,
  Path extends keyof Paths & string = keyof Paths & string,
  Method extends SupportedHttpMethod<
    Paths,
    Path
  > = 'get' extends SupportedHttpMethod<Paths, Path>
    ? 'get'
    : SupportedHttpMethod<Paths, Path>,
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
  ErrorT = FetchError,
  PickKeys extends KeysOf<Response> = KeysOf<Response>,
  DefaultT = DefaultAsyncDataValue,
>(
  request: Ref<Path> | Path | (() => Path),
  opts: UntypedUseLazyFetchOptions<Response, Response, PickKeys, DefaultT> &
    (Method extends 'get'
      ? {
          // method is optional when u can do get
          method?: Method | Uppercase<Method>;
        }
      : {
          method: Method | Uppercase<Method>;
        }) &
    Body &
    Query,
) => AsyncData<
  PickFrom<Response, PickKeys> | DefaultT,
  ErrorT | DefaultAsyncDataErrorValue
>;
