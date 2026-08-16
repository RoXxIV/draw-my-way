export async function fetchSharedMaps() {
  const response = await fetch('/api/shared-maps');
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Galerie indisponible.');
  }

  return payload.maps || [];
}

export async function shareMapImage({ imageDataUrl, stats }) {
  const response = await fetch('/api/shared-map', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      imageDataUrl,
      stats,
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Partage impossible.');
  }

  return payload.map;
}
