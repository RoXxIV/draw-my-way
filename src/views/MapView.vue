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
  isImporting: {
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
const isImportOverlayVisible = ref(false);
const mapInitError = ref('');
const customFrame = ref(null);
let frameResizeState = null;
const FRAME_HANDLES = ['nw', 'ne', 'sw', 'se'];
const FRAME_MARGIN = 8;
const FRAME_BOTTOM_MARGIN = 88;

class RecenterControl {
  constructor(onClick) {
    this.onClick = onClick;
  }

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recenter-control';
    button.title = 'Recentrer sur mes tracés';
    button.setAttribute('aria-label', 'Recentrer sur mes tracés');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>
    </svg>`;
    button.addEventListener('click', this.onClick);
    this.container.appendChild(button);

    return this.container;
  }

  onRemove() {
    this.container.remove();
  }
}

// En dessous de 360px le badge de stats déborde du cadre.
function getFrameMinSize(overlayWidth, overlayHeight) {
  const available = Math.min(
    overlayWidth - FRAME_MARGIN * 2,
    overlayHeight - FRAME_MARGIN - FRAME_BOTTOM_MARGIN,
  );

  return Math.min(window.matchMedia('(max-width: 760px)').matches ? 220 : 360, available);
}
const isCapturing = ref(false);
const snapshotBaseUrl = ref('');
const snapshotUrl = ref('');
const snapshotError = ref('');
let map = null;
let lastFitFeatureCount = 0;
let snapshotRenderVersion = 0;
let hasPlayedIntro = false;
let introActive = false;
let introFrameId = 0;
const ACTIVITY_SOURCE_ID = 'activities';
const INTRO_LAYER_ID = 'activity-lines-intro';
const INTRO_DURATION_MS = 3200;
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
        color: activity.color || props.routeColor,
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
const customFrameStyle = computed(() => {
  if (!customFrame.value) {
    return null;
  }

  return {
    top: `${customFrame.value.top}px`,
    left: `${customFrame.value.left}px`,
    width: `${customFrame.value.width}px`,
    height: `${customFrame.value.height}px`,
    right: 'auto',
    bottom: 'auto',
    aspectRatio: 'auto',
    transform: 'none',
  };
});
const captureResolutionLabel = computed(() => {
  if (!customFrame.value) {
    return activeCaptureFormat.value.resolution;
  }

  const pixelRatio = window.devicePixelRatio || 1;

  return `${Math.round(customFrame.value.width * pixelRatio)} × ${Math.round(customFrame.value.height * pixelRatio)} px`;
});
const badgeAccentColor = computed(() => props.captureSettings.accentColor || props.routeColor);
const isStatsOverlayEnabled = computed(() => props.captureSettings.showOverlay !== false);
const shouldShowCaptureStatsPreview = computed(() => (
  isStatsOverlayEnabled.value && (captureStatLines.value.length > 0 || Boolean(captureCustomText.value))
));

onMounted(() => {
  try {
    createMap();
  } catch {
    mapInitError.value = 'Impossible d’initialiser la carte (WebGL indisponible). Ferme puis rouvre complètement ton navigateur, ou vérifie que l’accélération matérielle est activée.';
  }
});

function createMap() {
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
  map.addControl(new RecenterControl(fitToRoutes), 'top-right');

  map.on('load', () => {
    mapLoaded.value = true;
    applyFootprintMode();
    applyCameraMode();
    syncRoutes();
    fitToRoutesIfNeeded();
  });
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onFrameResizeMove);
  cancelAnimationFrame(introFrameId);
  introActive = false;
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
  () => props.isImporting,
  (importing) => {
    if (importing) {
      isImportOverlayVisible.value = true;
      return;
    }

    if (!map || !mapLoaded.value) {
      isImportOverlayVisible.value = false;
      return;
    }

    // L'import est terminé : on garde le voile jusqu'à ce que la carte ait dessiné les tracés.
    map.once('idle', () => {
      isImportOverlayVisible.value = false;
    });
    map.triggerRepaint();
  },
);

watch(
  () => props.isCaptureMode,
  (isEnabled) => {
    if (!isEnabled) {
      snapshotBaseUrl.value = '';
      snapshotUrl.value = '';
      snapshotError.value = '';
      customFrame.value = null;
    }
  },
);

watch(
  () => props.captureSettings.format,
  () => {
    customFrame.value = null;
  },
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
    maybePlayIntro();
    return;
  }

  map.addSource(ACTIVITY_SOURCE_ID, {
    type: 'geojson',
    data,
    lineMetrics: true,
  });

  // All activities are rendered through one GeoJSON source/layer to keep MapLibre responsive.
  ensureRouteLayers();
  applyRouteRenderMode();
  applyRoutePaint();
  maybePlayIntro();
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

function applyRoutePaint(introFactor) {
  // Pendant l'intro, seules les frames de l'animation pilotent l'opacité des calques finaux.
  if (introActive && introFactor === undefined) {
    return;
  }

  const scale = introFactor === undefined ? 1 : introFactor;
  const opacity = clamp(props.routeOpacity, 0, 1) * scale;

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

function maybePlayIntro() {
  if (hasPlayedIntro || !map || !mapLoaded.value) {
    return;
  }

  const features = visibleFeatureCollection.value.features;

  if (features.length === 0) {
    return;
  }

  hasPlayedIntro = true;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  introActive = true;

  const uniqueColors = [...new Set(features.map((feature) => feature.properties.color))];
  const inkColor = uniqueColors.length === 1 ? uniqueColors[0] : props.routeColor;
  const targetOpacity = clamp(props.routeOpacity, 0, 1);

  applyRoutePaint(0);

  if (!map.getLayer(INTRO_LAYER_ID)) {
    map.addLayer({
      id: INTRO_LAYER_ID,
      type: 'line',
      source: ACTIVITY_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': ROUTE_LINE_WIDTH_BY_ZOOM,
        'line-opacity': targetOpacity,
        'line-gradient': buildIntroGradient(inkColor, 0.001),
      },
    });
  }

  // Démarre le dessin seulement quand la carte est stabilisée (tuiles chargées,
  // recadrage terminé, voile d'import retiré) : sinon l'animation joue « dans le noir ».
  let started = false;

  const begin = () => {
    if (started || !introActive) {
      return;
    }

    started = true;
    runIntroFrames(inkColor, targetOpacity);
  };

  map.once('idle', begin);
  window.setTimeout(begin, 4000);
}

function runIntroFrames(inkColor, targetOpacity) {
  const start = performance.now();

  const frame = (now) => {
    if (!map || !map.getLayer(INTRO_LAYER_ID)) {
      introActive = false;
      return;
    }

    const t = Math.min((now - start) / INTRO_DURATION_MS, 1);
    // Le dessin occupe les 3/4 du temps (easeOutCubic), le fondu vers les couleurs finales la fin.
    const draw = 1 - (1 - Math.min(t / 0.75, 1)) ** 3;
    const fade = clamp((t - 0.7) / 0.3, 0, 1);

    map.setPaintProperty(INTRO_LAYER_ID, 'line-gradient', buildIntroGradient(inkColor, Math.max(draw, 0.001)));
    map.setPaintProperty(INTRO_LAYER_ID, 'line-opacity', targetOpacity * (1 - fade));
    applyRoutePaint(fade);

    if (t < 1) {
      introFrameId = requestAnimationFrame(frame);
    } else {
      finishIntro();
    }
  };

  introFrameId = requestAnimationFrame(frame);
}

function buildIntroGradient(color, head) {
  const tail = Math.max(head - 0.08, 0);

  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    tail,
    color,
    Math.max(head, tail + 0.001),
    'rgba(255, 255, 255, 0)',
  ];
}

function finishIntro() {
  introActive = false;

  if (map?.getLayer(INTRO_LAYER_ID)) {
    map.removeLayer(INTRO_LAYER_ID);
  }

  applyRoutePaint();
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

function fitToRoutes() {
  const data = visibleFeatureCollection.value;

  if (!map || !mapLoaded.value || data.features.length === 0) {
    return;
  }

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
      padding: { top: 80, right: 80, bottom: 110, left: 80 },
      duration: 700,
      maxZoom: 14,
    },
  );
}

function fitToRoutesIfNeeded() {
  const featureCount = visibleFeatureCollection.value.features.length;

  if (featureCount === 0 || featureCount === lastFitFeatureCount) {
    return;
  }

  lastFitFeatureCount = featureCount;
  fitToRoutes();
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
  if (props.captureSettings.showOverlay === false) {
    return;
  }

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
  context.fillStyle = badgeAccentColor.value;
  drawRoundRect(context, x + padding, cursorY, Math.round(38 * scale), accentHeight, Math.round(2 * scale));
  context.fill();
  cursorY += accentHeight + afterAccentGap;

  if (customText) {
    cursorY += headlineFontSize;
    context.fillStyle = badgeAccentColor.value;
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

async function captureAndDownload() {
  await captureMapImage();

  if (!snapshotUrl.value) {
    return;
  }

  const link = document.createElement('a');
  link.href = snapshotUrl.value;
  link.download = captureDownloadName.value;
  link.click();
  clearSnapshot();
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

function reloadPage() {
  window.location.reload();
}

function startFrameResize(handle, event) {
  const overlay = captureFrame.value?.parentElement;

  if (!overlay) {
    return;
  }

  const overlayRect = overlay.getBoundingClientRect();
  const rect = captureFrame.value.getBoundingClientRect();
  const start = {
    left: rect.left - overlayRect.left,
    top: rect.top - overlayRect.top,
    width: rect.width,
    height: rect.height,
  };

  customFrame.value = { ...start };
  frameResizeState = {
    handle,
    start,
    startX: event.clientX,
    startY: event.clientY,
    ratio: ['square', 'story', 'poster'].includes(activeCaptureFormat.value.id) ? rect.width / rect.height : 0,
    overlayWidth: overlayRect.width,
    overlayHeight: overlayRect.height,
    minSize: getFrameMinSize(overlayRect.width, overlayRect.height),
  };
  window.addEventListener('pointermove', onFrameResizeMove);
  window.addEventListener('pointerup', stopFrameResize, { once: true });
}

function onFrameResizeMove(event) {
  if (!frameResizeState) {
    return;
  }

  const { handle, start, startX, startY, ratio, overlayWidth, overlayHeight, minSize } = frameResizeState;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;
  const growsLeft = handle.includes('w');
  const growsTop = handle.includes('n');
  let width = growsLeft ? start.width - deltaX : start.width + deltaX;
  let height = growsTop ? start.height - deltaY : start.height + deltaY;

  if (ratio) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  width = Math.max(width, minSize);
  height = Math.max(height, ratio ? width / ratio : minSize);
  width = Math.min(width, overlayWidth - FRAME_MARGIN * 2);

  if (ratio) {
    height = width / ratio;
  }

  height = Math.min(height, overlayHeight - FRAME_MARGIN - FRAME_BOTTOM_MARGIN);

  if (ratio) {
    width = height * ratio;
  }

  const left = clamp(growsLeft ? start.left + start.width - width : start.left, FRAME_MARGIN, Math.max(overlayWidth - FRAME_MARGIN - width, FRAME_MARGIN));
  const top = clamp(growsTop ? start.top + start.height - height : start.top, FRAME_MARGIN, Math.max(overlayHeight - FRAME_BOTTOM_MARGIN - height, FRAME_MARGIN));

  customFrame.value = { left, top, width, height };
}

function stopFrameResize() {
  frameResizeState = null;
  window.removeEventListener('pointermove', onFrameResizeMove);
}

</script>

<template>
  <section class="map-shell">
    <div ref="mapContainer" class="map-container"></div>
    <div
      v-if="!isCaptureMode && shouldShowCaptureStatsPreview"
      class="capture-stats-preview map-stats-overlay"
      :class="`is-${captureStatsPosition}`"
      :style="{ '--capture-accent-color': badgeAccentColor }"
      aria-hidden="true"
    >
      <p class="capture-stats-brand">DrawMyWay</p>
      <p v-if="captureCustomText" class="capture-stats-text">{{ captureCustomText }}</p>
      <div v-if="captureStatLines.length > 0" class="capture-stats-list">
        <p v-for="line in captureStatLines" :key="line">{{ line }}</p>
      </div>
    </div>
    <div v-if="isCaptureMode" class="capture-overlay">
      <div
        ref="captureFrame"
        class="capture-frame"
        :class="`is-${activeCaptureFormat.id}`"
        :style="customFrameStyle"
      >
        <span
          v-for="handle in FRAME_HANDLES"
          :key="handle"
          class="capture-handle"
          :class="`is-${handle}`"
          @pointerdown.prevent="startFrameResize(handle, $event)"
        ></span>
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
        <span class="capture-resolution">{{ captureResolutionLabel }}</span>
        <div
          v-if="shouldShowCaptureStatsPreview"
          class="capture-stats-preview"
          :class="`is-${captureStatsPosition}`"
          :style="{ '--capture-accent-color': badgeAccentColor }"
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
            class="capture-download"
            type="button"
            :disabled="isCapturing"
            @click="captureAndDownload"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                fill="none"
                stroke="currentColor"
                stroke-linejoin="round"
                stroke-width="2"
              />
              <circle cx="9" cy="10" r="1.6" fill="currentColor" />
              <path
                d="m5.5 17 4.2-4.4 3 3 2.6-2.6 3.2 3.4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
            <span>{{ isCapturing ? 'Préparation…' : "Télécharger l'image" }}</span>
          </button>
        </div>
      </div>
      <p v-if="snapshotError" class="capture-error">{{ snapshotError }}</p>
    </div>
    <div v-if="isStyleLoading || isImportOverlayVisible" class="map-loading" role="status">
      <span class="map-loading-spinner"></span>
      <span>{{ isImportOverlayVisible ? 'Import des traces…' : 'Chargement du fond' }}</span>
    </div>
    <div v-if="mapInitError" class="map-init-error" role="alert">
      <p>{{ mapInitError }}</p>
      <button type="button" @click="reloadPage">Recharger la page</button>
    </div>
  </section>
</template>

<style lang="scss">
.map-shell,
.map-container {
  width: 100%;
  height: 100%;
}

.map-loading {
  position: absolute;
  inset: 0;
  z-index: 18;
  display: grid;
  place-items: center;
  gap: 10px;
  background: rgba(20, 27, 36, 0.18);
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 800;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  pointer-events: none;
}

.map-loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.42);
  border-top-color: #ffffff;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.maplibregl-ctrl button.recenter-control svg {
  display: block;
  width: 18px;
  height: 18px;
  margin: auto;
  color: #333333;
}

.map-init-error {
  position: absolute;
  inset: 0;
  z-index: 19;
  display: grid;
  place-content: center;
  gap: 14px;
  padding: 24px;
  background: #dbe4ea;
  text-align: center;
}

.map-init-error p {
  max-width: 420px;
  margin: 0;
  color: $slate;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.5;
}

.map-init-error button {
  justify-self: center;
  min-height: 40px;
  border-radius: 8px;
  padding: 10px 16px;
  background: $ink;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 850;
}

.capture-overlay {
  position: absolute;
  inset: 0;
  z-index: 17;
  pointer-events: none;
}

.capture-frame {
  position: absolute;
  top: 18px;
  right: 58px;
  bottom: 96px;
  left: 18px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  box-shadow:
    0 0 0 9999px rgba(10, 16, 24, 0.64),
    inset 0 0 0 1px rgba(23, 33, 43, 0.28);
}

.capture-frame.is-square,
.capture-frame.is-story,
.capture-frame.is-poster {
  top: calc(50% - 40px);
  bottom: auto;
  left: 50%;
  right: auto;
  transform: translate(-50%, -50%);
}

.capture-frame.is-square {
  width: min(calc(100vw - 36px), calc(100dvh - 170px));
  aspect-ratio: 1;
}

.capture-frame.is-story {
  height: calc(100dvh - 170px);
  aspect-ratio: 9 / 16;
}

.capture-frame.is-poster {
  height: calc(100dvh - 170px);
  aspect-ratio: 4 / 5;
}

.capture-handle {
  position: absolute;
  z-index: 4;
  width: 16px;
  height: 16px;
  border: 2px solid $ink;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  pointer-events: auto;
  touch-action: none;
}

.capture-handle.is-nw {
  top: -8px;
  left: -8px;
  cursor: nwse-resize;
}

.capture-handle.is-ne {
  top: -8px;
  right: -8px;
  cursor: nesw-resize;
}

.capture-handle.is-sw {
  bottom: -8px;
  left: -8px;
  cursor: nesw-resize;
}

.capture-handle.is-se {
  bottom: -8px;
  right: -8px;
  cursor: nwse-resize;
}

.capture-resolution {
  position: absolute;
  top: 12px;
  right: 58px;
  z-index: 2;
  border-radius: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.9);
  color: $ink;
  font-size: 0.72rem;
  font-weight: 850;
  pointer-events: none;
}

.capture-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  color: $ink;
  box-shadow: 0 12px 28px rgba(31, 41, 51, 0.18);
  pointer-events: auto;
}

.capture-close svg {
  width: 20px;
  height: 20px;
}

.capture-frame::before,
.capture-frame::after {
  position: absolute;
  width: 34px;
  height: 34px;
  border-color: #ffffff;
  content: "";
}

.capture-frame::before {
  top: -2px;
  left: -2px;
  border-top: 4px solid;
  border-left: 4px solid;
  border-top-left-radius: 8px;
}

.capture-frame::after {
  right: -2px;
  bottom: -2px;
  border-right: 4px solid;
  border-bottom: 4px solid;
  border-bottom-right-radius: 8px;
}

.map-stats-overlay {
  z-index: 15;
}

.capture-stats-preview {
  position: absolute;
  z-index: 1;
  width: min(300px, calc(100% - 44px));
  --capture-accent-color: #{$brand};
  border-radius: 8px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.84);
  color: $ink;
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.24);
  pointer-events: none;
}

.capture-stats-preview.is-top-left,
.capture-stats-preview.is-top-center,
.capture-stats-preview.is-top-right {
  top: 22px;
}

.capture-stats-preview.is-middle-left,
.capture-stats-preview.is-middle-center,
.capture-stats-preview.is-middle-right {
  top: 50%;
  transform: translateY(-50%);
}

.capture-stats-preview.is-bottom-left,
.capture-stats-preview.is-bottom-center,
.capture-stats-preview.is-bottom-right {
  bottom: 22px;
}

.capture-stats-preview.is-top-left,
.capture-stats-preview.is-middle-left,
.capture-stats-preview.is-bottom-left {
  left: 22px;
}

.capture-stats-preview.is-top-center,
.capture-stats-preview.is-middle-center,
.capture-stats-preview.is-bottom-center {
  left: 50%;
  transform: translateX(-50%);
}

.capture-stats-preview.is-middle-center {
  transform: translate(-50%, -50%);
}

.capture-stats-preview.is-top-right,
.capture-stats-preview.is-middle-right,
.capture-stats-preview.is-bottom-right {
  right: 22px;
}

.capture-stats-brand,
.capture-stats-text {
  margin: 0;
}

.capture-stats-brand {
  color: $ink;
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-transform: uppercase;
}

.capture-stats-brand::after {
  display: block;
  width: 38px;
  height: 3px;
  margin-top: 7px;
  border-radius: 999px;
  background: var(--capture-accent-color);
  content: "";
}

.capture-stats-text {
  margin-top: 11px;
  color: var(--capture-accent-color);
  font-size: 0.98rem;
  font-weight: 850;
  line-height: 1.15;
}

.capture-stats-list {
  display: grid;
  gap: 5px;
  margin: 12px 0 0;
}

.capture-stats-list p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 750;
  line-height: 1.25;
}

.capture-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 2;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.capture-download {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 16px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.96);
  color: $ink;
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0.02em;
  box-shadow: 0 14px 32px rgba(31, 41, 51, 0.24);
  backdrop-filter: blur(12px) saturate(145%);
  -webkit-backdrop-filter: blur(12px) saturate(145%);
  transition: transform 0.16s ease;
}

.capture-download:hover:not(:disabled) {
  transform: translateY(-2px);
}

.capture-download svg {
  width: 20px;
  height: 20px;
}

.capture-error {
  position: absolute;
  right: 72px;
  bottom: 110px;
  max-width: min(360px, calc(100vw - 36px));
  margin: 0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #ffffff;
  color: #9f1d1d;
  font-size: 0.86rem;
  font-weight: 750;
  box-shadow: 0 12px 28px rgba(31, 41, 51, 0.18);
  pointer-events: auto;
}

@media (max-width: 760px) {
  .capture-frame {
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    bottom: 84px;
    left: max(8px, env(safe-area-inset-left));
  }

  .capture-frame.is-square,
  .capture-frame.is-story,
  .capture-frame.is-poster {
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    bottom: 84px;
    left: max(8px, env(safe-area-inset-left));
    width: auto;
    height: auto;
    aspect-ratio: auto;
    transform: none;
  }

  .capture-resolution {
    top: 10px;
    right: 54px;
    font-size: 0.66rem;
  }

  .capture-close {
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
  }

  .capture-stats-preview {
    width: min(178px, calc(100% - 24px));
    padding: 9px 10px;
  }

  .capture-stats-preview.is-top-left,
  .capture-stats-preview.is-top-center,
  .capture-stats-preview.is-top-right {
    top: 12px;
  }

  .capture-stats-preview.is-bottom-left,
  .capture-stats-preview.is-bottom-center,
  .capture-stats-preview.is-bottom-right {
    bottom: 12px;
  }

  .capture-stats-preview.is-top-left,
  .capture-stats-preview.is-middle-left,
  .capture-stats-preview.is-bottom-left {
    left: 12px;
  }

  .capture-stats-preview.is-top-right,
  .capture-stats-preview.is-middle-right,
  .capture-stats-preview.is-bottom-right {
    right: 12px;
  }

  .capture-stats-brand {
    font-size: 0.78rem;
  }

  .capture-stats-text {
    margin-top: 6px;
  }

  .capture-stats-list {
    gap: 4px 8px;
    margin-top: 8px;
  }

  .capture-stats-text,
  .capture-stats-list p {
    font-size: 0.55rem;
  }

  .capture-actions {
    right: max(10px, env(safe-area-inset-right));
    bottom: 10px;
    left: max(10px, env(safe-area-inset-left));
  }

  .capture-download {
    flex: 1 1 0;
    padding: 8px 12px;
    font-size: 0.72rem;
  }

  .capture-error {
    right: max(10px, env(safe-area-inset-right));
    bottom: 118px;
    left: max(10px, env(safe-area-inset-left));
    max-width: none;
  }

  .maplibregl-ctrl-top-right {
    top: auto;
    right: max(10px, env(safe-area-inset-right));
    bottom: max(88px, calc(env(safe-area-inset-bottom) + 78px));
  }

  .app-layout.is-capture-mode .maplibregl-ctrl-top-right {
    display: none;
  }
}
</style>
