const MIN_POINTS_PER_LINE = 2;
const EARTH_RADIUS_METERS = 6371000;

export async function parseGpxFile(file) {
  const text = await file.text();
  const document = new DOMParser().parseFromString(text, 'application/xml');
  const parseError = document.querySelector('parsererror');

  if (parseError) {
    throw new Error('Le fichier GPX est invalide.');
  }

  const lines = [
    ...getTrackLines(document),
    ...getRouteLines(document),
  ].filter((line) => line.coordinates.length >= MIN_POINTS_PER_LINE);

  if (lines.length === 0) {
    throw new Error('Aucun tracé exploitable dans ce GPX.');
  }

  const coordinates = lines.map((line) => line.coordinates);
  const stats = lines.reduce(
    (totals, line) => ({
      activityCount: totals.activityCount + 1,
      distanceMeters: totals.distanceMeters + getLineDistance(line.coordinates),
      movingTimeSeconds: totals.movingTimeSeconds + getLineDuration(line.times),
      elevationGainMeters: totals.elevationGainMeters + getLineElevationGain(line.elevations),
    }),
    {
      activityCount: 0,
      distanceMeters: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    },
  );

  return {
    id: `gpx-demo:${file.name}:${file.size}:${file.lastModified}`,
    fingerprint: `gpx-demo:${file.name}:${file.size}:${file.lastModified}`,
    name: file.name.replace(/\.gpx$/i, ''),
    type: 'gpx_summary',
    startTime: getLatestTime(lines) || new Date(file.lastModified || Date.now()).toISOString(),
    fileName: file.name,
    pointCount: coordinates.reduce((total, line) => total + line.length, 0),
    sourceActivityCount: lines.length,
    stats,
    geometry: {
      type: 'MultiLineString',
      coordinates,
    },
  };
}

function getTrackLines(document) {
  return Array.from(document.querySelectorAll('trkseg')).map((segment) => parsePointNodes(segment.querySelectorAll('trkpt')));
}

function getRouteLines(document) {
  return Array.from(document.querySelectorAll('rte')).map((route) => parsePointNodes(route.querySelectorAll('rtept')));
}

function parsePointNodes(nodes) {
  const coordinates = [];
  const elevations = [];
  const times = [];

  Array.from(nodes).forEach((point) => {
    const lat = Number(point.getAttribute('lat'));
    const lon = Number(point.getAttribute('lon'));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    coordinates.push([lon, lat]);
    elevations.push(readNumber(point.querySelector('ele')?.textContent));
    times.push(readTimestamp(point.querySelector('time')?.textContent));
  });

  return { coordinates, elevations, times };
}

function getLineDistance(coordinates) {
  return coordinates.slice(1).reduce((total, coordinate, index) => (
    total + getDistanceMeters(coordinates[index], coordinate)
  ), 0);
}

function getLineDuration(times) {
  const validTimes = times.filter(Number.isFinite);

  if (validTimes.length < 2) {
    return 0;
  }

  return Math.max(0, (Math.max(...validTimes) - Math.min(...validTimes)) / 1000);
}

function getLineElevationGain(elevations) {
  return elevations.slice(1).reduce((total, elevation, index) => {
    const previous = elevations[index];

    if (!Number.isFinite(elevation) || !Number.isFinite(previous)) {
      return total;
    }

    return total + Math.max(elevation - previous, 0);
  }, 0);
}

function getLatestTime(lines) {
  const latestTimestamp = Math.max(...lines.flatMap((line) => line.times).filter(Number.isFinite));
  return Number.isFinite(latestTimestamp) ? new Date(latestTimestamp).toISOString() : '';
}

function getDistanceMeters(from, to) {
  const [fromLon, fromLat] = from.map(toRadians);
  const [toLon, toLat] = to.map(toRadians);
  const deltaLat = toLat - fromLat;
  const deltaLon = toLon - fromLon;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
