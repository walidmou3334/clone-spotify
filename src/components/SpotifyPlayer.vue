<script setup>
import { computed } from "vue";

const props = defineProps({
  trackId: {
    type: String,
    required: true,
  },
});

const playerUrl = computed(
  () => `https://open.spotify.com/embed/track/${encodeURIComponent(props.trackId)}`
);
</script>

<template>
  <section class="player">
    <h2>Lecteur Spotify</h2>

    <iframe
      :key="trackId"
      :src="playerUrl"
      title="Lecteur Spotify du morceau sélectionné"
      width="100%"
      height="352"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
    ></iframe>
  </section>
</template>

<style scoped>
.player {
  margin: 28px 0;
}

.player h2 {
  font-size: 22px;
}

iframe {
  display: block;
  border: 0;
  border-radius: 12px;
}
</style>