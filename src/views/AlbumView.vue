<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import SpotifyPlayer from "../components/SpotifyPlayer.vue";
import { getAlbum, getAlbumTracks } from "../services/spotify";

const route = useRoute();

const album = ref(null);
const tracks = ref([]);
const selectedTrack = ref(null);

const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");
const moreError = ref("");

const nextOffset = ref(0);
const hasNext = ref(false);

// Empêche une ancienne réponse de remplacer un autre album.
let requestVersion = 0;

function artists(item) {
  return (item.artists || []).map((artist) => artist.name).join(", ");
}

function duration(milliseconds) {
  const seconds = Math.floor((milliseconds || 0) / 1000);

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function loadAlbum(id) {
  const version = ++requestVersion;

  album.value = null;
  tracks.value = [];
  selectedTrack.value = null;
  error.value = "";
  moreError.value = "";
  hasNext.value = false;
  nextOffset.value = 0;
  loadingMore.value = false;
  loading.value = true;

  try {
    const data = await getAlbum(id);

    if (version !== requestVersion) return;

    album.value = data;

    const firstPage = data.tracks;
    const rawItems = firstPage?.items || [];

    tracks.value = rawItems.filter(Boolean);
    hasNext.value = Boolean(firstPage?.next);
    nextOffset.value = (firstPage?.offset || 0) + rawItems.length;
  } catch (err) {
    if (version === requestVersion) {
      error.value = err.message;
    }
  } finally {
    if (version === requestVersion) {
      loading.value = false;
    }
  }
}

async function loadMore() {
  if (loadingMore.value || !hasNext.value) return;

  const version = requestVersion;
  const id = String(route.params.id);

  loadingMore.value = true;
  moreError.value = "";

  try {
    const page = await getAlbumTracks(id, nextOffset.value);

    if (version !== requestVersion) return;

    const rawItems = page.items || [];

    tracks.value.push(...rawItems.filter(Boolean));
    nextOffset.value = page.offset + rawItems.length;
    hasNext.value = Boolean(page.next) && rawItems.length > 0;
  } catch (err) {
    if (version === requestVersion) {
      moreError.value = err.message;
    }
  } finally {
    if (version === requestVersion) {
      loadingMore.value = false;
    }
  }
}

watch(
  () => route.params.id,
  (id) => loadAlbum(String(id)),
  { immediate: true }
);
</script>

<template>
  <main class="album-page">
    <RouterLink to="/" class="back-link">
      Retour à la recherche
    </RouterLink>

    <p v-if="loading" class="muted" role="status">
      Chargement de l’album...
    </p>

    <section v-else-if="error">
      <p class="error" role="alert">{{ error }}</p>

      <button @click="loadAlbum(String(route.params.id))">
        Réessayer
      </button>
    </section>

    <template v-else-if="album">
      <header class="album-header">
        <img
          v-if="album.images?.[0]?.url"
          :src="album.images[0].url"
          :alt="`Pochette de ${album.name}`"
          class="album-cover"
        />

        <div class="album-info">
          <span class="eyebrow">ALBUM — SPOTIFY</span>
          <h1>{{ album.name }}</h1>

          <p class="artist-names">{{ artists(album) }}</p>

          <p class="muted">
            {{ album.release_date }}
            · {{ album.total_tracks }} titres
          </p>

          <a
            v-if="album.external_urls?.spotify"
            :href="album.external_urls.spotify"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir cet album sur Spotify
          </a>
        </div>
      </header>

      <div v-if="selectedTrack" class="player-container">
        <SpotifyPlayer :track-id="selectedTrack.id" />

        <button class="outline" @click="selectedTrack = null">
          Fermer le lecteur
        </button>
      </div>

      <section>
        <h2>Les morceaux</h2>

        <p v-if="tracks.length === 0" class="muted">
          Aucun morceau à afficher.
        </p>

        <div class="track-list">
          <article
            v-for="(track, index) in tracks"
            :key="`${track.id || 'track'}-${index}`"
            class="track"
            :class="{ selected: selectedTrack?.id === track.id }"
          >
            <span class="number">{{ index + 1 }}</span>

            <div class="track-info">
              <h3>{{ track.name }}</h3>
              <p>{{ artists(track) }}</p>

              <a
                v-if="track.external_urls?.spotify"
                :href="track.external_urls.spotify"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir sur Spotify
              </a>
            </div>

            <span class="duration">
              {{ duration(track.duration_ms) }}
            </span>

            <button
              v-if="track.id"
              class="play-button"
              :aria-label="`Afficher le lecteur de ${track.name}`"
              :aria-pressed="selectedTrack?.id === track.id"
              @click="selectedTrack = track"
            >
              {{
                selectedTrack?.id === track.id
                  ? "Sélectionné"
                  : "Lecteur"
              }}
            </button>
          </article>
        </div>

        <p v-if="moreError" class="error" role="alert">
          {{ moreError }}
        </p>

        <div v-if="hasNext" class="load-more">
          <button :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? "Chargement..." : "Afficher plus de titres" }}
          </button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.album-page {
  max-width: 1100px;
  margin: auto;
  padding: 32px 24px;
}

.back-link {
  display: inline-block;
  margin-bottom: 30px;
  color: #1ed760;
}

.album-header {
  display: flex;
  align-items: center;
  gap: 30px;
  margin-bottom: 38px;
  padding: 26px;
  border: 1px solid #333;
  border-radius: 16px;
  background: #1c1c1c;
}

.album-cover {
  width: 230px;
  height: 230px;
  object-fit: contain;
}

.album-info {
  min-width: 0;
}

.eyebrow {
  color: #1ed760;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 2px;
}

.album-info h1 {
  margin: 14px 0;
  font-size: clamp(26px, 4vw, 42px);
  overflow-wrap: anywhere;
}

.artist-names {
  font-size: 18px;
}

.muted,
.track-info p,
.number,
.duration {
  color: #b3b3b3;
}

.player-container {
  max-width: 750px;
  margin: 20px auto 35px;
}

.outline {
  padding: 10px 18px;
  border: 1px solid #777;
  background: transparent;
  color: white;
}

.track-list {
  display: grid;
  gap: 10px;
}

.track {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 50px auto;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #1c1c1c;
}

.track.selected {
  border-color: #1ed760;
}

.track-info h3 {
  margin: 0 0 6px;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.track-info p {
  margin: 0 0 5px;
  font-size: 13px;
}

.track-info a {
  font-size: 12px;
}

.play-button {
  padding: 10px 15px;
  font-size: 12px;
}

.load-more {
  margin-top: 24px;
  text-align: center;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 650px) {
  .album-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;
  }

  .album-cover {
    width: 100%;
    height: auto;
    max-width: 230px;
  }

  .track {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }

  .number,
  .duration {
    display: none;
  }
}
</style>