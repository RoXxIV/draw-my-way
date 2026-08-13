import { ref } from 'vue';
import {
  clearActivities as clearStoredActivities,
  deleteActivityById,
  getActivities,
  saveActivity,
  upsertActivity,
} from '../services/activityStorage';
import { parseGpxFile } from '../services/gpxParser.js';
import {
  disconnectStrava,
  fetchStravaAggregateActivity,
  getStravaStatus,
  openStravaConnection,
} from '../services/stravaImport.js';
import { parseTimelineJsonFile } from '../services/timelineJsonParser.js';

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

  async function importFiles(fileList) {
    const files = Array.from(fileList || []);

    if (files.length === 0) {
      return;
    }

    isImporting.value = true;
    const imported = [];
    const skipped = [];
    const failed = [];

    for (const file of files) {
      try {
        const activity = await parseGpxFile(file);
        const result = await saveActivity(activity);

        if (result.saved) {
          imported.push(activity);
          activities.value = [withVisibleFlag(activity), ...activities.value];
        } else {
          skipped.push(file.name);
        }
      } catch (error) {
        failed.push(error.message);
      }
    }

    setImportMessage(imported, skipped, failed, 'activité(s) importée(s).');
    isImporting.value = false;

    return { imported, skipped, failed };
  }

  async function importJsonFiles(fileList) {
    const files = Array.from(fileList || []);

    if (files.length === 0) {
      return;
    }

    isImporting.value = true;
    const imported = [];
    const skipped = [];
    const failed = [];

    for (const file of files) {
      try {
        const parsedActivities = await parseTimelineJsonFile(file);

        for (const activity of parsedActivities) {
          const result = await saveActivity(activity);

          if (result.saved) {
            imported.push(activity);
            activities.value = [withVisibleFlag(activity), ...activities.value];
          } else {
            skipped.push(activity.name);
          }
        }
      } catch (error) {
        failed.push(error.message);
      }
    }

    setImportMessage(imported, skipped, failed, 'trajet(s) JSON importé(s).');
    isImporting.value = false;

    return { imported, skipped, failed };
  }

  async function importStravaActivities() {
    isImporting.value = true;

    try {
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

  function toggleActivity(id) {
    activities.value = activities.value.map((activity) =>
      activity.id === id ? { ...activity, visible: !activity.visible } : activity,
    );
  }

  async function removeActivity(id) {
    await deleteActivityById(id);
    activities.value = activities.value.filter((activity) => activity.id !== id);
    setMessage('Activité supprimée.', 'info');
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

  function setImportMessage(imported, skipped, failed, successText) {
    if (imported.length > 0 && failed.length === 0 && skipped.length === 0) {
      setMessage(`${imported.length} ${successText}`, 'success');
      return;
    }

    if (failed.length === 0 && skipped.length > 0 && imported.length === 0) {
      setMessage(`Déjà importé : ${formatNames(skipped)}.`, 'info');
      return;
    }

    const parts = [];

    if (imported.length > 0) {
      parts.push(`${imported.length} importé(s)`);
    }

    if (skipped.length > 0) {
      parts.push(`${skipped.length} doublon(s) ignoré(s)`);
    }

    if (failed.length > 0) {
      parts.push(`${failed.length} erreur(s)`);
    }

    const details = failed.length > 0 ? ` ${formatNames(failed)}` : '';
    setMessage(parts.join(', ') + `.${details}`, failed.length > 0 ? 'error' : 'info');
  }

  return {
    activities,
    clearMessage,
    connectStrava,
    disconnectStravaAccount,
    importFiles,
    importJsonFiles,
    importStravaActivities,
    isCheckingStrava,
    isImporting,
    isLoading,
    loadActivities,
    message,
    messageType,
    refreshStravaStatus,
    removeActivity,
    removeAllActivities,
    stravaStatus,
    toggleActivity,
  };
}

function withVisibleFlag(activity) {
  return { ...activity, visible: activity.visible !== false };
}

function formatNames(values) {
  const shown = values.slice(0, 3).join(' ');
  const remaining = values.length - 3;

  if (remaining > 0) {
    return `${shown} ${remaining} autre(s).`;
  }

  return shown;
}
