/**
 * Roku-specific PerfettoSQL queries derived from the Roku developer documentation.
 * These target the built-in slice names emitted by Roku OS 15.1+ Perfetto instrumentation.
 */

export const FRAME_DROPS_QUERY = `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE s.name = 'swapBuffers'
ORDER BY s.dur DESC
`;

export const KEY_EVENTS_QUERY = `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE s.name = 'keyEvent'
ORDER BY s.dur DESC
`;

export const OBSERVER_QUERY = `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE s.name = 'observer.callback'
ORDER BY s.dur DESC
`;

export const RENDEZVOUS_QUERY = `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE s.name IN ('rendezvous', 'Rendezvous')
ORDER BY s.dur DESC
`;

export const SET_FIELD_QUERY = `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE s.name = 'roSGNode.setField'
ORDER BY s.dur DESC
`;

export const THREAD_OVERVIEW_QUERY = `
SELECT
  t.name AS thread_name,
  COUNT(*) AS total_slices,
  SUM(s.dur) AS total_dur
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE t.name IS NOT NULL
GROUP BY t.name
ORDER BY total_dur DESC
`;

export const TOP_SLICES_BY_THREAD_QUERY = (threadName: string, limit: number) => `
SELECT
  s.ts,
  s.dur,
  s.name,
  s.depth,
  s.track_id,
  t.name AS thread_name
FROM slice s
LEFT JOIN thread_track tt ON s.track_id = tt.id
LEFT JOIN thread t ON tt.utid = t.utid
WHERE t.name = '${threadName.replace(/'/g, "''")}'
ORDER BY s.dur DESC
LIMIT ${limit}
`;

export const TRACE_INFO_QUERY = `
SELECT
  (SELECT MAX(ts + dur) - MIN(ts) FROM slice) AS duration,
  (SELECT COUNT(*) FROM slice) AS total_slices,
  (SELECT COUNT(DISTINCT t.utid)
   FROM slice s
   LEFT JOIN thread_track tt ON s.track_id = tt.id
   LEFT JOIN thread t ON tt.utid = t.utid
   WHERE t.name IS NOT NULL) AS thread_count
`;
