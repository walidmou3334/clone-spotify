<script setup>
import { ref } from "vue";
import SpotifyPlayer from "../components/SpotifyPlayer.vue";
import { searchSpotify } from "../services/spotify";

const types = {
  track: "Chansons",
  artist: "Artistes",
  album: "Albums",
};

const HISTORY_KEY = "vue-music:search-history:v1";
function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(entry =>
      entry && typeof entry.query === "string" && entry.query.trim() &&
      entry.query.length <= 200 && Object.hasOwn(types, entry.type)
    ).slice(0, 6) : [];
  } catch { return []; }
}
const history = ref(readHistory());
function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value)); } catch { /* Storage can be unavailable. */ }
}
function remember(text, type) {
  history.value = [{ query: text, type }, ...history.value.filter(entry =>
    entry.query.toLowerCase() !== text.toLowerCase() || entry.type !== type
  )].slice(0, 6);
  saveHistory();
}
function clearHistory() { history.value = []; saveHistory(); }
function repeatSearch(entry) {
  query.value = entry.query;
  searchType.value = entry.type;
  return search();
}
function selectType(type) {
  searchType.value = type;
  if (query.value.trim()) return search();
}
const failedRequest = ref(null);
function retry() {
  if (failedRequest.value) return loadResults(...failedRequest.value);
}
const query = ref("");
const searchType = ref("track");

const activeQuery = ref("");
const activeType = ref("track");

const items = ref([]);
const selectedTrack = ref(null);
const searched = ref(false);
const loading = ref(false);
const error = ref("");
const offset = ref(0);
const hasNext = ref(false);

async function loadResults(text, type, pageOffset) {
  if (loading.value || !text.trim()) return;

  loading.value = true;
  error.value = "";
  failedRequest.value = null;

  try {
    const result = await searchSpotify(text, type, pageOffset);

    items.value = result.items;
    activeQuery.value = text;
    activeType.value = type;
    offset.value = pageOffset;
    hasNext.value = result.hasNext && pageOffset < 1000;
    searched.value = true;
    if (pageOffset === 0) remember(text, type);
  } catch (err) {
    error.value = err.message;
    failedRequest.value = [text, type, pageOffset];
  } finally {
    loading.value = false;
  }
}

function search() {
  return loadResults(query.value.trim(), searchType.value, 0);
}

function changePage(direction) {
  return loadResults(
    activeQuery.value,
    activeType.value,
    offset.value + direction * 10
  );
}

function imageUrl(item) {
  const images =
    activeType.value === "track" ? item.album?.images : item.images;

  return images?.[0]?.url || "";
}

function artistNames(item) {
  return (item.artists || []).map((artist) => artist.name).join(", ");
}

function duration(milliseconds) {
  const seconds = Math.floor((milliseconds || 0) / 1000);

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
</script>

<template>
  <div class="music-app">
    <header class="topbar">
      <a href="/" class="brand"><span class="brand-mark" aria-hidden="true">♫</span> Vue Music<span class="brand-dot">.</span></a>
      <span class="subtitle">Propulsé par Spotify</span>
    </header>

    <main class="content">
      <section class="intro">
        <span class="eyebrow">EXPLORER AVEC SPOTIFY</span>
        <h1>Votre prochaine<br /><span>découverte musicale.</span></h1>
        <p>Un titre en tête ? Un artiste à découvrir ? Trouvez votre prochain coup de cœur.</p>
      </section>

      <form class="search-form" @submit.prevent="search">
        <div class="field query-field">
          <label for="query">Votre recherche</label>

          <input
            id="query"
            v-model="query"
            :disabled="loading"
            type="search"
            placeholder="Exemple : Toto, Adele..."
            maxlength="200"
            required
          />
        </div>

        <button :disabled="loading || !query.trim()">
          {{ loading ? "Recherche..." : "Rechercher" }}
        </button>
      </form>

      <div class="type-tabs" role="group" aria-label="Type de recherche">
        <button v-for="(label, type) in types" :key="type" type="button"
          :aria-pressed="searchType === type" :class="{ active: searchType === type }"
          :disabled="loading" @click="selectType(type)">{{ label }}</button>
      </div>

      <section v-if="history.length" class="history" aria-label="Recherches récentes">
        <div class="history-heading"><h2>Recherches récentes</h2>
          <button class="text-button" @click="clearHistory">Tout effacer</button></div>
        <div class="history-chips">
          <button v-for="entry in history" :key="entry.type + entry.query" :disabled="loading"
            class="history-chip" @click="repeatSearch(entry)">
            {{ entry.query }} <span>{{ types[entry.type] }}</span>
          </button>
        </div>
      </section>

      <div v-if="error" class="error" role="alert">
        <p>{{ error }}</p><button class="outline" :disabled="loading" @click="retry">Réessayer</button>
      </div>

      <div v-if="selectedTrack" class="player-container">
        <SpotifyPlayer :track-id="selectedTrack.id" />

        <button class="outline" @click="selectedTrack = null">
          Fermer le lecteur
        </button>
      </div>

      <section class="results" :aria-busy="loading">
        <h2 v-if="searched">
          {{ types[activeType] }} — « {{ activeQuery }} »
        </h2>

        <div v-if="loading" role="status">
          <p class="muted">Chargement des résultats…</p>
          <div class="skeleton" v-for="n in 3" :key="n" aria-hidden="true"></div>
        </div>

        <div v-else-if="!searched && !error" class="empty-state">
          <div class="empty-icon" aria-hidden="true">♫</div>
          <h2>Tout commence par une recherche</h2>
          <p>Explorez les chansons, artistes et albums que vous aimez.</p>
        </div>

        <p v-else-if="items.length === 0" class="muted">
          Aucun résultat trouvé.
        </p>

        <div
          v-if="!loading"
          class="result-list"
          :class="{ 'card-grid': activeType !== 'track' }"
        >
          <article
            v-for="(item, index) in items"
            :key="`${activeType}-${item.id || index}`"
            class="result"
            :class="{
              'track-row': activeType === 'track',
              'entity-card': activeType !== 'track',
              selected:
                activeType === 'track' &&
                selectedTrack?.id === item.id,
            }"
          >
            <img
              v-if="imageUrl(item)"
              :src="imageUrl(item)"
              :alt="item.name"
              class="artwork"
              loading="lazy"
            />

            <div v-else class="artwork placeholder">Sans image</div>

            <div class="details">
              <h3>{{ item.name }}</h3>

              <template v-if="activeType === 'track'">
                <p>{{ artistNames(item) }}</p>
                <p class="small">
                  {{ item.album?.name }} · {{ duration(item.duration_ms) }}
                </p>
              </template>

              <template v-else-if="activeType === 'album'">
                <p>{{ artistNames(item) }}</p>
                <p class="small">
                  {{ item.release_date || "Date non renseignée" }}
                  <span v-if="item.total_tracks != null">
                    · {{ item.total_tracks }} titres
                  </span>
                </p>
              </template>

              <p v-else>Artiste</p>

              <a
                v-if="item.external_urls?.spotify"
                :href="item.external_urls.spotify"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir sur Spotify
              </a>
            </div>

            <button
              v-if="activeType === 'track' && item.id"
              class="player-button"
              :aria-label="`Afficher le lecteur de ${item.name}`"
              :aria-pressed="selectedTrack?.id === item.id"
              @click="selectedTrack = item"
            >
              {{ selectedTrack?.id === item.id ? "Sélectionné" : "Lecteur" }}
            </button>
          </article>
        </div>

        <nav
          v-if="searched && (offset > 0 || hasNext)"
          class="pagination"
          aria-label="Pages de résultats"
        >
          <button
            :disabled="loading || offset === 0"
            @click="changePage(-1)"
          >
            Précédent
          </button>

          <span>Page {{ offset / 10 + 1 }}</span>

          <button
            :disabled="loading || !hasNext"
            @click="changePage(1)"
          >
            Suivant
          </button>
        </nav>
      </section>

      <footer>
        Vue Music · Projet Vue.js <span>Données Spotify · Lecteur officiel Spotify</span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.music-app { min-height:100vh; background:radial-gradient(ellipse at 85% 10%, #19372b60, transparent 42%), #101412; }
.topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px 5%; border-bottom:1px solid #ffffff12; }
.brand { display:flex; align-items:center; gap:10px; color:#f3f6f4; font-size:23px; font-weight:800; text-decoration:none; letter-spacing:-1px; }
.brand-mark { display:grid; place-items:center; width:35px; height:35px; border-radius:10px; background:#b7f59b; color:#142014; font-size:25px; }
.brand-dot { color:#b7f59b; margin-left:-9px; }
.subtitle { color:#a3b2a9; font-size:12px; }
.content { max-width:1120px; margin:auto; padding:55px 28px 24px; }
.intro { margin-bottom:32px; }
.eyebrow { color:#b7f59b; font-size:11px; font-weight:700; letter-spacing:2.5px; }
.intro h1 { margin:20px 0; font-size:clamp(34px,5.5vw,62px); line-height:1.08; letter-spacing:-2px; }
.intro h1 span { color:#b7f59b; }
.intro p,.muted { color:#a3b2a9; line-height:1.7; }
.search-form { display:flex; align-items:flex-end; gap:12px; max-width:850px; }
.field { display:flex; flex-direction:column; gap:10px; }
.query-field { flex:1; min-width:0; }
label { font-size:12px; color:#c2cec6; }
input { width:100%; min-height:54px; padding:15px 20px; border:1px solid #ffffff25; border-radius:14px; background:#1d2620; color:white; font:inherit; }
input:focus { outline:2px solid #b7f59b; outline-offset:2px; }
.type-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0 32px; }
.type-tabs button { padding:10px 21px; background:transparent; color:#b2bfb6; border:1px solid #ffffff25; font-size:13px; }
.type-tabs button.active { background:#b7f59b; border-color:#b7f59b; color:#152412; }
.history { padding:20px 0 25px; border-top:1px solid #ffffff12; border-bottom:1px solid #ffffff12; }
.history-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; }
.history h2 { font-size:13px; margin:0; font-weight:500; color:#bac8bf; }
.text-button { padding:5px 0; background:transparent; color:#b7f59b; font-size:12px; }
.history-chips { display:flex; flex-wrap:wrap; gap:9px; }
.history-chip { padding:10px 13px; background:#1d2620; color:#e8f0eb; font-size:12px; max-width:100%; overflow-wrap:anywhere; text-align:left; }
.history-chip span { color:#99aa9f; margin-left:8px; font-weight:400; }
.outline { background:transparent; color:white; border:1px solid #ffffff45; padding:10px 18px; }
.player-container { max-width:750px; margin:24px auto; }
.results { margin-top:32px; }
.results>h2 { font-size:22px; margin-bottom:22px; }
.empty-state { padding:42px 20px; text-align:center; border:1px dashed #ffffff20; border-radius:20px; background:#ffffff02; }
.empty-icon { display:grid; place-items:center; width:54px; height:54px; margin:auto; background:#243d2b; border-radius:18px; color:#b7f59b; font-size:30px; }
.empty-state h2 { font-size:19px; margin:18px 0 10px; }
.empty-state p { color:#a3b2a9; font-size:14px; line-height:1.6; }
.result-list { display:grid; gap:10px; }
.result { padding:16px; border:1px solid #ffffff08; border-radius:15px; background:#1a221d; transition:background .15s; }
.result:hover { background:#222e26; }
.result.selected { border-color:#b7f59b; }
.track-row { display:grid; grid-template-columns:64px minmax(0,1fr) auto; align-items:center; gap:18px; }
.artwork { display:block; object-fit:contain; }
.track-row .artwork { width:64px; height:64px; }
.placeholder { display:grid; place-items:center; background:#304337; color:#b8c7bd; font-size:11px; }
.details { min-width:0; }
.details h3 { margin:0 0 7px; font-size:16px; overflow-wrap:anywhere; }
.details p { margin:5px 0; color:#a3b2a9; font-size:13px; overflow-wrap:anywhere; }
.details .small,.details a { font-size:12px; }
.details a { display:inline-block; margin-top:7px; color:#b7f59b; text-underline-offset:3px; }
.player-button { padding:10px 15px; font-size:12px; }
.card-grid { grid-template-columns:repeat(auto-fill,minmax(205px,1fr)); }
.entity-card .artwork { width:100%; aspect-ratio:1; margin-bottom:18px; }
.pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:28px; font-size:13px; }
.pagination button { background:#27362c; color:#e2eee5; padding:12px 18px; }
.skeleton { height:96px; margin:10px 0; border-radius:15px; background:linear-gradient(100deg,#1a221d,#293a2f,#1a221d); background-size:200% 100%; animation:shimmer 1.6s infinite; }
@keyframes shimmer { to { background-position:-200% 0; } }
footer { display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:28px 0 8px; margin-top:32px; color:#8b9b91; font-size:11px; border-top:1px solid #ffffff12; }
@media(prefers-reduced-motion:reduce) { .skeleton { animation:none; } }
@media(max-width:600px) {
 .topbar { padding:18px 20px; } .subtitle { max-width:90px; text-align:right; line-height:1.6; }
 .content { padding:34px 20px 20px; } .intro h1 { letter-spacing:-1px; }
 .search-form { align-items:stretch; flex-direction:column; } .search-form button { min-height:48px; }
 .track-row { grid-template-columns:48px minmax(0,1fr); gap:12px; }
 .track-row .artwork { width:48px; height:48px; } .player-button { grid-column:2; justify-self:start; }
 .card-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; } .entity-card { padding:12px; }
 .pagination { gap:10px; } .pagination button { padding:10px 12px; }
}
</style>
