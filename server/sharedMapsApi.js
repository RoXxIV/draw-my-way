const SHARED_MAPS_BUCKET = 'shared-maps';
const SHARED_MAPS_TABLE = 'shared_maps';
const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const MAX_JSON_BYTES = 10 * 1024 * 1024;

export function configureSharedMapsApi(server, env) {
  server.middlewares.use('/api/shared-maps', async (req, res) => {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      assertSupabaseConfig(env);
      const maps = await listSharedMaps(env);
      sendJson(res, 200, { maps });
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: error.message || 'Galerie TerraTrace indisponible.',
      });
    }
  });

  server.middlewares.use('/api/shared-map', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Méthode non autorisée.' });
      return;
    }

    try {
      assertSupabaseConfig(env);
      const session = await readStravaSession();

      if (!session?.athlete?.id) {
        const error = new Error('Connecte Strava avant de partager une image.');
        error.status = 401;
        throw error;
      }

      const payload = await readJsonBody(req);
      const imageBuffer = parseImageDataUrl(payload.imageDataUrl);
      const athleteId = String(session.athlete.id);
      const updatedAt = new Date().toISOString();
      const imagePath = `strava-${athleteId}.png`;

      await uploadSharedImage(env, imagePath, imageBuffer);

      const publicUrl = buildPublicImageUrl(env, imagePath, updatedAt);
      const [sharedMap] = await upsertSharedMap(env, {
        strava_athlete_id: athleteId,
        image_path: imagePath,
        image_url: publicUrl,
        stats: normalizeStats(payload.stats),
        updated_at: updatedAt,
      });

      sendJson(res, 200, { map: toPublicSharedMap(sharedMap) });
    } catch (error) {
      sendJson(res, error.status || 500, {
        error: error.message || 'Partage TerraTrace impossible.',
      });
    }
  });
}

async function listSharedMaps(env) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${SHARED_MAPS_TABLE}`);
  url.searchParams.set('select', 'id,image_url,stats,updated_at');
  url.searchParams.set('order', 'updated_at.desc');
  url.searchParams.set('limit', '60');

  const response = await supabaseFetch(env, url, {
    headers: {
      accept: 'application/json',
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throwSupabaseError(response, payload, 'Impossible de charger les cartes partagées.');
  }

  return payload.map(toPublicSharedMap);
}

async function uploadSharedImage(env, imagePath, imageBuffer) {
  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');
  const response = await supabaseFetch(
    env,
    `${env.SUPABASE_URL}/storage/v1/object/${SHARED_MAPS_BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        'cache-control': '3600',
        'content-type': 'image/png',
        'x-upsert': 'true',
      },
      body: imageBuffer,
    },
  );

  if (!response.ok) {
    const payload = await safeJson(response);
    throwSupabaseError(
      response,
      payload,
      `Upload impossible. Vérifie que le bucket public "${SHARED_MAPS_BUCKET}" existe dans Supabase Storage.`,
    );
  }
}

async function upsertSharedMap(env, row) {
  const response = await supabaseFetch(env, `${env.SUPABASE_URL}/rest/v1/${SHARED_MAPS_TABLE}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });
  const payload = await response.json();

  if (!response.ok) {
    throwSupabaseError(
      response,
      payload,
      `Sauvegarde impossible. Vérifie que la table "${SHARED_MAPS_TABLE}" existe avec une contrainte unique sur strava_athlete_id.`,
    );
  }

  return payload;
}

function buildPublicImageUrl(env, imagePath, version) {
  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');
  return `${env.SUPABASE_URL}/storage/v1/object/public/${SHARED_MAPS_BUCKET}/${encodedPath}?v=${encodeURIComponent(version)}`;
}

function normalizeStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return {};
  }

  return {
    activityCount: toPublicStat(stats.activityCount),
    distance: toPublicStat(stats.distance),
    movingTime: toPublicStat(stats.movingTime),
    elevationGain: toPublicStat(stats.elevationGain),
  };
}

function toPublicStat(stat) {
  if (!stat || typeof stat !== 'object') {
    return null;
  }

  return {
    label: String(stat.label || '').slice(0, 40),
    value: String(stat.value || '').slice(0, 40),
  };
}

function toPublicSharedMap(map) {
  return {
    id: map.id,
    imageUrl: map.image_url,
    stats: map.stats || {},
    updatedAt: map.updated_at,
  };
}

function parseImageDataUrl(imageDataUrl) {
  const match = String(imageDataUrl || '').match(/^data:image\/png;base64,([a-zA-Z0-9+/=]+)$/);

  if (!match) {
    const error = new Error('Image PNG invalide.');
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(match[1], 'base64');

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error('Image trop lourde pour le partage.');
    error.status = 413;
    throw error;
  }

  return buffer;
}

async function readJsonBody(req) {
  let raw = '';

  for await (const chunk of req) {
    raw += chunk;

    if (Buffer.byteLength(raw, 'utf8') > MAX_JSON_BYTES) {
      const error = new Error('Requête trop lourde.');
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(raw || '{}');
  } catch {
    const error = new Error('JSON invalide.');
    error.status = 400;
    throw error;
  }
}

async function readStravaSession() {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  try {
    return JSON.parse(await readFile(path.resolve(process.cwd(), '.strava-session.json'), 'utf8'));
  } catch {
    return null;
  }
}

function assertSupabaseConfig(env) {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !env[key]);

  if (missing.length > 0) {
    const error = new Error(`Configuration Supabase manquante : ${missing.join(', ')}.`);
    error.status = 500;
    throw error;
  }
}

function supabaseFetch(env, url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function throwSupabaseError(response, payload, fallbackMessage) {
  const message = payload?.message || payload?.error || '';
  const error = new Error(
    message.includes(`'public.${SHARED_MAPS_TABLE}'`)
      ? `La table Supabase "${SHARED_MAPS_TABLE}" n'existe pas encore. Exécute supabase/schema.sql dans le SQL Editor.`
      : message || fallbackMessage,
  );
  error.status = response.status;
  throw error;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
