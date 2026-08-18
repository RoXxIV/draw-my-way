<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import { bbox } from '@turf/bbox';
import { CAPTURE_FORMATS } from '../config/capture';
import { FRANCE_CENTER, FRANCE_ZOOM, getMapStyleUrl, isThreeDimensionalStyle } from '../config/map';
import { getAllTimeStatsRows } from '../services/activityStats';

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
  routeColor: {
    type: String,
    default: '#d62828',
  },
  routeOpacity: {
    type: Number,
    default: 0.95,
  },
  routeRenderMode: {
    type: String,
    default: 'solid',
  },
  isFootprintMode: {
    type: Boolean,
    default: false,
  },
  isCaptureMode: {
    type: Boolean,
    default: false,
  },
  mapStyleId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['close-capture-mode', 'update-capture-stats-position']);
const mapContainer = ref(null);
const captureFrame = ref(null);
const mapLoaded = ref(false);
const isStyleLoading = ref(false);
const isCapturing = ref(false);
const snapshotBaseUrl = ref('');
const snapshotUrl = ref('');
const snapshotError = ref('');
let map = null;
let lastFitFeatureCount = 0;
let snapshotRenderVersion = 0;
const ACTIVITY_SOURCE_ID = 'activities';
const ROUTE_LINE_WIDTH_BY_ZOOM = ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 1.8, 13, 2.5];
const HEAT_BASE_LINE_WIDTH_BY_ZOOM = ['interpolate', ['linear'], ['zoom'], 5, 2, 9, 3.2, 13, 4.5];
const HEAT_CORE_LINE_WIDTH_BY_ZOOM = ROUTE_LINE_WIDTH_BY_ZOOM;

const visibleFeatureCollection = computed(() => ({
  type: 'FeatureCollection',
  features: props.activities
    .filter((activity) => activity.visible !== false)
    .map((activity) => ({
      type: 'Feature',
      properties: {
        id: activity.id,
        name: activity.name,
        color: props.routeColor,
      },
      geometry: activity.geometry,
    })),
}));
const captureDownloadName = computed(() => `drawmyway-${new Date().toISOString().slice(0, 10)}.png`);
const captureCustomText = computed(() => props.captureSettings.customText.trim());
const activeCaptureFormat = computed(() => (
  CAPTURE_FORMATS.find((format) => format.id === props.captureSettings.format) || CAPTURE_FORMATS[2]
));
const capturePreviewRows = computed(() => {
  return (getAllTimeStatsRows(props.activities) || []).filter((row) => props.captureSettings.statRows[row.key]);
});
const captureCustomStatLines = computed(() => getCustomStatLines(props.captureSettings.customStats));
const captureStatLines = computed(() => [
  ...getCompactStatLines(capturePreviewRows.value),
  ...captureCustomStatLines.value,
]);
const shouldShowCaptureStatsPreview = computed(() => captureStatLines.value.length > 0 || Boolean(captureCustomText.value));

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: getMapStyleUrl(props.mapStyleId),
    center: FRANCE_CENTER,
    zoom: FRANCE_ZOOM,
    minZoom: getMinimumZoom(),
    canvasContextAttributes: {
      preserveDrawingBuffer: true,
    },
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

watch(
  () => props.routeRenderMode,
  () => {
    if (!map || !mapLoaded.value) {
      return;
    }

    applyRouteRenderMode();
  },
);

watch(
  () => props.routeColor,
  () => {
    if (!map || !mapLoaded.value) {
      return;
    }

    syncRoutes();
  },
);

watch(
  () => props.routeOpacity,
  () => {
    if (!map || !mapLoaded.value) {
      return;
    }

    applyRoutePaint();
  },
);

watch(
  () => props.isCaptureMode,
  (isEnabled) => {
    if (!isEnabled) {
      snapshotBaseUrl.value = '';
      snapshotUrl.value = '';
      snapshotError.value = '';
    }
  },
);

watch(
  [() => props.captureStatsPosition, () => props.captureSettings],
  () => {
    if (snapshotBaseUrl.value) {
      renderSnapshotFromBase();
    }
  },
  { deep: true },
);

function syncRoutes() {
  if (!map || !mapLoaded.value) {
    return;
  }

  const data = visibleFeatureCollection.value;
  const source = map.getSource(ACTIVITY_SOURCE_ID);

  if (source) {
    source.setData(data);
    ensureRouteLayers();
    applyRouteRenderMode();
    return;
  }

  map.addSource(ACTIVITY_SOURCE_ID, {
    type: 'geojson',
    data,
  });

  // All activities are rendered through one GeoJSON source/layer to keep MapLibre responsive.
  ensureRouteLayers();
  applyRouteRenderMode();
  applyRoutePaint();
}

function ensureRouteLayers() {
  if (!map.getLayer('activity-lines-heat-base')) {
    map.addLayer({
      id: 'activity-lines-heat-base',
      type: 'line',
      source: ACTIVITY_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#2b9348',
        'line-width': HEAT_BASE_LINE_WIDTH_BY_ZOOM,
        'line-opacity': 0.42,
        'line-blur': 0.7,
      },
    });
  }

  if (!map.getLayer('activity-lines-heat-core')) {
    map.addLayer({
      id: 'activity-lines-heat-core',
      type: 'line',
      source: ACTIVITY_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#ff3b00',
        'line-width': HEAT_CORE_LINE_WIDTH_BY_ZOOM,
        'line-opacity': 0.16,
      },
    });
  }

  if (!map.getLayer('activity-lines')) {
    map.addLayer({
      id: 'activity-lines',
      type: 'line',
      source: ACTIVITY_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ROUTE_LINE_WIDTH_BY_ZOOM,
        'line-opacity': 0.95,
      },
    });
  }
}

function applyRouteRenderMode() {
  const isHeatMode = props.routeRenderMode === 'heat';

  setLayerVisibility('activity-lines', isHeatMode ? 'none' : 'visible');
  setLayerVisibility('activity-lines-heat-base', isHeatMode ? 'visible' : 'none');
  setLayerVisibility('activity-lines-heat-core', isHeatMode ? 'visible' : 'none');
  applyRoutePaint();
}

function applyRoutePaint() {
  const opacity = clamp(props.routeOpacity, 0, 1);

  if (map.getLayer('activity-lines')) {
    map.setPaintProperty('activity-lines', 'line-opacity', opacity);
  }

  if (map.getLayer('activity-lines-heat-base')) {
    map.setPaintProperty('activity-lines-heat-base', 'line-opacity', opacity * 0.42);
  }

  if (map.getLayer('activity-lines-heat-core')) {
    map.setPaintProperty('activity-lines-heat-core', 'line-opacity', opacity * 0.16);
  }
}

function setLayerVisibility(layerId, visibility) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', visibility);
  }
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

  // The footprint mode hides style layers in-place and keeps the active style background intact.
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

async function captureMapImage() {
  if (!map || !captureFrame.value) {
    return;
  }

  isCapturing.value = true;
  snapshotError.value = '';
  snapshotUrl.value = '';

  await waitForMapFrame();

  try {
    const sourceCanvas = map.getCanvas();
    const mapRect = sourceCanvas.getBoundingClientRect();
    const frameRect = captureFrame.value.getBoundingClientRect();
    const scaleX = sourceCanvas.width / mapRect.width;
    const scaleY = sourceCanvas.height / mapRect.height;
    const sourceX = clamp((frameRect.left - mapRect.left) * scaleX, 0, sourceCanvas.width);
    const sourceY = clamp((frameRect.top - mapRect.top) * scaleY, 0, sourceCanvas.height);
    const sourceWidth = clamp(frameRect.width * scaleX, 1, sourceCanvas.width - sourceX);
    const sourceHeight = clamp(frameRect.height * scaleY, 1, sourceCanvas.height - sourceY);
    const outputCanvas = document.createElement('canvas');

    outputCanvas.width = Math.round(sourceWidth);
    outputCanvas.height = Math.round(sourceHeight);

    const context = outputCanvas.getContext('2d');
    context.fillStyle = '#f5f7fa';
    context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    context.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );
    const cssToCanvasScale = outputCanvas.width / frameRect.width;

    snapshotBaseUrl.value = outputCanvas.toDataURL('image/png');
    await renderSnapshotFromBase(cssToCanvasScale);
  } catch (error) {
    snapshotError.value = error.message || 'Capture impossible.';
  } finally {
    isCapturing.value = false;
  }
}

async function renderSnapshotFromBase(preferredScale) {
  if (!snapshotBaseUrl.value) {
    return;
  }

  const renderVersion = ++snapshotRenderVersion;
  const image = await loadImage(snapshotBaseUrl.value);

  if (renderVersion !== snapshotRenderVersion) {
    return;
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = image.naturalWidth;
  outputCanvas.height = image.naturalHeight;

  const context = outputCanvas.getContext('2d');
  const frameRect = captureFrame.value?.getBoundingClientRect();
  const cssToCanvasScale = preferredScale || (frameRect?.width ? outputCanvas.width / frameRect.width : 1);

  context.drawImage(image, 0, 0, outputCanvas.width, outputCanvas.height);
  drawStatsBadge(context, outputCanvas.width, outputCanvas.height, cssToCanvasScale);
  snapshotUrl.value = outputCanvas.toDataURL('image/png');
}


function getCompactStatLines(rows) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  const lines = [];

  if (byKey.activityCount) {
    lines.push(`${byKey.activityCount.value} activités`);
  }

  if (byKey.distance && byKey.movingTime) {
    lines.push(`${byKey.distance.value} · ${byKey.movingTime.value}`);
  } else if (byKey.distance) {
    lines.push(`${byKey.distance.value} distance`);
  } else if (byKey.movingTime) {
    lines.push(`${byKey.movingTime.value} temps`);
  }

  if (byKey.elevationGain) {
    lines.push(`${byKey.elevationGain.value} de dénivelé`);
  }

  return lines;
}

function getCustomStatLines(customStats) {
  const rows = Array.isArray(customStats) ? customStats : [];

  return rows
    .map((row) => ({
      value: String(row?.value || '').trim(),
      label: String(row?.label || '').trim(),
    }))
    .filter((row) => row.value || row.label)
    .map((row) => [row.value, row.label].filter(Boolean).join(' '));
}

function drawStatsBadge(context, width, height, cssToCanvasScale = 1) {
  const customText = props.captureSettings.customText.trim();
  const rows = (getAllTimeStatsRows(props.activities) || []).filter((row) => props.captureSettings.statRows[row.key]);
  const statLines = [
    ...getCompactStatLines(rows),
    ...getCustomStatLines(props.captureSettings.customStats),
  ];

  if (statLines.length === 0 && !customText) {
    return;
  }

  const isCompactExport = window.matchMedia('(max-width: 760px)').matches;
  const scale = Math.max(cssToCanvasScale, 1);
  const availableWidth = Math.max(width - Math.round((isCompactExport ? 24 : 44) * scale), 1);
  const padding = Math.round((isCompactExport ? 9 : 18) * scale);
  const panelWidth = Math.min(availableWidth, Math.round((isCompactExport ? 184 : 300) * scale));
  const brandFontSize = Math.round((isCompactExport ? 11 : 18) * scale);
  const headlineFontSize = Math.round((isCompactExport ? 9 : 15) * scale);
  const detailFontSize = Math.round((isCompactExport ? 8 : 13) * scale);
  const accentHeight = Math.max(Math.round(3 * scale), 2);
  const brandToAccentGap = Math.round(5 * scale);
  const afterAccentGap = Math.round((isCompactExport ? 8 : 11) * scale);
  const customToStatsGap = customText && statLines.length > 0 ? Math.round((isCompactExport ? 5 : 8) * scale) : 0;
  const detailLineHeight = Math.round((isCompactExport ? 12 : 21) * scale);
  const headlineLineHeight = customText ? Math.round((isCompactExport ? 13 : 21) * scale) : 0;
  const metaHeight = statLines.length * detailLineHeight;
  const panelHeight = Math.min(
    Math.max(height - padding * 2, 1),
    padding * 2 + brandFontSize + brandToAccentGap + accentHeight + afterAccentGap + headlineLineHeight + customToStatsGap + metaHeight,
  );
  const { x, y } = getStatsBadgePosition(props.captureStatsPosition, width, height, panelWidth, panelHeight, padding);

  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.24)';
  context.shadowBlur = Math.round((isCompactExport ? 18 : 24) * scale);
  context.shadowOffsetY = Math.round((isCompactExport ? 7 : 10) * scale);
  drawRoundRect(context, x, y, panelWidth, panelHeight, Math.round(8 * scale));
  context.fillStyle = 'rgba(255, 255, 255, 0.84)';
  context.fill();
  context.restore();

  let cursorY = y + padding + brandFontSize;

  context.fillStyle = '#17212b';
  context.font = `900 ${brandFontSize}px Inter, Arial, sans-serif`;
  context.fillText('DrawMyWay', x + padding, cursorY);

  cursorY += brandToAccentGap;
  context.fillStyle = props.routeColor;
  drawRoundRect(context, x + padding, cursorY, Math.round(38 * scale), accentHeight, Math.round(2 * scale));
  context.fill();
  cursorY += accentHeight + afterAccentGap;

  if (customText) {
    cursorY += headlineFontSize;
    context.fillStyle = props.routeColor;
    context.font = `850 ${headlineFontSize}px Inter, Arial, sans-serif`;
    context.fillText(truncateText(context, customText, panelWidth - padding * 2), x + padding, cursorY);
    cursorY += customToStatsGap + detailFontSize;
  } else {
    cursorY += detailFontSize;
  }

  statLines.forEach((line, index) => {
    const rowY = cursorY + index * detailLineHeight;

    context.fillStyle = '#344451';
    context.font = `700 ${detailFontSize}px Inter, Arial, sans-serif`;
    context.fillText(truncateText(context, line, panelWidth - padding * 2), x + padding, rowY);
  });
}

function truncateText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;

  while (truncated.length > 0 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
}

function clearSnapshot() {
  snapshotBaseUrl.value = '';
  snapshotUrl.value = '';
  snapshotError.value = '';
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Aperçu de capture impossible.'));
    image.src = source;
  });
}

function getStatsBadgePosition(position, width, height, panelWidth, panelHeight, padding) {
  const horizontal = position.split('-')[1];
  const vertical = position.split('-')[0];
  const xByPosition = {
    left: padding,
    center: (width - panelWidth) / 2,
    right: width - panelWidth - padding,
  };
  const yByPosition = {
    top: padding,
    middle: (height - panelHeight) / 2,
    bottom: height - panelHeight - padding,
  };

  return {
    x: clamp(Math.round(xByPosition[horizontal] ?? padding), padding, Math.max(width - panelWidth - padding, padding)),
    y: clamp(Math.round(yByPosition[vertical] ?? padding), padding, Math.max(height - panelHeight - padding, padding)),
  };
}

function drawRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function waitForMapFrame() {
  return new Promise((resolve) => {
    let hasResolved = false;

    const finish = () => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    };

    map.once('render', finish);
    map.triggerRepaint();
    setTimeout(finish, 300);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

</script>

<template>
  <section class="map-shell">
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="isCaptureMode" class="capture-overlay">
      <div ref="captureFrame" class="capture-frame" :class="`is-${activeCaptureFormat.id}`">
        <button
          class="capture-close"
          type="button"
          aria-label="Fermer le mode photo"
          title="Fermer le mode photo"
          @click="emit('close-capture-mode')"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="2"
            />
          </svg>
        </button>
        <span class="capture-resolution">{{ activeCaptureFormat.resolution }}</span>
        <img
          v-if="snapshotUrl"
          class="capture-preview"
          :src="snapshotUrl"
          alt="Aperçu de la capture DrawMyWay"
        />
        <div
          v-if="shouldShowCaptureStatsPreview && !snapshotUrl"
          class="capture-stats-preview"
          :class="`is-${captureStatsPosition}`"
          :style="{ '--capture-accent-color': routeColor }"
          aria-hidden="true"
        >
          <p class="capture-stats-brand">DrawMyWay</p>
          <p v-if="captureCustomText" class="capture-stats-text">{{ captureCustomText }}</p>
          <div v-if="captureStatLines.length > 0" class="capture-stats-list">
            <p v-for="line in captureStatLines" :key="line">{{ line }}</p>
          </div>
        </div>
        <div class="capture-actions">
          <button
            v-if="!snapshotUrl"
            class="capture-button"
            type="button"
            :disabled="isCapturing"
            @click="captureMapImage"
          >
            {{ isCapturing ? 'Capture...' : 'Capturer' }}
          </button>
          <button v-else class="capture-button" type="button" @click="clearSnapshot">
            Réajuster
          </button>
          <a
            v-if="snapshotUrl"
            class="capture-download"
            :href="snapshotUrl"
            :download="captureDownloadName"
          >
            Télécharger l'image
          </a>
        </div>
      </div>
      <p v-if="snapshotError" class="capture-error">{{ snapshotError }}</p>
    </div>
    <div v-if="isStyleLoading" class="map-loading" role="status">
      <span class="map-loading-spinner"></span>
      <span>Chargement du fond</span>
    </div>
  </section>
</template>
