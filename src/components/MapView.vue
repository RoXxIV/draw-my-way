<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import { bbox } from '@turf/bbox';
import { FRANCE_CENTER, FRANCE_ZOOM, getMapStyleUrl, isThreeDimensionalStyle } from '../config/map';

const props = defineProps({
  activities: {
    type: Array,
    required: true,
  },
  routeColor: {
    type: String,
    default: '#d62828',
  },
  isFootprintMode: {
    type: Boolean,
    default: false,
  },
  mapStyleId: {
    type: String,
    required: true,
  },
});

const mapContainer = ref(null);
const mapLoaded = ref(false);
const isStyleLoading = ref(false);
let map = null;
let lastFitFeatureCount = 0;

const visibleFeatureCollection = computed(() => ({
  type: 'FeatureCollection',
  features: props.activities
    .filter((activity) => activity.visible !== false)
    .map((activity, index) => ({
      type: 'Feature',
      properties: {
        id: activity.id,
        name: activity.name,
        color: props.routeColor,
      },
      geometry: activity.geometry,
    })),
}));

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: getMapStyleUrl(props.mapStyleId),
    center: FRANCE_CENTER,
    zoom: FRANCE_ZOOM,
    minZoom: getMinimumZoom(),
    renderWorldCopies: false,
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

  map.on('load', () => {
    mapLoaded.value = true;
    applyFootprintMode();
    applyCameraMode();
    syncRoutes();
    fitToRoutesIfNeeded();
  });
});

onBeforeUnmount(() => {
  map?.remove();
});

watch(
  visibleFeatureCollection,
  () => {
    syncRoutes();
    fitToRoutesIfNeeded();
  },
  { deep: true },
);

watch(
  () => props.isFootprintMode,
  () => {
    if (!map || !mapLoaded.value) {
      return;
    }

    if (props.isFootprintMode) {
      applyFootprintMode();
      return;
    }

    reloadCurrentStyle();
  },
);

watch(
  () => props.mapStyleId,
  (styleId) => {
    if (!map || !mapLoaded.value) {
      return;
    }

    reloadCurrentStyle(styleId);
  },
);

function syncRoutes() {
  if (!map || !mapLoaded.value) {
    return;
  }

  const data = visibleFeatureCollection.value;
  const source = map.getSource('activities');

  if (source) {
    source.setData(data);
    return;
  }

  map.addSource('activities', {
    type: 'geojson',
    data,
  });

  map.addLayer({
    id: 'activity-lines',
    type: 'line',
    source: 'activities',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 3,
      'line-opacity': 0.95,
    },
  });
}

function getMinimumZoom() {
  return window.matchMedia('(max-width: 760px)').matches ? 1.75 : 1.35;
}

function applyFootprintMode() {
  if (!map || !mapLoaded.value) {
    return;
  }

  const keepVisible = new Set([
    'background',
    'water',
    'boundary_2',
    'boundary_3',
    'boundary_disputed',
    'activity-lines-casing',
    'activity-lines',
  ]);

  for (const layer of map.getStyle().layers || []) {
    if (layer.id.startsWith('activity-lines')) {
      continue;
    }

    const visibility = !props.isFootprintMode || keepVisible.has(layer.id) ? 'visible' : 'none';
    map.setLayoutProperty(layer.id, 'visibility', visibility);
  }
}

function reloadCurrentStyle(styleId = props.mapStyleId) {
  isStyleLoading.value = true;
  mapLoaded.value = false;
  map.setStyle(getMapStyleUrl(styleId));
  map.once('style.load', () => {
    mapLoaded.value = true;
    applyFootprintMode();
    applyCameraMode();
    syncRoutes();
    isStyleLoading.value = false;
  });
}

function applyCameraMode() {
  if (!map) {
    return;
  }

  if (isThreeDimensionalStyle(props.mapStyleId)) {
    map.easeTo({
      pitch: 55,
      bearing: -18,
      duration: 650,
    });
    return;
  }

  map.easeTo({
    pitch: 0,
    bearing: 0,
    duration: 450,
  });
}

function fitToRoutesIfNeeded() {
  const data = visibleFeatureCollection.value;

  if (!map || !mapLoaded.value || data.features.length === 0 || data.features.length === lastFitFeatureCount) {
    return;
  }

  lastFitFeatureCount = data.features.length;

  const bounds = bbox(data);

  if (bounds.some((value) => !Number.isFinite(value))) {
    return;
  }

  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    {
      padding: 80,
      duration: 700,
      maxZoom: 14,
    },
  );
}

</script>

<template>
  <section class="map-shell">
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="isStyleLoading" class="map-loading" role="status">
      <span class="map-loading-spinner"></span>
      <span>Chargement du fond</span>
    </div>
  </section>
</template>
