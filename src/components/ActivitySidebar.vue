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

