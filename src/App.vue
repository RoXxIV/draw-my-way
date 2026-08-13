<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ActivitySidebar from './components/ActivitySidebar.vue';
import MapView from './components/MapView.vue';
import { DEFAULT_MAP_STYLE_ID, getValidMapStyleId } from './config/map';
import { useActivities } from './composables/useActivities';

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

const routeColor = ref(localStorage.getItem('routeColor') || '#d62828');
const isFootprintMode = ref(localStorage.getItem('isFootprintMode') === '1');
const mapStyleId = ref(getValidMapStyleId(localStorage.getItem('mapStyleId') || DEFAULT_MAP_STYLE_ID));

function updateRouteColor(color) {
  routeColor.value = color;
  localStorage.setItem('routeColor', color);
}

function toggleFootprintMode() {
  isFootprintMode.value = !isFootprintMode.value;
  localStorage.setItem('isFootprintMode', isFootprintMode.value ? '1' : '0');
}

function updateMapStyle(styleId) {
  mapStyleId.value = styleId;
  localStorage.setItem('mapStyleId', styleId);
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
