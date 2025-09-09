export default defineEventHandler(() => {
  // auto import type test
  const path = '/emojis' satisfies keyof GithubPaths;

  // auto import client test
  return $fetchGithub(path);
});
