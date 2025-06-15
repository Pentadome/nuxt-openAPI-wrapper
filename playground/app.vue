<template>
  <div>Nuxt module playground!</div>
</template>

<script setup lang="ts">
import {
  $fetchGithub,
  useGithubFetch,
  type GithubComponents,
  type GitlabComponents,
} from '#build/openapi-wrapper';

const _result = await $fetchGithub('/advisories/{ghsa_id}', {
  pathParams: {
    ghsa_id: '2',
  },
});

// check for type error
const _test: GithubComponents['schemas']['global-advisory'] = _result;

const _result2 = await useGithubFetch('/advisories/{ghsa_id}', {
  pathParams: { ghsa_id: 'test' },
  method: 'GET',
});

// check for type error
const _test2: GithubComponents['schemas']['global-advisory'] | null =
  _result2.data.value;

const _result3 = useCustomGithubFetch('/advisories/{ghsa_id}', {
  pathParams: { ghsa_id: 'test' },
  lazy: true,
});

useLazyCustomGithubFetch('/');

// check for type error
const _test3: GithubComponents['schemas']['global-advisory'] | null =
  _result3.data.value;

// test auto import
const _result4 = await $fetchGitlab('/avatar', {
  params: {
    email: 'test@test.com',
  },
});

// check for type error
const _test4: GitlabComponents['schemas']['API_Entities_Avatar'] = _result4;
</script>
