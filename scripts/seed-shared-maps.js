import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SHARED_MAPS_TABLE = 'shared_maps';
const TARGET_COUNT = Number(process.argv[2] || 50);

const env = await readLocalEnv();

assertEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const existingMaps = await fetchRows(env, {
  select: 'strava_athlete_id,image_path,image_url,stats,updated_at',
  order: 'updated_at.desc',
  limit: 1,
});

if (existingMaps.length === 0) {
  throw new Error('Aucune carte existante a dupliquer. Partage une photo une premiere fois.');
}

const source = existingMaps[0];
const now = Date.now();
const rows = Array.from({ length: TARGET_COUNT }, (_, index) => {
  const updatedAt = new Date(now - index * 60 * 60 * 1000).toISOString();

  return {
    strava_athlete_id: `seed-${randomUUID()}`,
    image_path: source.image_path,
    image_url: `${source.image_url.split('?')[0]}?seed=${index + 1}&v=${encodeURIComponent(updatedAt)}`,
    stats: source.stats || {},
    updated_at: updatedAt,
  };
});

await insertRows(env, rows);

console.log(`${rows.length} cartes de test ajoutees dans ${SHARED_MAPS_TABLE}.`);

async function fetchRows(env, params) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${SHARED_MAPS_TABLE}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await supabaseFetch(env, url, {
    headers: {
      accept: 'application/json',
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Lecture Supabase impossible.');
  }

  return payload;
}

async function insertRows(env, rows) {
  const response = await supabaseFetch(env, `${env.SUPABASE_URL}/rest/v1/${SHARED_MAPS_TABLE}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || 'Insertion Supabase impossible.');
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

async function readLocalEnv() {
  const file = await readFile(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const values = {};

  for (const line of file.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+?)\s*=\s*(.*)\s*$/);

    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return values;
}

function assertEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Variables manquantes dans .env.local : ${missing.join(', ')}`);
  }
}
