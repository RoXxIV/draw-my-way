import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_AGGREGATE_ID = 'strava-summary-polylines-v1';
const STRAVA_PER_PAGE = 200;
const STRAVA_MAX_PAGES = 20;
const STRAVA_MIN_LINE_POINTS = 2;
const STRAVA_SIMPLIFY_EVERY_N_POINTS = 5;
const STRAVA_SCOPE = 'read,activity:read_all';
const SESSION_FILE = path.resolve(process.cwd(), '.strava-session.json');

export function configureStravaApi(server, env) {
  server.middlewares.use('/api/strava/status', async (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      assertBaseStravaConfig(env);
      const session = await readSession();
      sendJson(res, 200, {
        configured: true,
        connected: Boolean(getRefreshToken(env, session)),
        athlete: session?.athlete || null,
      });
    } catch (error) {
      sendJson(res, 200, {
        configured: false,
        connected: false,
        error: error.message,
      });
    }
  });

  server.middlewares.use('/api/strava/connect', (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      assertBaseStravaConfig(env);
      const redirectUri = buildCallbackUrl(req);
      const url = new URL(STRAVA_AUTHORIZE_URL);
      url.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('approval_prompt', 'auto');
      url.searchParams.set('scope', STRAVA_SCOPE);
      redirect(res, url.toString());
    } catch (error) {
      sendHtml(res, 500, closePage('Connexion Strava impossible', error.message));
    }
  });

  server.middlewares.use('/api/strava/callback', async (req, res) => {
    try {
      assertBaseStravaConfig(env);
      const requestUrl = new URL(req.url, buildOrigin(req));
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        sendHtml(res, 400, closePage('Connexion Strava annulée', `Strava a répondu : ${error}`));
        return;
      }

      if (!code) {
        sendHtml(res, 400, closePage('Connexion Strava impossible', 'Code OAuth manquant.'));
        return;
      }

      const token = await exchangeAuthorizationCode(env, code);
      await writeSession({
        refreshToken: token.refresh_token,
        athlete: token.athlete || null,
        updatedAt: new Date().toISOString(),
      });
      sendHtml(res, 200, closePage('Connexion Strava réussie', 'Tu peux revenir à la carte.'));
    } catch (error) {
      sendHtml(res, error.status || 500, closePage('Connexion Strava impossible', error.message));
    }
  });

  server.middlewares.use('/api/strava/disconnect', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    await clearSession();
    sendJson(res, 200, { connected: false });
  });

  server.middlewares.use('/api/strava/import', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      assertBaseStravaConfig(env);
      const session = await readSession();
      const refreshToken = getRefreshToken(env, session);

      if (!refreshToken) {
        const error = new Error('Connecte-toi avec Strava avant import.');
        error.status = 401;
        throw error;
      }

      const accessToken = await refreshAccessToken(env, refreshToken);
      const activities = await fetchAllActivities(accessToken);

      sendJson(res, 200, buildSportAggregates(activities));
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: error.message || 'Import Strava impossible.',
      });
    }
  });

  server.middlewares.use('/api/strava/activities-by-date', async (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      const accessToken = await getConnectedAccessToken(env);
      const requestUrl = new URL(req.url, buildOrigin(req));
      const range = readActivityRange(requestUrl.searchParams);
      const activities = await fetchAllActivities(accessToken, range);

      sendJson(res, 200, activities.map(toActivityListItem));
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: error.message || 'Recherche Strava impossible.',
      });
    }
  });

  server.middlewares.use('/api/strava/import-selected', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      const accessToken = await getConnectedAccessToken(env);
      const body = await readJsonBody(req);
      const activityIds = Array.isArray(body.activityIds) ? body.activityIds.map(String) : [];

      if (activityIds.length === 0) {
        const error = new Error('Sélectionne au moins une activité Strava.');
        error.status = 422;
        throw error;
      }

      const range = readActivityRange(new URLSearchParams({
        after: String(body.after || ''),
        before: String(body.before || ''),
      }));
      const activities = await fetchAllActivities(accessToken, range);
      const selectedActivities = activities.filter((activity) => activityIds.includes(String(activity.id)));

      if (selectedActivities.length === 0) {
        const error = new Error('Aucune activité sélectionnée trouvée sur cette date.');
        error.status = 422;
        throw error;
      }

      sendJson(res, 200, buildAggregateActivity(selectedActivities, {
        id: `strava-selection-${activityIds.sort().join('-')}`,
        name: 'Strava - sélection',
        type: 'strava_selection',
        fileName: 'Sélection Strava',
      }));
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: error.message || 'Import de la sélection Strava impossible.',
      });
    }
  });
}

async function getConnectedAccessToken(env) {
  assertBaseStravaConfig(env);
  const session = await readSession();
  const refreshToken = getRefreshToken(env, session);

  if (!refreshToken) {
    const error = new Error('Connecte-toi avec Strava avant import.');
    error.status = 401;
    throw error;
  }

  return refreshAccessToken(env, refreshToken);
}

function assertBaseStravaConfig(env) {
  const missing = ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'].filter((key) => !env[key]);

  if (missing.length > 0) {
    const error = new Error(`Configuration Strava manquante : ${missing.join(', ')}.`);
    error.status = 500;
    throw error;
  }
}

async function exchangeAuthorizationCode(env, code) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || 'Impossible de finaliser la connexion Strava.');
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function refreshAccessToken(env, refreshToken) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || 'Impossible de rafraîchir le token Strava.');
    error.status = response.status;
    throw error;
  }

  if (payload.refresh_token && payload.refresh_token !== refreshToken) {
    const session = await readSession();
    await writeSession({
      ...session,
      refreshToken: payload.refresh_token,
      updatedAt: new Date().toISOString(),
    });
  }

  return payload.access_token;
}

function getRefreshToken(env, session) {
  return session?.refreshToken || '';
}

async function fetchAllActivities(accessToken, options = {}) {
  const activities = [];
  const maxPages = options.maxPages || STRAVA_MAX_PAGES;

  // Strava is paginated; the cap protects the local dev server from endless imports.
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(STRAVA_ACTIVITIES_URL);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(STRAVA_PER_PAGE));

    if (options.after) {
      url.searchParams.set('after', String(options.after));
    }

    if (options.before) {
      url.searchParams.set('before', String(options.before));
    }

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(payload.message || 'Impossible de récupérer les activités Strava.');
      error.status = response.status;
      throw error;
    }

    activities.push(...payload);

    if (payload.length < STRAVA_PER_PAGE) {
      break;
    }
  }

  return activities;
}

const SPORT_FAMILY_LABELS = {
  ride: 'Vélo',
  run: 'Course',
  walk: 'Marche & rando',
  swim: 'Natation',
  other: 'Autres sports',
};

const SPORT_FAMILY_BY_TYPE = {
  Ride: 'ride',
  VirtualRide: 'ride',
  EBikeRide: 'ride',
  EMountainBikeRide: 'ride',
  GravelRide: 'ride',
  MountainBikeRide: 'ride',
  Handcycle: 'ride',
  Velomobile: 'ride',
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Walk: 'walk',
  Hike: 'walk',
  Snowshoe: 'walk',
  Swim: 'swim',
};

function getSportFamily(activity) {
  return SPORT_FAMILY_BY_TYPE[activity.sport_type || activity.type] || 'other';
}

function buildSportAggregates(activities) {
  const groups = new Map();

  for (const activity of activities) {
    const family = getSportFamily(activity);

    if (!groups.has(family)) {
      groups.set(family, []);
    }

    groups.get(family).push(activity);
  }

  const aggregates = [];

  for (const [family, familyActivities] of groups) {
    try {
      aggregates.push(buildAggregateActivity(familyActivities, {
        id: `strava-summary-${family}-v1`,
        name: `Strava – ${SPORT_FAMILY_LABELS[family]}`,
        type: 'strava_summary',
        fileName: 'API Strava',
        sportFamily: family,
      }));
    } catch {
      // Famille sans tracé exploitable (ex : natation en piscine) — ignorée.
    }
  }

  if (aggregates.length === 0) {
    const error = new Error('Aucune activité Strava avec tracé exploitable.');
    error.status = 422;
    throw error;
  }

  return aggregates;
}

function buildAggregateActivity(activities, options = {}) {
  const lines = [];
  let sourceActivities = 0;
  let pointCount = 0;
  let latestStartTime = '';
  const stats = activities.reduce(
    (totals, activity) => ({
      activityCount: totals.activityCount + 1,
      distanceMeters: totals.distanceMeters + toNumber(activity.distance),
      movingTimeSeconds: totals.movingTimeSeconds + toNumber(activity.moving_time),
      elevationGainMeters: totals.elevationGainMeters + toNumber(activity.total_elevation_gain),
    }),
    {
      activityCount: 0,
      distanceMeters: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    },
  );

  for (const activity of activities) {
    const polyline = activity.map?.summary_polyline;

    if (!polyline) {
      continue;
    }

    const line = lightenLine(decodePolyline(polyline));

    if (line.length < STRAVA_MIN_LINE_POINTS) {
      continue;
    }

    sourceActivities += 1;
    pointCount += line.length;
    lines.push(line);

    if (!latestStartTime || Date.parse(activity.start_date) > Date.parse(latestStartTime)) {
      latestStartTime = activity.start_date || latestStartTime;
    }
  }

  if (lines.length === 0) {
    const error = new Error('Aucune activité Strava avec tracé exploitable.');
    error.status = 422;
    throw error;
  }

  return {
    id: options.id || STRAVA_AGGREGATE_ID,
    fingerprint: options.id || STRAVA_AGGREGATE_ID,
    name: options.name || 'Strava - de tout temps',
    type: options.type || 'strava_summary',
    startTime: latestStartTime,
    fileName: options.fileName || 'API Strava',
    sportFamily: options.sportFamily || '',
    pointCount,
    sourceActivityCount: sourceActivities,
    stats,
    geometry: {
      type: 'MultiLineString',
      coordinates: lines,
    },
  };
}

function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function readActivityRange(searchParams) {
  const after = Number(searchParams.get('after'));
  const before = Number(searchParams.get('before'));

  if (!Number.isFinite(after) || !Number.isFinite(before) || before <= after) {
    const error = new Error('Plage de dates invalide.');
    error.status = 400;
    throw error;
  }

  return {
    after: Math.floor(after),
    before: Math.floor(before),
    maxPages: 2,
  };
}

function toActivityListItem(activity) {
  return {
    id: String(activity.id),
    name: activity.name || 'Activité Strava',
    type: activity.type || activity.sport_type || '',
    sportType: activity.sport_type || activity.type || '',
    startDate: activity.start_date || '',
    startDateLocal: activity.start_date_local || activity.start_date || '',
    distanceMeters: toNumber(activity.distance),
    movingTimeSeconds: toNumber(activity.moving_time),
    elevationGainMeters: toNumber(activity.total_elevation_gain),
    hasMap: Boolean(activity.map?.summary_polyline),
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 100000) {
        reject(Object.assign(new Error('Requête trop volumineuse.'), { status: 413 }));
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('JSON invalide.'), { status: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function decodePolyline(polyline) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < polyline.length) {
    const latitude = decodeSignedValue(polyline, index);
    index = latitude.nextIndex;
    lat += latitude.value;

    const longitude = decodeSignedValue(polyline, index);
    index = longitude.nextIndex;
    lng += longitude.value;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function decodeSignedValue(polyline, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte;

  do {
    byte = polyline.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

function lightenLine(line) {
  if (line.length <= 2) {
    return line;
  }

  // Summary polylines are already simplified; this second pass keeps the all-time map light.
  const lightened = line.filter((_, index) => index % STRAVA_SIMPLIFY_EVERY_N_POINTS === 0);
  const lastPoint = line[line.length - 1];

  if (lightened[lightened.length - 1] !== lastPoint) {
    lightened.push(lastPoint);
  }

  return lightened;
}

async function readSession() {
  try {
    return JSON.parse(await readFile(SESSION_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeSession(session) {
  await writeFile(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
}

async function clearSession() {
  await rm(SESSION_FILE, { force: true });
}

function buildCallbackUrl(req) {
  return `${buildOrigin(req)}/api/strava/callback`;
}

function buildOrigin(req) {
  const host = req.headers.host || '127.0.0.1:5173';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`;
}

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader('location', url);
  res.end();
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
}

function closePage(title, message) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; color: #17212b; }
      button { border: 0; border-radius: 6px; padding: 10px 14px; background: #fc4c02; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <button type="button" onclick="window.close()">Fermer</button>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'strava-oauth-complete' }, window.location.origin);
        setTimeout(() => window.close(), 400);
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
