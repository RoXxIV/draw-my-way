<script setup>
import { computed, ref } from 'vue';
import RouteStylePanel from './RouteStylePanel.vue';

const props = defineProps({
  activities: {
    type: Array,
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
  routeColor: {
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
  stravaStatus: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  'connect-strava',
  'disconnect-strava',
  'toggle-footprint-mode',
  'update-map-style',
  'update-route-color',
]);

const isMenuOpen = ref(false);
const stravaActivity = computed(() => props.activities.find((activity) => activity.type === 'strava_summary'));
const statsSourceTitle = computed(() => {
  const sources = props.activities
    .map((activity) => getActivitySourceLabel(activity.type))
    .filter(Boolean);
  const uniqueSources = [...new Set(sources)];

  return uniqueSources.length > 0 ? `De tout temps (${uniqueSources.join(', ')})` : 'De tout temps';
});
const stravaStats = computed(() => {
  const stats = stravaActivity.value?.stats;

  if (!stats) {
    return null;
  }

  return [
    ['Activités', stats.activityCount.toLocaleString('fr-FR')],
    ['Distance', formatDistance(stats.distanceMeters)],
    ['Temps', formatDuration(stats.movingTimeSeconds)],
    ['Dénivelé', `${Math.round(stats.elevationGainMeters).toLocaleString('fr-FR')} m`],
  ];
});

function formatDistance(meters) {
  return `${(meters / 1000).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} km`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
}

function getActivitySourceLabel(type) {
  const labels = {
    strava_summary: 'Strava',
  };

  return labels[type] || '';
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
          <h1>TerraTrace</h1>
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
      <p v-else-if="!stravaStats" class="empty-state">Connecte Strava pour afficher tes statistiques.</p>

      <section v-else class="stats-panel">
        <h2>{{ statsSourceTitle }}</h2>
        <dl class="stats-table">
          <template v-for="[label, value] in stravaStats" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
      </section>

      <footer class="strava-account">
        <template v-if="stravaStatus.connected">
          <p v-if="stravaStatus.athlete" class="account-status">
            Connecté : {{ stravaStatus.athlete.firstname }} {{ stravaStatus.athlete.lastname }}
          </p>
          <p v-else class="account-status">Connecté à Strava</p>
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

      <RouteStylePanel
        :is-footprint-mode="isFootprintMode"
        :map-style-id="mapStyleId"
        :model-value="routeColor"
        @toggle-footprint-mode="emit('toggle-footprint-mode')"
        @update-map-style="emit('update-map-style', $event)"
        @update:model-value="emit('update-route-color', $event)"
      />
    </div>
  </aside>
</template>

