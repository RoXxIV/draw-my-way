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

export async function fetchStravaAggregateActivity() {
  const response = await fetch('/api/strava/import', {
    method: 'POST',
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Import Strava impossible.');
  }

  return payload;
}
