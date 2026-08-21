export default defineEventHandler(async () => {
  // auto import from ../utils/customGitlabFetch.ts
  const x = await $fetchGitlab('/api/v4/version');

  return x;
});
