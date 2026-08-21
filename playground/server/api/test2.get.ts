export default defineEventHandler(async () => {
  // auto import type test
  const path = '/emojis' satisfies keyof GithubPaths;

  // auto import client test
  const x = await $fetchGithub(path);

  return x;
});
