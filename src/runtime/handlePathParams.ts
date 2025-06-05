import { computed, reactive, toValue, type Ref } from 'vue';
import type { ComputedOptions } from '../typeUtils';

type PathParams = Record<string, string | number>;

export const handleFetchPathParams = (path: string, pathParams: PathParams) => {
  return handlePathString(path, pathParams);
};

export const handleUseFetchPathParams = (
  path: string | Ref<string> | (() => string),
  pathParams: ComputedOptions<PathParams>,
) => {
  const reactivePathParams = reactive(pathParams) as PathParams;
  return computed(() =>
    handleFetchPathParams(toValue(path), reactivePathParams),
  );
};

const handlePathString = (pathString: string, pathParams: PathParams) => {
  for (const [key, value] of Object.entries(pathParams)) {
    pathString = pathString.replace(`{${key}}`, `${value}`);
  }
  return pathString;
};
