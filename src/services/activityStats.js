export const STATS_ROW_OPTIONS = [
  { key: 'activityCount', label: 'Activités' },
  { key: 'distance', label: 'Distance' },
  { key: 'movingTime', label: 'Temps' },
  { key: 'elevationGain', label: 'Dénivelé' },
];

export function getAllTimeStatsRows(activities) {
  const stats = activities.find((activity) => activity.type === 'strava_summary')?.stats;

  if (!stats) {
    return null;
  }

  return [
    { key: 'activityCount', label: 'Activités', value: stats.activityCount.toLocaleString('fr-FR') },
    { key: 'distance', label: 'Distance', value: formatDistance(stats.distanceMeters) },
    { key: 'movingTime', label: 'Temps', value: formatDuration(stats.movingTimeSeconds) },
    { key: 'elevationGain', label: 'Dénivelé', value: `${Math.round(stats.elevationGainMeters).toLocaleString('fr-FR')} m` },
  ];
}

export function getAllTimeStatsSummary(activities) {
  const rows = getAllTimeStatsRows(activities);

  if (!rows) {
    return null;
  }

  return Object.fromEntries(rows.map((row) => [row.key, row]));
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
