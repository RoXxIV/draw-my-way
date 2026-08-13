import { gpx } from '@tmcw/togeojson';
import { simplifyRouteGeometry } from './routeGeometry.js';

export { ROUTE_SIMPLIFICATION_TOLERANCE as GPX_SIMPLIFICATION_TOLERANCE } from './routeGeometry.js';

export async function parseGpxFile(file) {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    throw new Error(`${file.name} n'est pas un fichier GPX.`);
  }

  const buffer = await file.arrayBuffer();
  const id = await sha256(buffer);
  const text = new TextDecoder('utf-8').decode(buffer);
  const xml = new DOMParser().parseFromString(text, 'application/xml');

  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${file.name} contient un XML invalide.`);
  }

  const geojson = gpx(xml);
  const geometry = extractLineGeometry(geojson);

  if (!geometry) {
    throw new Error(`${file.name} ne contient pas de trace GPS exploitable.`);
  }

  const activity = {
    id,
    fingerprint: id,
    name: readTrackText(xml, 'name') || stripExtension(file.name),
    type: readTrackText(xml, 'type') || '',
    startTime: readFirstText(xml, 'time') || '',
    fileName: file.name,
    pointCount: countElements(xml, 'trkpt'),
    geometry: simplifyRouteGeometry(geometry),
  };

  if (activity.pointCount === 0) {
    activity.pointCount = countPoints(activity.geometry);
  }

  return activity;
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function extractLineGeometry(featureCollection) {
  const lines = [];

  for (const feature of featureCollection.features || []) {
    const geometry = feature.geometry;

    if (!geometry) {
      continue;
    }

    if (geometry.type === 'LineString' && isValidLine(geometry.coordinates)) {
      lines.push(geometry.coordinates);
    }

    if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        if (isValidLine(line)) {
          lines.push(line);
        }
      }
    }
  }

  if (lines.length === 0) {
    return null;
  }

  if (lines.length === 1) {
    return { type: 'LineString', coordinates: lines[0] };
  }

  return { type: 'MultiLineString', coordinates: lines };
}

function isValidLine(coordinates) {
  return Array.isArray(coordinates) && coordinates.length >= 2;
}

function countPoints(geometry) {
  if (geometry.type === 'LineString') {
    return geometry.coordinates.length;
  }

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.reduce((total, line) => total + line.length, 0);
  }

  return 0;
}

function readTrackText(xml, localName) {
  const track = findFirstElement(xml, 'trk');
  if (!track) {
    return readFirstText(xml, localName);
  }

  const child = Array.from(track.children).find((element) => element.localName === localName);
  return child?.textContent?.trim() || readFirstText(xml, localName);
}

function readFirstText(xml, localName) {
  return findFirstElement(xml, localName)?.textContent?.trim() || '';
}

function findFirstElement(root, localName) {
  return Array.from(root.getElementsByTagName('*')).find((element) => element.localName === localName);
}

function countElements(root, localName) {
  return Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === localName).length;
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, '');
}
