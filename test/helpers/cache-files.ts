import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Lists the `<key>.json` cache records in a per-API cache directory. */
export const listCacheFiles = (cacheDirectory: string): string[] => {
  try {
    return readdirSync(cacheDirectory)
      .filter((name) => /^[0-9a-f]{64}\.json$/.test(name))
      .map((name) => path.join(cacheDirectory, name));
  } catch {
    return [];
  }
};

/** Returns the single cache record path in `cacheDirectory`, or undefined when none exists. */
export const findCacheFile = (cacheDirectory: string): string | undefined => {
  const files = listCacheFiles(cacheDirectory);
  if (files.length > 1) {
    throw new Error(`Expected one cache file, found ${files.length}`);
  }
  return files[0];
};

export const hasCacheFile = (cacheDirectory: string): boolean =>
  listCacheFiles(cacheDirectory).length > 0;
