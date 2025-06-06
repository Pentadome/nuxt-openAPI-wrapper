<template>
  <div>Nuxt module playground!</div>
</template>

<script setup lang="ts">
import { $fetchGithub, useGithubFetch } from '#build/nuxt-open-api';

const _result = await $fetchGithub('/advisories/{ghsa_id}', {
  pathParams: {
    ghsa_id: '2',
  },
});

const _result2 = await useGithubFetch('/advisories/{ghsa_id}', {
  pathParams: { ghsa_id: 'test' },
  method: 'GET',
});

const _result3 = useCustomGithubFetch('/advisories/{ghsa_id}', {
  pathParams: { ghsa_id: 'test' },
});
</script>
