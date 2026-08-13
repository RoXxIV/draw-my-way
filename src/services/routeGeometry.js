import { simplify } from '@turf/simplify';

export const ROUTE_SIMPLIFICATION_TOLERANCE = 0.00002;

export function simplifyRouteGeometry(geometry) {
  try {
    const simplified = simplify(
      { type: 'Feature', properties: {}, geometry },
      {
        tolerance: ROUTE_SIMPLIFICATION_TOLERANCE,
        highQuality: true,
        mutate: false,
      },
    );

    if (isValidRouteGeometry(simplified.geometry)) {
      return simplified.geometry;
    }
  } catch {
    return geometry;
  }

  return geometry;
}

export function isValidRouteGeometry(geometry) {
  if (!geometry) {
    return false;
  }

  if (geometry.type === 'LineString') {
    return isValidLine(geometry.coordinates);
  }

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.some(isValidLine);
  }

  return false;
}

function isValidLine(coordinates) {
  return Array.isArray(coordinates) && coordinates.length >= 2;
}
