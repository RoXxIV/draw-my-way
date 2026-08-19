<script setup>
import { computed, ref } from 'vue';
import RouteStylePanel from './RouteStylePanel.vue';
import { CAPTURE_FORMATS, CAPTURE_STATS_POSITIONS } from '../config/capture';
import { getAllTimeStatsRows, STATS_ROW_OPTIONS } from '../services/activityStats';

const CUSTOM_TEXT_MAX_LENGTH = 70;
const CUSTOM_STAT_MAX_LENGTH = 32;

const props = defineProps({
  activities: {
    type: Array,
    required: true,
  },
  captureSettings: {
    type: Object,
    required: true,
  },
  captureStatsPosition: {
    type: String,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isCheckingStrava: {
    type: Boolean,
    default: false,
  },
  isImporting: {
    type: Boolean,
    default: false,
  },
  isSearchingStravaDate: {
    type: Boolean,
    default: false,
  },
  routeColor: {
    type: String,
    required: true,
  },
  routeOpacity: {
    type: Number,
    required: true,
  },
  routeRenderMode: {
    type: String,
    required: true,
  },
  mapStyleId: {
    type: String,
    required: true,
  },
  isFootprintMode: {
    type: Boolean,
    default: false,
  },
  isCaptureMode: {
    type: Boolean,
    default: false,
  },
  stravaStatus: {
    type: Object,
    required: true,
  },
  stravaDateSearch: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  'connect-strava',
  'disconnect-strava',
  'import-gpx',
  'import-strava-date-selection',
  'search-strava-date',
  'toggle-footprint-mode',
  'toggle-capture-mode',
  'update-capture-settings',
  'update-capture-stats-position',
  'update-map-style',
  'update-route-color',
  'update-route-opacity',
  'update-route-render-mode',
]);

const isMenuOpen = ref(false);
const gpxInput = ref(null);
const stravaDate = ref(new Date().toISOString().slice(0, 10));
const selectedStravaActivityIds = ref([]);
const stravaStats = computed(() => getAllTimeStatsRows(props.activities));
const customStats = computed(() => normalizeCustomStats(props.captureSettings.customStats));
const stravaDateActivities = computed(() => props.stravaDateSearch.activities || []);

function updateCaptureSettings(partialSettings) {
  emit('update-capture-settings', {
    ...props.captureSettings,
    ...partialSettings,
  });
}

function updateCaptureStatRow(key) {
  emit('update-capture-settings', {
    ...props.captureSettings,
    statRows: {
      ...props.captureSettings.statRows,
      [key]: !props.captureSettings.statRows[key],
    },
  });
}

function updateCustomText(event) {
  updateCaptureSettings({
    customText: event.target.value.slice(0, CUSTOM_TEXT_MAX_LENGTH),
  });
}

function updateCustomStat(index, field, event) {
  const nextCustomStats = customStats.value.map((row) => ({ ...row }));
  nextCustomStats[index][field] = event.target.value.slice(0, CUSTOM_STAT_MAX_LENGTH);
  updateCaptureSettings({ customStats: nextCustomStats });
}

function updateCaptureFormat(format) {
  updateCaptureSettings({ format });
}

function openGpxImport() {
  gpxInput.value?.click();
}

function importGpx(event) {
  const file = event.target.files?.[0];

  if (file) {
    emit('import-gpx', file);
  }

  event.target.value = '';
}

function searchStravaDate() {
  selectedStravaActivityIds.value = [];
  emit('search-strava-date', stravaDate.value);
}

function toggleStravaDateActivity(activityId) {
  const id = String(activityId);

  if (selectedStravaActivityIds.value.includes(id)) {
    selectedStravaActivityIds.value = selectedStravaActivityIds.value.filter((selectedId) => selectedId !== id);
    return;
  }

  selectedStravaActivityIds.value = [...selectedStravaActivityIds.value, id];
}

function selectAllStravaDateActivities() {
  selectedStravaActivityIds.value = stravaDateActivities.value
    .filter((activity) => activity.hasMap)
    .map((activity) => String(activity.id));
}

function importStravaDateSelection() {
  emit('import-strava-date-selection', selectedStravaActivityIds.value);
}

function normalizeCustomStats(stats) {
  const rows = Array.isArray(stats) ? stats : [];

  return [0, 1].map((index) => ({
    value: String(rows[index]?.value || '').slice(0, CUSTOM_STAT_MAX_LENGTH),
    label: String(rows[index]?.label || '').slice(0, CUSTOM_STAT_MAX_LENGTH),
  }));
}

function formatActivityDistance(activity) {
  return `${(Number(activity.distanceMeters || 0) / 1000).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} km`;
}

function formatActivityTime(activity) {
  const date = new Date(activity.startDateLocal || activity.startDate);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

</script>

<template>
  <button
    class="mobile-menu-toggle"
    :class="{ 'is-hidden': isMenuOpen }"
    type="button"
    :aria-expanded="isMenuOpen"
    aria-label="Ouvrir le menu"
    @click="isMenuOpen = true"
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="2"
      />
    </svg>
  </button>

  <aside class="stats-card" :class="{ 'is-mobile-open': isMenuOpen }">
    <div class="stats-card-content">
      <header class="stats-card-header">
        <div>
          <h1>DrawMyWay</h1>
          <p>La carte de tous vos chemins</p>
        </div>
        <button
          class="mobile-menu-close"
          type="button"
          aria-label="Fermer le menu"
          @click="isMenuOpen = false"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="2"
            />
          </svg>
        </button>
      </header>

      <p v-if="isLoading" class="muted">Chargement des activités...</p>
      <p v-else-if="!stravaStats" class="empty-state">Ajoute un GPX ou connecte Strava pour afficher tes statistiques.</p>

      <section v-else-if="!isCaptureMode" class="stats-panel">
        <h2>Toutes les activités</h2>
        <div class="stats-metrics">
          <article v-for="row in stravaStats" :key="row.key" class="stats-metric">
            <strong>{{ row.value }}</strong>
            <span>{{ row.label }}</span>
          </article>
        </div>
      </section>

      <section v-if="isCaptureMode" class="photo-settings">
        <p class="photo-settings-title">Créer un visuel</p>

        <div class="photo-format-control" role="group" aria-label="Format de l'image">
          <span>Format</span>
          <div class="photo-format-options">
            <button
              v-for="format in CAPTURE_FORMATS"
              :key="format.id"
              class="photo-format-button"
              :class="{ 'is-selected': captureSettings.format === format.id }"
              type="button"
              :title="format.resolution"
              @click="updateCaptureFormat(format.id)"
            >
              <span>{{ format.label }}</span>
              <small>{{ format.resolution }}</small>
            </button>
          </div>
        </div>

        <div class="photo-stat-lines">
          <label v-for="row in STATS_ROW_OPTIONS" :key="row.key" class="photo-toggle">
            <input
              type="checkbox"
              :checked="captureSettings.statRows[row.key]"
              @change="updateCaptureStatRow(row.key)"
            />
            <span>{{ row.label }}</span>
          </label>
        </div>

        <label class="photo-text-field">
          <span>Texte perso</span>
          <input
            type="text"
            :maxlength="CUSTOM_TEXT_MAX_LENGTH"
            :value="captureSettings.customText"
            placeholder="Ex : Beaujolais 2026"
            @input="updateCustomText"
          />
        </label>
        <p class="photo-text-count">{{ captureSettings.customText.length }}/{{ CUSTOM_TEXT_MAX_LENGTH }}</p>

        <div class="photo-custom-stats">
          <span>Stats personnalisées</span>
          <div
            v-for="(stat, index) in customStats"
            :key="index"
            class="photo-custom-stat-row"
          >
            <input
              type="text"
              :maxlength="CUSTOM_STAT_MAX_LENGTH"
              :value="stat.value"
              placeholder="Ex : 1 470 km"
              aria-label="Valeur personnalisée"
              @input="updateCustomStat(index, 'value', $event)"
            />
            <input
              type="text"
              :maxlength="CUSTOM_STAT_MAX_LENGTH"
              :value="stat.label"
              placeholder="Ex : distance"
              aria-label="Libellé personnalisé"
              @input="updateCustomStat(index, 'label', $event)"
            />
          </div>
        </div>

        <div class="photo-placement" role="group" aria-label="Placement des informations">
          <span>Placement des informations</span>
          <div class="photo-placement-grid">
            <button
              v-for="position in CAPTURE_STATS_POSITIONS"
              :key="position.id"
              class="photo-placement-button"
              :class="{ 'is-selected': captureStatsPosition === position.id }"
              type="button"
              :aria-label="position.label"
              :aria-pressed="captureStatsPosition === position.id"
              :title="position.label"
              @click="emit('update-capture-stats-position', position.id)"
            ></button>
          </div>
        </div>
      </section>

      <section v-if="!isCaptureMode" class="source-import-panel">
        <p class="source-import-title">Ajouter des traces</p>
        <input
          ref="gpxInput"
          class="visually-hidden"
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          @change="importGpx"
        />
        <button
          class="gpx-import-button"
          type="button"
          :disabled="isImporting"
          @click="openGpxImport"
        >
          Importer un GPX
        </button>

        <section v-if="stravaStatus.connected" class="strava-date-import">
          <p class="strava-date-title">Composer par date</p>
          <div class="strava-date-search">
            <input
              v-model="stravaDate"
              type="date"
              aria-label="Date des activités Strava"
            />
            <button
              type="button"
              :disabled="isSearchingStravaDate"
              @click="searchStravaDate"
            >
              {{ isSearchingStravaDate ? 'Recherche...' : 'Chercher' }}
            </button>
          </div>

          <div v-if="stravaDateActivities.length > 0" class="strava-date-results">
            <div class="strava-date-results-header">
              <span>{{ stravaDateActivities.length }} activité(s)</span>
              <button type="button" @click="selectAllStravaDateActivities">Tout cocher</button>
            </div>
            <label
              v-for="activity in stravaDateActivities"
              :key="activity.id"
              class="strava-date-activity"
              :class="{ 'is-disabled': !activity.hasMap }"
            >
              <input
                type="checkbox"
                :checked="selectedStravaActivityIds.includes(String(activity.id))"
                :disabled="!activity.hasMap"
                @change="toggleStravaDateActivity(activity.id)"
              />
              <span>
                <strong>{{ activity.name }}</strong>
                <small>{{ formatActivityTime(activity) }} · {{ formatActivityDistance(activity) }} · {{ activity.sportType || activity.type }}</small>
              </span>
            </label>
            <button
              class="strava-date-import-button"
              type="button"
              :disabled="isImporting || selectedStravaActivityIds.length === 0"
              @click="importStravaDateSelection"
            >
              Importer la sélection
            </button>
          </div>
        </section>
      </section>

      <RouteStylePanel
        :is-capture-mode="isCaptureMode"
        :is-footprint-mode="isFootprintMode"
        :map-style-id="mapStyleId"
        :model-value="routeColor"
        :route-opacity="routeOpacity"
        :route-render-mode="routeRenderMode"
        @toggle-capture-mode="emit('toggle-capture-mode')"
        @toggle-footprint-mode="emit('toggle-footprint-mode')"
        @update-map-style="emit('update-map-style', $event)"
        @update:model-value="emit('update-route-color', $event)"
        @update-route-opacity="emit('update-route-opacity', $event)"
        @update-route-render-mode="emit('update-route-render-mode', $event)"
      />

      <footer class="strava-account">
        <template v-if="stravaStatus.connected">
          <p v-if="stravaStatus.athlete" class="account-status">
            Synchronisé avec Strava · {{ stravaStatus.athlete.firstname }} {{ stravaStatus.athlete.lastname }}
          </p>
          <p v-else class="account-status">Synchronisé avec Strava</p>
          <button
            class="disconnect-button"
            type="button"
            :disabled="isImporting"
            @click="emit('disconnect-strava')"
          >
            Déconnecter Strava
          </button>
        </template>

        <button
          v-else
          class="strava-button"
          type="button"
          :disabled="isCheckingStrava"
          @click="emit('connect-strava')"
        >
          {{ isCheckingStrava ? 'Vérification...' : 'Connecter Strava' }}
        </button>
      </footer>
    </div>
  </aside>
</template>


<style lang="scss">
.mobile-menu-toggle,
.mobile-menu-close {
  display: none;
}

.stats-card {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 20;
  width: min(320px, calc(100vw - 36px));
  max-height: calc(100dvh - 36px);
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 45px rgba(31, 41, 51, 0.2);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
}

.stats-card-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-height: calc(100dvh - 36px);
  padding: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #aab1b8 transparent;
}

.stats-card-content::-webkit-scrollbar {
  width: 8px;
}

.stats-card-content::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(127, 140, 153, 0.48);
  background-clip: content-box;
}

.stats-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(127, 140, 153, 0.35);
  padding-bottom: 14px;
}

.stats-card-header h1::after {
  display: block;
  width: 64px;
  height: 3px;
  margin-top: 7px;
  border-radius: 999px;
  background: $brand;
  content: "";
}

.stats-card-header p {
  margin: 9px 0 0;
  color: $slate-soft;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.25;
}

.eyebrow {
  margin: 0 0 4px;
  color: $slate-soft;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.muted,
.empty-state {
  margin: 0;
  color: #5f6f7c;
  font-size: 0.88rem;
  line-height: 1.35;
}

.strava-button {
  width: 100%;
  padding: 11px 14px;
  background: $strava;
  color: #ffffff;
  font-weight: 800;
}

.disconnect-button {
  width: auto;
  margin-top: 8px;
  padding: 0;
  background: transparent;
  color: $slate-soft;
  font-size: 0.78rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stats-panel {
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(127, 140, 153, 0.35);
  background: transparent;
}

.photo-settings {
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(127, 140, 153, 0.35);
  padding-bottom: 14px;
}

.photo-settings-title {
  margin: 0 0 10px;
  color: $ink;
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.photo-format-control {
  display: grid;
  gap: 7px;
  margin-bottom: 12px;
  color: $ink;
  font-size: 0.82rem;
  font-weight: 800;
}

.photo-format-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.photo-format-button {
  display: grid;
  min-height: 42px;
  place-items: center;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.96);
  color: $ink;
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1.15;
}

.photo-format-button small {
  color: $slate-soft;
  font-size: 0.64rem;
  font-weight: 750;
}

.photo-format-button.is-selected {
  background: $ink;
  color: #ffffff;
}

.photo-format-button.is-selected small {
  color: rgba(255, 255, 255, 0.74);
}

.photo-toggle {
  display: flex;
  min-height: 26px;
  align-items: center;
  gap: 9px;
  color: $ink;
  font-size: 0.82rem;
  font-weight: 750;
}

.photo-toggle input {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  accent-color: $ink;
}

.photo-stat-lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
  margin-top: 10px;
}

.photo-text-field {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  color: $ink;
  font-size: 0.82rem;
  font-weight: 750;
}

.photo-text-field input {
  width: 100%;
  min-height: 36px;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
  color: $ink;
  font: inherit;
  font-weight: 650;
}

.photo-text-count {
  margin: 5px 0 0;
  color: $slate-soft;
  font-size: 0.72rem;
  font-weight: 700;
  text-align: right;
}

.photo-custom-stats {
  display: grid;
  gap: 7px;
  margin-top: 10px;
  color: $ink;
  font-size: 0.82rem;
  font-weight: 750;
}

.photo-custom-stat-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}

.photo-custom-stat-row input {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 7px 8px;
  background: #ffffff;
  color: $ink;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
}

.photo-placement {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.photo-placement span {
  color: $ink;
  font-size: 0.82rem;
  font-weight: 850;
}

.photo-placement-grid {
  display: grid;
  grid-template-columns: repeat(3, 18px);
  gap: 8px;
}

.photo-placement-button {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(252, 76, 2, 0.68);
  border-radius: 3px;
  background: rgba(255, 221, 132, 0.68);
}

.photo-placement-button.is-selected {
  background: $strava;
  box-shadow:
    0 0 0 2px #ffffff,
    0 0 0 4px rgba(252, 76, 2, 0.38);
}

.source-import-panel {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(127, 140, 153, 0.35);
  padding-bottom: 14px;
}

.source-import-title {
  margin: 0;
  color: $ink;
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.strava-account {
  margin-top: 2px;
}

.strava-date-import {
  display: grid;
  gap: 8px;
  border-top: 1px solid rgba(127, 140, 153, 0.22);
  padding-top: 10px;
}

.strava-date-title {
  margin: 0;
  color: $ink;
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.strava-date-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px;
}

.strava-date-search input {
  min-width: 0;
  min-height: 36px;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 7px 8px;
  background: #ffffff;
  color: $ink;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;
}

.strava-date-search button,
.strava-date-results-header button {
  min-height: 36px;
  padding: 7px 9px;
  background: $ink;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 850;
}

.strava-date-results {
  display: grid;
  gap: 7px;
}

.strava-date-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: $slate-soft;
  font-size: 0.74rem;
  font-weight: 800;
}

.strava-date-results-header button {
  min-height: 28px;
  border: 1px solid $border-soft;
  background: rgba(255, 255, 255, 0.9);
  color: $ink;
  font-size: 0.72rem;
}

.strava-date-activity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  border: 1px solid rgba(127, 140, 153, 0.18);
  border-radius: 6px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: $ink;
}

.strava-date-activity.is-disabled {
  opacity: 0.5;
}

.strava-date-activity input {
  margin-top: 2px;
  accent-color: $ink;
}

.strava-date-activity strong,
.strava-date-activity small {
  display: block;
  min-width: 0;
}

.strava-date-activity strong {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strava-date-activity small {
  margin-top: 3px;
  color: $slate-soft;
  font-size: 0.7rem;
  font-weight: 700;
}

.strava-date-import-button {
  width: 100%;
  min-height: 36px;
  background: $brand;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 850;
}

.gpx-import-button {
  width: 100%;
  min-height: 38px;
  border: 1px solid $border-soft;
  background: rgba(255, 255, 255, 0.9);
  color: $ink;
  font-size: 0.82rem;
  font-weight: 850;
}

.account-status {
  margin: 0;
  color: $slate;
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.35;
}

.stats-panel h2 {
  margin: 0;
  padding: 10px 0 4px;
  background: transparent;
  color: $ink-deep;
  font-size: 0.95rem;
  line-height: 1.2;
}

.stats-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 18px;
  padding: 8px 0 4px;
}

.stats-metric {
  min-width: 0;
}

.stats-metric strong,
.stats-metric span {
  display: block;
}

.stats-metric strong {
  overflow-wrap: anywhere;
  color: $ink-deep;
  font-size: 1.16rem;
  font-weight: 850;
  line-height: 1.05;
}

.stats-metric span {
  margin-top: 5px;
  color: $slate-soft;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.04em;
  line-height: 1.1;
  text-transform: uppercase;
}

@media (max-width: 760px) {
  .mobile-menu-toggle {
    position: fixed;
    top: max(10px, env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
    z-index: 30;
    display: grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.62);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.94);
    color: $ink;
    box-shadow: 0 12px 30px rgba(31, 41, 51, 0.2);
    backdrop-filter: blur(12px) saturate(145%);
    -webkit-backdrop-filter: blur(12px) saturate(145%);
  }

  .mobile-menu-toggle.is-hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-6px);
  }

  .stats-card {
    top: max(10px, env(safe-area-inset-top));
    right: max(10px, env(safe-area-inset-right));
    left: max(10px, env(safe-area-inset-left));
    width: auto;
    max-height: min(62dvh, 520px);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease,
      visibility 0.18s ease;
    visibility: hidden;
  }

  .app-layout.is-capture-mode .stats-card,
  .app-layout.is-capture-mode .stats-card-content {
    max-height: calc(100dvh - 20px);
  }

  .stats-card.is-mobile-open {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
    visibility: visible;
  }

  .stats-card-content {
    max-height: min(62dvh, 520px);
    padding: 12px;
  }

  .stats-card-header {
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 10px;
  }

  .mobile-menu-close {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    place-items: center;
    background: #ffffff;
    color: $ink;
  }

  .eyebrow {
    font-size: 0.68rem;
  }

  h1 {
    font-size: 1.36rem;
  }

  .muted,
  .empty-state {
    font-size: 0.82rem;
  }

  .stats-panel {
    margin-bottom: 10px;
  }

  .photo-settings {
    margin-bottom: 10px;
    padding-bottom: 10px;
  }

  .photo-settings-title {
    margin-bottom: 8px;
    font-size: 0.8rem;
  }

  .photo-format-control {
    margin-bottom: 10px;
    font-size: 0.78rem;
  }

  .photo-format-button {
    min-height: 38px;
    padding: 5px 6px;
    font-size: 0.74rem;
  }

  .photo-format-button small {
    font-size: 0.58rem;
  }

  .photo-toggle {
    min-height: 24px;
    font-size: 0.78rem;
  }

  .photo-text-field {
    margin-top: 8px;
    font-size: 0.78rem;
  }

  .photo-custom-stats {
    margin-top: 8px;
    font-size: 0.78rem;
  }

  .photo-custom-stat-row input {
    min-height: 32px;
    font-size: 0.74rem;
  }

  .stats-panel h2 {
    padding: 8px 0;
    font-size: 0.86rem;
  }

  .stats-metrics {
    gap: 12px 14px;
    padding-top: 6px;
  }

  .stats-metric strong {
    font-size: 1rem;
  }

  .stats-metric span {
    font-size: 0.62rem;
  }

  .account-status {
    font-size: 0.8rem;
  }

  .strava-button,
  .disconnect-button {
    min-height: 38px;
    padding: 8px 10px;
    font-size: 0.84rem;
  }

  .disconnect-button {
    min-height: 0;
    padding: 0;
    font-size: 0.76rem;
  }
}

@media (max-width: 380px) {
  .stats-card {
    max-height: min(68dvh, 540px);
  }

  .stats-card-content {
    max-height: min(68dvh, 540px);
  }
}

@media (max-width: 760px) and (max-height: 640px) {
  .stats-card,
  .stats-card-content {
    max-height: calc(100dvh - 20px);
  }
}
</style>
