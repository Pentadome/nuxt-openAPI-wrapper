<template>
  <div>Nuxt module playground!</div>
</template>

<script setup lang="ts">
const result = await $fetchGithub('/advisories/{ghsa_id}', {
  pathParams: {
    ghsa_id: '2',
  },
});

const result2 = await useGithubFetch('/advisories/{ghsa_id}', {
  pathParams: { ghsa_id: 'test' },
  method: 'GET',
});

useFetch;
</script>
