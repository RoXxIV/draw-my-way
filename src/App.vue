<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ActivitySidebar from './components/ActivitySidebar.vue';
import HomeView from './views/HomeView.vue';
import LegalView from './views/LegalView.vue';
import MapView from './views/MapView.vue';
import { CAPTURE_STATS_POSITION_STORAGE_KEY, DEFAULT_CAPTURE_FORMAT, DEFAULT_CAPTURE_STATS_POSITION } from './config/capture';
import { DEFAULT_MAP_STYLE_ID, getValidMapStyleId } from './config/map';
import { useActivities } from './composables/useActivities';

const ROUTE_COLOR_STORAGE_KEY = 'routeColor';
const ROUTE_RENDER_MODE_STORAGE_KEY = 'routeRenderMode';
const ROUTE_OPACITY_STORAGE_KEY = 'routeOpacity';
const FOOTPRINT_MODE_STORAGE_KEY = 'isFootprintMode';
const MAP_STYLE_STORAGE_KEY = 'mapStyleId';
const CAPTURE_SETTINGS_STORAGE_KEY = 'captureSettings';
const DEFAULT_ROUTE_COLOR = '#d62828';
const DEFAULT_ROUTE_RENDER_MODE = 'solid';
const DEFAULT_ROUTE_OPACITY = 0.95;
const DEFAULT_CAPTURE_SETTINGS = {
  format: DEFAULT_CAPTURE_FORMAT,
  customText: '',
  customStats: [
    { value: '', label: '' },
    { value: '', label: '' },
  ],
  statRows: {
    activityCount: true,
    distance: true,
    movingTime: true,
    elevationGain: true,
  },
};

const {
  activities,
  clearMessage,
  connectStrava,
  disconnectStravaAccount,
  importGpxFile,
  importStravaActivities,
  importStravaDateSelection,
  isCheckingStrava,
  isImporting,
  isLoading,
  isSearchingStravaDate,
  loadActivities,
  message,
  messageType,
  removeAllActivities,
  searchStravaActivitiesByDate,
  stravaStatus,
  stravaDateSearch,
  refreshStravaStatus,
} = useActivities();

const routeColor = ref(localStorage.getItem(ROUTE_COLOR_STORAGE_KEY) || DEFAULT_ROUTE_COLOR);
const routeRenderMode = ref(localStorage.getItem(ROUTE_RENDER_MODE_STORAGE_KEY) || DEFAULT_ROUTE_RENDER_MODE);
const routeOpacity = ref(readRouteOpacity());
const isFootprintMode = ref(localStorage.getItem(FOOTPRINT_MODE_STORAGE_KEY) === '1');
const isCaptureMode = ref(false);
const mapStyleId = ref(getValidMapStyleId(localStorage.getItem(MAP_STYLE_STORAGE_KEY) || DEFAULT_MAP_STYLE_ID));
const captureSettings = ref(readCaptureSettings());
const captureStatsPosition = ref(localStorage.getItem(CAPTURE_STATS_POSITION_STORAGE_KEY) || DEFAULT_CAPTURE_STATS_POSITION);
const currentHash = ref(window.location.hash);
const isImportChoiceOpen = ref(false);
const legalPageIds = new Set(['mentions-legales', 'confidentialite', 'conditions']);
const isExplorerOpen = computed(() => currentHash.value === '#carte');
const activeLegalPage = computed(() => {
  const pageId = currentHash.value.replace(/^#/, '');

  return legalPageIds.has(pageId) ? pageId : '';
});

function updateRouteColor(color) {
  routeColor.value = color;
  localStorage.setItem(ROUTE_COLOR_STORAGE_KEY, color);
}

function updateRouteRenderMode(mode) {
  routeRenderMode.value = mode;
  localStorage.setItem(ROUTE_RENDER_MODE_STORAGE_KEY, mode);
}

function updateRouteOpacity(opacity) {
  routeOpacity.value = opacity;
  localStorage.setItem(ROUTE_OPACITY_STORAGE_KEY, String(opacity));
}

function toggleFootprintMode() {
  isFootprintMode.value = !isFootprintMode.value;
  localStorage.setItem(FOOTPRINT_MODE_STORAGE_KEY, isFootprintMode.value ? '1' : '0');
}

function toggleCaptureMode() {
  isCaptureMode.value = !isCaptureMode.value;
}

function closeCaptureMode() {
  isCaptureMode.value = false;
}

function chooseComposeMode() {
  isImportChoiceOpen.value = false;
}

async function chooseFullImport() {
  isImportChoiceOpen.value = false;
  await importStravaActivities();
}

async function handleDisconnectStrava() {
  isImportChoiceOpen.value = false;
  await disconnectStravaAccount();
}

function updateMapStyle(styleId) {
  mapStyleId.value = styleId;
  localStorage.setItem(MAP_STYLE_STORAGE_KEY, styleId);
}

function updateCaptureSettings(settings) {
  captureSettings.value = settings;
  localStorage.setItem(CAPTURE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function updateCaptureStatsPosition(position) {
  captureStatsPosition.value = position;
  localStorage.setItem(CAPTURE_STATS_POSITION_STORAGE_KEY, position);
}

function openExplorer() {
  if (window.location.hash !== '#carte') {
    window.history.pushState({}, '', '#carte');
  }

  currentHash.value = '#carte';
}

function syncViewFromHash() {
  currentHash.value = window.location.hash;
}

function readCaptureSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(CAPTURE_SETTINGS_STORAGE_KEY) || 'null');
    const storedSettings = { ...(stored || {}) };
    delete storedSettings.showStatsBadge;

    return {
      ...DEFAULT_CAPTURE_SETTINGS,
      ...storedSettings,
      customStats: normalizeCustomStats(storedSettings.customStats),
      statRows: {
        ...DEFAULT_CAPTURE_SETTINGS.statRows,
        ...stored?.statRows,
      },
    };
  } catch {
    return DEFAULT_CAPTURE_SETTINGS;
  }
}

function normalizeCustomStats(customStats) {
  const rows = Array.isArray(customStats) ? customStats : [];

  return DEFAULT_CAPTURE_SETTINGS.customStats.map((defaultRow, index) => ({
    value: String(rows[index]?.value || defaultRow.value).slice(0, 32),
    label: String(rows[index]?.label || defaultRow.label).slice(0, 32),
  }));
}

function readRouteOpacity() {
  const storedOpacity = Number(localStorage.getItem(ROUTE_OPACITY_STORAGE_KEY));

  if (!Number.isFinite(storedOpacity)) {
    return DEFAULT_ROUTE_OPACITY;
  }

  return Math.min(Math.max(storedOpacity, 0), 1);
}

async function resetLocalDataFromUrl() {
  const url = new URL(window.location.href);

  if (url.searchParams.get('resetLocalData') !== '1') {
    return;
  }

  await removeAllActivities();
  url.searchParams.delete('resetLocalData');
  window.history.replaceState({}, '', url);
}

async function handleOauthMessage(event) {
  if (event.origin === window.location.origin && event.data?.type === 'strava-oauth-complete') {
    await refreshStravaStatus();
    isImportChoiceOpen.value = true;
  }
}

onMounted(() => {
  loadActivities().then(resetLocalDataFromUrl);
  window.addEventListener('hashchange', syncViewFromHash);
  window.addEventListener('message', handleOauthMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncViewFromHash);
  window.removeEventListener('message', handleOauthMessage);
});
</script>

<template>
  <HomeView
    v-if="!isExplorerOpen && !activeLegalPage"
    @open-app="openExplorer"
  />

  <LegalView v-else-if="activeLegalPage" :page-id="activeLegalPage" />

  <main v-else class="app-layout" :class="{ 'is-capture-mode': isCaptureMode }">
    <ActivitySidebar
      :activities="activities"
      :capture-settings="captureSettings"
      :capture-stats-position="captureStatsPosition"
      :is-loading="isLoading"
      :is-capture-mode="isCaptureMode"
      :is-checking-strava="isCheckingStrava"
      :is-footprint-mode="isFootprintMode"
      :is-importing="isImporting"
      :is-searching-strava-date="isSearchingStravaDate"
      :map-style-id="mapStyleId"
      :route-color="routeColor"
      :route-opacity="routeOpacity"
      :route-render-mode="routeRenderMode"
      :strava-date-search="stravaDateSearch"
      :strava-status="stravaStatus"
      @connect-strava="connectStrava"
      @disconnect-strava="handleDisconnectStrava"
      @import-gpx="importGpxFile"
      @import-strava-date-selection="importStravaDateSelection"
      @search-strava-date="searchStravaActivitiesByDate"
      @toggle-capture-mode="toggleCaptureMode"
      @toggle-footprint-mode="toggleFootprintMode"
      @update-capture-settings="updateCaptureSettings"
      @update-capture-stats-position="updateCaptureStatsPosition"
      @update-map-style="updateMapStyle"
      @update-route-color="updateRouteColor"
      @update-route-opacity="updateRouteOpacity"
      @update-route-render-mode="updateRouteRenderMode"
    />

    <div class="workspace">
      <MapView
        :activities="activities"
        :capture-settings="captureSettings"
        :capture-stats-position="captureStatsPosition"
        :is-capture-mode="isCaptureMode"
        :is-footprint-mode="isFootprintMode"
        :map-style-id="mapStyleId"
        :route-color="routeColor"
        :route-opacity="routeOpacity"
        :route-render-mode="routeRenderMode"
        @close-capture-mode="closeCaptureMode"
        @update-capture-stats-position="updateCaptureStatsPosition"
      />

      <div class="status-panel">
        <div v-if="message" class="status-message" :class="messageType" role="status">
          <span>{{ message }}</span>
          <button type="button" aria-label="Fermer le message" @click="clearMessage">x</button>
        </div>
      </div>
    </div>

    <div
      v-if="isImportChoiceOpen"
      class="strava-import-choice"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strava-import-choice-title"
    >
      <div class="strava-import-choice-card">
        <p class="home-eyebrow">Strava connecté</p>
        <h2 id="strava-import-choice-title">Comment veux-tu commencer ?</h2>
        <p>
          Compose une carte légère en choisissant des activités par date, ou importe tout ton historique pour générer la carte complète.
        </p>
        <div class="strava-import-choice-actions">
          <button type="button" class="choice-primary" @click="chooseComposeMode">
            Composer par date
          </button>
          <button type="button" class="choice-secondary" :disabled="isImporting" @click="chooseFullImport">
            Tout importer
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style lang="scss">
.app-layout {
  position: relative;
  height: 100dvh;
  overflow: hidden;
}

.workspace {
  position: relative;
  min-width: 0;
  background: #dbe4ea;
  height: 100%;
}

.status-panel {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 30;
  display: flex;
  width: min(340px, calc(100% - 36px));
  flex-direction: column;
  gap: 10px;
}

.strava-import-choice {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 16, 24, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.strava-import-choice-card {
  width: min(430px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 8px;
  padding: 22px;
  background: rgba(255, 255, 255, 0.96);
  color: $ink;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}

.strava-import-choice-card h2 {
  margin: 0;
  color: $ink-deep;
  font-size: 1.4rem;
  line-height: 1.12;
}

.strava-import-choice-card > p:not(.home-eyebrow) {
  margin: 12px 0 0;
  color: $slate;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.45;
}

.strava-import-choice-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.choice-primary,
.choice-secondary {
  min-height: 42px;
  padding: 10px 12px;
  font-size: 0.86rem;
  font-weight: 850;
}

.choice-primary {
  background: $brand;
  color: #ffffff;
  box-shadow: 0 14px 34px rgba(252, 76, 2, 0.22);
}

.choice-secondary {
  border: 1px solid $border-soft;
  background: #ffffff;
  color: $ink;
}

.status-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 8px;
  padding: 10px 10px 10px 13px;
  background: #ffffff;
  color: #22313d;
  box-shadow: 0 12px 28px rgba(31, 41, 51, 0.16);
}

.status-message.success {
  border-left: 5px solid #2a9d8f;
}

.status-message.error {
  border-left: 5px solid #d62828;
}

.status-message.info {
  border-left: 5px solid #0077b6;
}

.status-message button {
  width: 28px;
  height: 28px;
  background: #e8eef3;
  color: #23303b;
  font-weight: 800;
}

@media (max-width: 760px) {
  .status-panel {
    right: max(10px, env(safe-area-inset-right));
    bottom: max(10px, env(safe-area-inset-bottom));
    left: max(10px, env(safe-area-inset-left));
    width: auto;
  }

  .status-message {
    padding: 9px 9px 9px 12px;
    font-size: 0.82rem;
  }

  .strava-import-choice-actions {
    grid-template-columns: 1fr;
  }
}
</style>
