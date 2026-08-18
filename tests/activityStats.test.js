import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAllTimeStatsRows } from '../src/services/activityStats.js';

function rowsByKey(activities) {
  return Object.fromEntries(getAllTimeStatsRows(activities).map((row) => [row.key, row.value]));
}

describe('getAllTimeStatsRows', () => {
  it('returns null when no summary activity is available', () => {
    assert.equal(getAllTimeStatsRows([{ type: 'route', stats: { activityCount: 12 } }]), null);
  });

  it('aggregates Strava selections and GPX summaries', () => {
    const rows = rowsByKey([
      {
        type: 'strava_selection',
        stats: {
          activityCount: 4,
          distanceMeters: 42600,
          movingTimeSeconds: 7200,
          elevationGainMeters: 850,
        },
      },
      {
        type: 'gpx_summary',
        stats: {
          activityCount: 1,
          distanceMeters: 7400,
          movingTimeSeconds: 1800,
          elevationGainMeters: 150.4,
        },
      },
      {
        type: 'route',
        stats: {
          activityCount: 100,
          distanceMeters: 999999,
          movingTimeSeconds: 999999,
          elevationGainMeters: 999999,
        },
      },
    ]);

    assert.deepEqual(rows, {
      activityCount: '5',
      distance: '50,0 km',
      movingTime: '2 h 30',
      elevationGain: '1 000 m',
    });
  });
});
