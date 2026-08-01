/* This file contains the mock api implementation for this assessment project
its goal is to provide semi structured data to the frontend virtualized list in batches

As per the requirements, some of the data could be malformed, inaccurate, or just missing. This mock will support
generating data with these defects to demonstrate how a frontend would handle it

This mock will also support random communication failiures and random load times to mock what would be experienced over a normal network connection, with the goal
of the front end ui handling the issues while still providing a good user experience
*/


export type RawEvent = Record<string, unknown>;

//params to be provided to the list endpoint
export interface ListParams {
  offset?: number;
  limit?: number;
  search?: string;
  fields?: string[];
  type?: string;
  sort?: 'timestamp' | 'confidence' | 'id' | 'type' | 'location' | 'description';
  dir?: 'asc' | 'desc';
}

//results returned from list endpoint
export interface ListResult {
  items: RawEvent[];
  total: number;
  offset: number;
  limit: number;
}
//related items
export interface RelatedLink {
  id: string;
  resolved: boolean;
  self: boolean;
}
//type expected for modal popup, includes related links that can be navigated to from within the modal
export interface DetailResult {
  event: RawEvent;
  related: RelatedLink[];
}

export interface TypeSummary {
  type: string;
  count: number;
  missingConfidence: number;
  meanConfidence: number;
  highConfidence: number;
}

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

export const isRetryable = (err: unknown): boolean => {
  if (isAbort(err)) return false;
  if (!(err instanceof ApiError)) return false;
  return err.status === undefined || err.status >= 500 || err.status === 429;
};

/* ---------------------------------------------------------------- */
/* Fixture                                                          */
/* ---------------------------------------------------------------- */

interface StoredEvent {
  id: string;
  type: string;
  /** Normalized for querying only. The raw shape is what callers receive. */
  timestampMs: number | null;
  confidence: number | null;
  raw: RawEvent;
}

const TYPES = ['movement', 'signal', 'alert', 'transit'];
const REGIONS = ['Region-A', 'Region-B', 'Region-C', 'Region-D', 'Region-E'];

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

//handles building all of the mock data, fontend will need to be able to handle or indicate data that is not expected to the user
function build(count: number): StoredEvent[] {
  const rand = makeRng(20260101);
  const base = Date.parse('2026-01-01T00:00:00Z');
  const rows: StoredEvent[] = [];

  for (let i = 0; i < count; i++) {
    const id = `evt-${i}`;
    const type = i % 400 === 0 ? 'unclassified_v2' : TYPES[i % TYPES.length];
    const ms = base + i * 60_000;
    const raw: RawEvent = { id, type };

    // timestamp: mixed formats, sometimes absent or unparseable
    let timestampMs: number | null = ms;
    switch (i % 71) {
      case 0:
        raw.timestamp = null;
        timestampMs = null;
        break;
      case 1:
        raw.timestamp = 'not-a-date';
        timestampMs = null;
        break;
      case 2:
        raw.timestamp = Math.floor(ms / 1000); // epoch seconds, not ISO
        break;
      case 3:
        raw.timestamp = new Date(ms).toISOString().replace('T', ' ').replace('Z', ''); // no offset
        break;
      default:
        raw.timestamp = new Date(ms).toISOString();
    }

    // confidence: string, percent scale, null, absent, out of range
    let confidence: number | null = Math.round(rand() * 10000) / 10000;
    switch (i % 37) {
      case 0:
        raw.confidence = null;
        confidence = null;
        break;
      case 1:
        confidence = null; // key omitted entirely below
        break;
      case 2:
        raw.confidence = confidence.toFixed(2); // string
        break;
      case 3:
        raw.confidence = Math.round(confidence * 100); // 0-100 scale
        break;
      case 4:
        raw.confidence = 1.4; // out of range
        confidence = null; // invalid, not a legitimately high value — treat like missing
        break;
      default:
        raw.confidence = confidence;
    }

    // location: missing, empty, or inconsistently cased
    raw.location =
      i % 17 === 0 ? null
      : i % 17 === 1 ? ''
      : i % 17 === 2 ? REGIONS[i % REGIONS.length].toUpperCase()
      : REGIONS[i % REGIONS.length];

    raw.description =
      i % 23 === 0
        ? null
        : i % 12 === 0 ? `Something happened ${i}. This is another event description` :
         `Automated detection ${i}. Correlated across two sensors; awaiting analyst review.`;

    // related_ids: sometimes dangling, sometimes self-referential
    const related: string[] = [];
    if (i % 3 === 0 && i + 4 < count) related.push(`evt-${i + 4}`);
    if (i % 5 === 0 && i > 2) related.push(`evt-${i - 3}`);
    if (i % 29 === 0) related.push(`evt-${count + i}`); // points at nothing
    if (i % 61 === 0) related.push(id); // points at itself
    raw.related_ids = related;

    // fields the client has never seen
    if (i % 13 === 0) {
      raw.sensor_id = `sn-${i % 40}`;
      raw.ingest_lag_ms = Math.floor(rand() * 4000);
    }
    if (i % 47 === 0) raw.classification = 'restricted';

    rows.push({ id, type, timestampMs, confidence, raw });
  }

  // duplicate id — same logical event ingested twice
  if (rows.length > 500) {
    rows.push({ ...rows[500], raw: { ...rows[500].raw, description: 'Duplicate ingest' } });
  }

  return rows;
}

const DB = build(100_000); //generate 100,000 rows

/* ------------------------------------------------------------------------------------------------------------------- */
/* Transport simulation - simulated normal network latency and handles aborting requests when they are no longer needed*/
/* ------------------------------------------------------------------------------------------------------------------- */

const MIN_LATENCY = 180;
const MAX_LATENCY = 900;
const FAILURE_RATE = 0.06;

function transport(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const ms = MIN_LATENCY + Math.random() * (MAX_LATENCY - MIN_LATENCY);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      if (Math.random() < FAILURE_RATE) reject(new ApiError('Upstream unavailable (this is an intended random error to demonstrate retry logic)', 503));
      else resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/* ---------------------------------------------------------------- */
/* Endpoints                                                        */
/* ---------------------------------------------------------------- */

const ALLOWED_FIELDS = new Set([
  'id', 'type', 'timestamp', 'location', 'confidence',
  'description', 'related_ids', 'sensor_id', 'ingest_lag_ms', 'classification',
]);

function sortValue(e: StoredEvent, field: NonNullable<ListParams['sort']>): string | number | null {
  switch (field) {
    case 'timestamp':
      return e.timestampMs;
    case 'confidence':
      return e.confidence;
    case 'id':
      return e.id;
    case 'type':
      return e.type;
    case 'location': {
      const loc = e.raw.location;
      return typeof loc === 'string' && loc.length > 0 ? loc.toLowerCase() : null;
    }
    case 'description': {
      const desc = e.raw.description;
      return typeof desc === 'string' && desc.length > 0 ? desc.toLowerCase() : null;
    }
  }
}

// Free-text fields a search term is matched against, in the raw payload.
const SEARCHABLE_FIELDS = ['id', 'type', 'location', 'description'];

function matchesSearch(raw: RawEvent, term: string): boolean {
  return SEARCHABLE_FIELDS.some((field) => {
    const value = raw[field];
    return typeof value === 'string' && value.toLowerCase().includes(term);
  });
}

function project(raw: RawEvent, fields?: string[]): RawEvent {
  if (!fields?.length) return raw;
  const keys = new Set(fields.filter((f) => ALLOWED_FIELDS.has(f)));
  keys.add('id'); // callers always need a key
  const slim: RawEvent = {};
  for (const k of keys) if (k in raw) slim[k] = raw[k];
  return slim;
}

//returns a list of events in batches specified by the params provided
export async function listEvents(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<ListResult> {
  await transport(signal);

  const { offset = 0, limit = 100, type, search, sort = 'timestamp', dir = 'desc' } = params;

  let rows = type ? DB.filter((e) => e.type === type) : DB;

  const term = search?.trim().toLowerCase();
  if (term) rows = rows.filter((e) => matchesSearch(e.raw, term));

  // Nulls last in both directions: a missing value is unknown, not low.
  const mult = dir === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    const av = sortValue(a, sort);
    const bv = sortValue(b, sort);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult; //ensure we are sorting numerically for id
    }
    return (av - bv) * mult;
  });

  return {
    items: rows.slice(offset, offset + limit).map((e) => project(e.raw, params.fields)),
    total: rows.length,
    offset,
    limit,
  };
}

//gets an event by ID
export async function getEvent(id: string, signal?: AbortSignal): Promise<DetailResult> {
  await transport(signal);

  const found = DB.find((e) => e.id === id);
  if (!found) throw new ApiError(`No event ${id}`, 404);

  const ids = Array.isArray(found.raw.related_ids) ? (found.raw.related_ids as string[]) : [];

  // Resolved here, not in the UI: the client can't tell a dangling reference
  // from one it simply hasn't fetched.
  const related: RelatedLink[] = ids.map((rid) => ({
    id: rid,
    resolved: DB.some((e) => e.id === rid),
    self: rid === found.id,
  }));

  return { event: found.raw, related };
}
//summarizes the data, if time allows provide chart insights or something
export async function getSummary(
  signal?: AbortSignal,
): Promise<{ total: number; byType: TypeSummary[] }> {
  await transport(signal);

  const groups = new Map<string, StoredEvent[]>();
  for (const e of DB) {
    const bucket = groups.get(e.type);
    if (bucket) bucket.push(e);
    else groups.set(e.type, [e]);
  }

  const byType = [...groups.entries()]
    .map(([type, rows]) => {
      const known = rows.filter((r) => r.confidence !== null);
      return {
        type,
        count: rows.length,
        missingConfidence: rows.length - known.length,
        meanConfidence: known.length
          ? known.reduce((s, r) => s + r.confidence!, 0) / known.length
          : 0,
        highConfidence: rows.filter((r) => (r.confidence ?? 0) >= 0.85).length,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { total: DB.length, byType };
}