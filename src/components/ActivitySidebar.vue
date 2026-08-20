<script setup>
import { computed, ref } from 'vue';
import RouteStylePanel from './RouteStylePanel.vue';
import { CAPTURE_FORMATS, CAPTURE_STATS_POSITIONS } from '../config/capture';
import { ROUTE_COLORS } from '../config/colors';
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
  'clear-activities',
  'connect-strava',
  'update-activity-appearance',
  'disconnect-strava',
  'import-gpx',
  'import-strava-date-selection',
  'open-strava-import',
  'search-strava-date',
  'toggle-footprint-mode',
  'toggle-capture-mode',
  'update-capture-settings',
  'update-capture-stats-position',
  'update-map-style',
  'update-route-opacity',
  'update-route-render-mode',
]);

const activePanel = ref('');
const gpxInput = ref(null);
const stravaDate = ref(new Date().toISOString().slice(0, 10));
const selectedStravaActivityIds = ref([]);
const stravaStats = computed(() => getAllTimeStatsRows(props.activities));
const customStats = computed(() => normalizeCustomStats(props.captureSettings.customStats));
const stravaDateActivities = computed(() => props.stravaDateSearch.activities || []);
const isOverlayEnabled = computed(() => props.captureSettings.showOverlay !== false);
const importBreakdown = computed(() => props.activities
  .filter((activity) => activity.stats)
  .map((activity) => ({
    id: activity.id,
    name: activity.name || activity.fileName || 'Import',
    visible: activity.visible !== false,
    color: activity.color || '',
    detail: [
      `${Number(activity.stats.activityCount || 0).toLocaleString('fr-FR')} activité(s)`,
      `${(Number(activity.stats.distanceMeters || 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`,
      `${Math.round(Number(activity.stats.elevationGainMeters || 0)).toLocaleString('fr-FR')} m D+`,
    ].join(' · '),
  })));
const badgeAccentColor = computed(() => props.captureSettings.accentColor || '#d62828');
const displayedPanel = computed(() => activePanel.value);
const isPanelOpen = computed(() => displayedPanel.value !== '');
const panelTitle = computed(() => ({
  import: 'Ajouter des traces',
  stats: 'Statistiques',
  style: 'Personnaliser la carte',
}[displayedPanel.value] || ''));
function togglePanel(name) {
  activePanel.value = activePanel.value === name ? '' : name;
}

function closePanel() {
  activePanel.value = '';
}

function updateCaptureSettings(partialSettings) {
  emit('update-capture-settings', {
    ...props.captureSettings,
    ...partialSettings,
  });
}

function toggleStatsOverlay() {
  updateCaptureSettings({ showOverlay: !isOverlayEnabled.value });
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

function clearActivities() {
  if (window.confirm('Supprimer toutes les traces de la carte ?')) {
    emit('clear-activities');
  }
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
  <a class="map-brand" href="#" title="Retour à l'accueil">
    <span class="map-brand-dot" aria-hidden="true"></span>
    DrawMyWay
  </a>

  <input
    ref="gpxInput"
    class="visually-hidden"
    type="file"
    accept=".gpx,application/gpx+xml,application/xml,text/xml"
    @change="importGpx"
  />

  <div class="map-bottom-bar">
    <nav class="map-toolbar" aria-label="Outils de la carte">
    <button
      class="map-tool"
      :class="{ 'is-active': displayedPanel === 'import' }"
      type="button"
      @click="togglePanel('import')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
        <path
          d="M12 3v10m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <span>Traces</span>
    </button>

    <button
      class="map-tool"
      :class="{ 'is-active': displayedPanel === 'stats' }"
      type="button"
      @click="togglePanel('stats')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
        <path
          d="M5 20V10m7 10V4m7 16v-7"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="2.4"
        />
      </svg>
      <span>Stats</span>
    </button>

    <button
      class="map-tool"
      :class="{ 'is-active': displayedPanel === 'style' }"
      type="button"
      @click="togglePanel('style')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
        <path
          d="M18.4 3.6a2.1 2.1 0 0 1 3 3l-9.1 9.1-3-3 9.1-9.1Z"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <path
          d="M8.7 13.3c-2.6.5-4.1 2-4.4 4.5-.1.8-.4 1.5-1 2.1 2.1.2 4.4-.2 5.8-1.6 1.1-1.1 1.5-2.7.9-4.1"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <span>Style</span>
    </button>

    <span class="map-toolbar-separator" aria-hidden="true"></span>

    <button
      class="map-tool map-tool-photo"
      :class="{ 'is-active': isCaptureMode }"
      type="button"
      :aria-pressed="isCaptureMode"
      @click="emit('toggle-capture-mode')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
        <path
          d="M14.5 5 13 3H9L7.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"
          fill="none"
          stroke="currentColor"
          stroke-linejoin="round"
          stroke-width="2"
        />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <span>Photo</span>
    </button>
    </nav>

    <div v-if="isCaptureMode" class="map-format-bar" role="group" aria-label="Format de l'image">
      <button
        v-for="format in CAPTURE_FORMATS"
        :key="format.id"
        class="map-format-chip"
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

  <aside v-if="isPanelOpen" class="map-panel" :aria-label="panelTitle">
    <header class="map-panel-header">
      <h2>{{ panelTitle }}</h2>
      <button
        class="map-panel-close"
        type="button"
        aria-label="Fermer le panneau"
        @click="closePanel"
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

    <div class="map-panel-content">
      <section v-if="displayedPanel === 'import'" class="source-import-panel">
        <div class="import-buttons">
          <button
            v-if="!stravaStatus.connected"
            class="strava-button"
            type="button"
            :disabled="isCheckingStrava"
            @click="emit('connect-strava')"
          >
            {{ isCheckingStrava ? 'Vérification...' : 'Connecter Strava' }}
          </button>
          <button
            v-else
            class="strava-button"
            type="button"
            :disabled="isImporting"
            @click="emit('open-strava-import')"
          >
            {{ isImporting ? 'Import...' : 'Importer depuis Strava' }}
          </button>
          <button
            class="gpx-import-button"
            type="button"
            :disabled="isImporting"
            @click="openGpxImport"
          >
            Importer un GPX
          </button>
        </div>

        <p v-if="!stravaStatus.connected" class="muted">
          Connecte Strava pour importer tout ton historique en un clic, ou dépose un fichier GPX.
        </p>

        <details v-if="stravaStatus.connected" class="style-section" open>
          <summary>Composer par date</summary>
          <div class="strava-date-import">
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
          </div>
        </details>

        <footer v-if="stravaStatus.connected || activities.length > 0" class="strava-account">
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
              Déconnecter et tout vider
            </button>
            <p class="disconnect-hint">
              Supprime la connexion Strava et toutes les traces de la carte, imports GPX compris.
            </p>
          </template>

          <button
            v-if="activities.length > 0"
            class="disconnect-button"
            type="button"
            :disabled="isImporting"
            @click="clearActivities"
          >
            Vider la carte
          </button>
          <p v-if="activities.length > 0 && !stravaStatus.connected" class="disconnect-hint">
            Supprime toutes les traces importées, sans toucher à la connexion Strava.
          </p>
        </footer>
      </section>

      <section v-else-if="displayedPanel === 'stats'" class="stats-panel">
        <p v-if="isLoading" class="muted">Chargement des activités...</p>
        <p v-else-if="!stravaStats" class="empty-state">
          Ajoute un GPX ou connecte Strava pour afficher tes statistiques.
        </p>
        <template v-else>
          <details class="style-section" open>
            <summary>Totaux</summary>
            <div class="stats-metrics">
              <article v-for="row in stravaStats" :key="row.key" class="stats-metric">
                <strong>{{ row.value }}</strong>
                <span>{{ row.label }}</span>
              </article>
            </div>
          </details>

          <details v-if="importBreakdown.length > 0" class="style-section">
            <summary>Par import</summary>
            <div class="import-breakdown">
              <article
                v-for="item in importBreakdown"
                :key="item.id"
                class="import-breakdown-row"
              >
                <strong>{{ item.name }}</strong>
                <small>{{ item.detail }}</small>
              </article>
            </div>
          </details>

          <details class="style-section" open>
            <summary>Badge sur la carte</summary>
            <label class="photo-toggle">
              <input
                type="checkbox"
                :checked="isOverlayEnabled"
                @change="toggleStatsOverlay"
              />
              <span>Afficher le badge de stats</span>
            </label>

            <div class="photo-stat-lines">
              <label v-for="row in STATS_ROW_OPTIONS" :key="row.key" class="photo-toggle">
                <input
                  type="checkbox"
                  :checked="captureSettings.statRows[row.key]"
                  :disabled="!isOverlayEnabled"
                  @change="updateCaptureStatRow(row.key)"
                />
                <span>{{ row.label }}</span>
              </label>
            </div>

            <div class="badge-accent">
              <span>Couleur d'accent</span>
              <div class="import-row-colors" role="group" aria-label="Couleur d'accent du badge">
                <button
                  v-for="color in ROUTE_COLORS"
                  :key="color"
                  class="color-swatch"
                  :class="{ 'is-selected': color === badgeAccentColor }"
                  type="button"
                  :style="{ backgroundColor: color }"
                  :disabled="!isOverlayEnabled"
                  :aria-label="`Choisir ${color}`"
                  @click="updateCaptureSettings({ accentColor: color })"
                ></button>
              </div>
            </div>
          </details>

          <details class="style-section">
            <summary>Texte &amp; stats perso</summary>
            <div>
              <label class="photo-text-field">
                <span>Texte perso</span>
                <input
                  type="text"
                  :maxlength="CUSTOM_TEXT_MAX_LENGTH"
                  :value="captureSettings.customText"
                  :disabled="!isOverlayEnabled"
                  placeholder="Ex : Beaujolais 2026"
                  @input="updateCustomText"
                />
              </label>
              <p class="photo-text-count">{{ captureSettings.customText.length }}/{{ CUSTOM_TEXT_MAX_LENGTH }}</p>
            </div>

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
                  :disabled="!isOverlayEnabled"
                  placeholder="Ex : 1 470 km"
                  aria-label="Valeur personnalisée"
                  @input="updateCustomStat(index, 'value', $event)"
                />
                <input
                  type="text"
                  :maxlength="CUSTOM_STAT_MAX_LENGTH"
                  :value="stat.label"
                  :disabled="!isOverlayEnabled"
                  placeholder="Ex : distance"
                  aria-label="Libellé personnalisé"
                  @input="updateCustomStat(index, 'label', $event)"
                />
              </div>
            </div>
          </details>

          <details class="style-section">
            <summary>Emplacement du badge</summary>
            <div class="photo-placement-grid" role="group" aria-label="Placement du badge">
              <button
                v-for="position in CAPTURE_STATS_POSITIONS"
                :key="position.id"
                class="photo-placement-button"
                :class="{ 'is-selected': captureStatsPosition === position.id }"
                type="button"
                :disabled="!isOverlayEnabled"
                :aria-label="position.label"
                :aria-pressed="captureStatsPosition === position.id"
                :title="position.label"
                @click="emit('update-capture-stats-position', position.id)"
              ></button>
            </div>
          </details>
        </template>
      </section>

      <RouteStylePanel
        v-else-if="displayedPanel === 'style'"
        :imports="importBreakdown"
        :is-footprint-mode="isFootprintMode"
        :map-style-id="mapStyleId"
        :route-opacity="routeOpacity"
        :route-render-mode="routeRenderMode"
        @toggle-footprint-mode="emit('toggle-footprint-mode')"
        @update-activity-appearance="emit('update-activity-appearance', $event)"
        @update-map-style="emit('update-map-style', $event)"
        @update-route-opacity="emit('update-route-opacity', $event)"
        @update-route-render-mode="emit('update-route-render-mode', $event)"
      />

    </div>
  </aside>
</template>


<style lang="scss">
.map-brand {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.94);
  color: $ink;
  font-size: 0.88rem;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 0 12px 30px rgba(31, 41, 51, 0.18);
  backdrop-filter: blur(12px) saturate(145%);
  -webkit-backdrop-filter: blur(12px) saturate(145%);
}

.map-brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: $brand;
}

.map-bottom-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  z-index: 26;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 24px);
  transform: translateX(-50%);
}

.map-bottom-bar::-webkit-scrollbar {
  display: none;
}

.map-toolbar,
.map-format-bar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 999px;
  padding: 7px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 44px rgba(31, 41, 51, 0.24);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
}

.map-format-bar {
  animation: map-panel-in 0.18s ease;
}

.map-format-chip {
  display: grid;
  justify-items: center;
  gap: 2px;
  border-radius: 999px;
  padding: 7px 12px;
  background: transparent;
  color: $ink;
  font-size: 0.68rem;
  font-weight: 850;
  white-space: nowrap;
}

.map-format-chip small {
  color: $slate-soft;
  font-size: 0.56rem;
  font-weight: 750;
}

.map-format-chip:hover {
  background: rgba(23, 33, 43, 0.07);
}

.map-format-chip.is-selected {
  background: $ink;
  color: #ffffff;
}

.map-format-chip.is-selected small {
  color: rgba(255, 255, 255, 0.72);
}

.map-tool {
  display: grid;
  min-width: 64px;
  justify-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 8px 12px;
  background: transparent;
  color: $ink;
  font-size: 0.66rem;
  font-weight: 850;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.map-tool .tool-icon {
  width: 20px;
  height: 20px;
}

.map-tool:hover {
  background: rgba(23, 33, 43, 0.07);
}

.map-tool.is-active {
  background: $ink;
  color: #ffffff;
}

.map-tool-photo {
  color: $brand;
}

.map-tool-photo.is-active {
  background: $brand;
  color: #ffffff;
}

.map-toolbar-separator {
  align-self: center;
  width: 1px;
  height: 30px;
  margin: 0 5px;
  background: rgba(127, 140, 153, 0.32);
}

.map-panel {
  position: fixed;
  top: 72px;
  left: 14px;
  z-index: 25;
  display: flex;
  width: min(310px, calc(100vw - 28px));
  max-height: min(540px, calc(100dvh - 180px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 45px rgba(31, 41, 51, 0.22);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
  animation: map-panel-in 0.18s ease;
}

@keyframes map-panel-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.map-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(127, 140, 153, 0.24);
  padding: 13px 16px;
}

.map-panel-header h2 {
  margin: 0;
  color: $ink-deep;
  font-size: 0.95rem;
  line-height: 1.2;
}

.map-panel-close {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: rgba(23, 33, 43, 0.06);
  color: $ink;
}

.map-panel-close .tool-icon {
  width: 16px;
  height: 16px;
}

.map-panel-content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 16px 16px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #aab1b8 transparent;
}

.map-panel-content::-webkit-scrollbar {
  width: 8px;
}

.map-panel-content::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(127, 140, 153, 0.48);
  background-clip: content-box;
}

.muted,
.empty-state {
  margin: 0;
  color: #5f6f7c;
  font-size: 0.88rem;
  line-height: 1.35;
}

// --- Panneau "Ajouter des traces" ---

.source-import-panel {
  display: grid;
  gap: 12px;
}

.import-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.strava-button {
  min-height: 42px;
  padding: 10px 12px;
  background: $strava;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 850;
}

.gpx-import-button {
  min-height: 42px;
  border: 1px solid $border-soft;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.9);
  color: $ink;
  font-size: 0.82rem;
  font-weight: 850;
}

.strava-date-import {
  display: grid;
  gap: 8px;
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

.strava-account {
  border-top: 1px solid rgba(127, 140, 153, 0.22);
  padding-top: 12px;
}

.account-status {
  margin: 0;
  color: $slate;
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.35;
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

// --- Panneau "Statistiques" ---

.import-breakdown {
  display: grid;
  gap: 7px;
}

.import-breakdown-row {
  border: 1px solid rgba(127, 140, 153, 0.18);
  border-radius: 6px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.72);
}

.import-breakdown-row strong,
.import-breakdown-row small {
  display: block;
  min-width: 0;
}

.import-breakdown-row strong {
  overflow: hidden;
  color: $ink;
  font-size: 0.78rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-breakdown-row small {
  margin-top: 3px;
  color: $slate-soft;
  font-size: 0.7rem;
  font-weight: 700;
}

.badge-accent {
  display: grid;
  gap: 2px;
  margin-top: 10px;
}

.badge-accent > span {
  color: $ink;
  font-size: 0.82rem;
  font-weight: 750;
}

.disconnect-hint {
  margin: 6px 0 0;
  color: $slate-soft;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.4;
}

.stats-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 18px;
  padding: 4px 0;
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

// --- Réglages du badge de stats ---

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

@media (max-width: 760px) {
  .map-brand {
    top: max(10px, env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
    padding: 8px 13px;
    font-size: 0.8rem;
  }

  .map-bottom-bar {
    bottom: max(0px, calc(env(safe-area-inset-bottom) - 6px));
    max-width: 100vw;
    padding: 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .map-format-chip {
    padding: 6px 9px;
    font-size: 0.6rem;
  }

  .map-tool {
    min-width: 56px;
    padding: 7px 9px;
    font-size: 0.6rem;
  }

  .map-panel {
    top: max(64px, calc(env(safe-area-inset-top) + 54px));
    right: max(10px, env(safe-area-inset-right));
    left: max(10px, env(safe-area-inset-left));
    width: auto;
    max-height: calc(100dvh - 160px);
  }

  .map-panel-content {
    padding: 12px;
  }

  .stats-metrics {
    gap: 12px 14px;
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
}
</style>
