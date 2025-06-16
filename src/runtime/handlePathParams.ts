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
  // unref the outer ref and unwrap all the inner refs using reactive.
  const reactivePathParams = computed(
    () => reactive(unref(pathParams)) as PathParams,
  );

  return computed(() => {
    return handleFetchPathParams(toValue(path), reactivePathParams.value);
  });
};

const handlePathString = (pathString: string, pathParams: PathParams) => {
  for (const [key, value] of Object.entries(pathParams)) {
    pathString = pathString.replace(`{${key}}`, `${value}`);
  }
  return pathString;
};
