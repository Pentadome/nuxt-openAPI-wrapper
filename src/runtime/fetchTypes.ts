/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { FetchOptions, FetchError } from 'ofetch';
import type { UseFetchOptions, AsyncData } from 'nuxt/app';
import type {
  DefaultAsyncDataErrorValue,
  DefaultAsyncDataValue,
} from 'nuxt/app/defaults';
import type { NitroFetchRequest, AvailableRouterMethod } from 'nitropack/types';
import type {
  PickFrom,
  KeysOf,
  HasRequiredProperties,
  OmitStrict,
  ComputedOptions,
  PlainObject,
} from './typeUtils';
import type { Ref } from 'vue';
export type { FetchOptions } from 'ofetch';
export type { ComputedOptions } from './typeUtils';

type UntypedOptionsToReplaceWithTypedOptions =
  | 'body'
  | 'method'
  | 'params'
  | 'query'
  | 'headers';

export type UntypedFetchOptions = OmitStrict<
  FetchOptions,
  UntypedOptionsToReplaceWithTypedOptions
>;

/** @see similair to  {@link https://github.com/nuxt/nuxt/blob/d0a61fc69061690ffda41d9dfe321e400da9da80/packages/nuxt/src/app/composables/fetch.ts#L29} */
export type ComputedUntypedFetchOptions = ComputedOptions<UntypedFetchOptions>;

// useFetch
type UntypedUseLazyFetchOptions<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DefaultAsyncDataValue,
  R extends NitroFetchRequest = string & {},
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> = OmitStrict<
  UseFetchOptions<ResT, DataT, PickKeys, DefaultT, R, M>,
  UntypedOptionsToReplaceWithTypedOptions | 'lazy'
>;

type LazyFetchOption = Pick<UseFetchOptions<void>, 'lazy'>;

type HTTPMethod =
  | 'get'
  | 'head'
  | 'patch'
  | 'post'
  | 'put'
  | 'delete'
  | 'connect'
  | 'options'
  | 'trace';

type GetSupportedHttpMethods<PathInfo extends PlainObject> = {
  [key in keyof PathInfo]: PathInfo[key] extends {}
    ? key extends HTTPMethod
      ? key
      : never
    : never;
}[keyof PathInfo];

type Get2xxReponses<Operation> = Operation extends { responses: {} }
  ? {
      [key in keyof Operation['responses']]: key extends string | number
        ? `${key}` extends `2${string}`
          ? Operation['responses'][key] extends {
              content: {
                'application/json': {};
              };
            }
            ? Operation['responses'][key]['content']['application/json']
            : never
          : never
        : never;
    }[keyof Operation['responses']]
  : unknown;

type GetBody<Operation> = Operation extends {
  requestBody: {
    content: {
      'application/json': {};
    };
  };
}
  ? { body: Operation['requestBody']['content']['application/json'] }
  : { body?: any };

type GetPathParams<Operation> = Operation extends {
  parameters: {
    path: {};
  };
}
  ? { pathParams: Operation['parameters']['path'] }
  : {};

type GetQueryParams<Operation> = Operation extends {
  parameters: {
    query: {};
  };
}
  ? HasRequiredProperties<Operation['parameters']['query']> extends true
    ?
        | { params: Operation['parameters']['query'] & PlainObject }
        | { query: Operation['parameters']['query'] & PlainObject }
    : {
        params?: Operation['parameters']['query'] & PlainObject;
        query?: Operation['parameters']['query'] & PlainObject;
      }
  : { params?: PlainObject; query?: PlainObject };

type GetHeaders<Operation> = Operation extends {
  parameters: {
    header: {};
  };
}
  ? HasRequiredProperties<Operation['parameters']['header']> extends true
    ? { headers: Operation['parameters']['header'] & PlainObject }
    : { headers?: Operation['parameters']['header'] & PlainObject }
  : { headers?: PlainObject };

type GetMethodProp<Methods, Method> = 'get' extends Methods
  ? {
      // method is optional when u can do get
      method?: Method extends string ? Uppercase<Method> | Method : Method;
    }
  : {
      method: Method extends string ? Uppercase<Method> | Method : Method;
    };

export type SimplifiedFetchOptions = FetchOptions & {
  pathParams?: Record<string, string | number>;
};

export type SimplifiedUseFetchOptions = UseFetchOptions<void> & {
  pathParams?: ComputedOptions<Record<string, string | number>>;
};

export type Fetch<Paths extends Record<string, any>> = <
  Path extends keyof Paths,
  PathInfo extends Paths[Path],
  MethodOptions extends GetSupportedHttpMethods<PathInfo>,
  Method extends Extract<MethodOptions, string>,
  Operation extends Paths[Path][Method],
  Body extends GetBody<Operation>,
  PathParams extends GetPathParams<Operation>,
  Query extends GetQueryParams<Operation>,
  Headers extends GetHeaders<Operation>,
  Response extends Get2xxReponses<Operation>,
>(
  path: Path,
  // see: https://stackoverflow.com/a/78720068/11463241
  ...config: HasRequiredProperties<
    Headers & Query & PathParams & Body & GetMethodProp<MethodOptions, Method>
  > extends true
    ? [
        config: UntypedFetchOptions &
          GetMethodProp<MethodOptions, Method> &
          Body &
          PathParams &
          Query &
          Headers,
      ]
    : [
        config?: UntypedFetchOptions &
          GetMethodProp<MethodOptions, Method> &
          Body &
          PathParams &
          Query &
          Headers,
      ]
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

export type UseFetch<
  Paths extends Record<string, any>,
  Lazy extends boolean = false,
> = <
  Path extends keyof Paths,
  PathInfo extends Paths[Path],
  MethodOptions extends GetSupportedHttpMethods<PathInfo>,
  Method extends Extract<MethodOptions, string>,
  Operation extends Paths[Path][Method],
  Body extends GetBody<Operation>,
  PathParams extends GetPathParams<Operation>,
  Query extends GetQueryParams<Operation>,
  Headers extends GetHeaders<Operation>,
  Response extends Get2xxReponses<Operation>,
  ErrorT = FetchError,
  PickKeys extends KeysOf<Response> = KeysOf<Response>,
  DefaultT = DefaultAsyncDataValue,
>(
  request: Ref<Path> | Path | (() => Path),
  ...opts: HasRequiredProperties<
    Headers & Query & PathParams & Body & GetMethodProp<MethodOptions, Method>
  > extends true
    ? [
        opts: UntypedUseLazyFetchOptions<
          Response,
          Response,
          PickKeys,
          DefaultT
        > &
          (Lazy extends false ? LazyFetchOption : {}) &
          ComputedOptions<
            Headers &
              Query &
              PathParams &
              Body &
              GetMethodProp<MethodOptions, Method>
          >,
      ]
    : [
        opts?: UntypedUseLazyFetchOptions<
          Response,
          Response,
          PickKeys,
          DefaultT
        > &
          (Lazy extends false ? LazyFetchOption : {}) &
          ComputedOptions<
            Headers &
              Query &
              PathParams &
              Body &
              GetMethodProp<MethodOptions, Method>
          >,
      ]
) => AsyncData<
  PickFrom<Response, PickKeys> | DefaultT,
  ErrorT | DefaultAsyncDataErrorValue
>;

export type UseLazyFetch<Paths extends Record<string, any>> = UseFetch<
  Paths,
  true
>;
