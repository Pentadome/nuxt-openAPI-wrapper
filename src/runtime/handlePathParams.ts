import {
  computed,
  reactive,
  toValue,
  unref,
  type MaybeRef,
  type Ref,
} from 'vue';
import type { ComputedOptions } from './typeUtils';

type PathParams = Record<string, string | number>;

export const handleFetchPathParams = (path: string, pathParams: PathParams) => {
  return handlePathString(path, pathParams);
};

export const handleUseFetchPathParams = (
  path: string | Ref<string> | (() => string),
  pathParams: MaybeRef<ComputedOptions<PathParams>>,
) => {
  return computed(() => {
    const reactivePathParams = reactive(unref(pathParams)) as PathParams;
    return handleFetchPathParams(toValue(path), reactivePathParams);
  });
};

const handlePathString = (pathString: string, pathParams: PathParams) => {
  for (const [key, value] of Object.entries(pathParams)) {
    pathString = pathString.replace(`{${key}}`, `${value}`);
  }
  return pathString;
};
