import { ref } from 'vue';
import {
  clearActivities as clearStoredActivities,
  getActivities,
  upsertActivity,
} from '../services/activityStorage';
import {
  disconnectStrava,
  fetchStravaAggregateActivity,
  fetchSelectedStravaActivities,
  fetchStravaActivitiesByDate,
  getStravaStatus,
  openStravaConnection,
} from '../services/stravaImport.js';
import { parseGpxFile } from '../services/gpxImport.js';

const STRAVA_SELECTION_COMPOSITION_ID = 'strava-selection-composition-v1';

export function useActivities() {
  const activities = ref([]);
  const isLoading = ref(false);
  const isImporting = ref(false);
  const isCheckingStrava = ref(false);
  const isSearchingStravaDate = ref(false);
  const message = ref('');
  const messageType = ref('info');
  const stravaDateSearch = ref({
    date: '',
    after: 0,
    before: 0,
    activities: [],
  });
  const stravaStatus = ref({
    configured: false,
    connected: false,
    athlete: null,
  });

  async function loadActivities() {
    isLoading.value = true;

    try {
      activities.value = (await getActivities()).map(withVisibleFlag);
      await refreshStravaStatus();
    } catch (error) {
      setMessage(`Impossible de charger les activités : ${error.message}`, 'error');
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshStravaStatus() {
    isCheckingStrava.value = true;

    try {
      stravaStatus.value = await getStravaStatus();
    } catch (error) {
      stravaStatus.value = {
        configured: false,
        connected: false,
        athlete: null,
        error: error.message,
      };
    } finally {
      isCheckingStrava.value = false;
    }
  }

  function connectStrava() {
    openStravaConnection();
  }

  async function disconnectStravaAccount() {
    try {
      await disconnectStrava();
      await clearStoredActivities();
      activities.value = [];
      resetStravaDateSearch();
      await refreshStravaStatus();
      setMessage('Compte Strava déconnecté.', 'info');
    } catch (error) {
      setMessage(error.message, 'error');
    }
  }

  async function importStravaActivities() {
    isImporting.value = true;

    try {
      // The API returns one aggregate activity to avoid hundreds of MapLibre layers.
      const activity = withVisibleFlag(await fetchStravaAggregateActivity());
      await upsertActivity(activity);
      activities.value = [activity, ...activities.value.filter((item) => item.id !== activity.id)];
      const activityCount = activity.stats?.activityCount || activity.sourceActivityCount;
      setMessage(
        `Import Strava terminé : ${activityCount} activité(s), ${activity.pointCount.toLocaleString('fr-FR')} points carto allégés.`,
        'success',
      );
      await refreshStravaStatus();
      return activity;
    } catch (error) {
      setMessage(error.message, 'error');
      return null;
    } finally {
      isImporting.value = false;
    }
  }

  async function importGpxFile(file) {
    if (!file) {
      return null;
    }

    isImporting.value = true;

    try {
      // Laisse le navigateur peindre le voile de chargement avant le parsing synchrone du GPX.
      await waitForPaint();
      const activity = withVisibleFlag(await parseGpxFile(file));
      await upsertActivity(activity);
      activities.value = [activity, ...activities.value.filter((item) => item.id !== activity.id)];
      setMessage(
        `Import GPX terminé : ${activity.sourceActivityCount} tracé(s), ${activity.pointCount.toLocaleString('fr-FR')} points.`,
        'success',
      );
      return activity;
    } catch (error) {
      setMessage(error.message, 'error');
      return null;
    } finally {
      isImporting.value = false;
    }
  }

  async function searchStravaActivitiesByDate(date) {
    isSearchingStravaDate.value = true;

    try {
      const result = await fetchStravaActivitiesByDate(date);
      stravaDateSearch.value = {
        date,
        after: result.after,
        before: result.before,
        activities: result.activities,
      };
      setMessage(`${result.activities.length} activité(s) trouvée(s) pour cette date.`, 'info');
      return result.activities;
    } catch (error) {
      stravaDateSearch.value = {
        date,
        after: 0,
        before: 0,
        activities: [],
      };
      setMessage(error.message, 'error');
      return [];
    } finally {
      isSearchingStravaDate.value = false;
    }
  }

  async function importStravaDateSelection(activityIds) {
    isImporting.value = true;

    try {
      const importedActivity = withVisibleFlag(await fetchSelectedStravaActivities({
        after: stravaDateSearch.value.after,
        before: stravaDateSearch.value.before,
        activityIds,
      }));
      const activity = withVisibleFlag(mergeStravaSelectionActivity(activities.value, importedActivity));
      await upsertActivity(activity);
      activities.value = [
        activity,
        ...activities.value.filter((item) => item.id !== activity.id && item.type !== 'strava_selection'),
      ];
      setMessage(
        `Sélection Strava importée : ${activity.sourceActivityCount} activité(s), ${activity.pointCount.toLocaleString('fr-FR')} points.`,
        'success',
      );
      return activity;
    } catch (error) {
      setMessage(error.message, 'error');
      return null;
    } finally {
      isImporting.value = false;
    }
  }

  async function removeAllActivities() {
    await clearStoredActivities();
    activities.value = [];
    resetStravaDateSearch();
    setMessage('Toutes les activités ont été supprimées.', 'info');
  }

  function clearMessage() {
    message.value = '';
  }

  function setMessage(text, type = 'info') {
    message.value = text;
    messageType.value = type;
  }

  function resetStravaDateSearch() {
    stravaDateSearch.value = {
      date: '',
      after: 0,
      before: 0,
      activities: [],
    };
  }

  return {
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
    refreshStravaStatus,
    removeAllActivities,
    searchStravaActivitiesByDate,
    stravaStatus,
    stravaDateSearch,
  };
}

function withVisibleFlag(activity) {
  return { ...activity, visible: activity.visible !== false };
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function mergeStravaSelectionActivity(currentActivities, importedActivity) {
  const currentComposition = currentActivities.find((activity) => activity.id === STRAVA_SELECTION_COMPOSITION_ID);
  const selectedActivities = [currentComposition, importedActivity].filter(Boolean);
  const coordinates = selectedActivities.flatMap((activity) => activity.geometry?.coordinates || []);
  const stats = selectedActivities.reduce(
    (totals, activity) => ({
      activityCount: totals.activityCount + Number(activity.stats?.activityCount || 0),
      distanceMeters: totals.distanceMeters + Number(activity.stats?.distanceMeters || 0),
      movingTimeSeconds: totals.movingTimeSeconds + Number(activity.stats?.movingTimeSeconds || 0),
      elevationGainMeters: totals.elevationGainMeters + Number(activity.stats?.elevationGainMeters || 0),
    }),
    {
      activityCount: 0,
      distanceMeters: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    },
  );

  return {
    ...importedActivity,
    id: STRAVA_SELECTION_COMPOSITION_ID,
    fingerprint: STRAVA_SELECTION_COMPOSITION_ID,
    name: 'Strava - composition',
    type: 'strava_selection',
    fileName: 'Composition Strava',
    pointCount: coordinates.reduce((total, line) => total + line.length, 0),
    sourceActivityCount: stats.activityCount,
    stats,
    geometry: {
      type: 'MultiLineString',
      coordinates,
    },
  };
}
