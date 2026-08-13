import { simplifyRouteGeometry } from './routeGeometry.js';

export async function parseTimelineJsonFile(file) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error(`${file.name} n'est pas un fichier JSON.`);
  }

  const buffer = await file.arrayBuffer();
  const fileHash = await sha256(buffer);
  const text = new TextDecoder('utf-8').decode(buffer);
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${file.name} contient un JSON invalide.`);
  }

  const segments = Array.isArray(data.semanticSegments) ? data.semanticSegments : [];

  if (segments.length === 0) {
    throw new Error(`${file.name} ne contient pas de segments Timeline exploitables.`);
  }

  const activities = segments
    .map((segment, index) => buildActivity(segment, index, file.name, fileHash))
    .filter(Boolean);

  if (activities.length === 0) {
    throw new Error(`${file.name} ne contient aucune trajectoire GPS exploitable.`);
  }

  return activities;
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildActivity(segment, index, fileName, fileHash) {
  if (!Array.isArray(segment.timelinePath)) {
    return null;
  }

  const coordinates = segment.timelinePath
    .map((point) => parseLatLng(point.point))
    .filter(Boolean);

  if (coordinates.length < 2) {
    return null;
  }

  const geometry = simplifyRouteGeometry({
    type: 'LineString',
    coordinates,
  });

  return {
    id: `${fileHash}-${index}`,
    fingerprint: `${fileHash}-${index}`,
    name: `Trajet Timeline ${formatDateForName(segment.startTime, index)}`,
    type: 'timeline_json',
    startTime: segment.startTime || '',
    endTime: segment.endTime || '',
    fileName,
    pointCount: coordinates.length,
    geometry,
  };
}

function parseLatLng(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const matches = value.match(/-?\d+(?:\.\d+)?/g);

  if (!matches || matches.length < 2) {
    return null;
  }

  const lat = Number(matches[0]);
  const lng = Number(matches[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return [lng, lat];
}

function formatDateForName(value, index) {
  if (!value) {
    return `#${index + 1}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `#${index + 1}`;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
