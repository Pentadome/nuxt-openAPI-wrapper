export default defineEventHandler(() => {
  // auto import from ../utils/customGitlabFetch.ts
  return $fetchGitlab('/version');
});
