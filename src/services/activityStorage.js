import { openDB } from 'idb';

const DB_NAME = 'france-gpx-activities';
const DB_VERSION = 1;
const STORE_NAME = 'activities';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('startTime', 'startTime');
    }
  },
});

export async function getActivities() {
  const db = await dbPromise;
  const activities = await db.getAll(STORE_NAME);

  return activities.sort((a, b) => {
    const dateA = a.startTime ? Date.parse(a.startTime) : 0;
    const dateB = b.startTime ? Date.parse(b.startTime) : 0;
    return dateB - dateA || a.fileName.localeCompare(b.fileName);
  });
}

export async function saveActivity(activity) {
  const db = await dbPromise;
  const existing = await db.get(STORE_NAME, activity.id);

  if (existing) {
    return { saved: false, activity: existing };
  }

  await db.add(STORE_NAME, activity);
  return { saved: true, activity };
}

export async function upsertActivity(activity) {
  const db = await dbPromise;
  await db.put(STORE_NAME, activity);
  return activity;
}

export async function deleteActivityById(id) {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

export async function clearActivities() {
  const db = await dbPromise;
  await db.clear(STORE_NAME);
}
