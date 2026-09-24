import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

/** Registers cleanup for the current test file and returns a temp directory factory.
 * @param root parent directory; defaults to the OS temp directory.
 */
export const useTempDirectories = (root = tmpdir()) => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  return async (prefix = 'nuxt-openapi-wrapper-test-') => {
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(path.join(root, prefix));
    directories.push(directory);
    return directory;
  };
};

/** Temp root inside the repository, so generated files can resolve `src/` and `node_modules`. Ignored by git via `.tmp`. */
export const repoTempRoot = path.resolve(import.meta.dirname, '..', '.tmp');
