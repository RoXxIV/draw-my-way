export const STATS_ROW_OPTIONS = [
  { key: 'activityCount', label: 'Activités' },
  { key: 'distance', label: 'Distance' },
  { key: 'movingTime', label: 'Temps' },
  { key: 'elevationGain', label: 'Dénivelé' },
];

export function getAllTimeStatsRows(activities) {
  const summaryActivities = activities.filter((activity) => ['strava_summary', 'strava_selection', 'gpx_summary'].includes(activity.type) && activity.stats);

  if (summaryActivities.length === 0) {
    return null;
  }

  const stats = summaryActivities.reduce(
    (totals, activity) => ({
      activityCount: totals.activityCount + Number(activity.stats.activityCount || 0),
      distanceMeters: totals.distanceMeters + Number(activity.stats.distanceMeters || 0),
      movingTimeSeconds: totals.movingTimeSeconds + Number(activity.stats.movingTimeSeconds || 0),
      elevationGainMeters: totals.elevationGainMeters + Number(activity.stats.elevationGainMeters || 0),
    }),
    {
      activityCount: 0,
      distanceMeters: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    },
  );

  return [
    { key: 'activityCount', label: 'Activités', value: stats.activityCount.toLocaleString('fr-FR') },
    { key: 'distance', label: 'Distance', value: formatDistance(stats.distanceMeters) },
    { key: 'movingTime', label: 'Temps', value: formatDuration(stats.movingTimeSeconds) },
    { key: 'elevationGain', label: 'Dénivelé', value: `${Math.round(stats.elevationGainMeters).toLocaleString('fr-FR')} m` },
  ];
}

function formatDistance(meters) {
  return `${(meters / 1000).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} km`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}
