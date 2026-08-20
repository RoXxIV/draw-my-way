export async function getStravaStatus() {
  const response = await fetch('/api/strava/status');
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Statut Strava indisponible.');
  }

  return payload;
}

export function openStravaConnection() {
  const popup = window.open('/api/strava/connect', 'strava-connect', 'width=720,height=760');

  if (!popup) {
    window.location.href = '/api/strava/connect';
  }
}

export async function disconnectStrava() {
  const response = await fetch('/api/strava/disconnect', {
    method: 'POST',
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Déconnexion Strava impossible.');
  }

  return payload;
}

export async function fetchStravaSportAggregates() {
  const response = await fetch('/api/strava/import', {
    method: 'POST',
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Import Strava impossible.');
  }

  return Array.isArray(payload) ? payload : [payload];
}

export async function fetchStravaActivitiesByDate(date) {
  const range = getLocalDayRange(date);
  const params = new URLSearchParams({
    after: String(range.after),
    before: String(range.before),
  });
  const response = await fetch(`/api/strava/activities-by-date?${params}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Recherche Strava impossible.');
  }

  return {
    ...range,
    activities: payload,
  };
}

export async function fetchSelectedStravaActivities({ after, before, activityIds }) {
  const response = await fetch('/api/strava/import-selected', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ after, before, activityIds }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Import de la sélection Strava impossible.');
  }

  return payload;
}

function getLocalDayRange(date) {
  if (!date) {
    throw new Error('Choisis une date.');
  }

  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error('Date invalide.');
  }

  return {
    after: Math.floor(start.getTime() / 1000),
    before: Math.ceil(end.getTime() / 1000),
  };
}
