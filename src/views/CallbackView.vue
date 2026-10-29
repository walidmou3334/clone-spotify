<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { handleSpotifyCallback } from "../services/spotify";

const router = useRouter();
const error = ref("");

onMounted(async () => {
  try {
    await handleSpotifyCallback();
    await router.replace("/");
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>Connexion Spotify</h1>

      <template v-if="error">
        <p class="error" role="alert">{{ error }}</p>
        <RouterLink to="/">Retour à l’accueil</RouterLink>
      </template>

      <p v-else role="status">
        Connexion en cours, veuillez patienter...
      </p>
    </section>
  </main>
</template>