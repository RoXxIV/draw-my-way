<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ActivitySidebar from './components/ActivitySidebar.vue';
import MapView from './components/MapView.vue';
import { DEFAULT_MAP_STYLE_ID, getValidMapStyleId } from './config/map';
import { useActivities } from './composables/useActivities';

const ROUTE_COLOR_STORAGE_KEY = 'routeColor';
const FOOTPRINT_MODE_STORAGE_KEY = 'isFootprintMode';
const MAP_STYLE_STORAGE_KEY = 'mapStyleId';
const DEFAULT_ROUTE_COLOR = '#d62828';

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
const isFootprintMode = ref(localStorage.getItem(FOOTPRINT_MODE_STORAGE_KEY) === '1');
const mapStyleId = ref(getValidMapStyleId(localStorage.getItem(MAP_STYLE_STORAGE_KEY) || DEFAULT_MAP_STYLE_ID));

function updateRouteColor(color) {
  routeColor.value = color;
  localStorage.setItem(ROUTE_COLOR_STORAGE_KEY, color);
}

function toggleFootprintMode() {
  isFootprintMode.value = !isFootprintMode.value;
  localStorage.setItem(FOOTPRINT_MODE_STORAGE_KEY, isFootprintMode.value ? '1' : '0');
}

function updateMapStyle(styleId) {
  mapStyleId.value = styleId;
  localStorage.setItem(MAP_STYLE_STORAGE_KEY, styleId);
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
  <main class="app-layout">
    <ActivitySidebar
      :activities="activities"
      :is-loading="isLoading"
      :is-checking-strava="isCheckingStrava"
      :is-footprint-mode="isFootprintMode"
      :is-importing="isImporting"
      :map-style-id="mapStyleId"
      :route-color="routeColor"
      :strava-status="stravaStatus"
      @connect-strava="connectStrava"
      @disconnect-strava="disconnectStravaAccount"
      @toggle-footprint-mode="toggleFootprintMode"
      @update-map-style="updateMapStyle"
      @update-route-color="updateRouteColor"
    />

    <div class="workspace">
      <MapView
        :activities="activities"
        :is-footprint-mode="isFootprintMode"
        :map-style-id="mapStyleId"
        :route-color="routeColor"
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
