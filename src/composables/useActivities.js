import { ref } from 'vue';
import {
  clearActivities as clearStoredActivities,
  getActivities,
  upsertActivity,
} from '../services/activityStorage';
import {
  disconnectStrava,
  fetchStravaAggregateActivity,
  getStravaStatus,
  openStravaConnection,
} from '../services/stravaImport.js';

export function useActivities() {
  const activities = ref([]);
  const isLoading = ref(false);
  const isImporting = ref(false);
  const isCheckingStrava = ref(false);
  const message = ref('');
  const messageType = ref('info');
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

  async function removeAllActivities() {
    await clearStoredActivities();
    activities.value = [];
    setMessage('Toutes les activités ont été supprimées.', 'info');
  }

  function clearMessage() {
    message.value = '';
  }

  function setMessage(text, type = 'info') {
    message.value = text;
    messageType.value = type;
  }

  return {
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
    refreshStravaStatus,
    removeAllActivities,
    stravaStatus,
  };
}

function withVisibleFlag(activity) {
  return { ...activity, visible: activity.visible !== false };
}
