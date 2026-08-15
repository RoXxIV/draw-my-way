<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ActivitySidebar from './components/ActivitySidebar.vue';
import MapView from './components/MapView.vue';
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
  showStatsBadge: true,
  customText: '',
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
  importStravaActivities,
  isCheckingStrava,
  isImporting,
  isLoading,
  loadActivities,
  message,
  messageType,
  removeAllActivities,
  stravaStatus,
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

function readCaptureSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(CAPTURE_SETTINGS_STORAGE_KEY) || 'null');

    return {
      ...DEFAULT_CAPTURE_SETTINGS,
      ...stored,
      statRows: {
        ...DEFAULT_CAPTURE_SETTINGS.statRows,
        ...stored?.statRows,
      },
    };
  } catch {
    return DEFAULT_CAPTURE_SETTINGS;
  }
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
    // The OAuth popup notifies the opener so the user does not need a second import click.
    await refreshStravaStatus();
    await importStravaActivities();
  }
}

onMounted(() => {
  loadActivities().then(resetLocalDataFromUrl);
  window.addEventListener('message', handleOauthMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleOauthMessage);
});
</script>

<template>
  <main class="app-layout" :class="{ 'is-capture-mode': isCaptureMode }">
    <ActivitySidebar
      :activities="activities"
      :capture-settings="captureSettings"
      :capture-stats-position="captureStatsPosition"
      :is-loading="isLoading"
      :is-capture-mode="isCaptureMode"
      :is-checking-strava="isCheckingStrava"
      :is-footprint-mode="isFootprintMode"
      :is-importing="isImporting"
      :map-style-id="mapStyleId"
      :route-color="routeColor"
      :route-opacity="routeOpacity"
      :route-render-mode="routeRenderMode"
      :strava-status="stravaStatus"
      @connect-strava="connectStrava"
      @disconnect-strava="disconnectStravaAccount"
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
        @update-capture-stats-position="updateCaptureStatsPosition"
      />

      <div class="status-panel">
        <div v-if="message" class="status-message" :class="messageType" role="status">
          <span>{{ message }}</span>
          <button type="button" aria-label="Fermer le message" @click="clearMessage">x</button>
        </div>
      </div>
    </div>
  </main>
</template>
