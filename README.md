# Event Monitoring Interface

A frontend for analysts to explore a large, frequently-updated, structurally inconsistent event feed.

Built with React 19 + TypeScript + Vite. The data layer is a mock API that deliberately reproduces the
conditions described in the brief: 100,000 events, mixed field shapes, missing values, dangling
references, variable latency, and intermittent request failures.

---

## Running it

Requires Node.js 20+ and npm.

```bash
cd assessment
npm install
npm run dev
```

Vite serves on <http://localhost:5173>.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

There is no backend to start — see [Mock API](#mock-api) below.

---

## What's implemented

- **Virtualized event list** over 100k rows — only visible rows are mounted, fetched in batches of 40 as you scroll.
- **Search** across id, type, location, and description, debounced at 300ms.
- **Filter** by event type; **sort** by any of six fields in either direction.
- **Detail modal** with full metadata, including fields the client doesn't know about ahead of time.
- **Related-event navigation** with a breadcrumb trail, so an analyst can drill through a chain of
  linked events and step back to any point in it.
- **Shareable filter state** — type/sort/direction live in the URL query string, so a refresh or a
  pasted link reproduces the same view.
- **Loading, empty, error, and partial-failure states**, with retry.
- **Request cancellation and retry with exponential backoff** for flaky or slow connections.

---

## Architecture

```
assessment/
├── api/
│   └── mockApi.ts              # Data layer: fixture generation, query/sort/filter, transport simulation
├── src/
│   ├── Home/
│   │   ├── Home.tsx            # Toolbar; owns filter + search state; syncs filters to the URL
│   │   ├── Home.css
│   │   ├── Components/
│   │   │   ├── EventsList.tsx  # Virtualized list; owns row/paging state via useReducer
│   │   │   ├── EventRow.tsx    # Presentational row; renders one event or a skeleton
│   │   │   └── EventModal.tsx  # Detail view; owns its own fetch for the selected event
│   │   ├── Context/
│   │   │   └── EventModalContext.tsx  # Provides the selection stack, renders the modal
│   │   ├── Hooks/
│   │   │   ├── useDebounce.tsx
│   │   │   └── useEventModal.tsx
│   │   └── Types/types.tsx
│   ├── index.css               # Design tokens (light/dark), base typography
│   └── main.tsx
└── index.html
```

### Why the state is split this way

State lives at the lowest level that needs to own it, rather than in one global store:

- **`Home`** owns the *query* — search text, type filter, sort field, sort direction. It is the only
  thing that needs to know about them as a unit, and it is where they get serialized to the URL.
- **`EventsList`** owns the *result set* — which rows have arrived, the total count, and whether the
  last fetch failed. This is the only genuinely complex state in the app, so it uses `useReducer`
  rather than several `useState` calls (see below).
- **`EventModal`** owns its *own* fetch. The list has no reason to know a detail request is in flight,
  and the modal needs data the list never requested.
- **`EventModalContext`** carries only the selection stack (an array of event ids). It's context and
  not props because any row at any scroll offset can open the modal, and threading a callback through
  the virtualizer's row props for that alone isn't worth it.

There is no Redux/Zustand here on purpose. Nothing in this app is shared widely enough to justify it;
the one piece of cross-cutting state (which event is selected) is a string array.

### Why `useReducer` for the list

The list has three interacting concerns — accumulated rows, total count, and error status — plus one
that's easy to miss: **responses arriving for a query that is no longer on screen**. Three separate
`useState` calls make invalid combinations representable (rows present *and* status `"loading"` *and*
a stale error) and make each update a manual, order-sensitive sequence.

The reducer collapses that into typed transitions, and carries a `generation` counter. Every dispatch
names the generation it was issued under, and the reducer drops any action whose generation no longer
matches. That's the guard against a slow batch landing after the user has already changed filters and
overwriting good data with stale rows.

### Data flow

```
Home                     EventsList                    mockApi
────                     ──────────                    ───────
search  ──debounce 300ms──┐
type    ─────────────────►│
sort    ─────────────────►├─ queryParams ─┐
dir     ─────────────────►┘               │
                                          ▼
                       scroll ──► useInfiniteLoader ──► loadMoreRows(start, stop)
                                                              │
                                                    listEvents(params, signal)
                                                              │
                                          ┌───────────────────┘
                                          ▼
                              dispatch BATCH_SUCCESS / BATCH_FAIL
                                          │
                                          ▼
                              rows: Map<index, RawEvent>
                                          │
                                          ▼
                                  EventRow (index → row | skeleton)
                                          │
                                     click / Enter
                                          ▼
                              EventModalContext.openEvent(id)
                                          │
                                          ▼
                              EventModal ──► getEvent(id, signal)
```

Rows are held in a `Map<number, RawEvent>` keyed by **absolute index**, not an array. Batches can
arrive out of order and with gaps — a user who drags the scrollbar from row 0 to row 80,000 produces
exactly that — and a sparse map represents it without placeholder padding.

When the query changes, `EventsList` is remounted via a `key` derived from the query rather than
reset in place. A different query means a different event at every index, so there is nothing in the
old state worth keeping, and a remount is a cheaper correctness guarantee than a partial reset.

---

## Mock API

`assessment/api/mockApi.ts` stands in for a backend. It is a module, not a server, to keep setup to
`npm install && npm run dev`; the exported functions are async and take an `AbortSignal`, so swapping
them for `fetch` calls against a real service (ASP.NET, Spring Boot, Flask) is a change to three
function bodies and nothing else.

Three endpoints:

| Function | Purpose |
| --- | --- |
| `listEvents(params, signal)` | Paged, filtered, sorted, searched slice + total count |
| `getEvent(id, signal)` | One event plus its resolved related-links |
| `getSummary(signal)` | Per-type aggregates (not yet consumed by the UI — see [What's next](#whats-next)) |

**All filtering, sorting, and searching happen server-side.** The client sends `offset`/`limit` and
receives only that window. This matters for the scaling question: the client never holds the dataset,
so the interface behaves the same at 100k rows as at 100.

`listEvents` also accepts a `fields` parameter that projects the response down to the columns the
caller actually renders — the list view has no use for `description` or `related_ids`.

### Simulated network conditions

The transport layer adds 180–900ms of latency and fails 6% of requests with a 503. This is on by
default because error paths that are never exercised are error paths that don't work. Constants are
at the top of `mockApi.ts` (`MIN_LATENCY`, `MAX_LATENCY`, `FAILURE_RATE`) if you want a clean run.

---

## Handling messy data

The fixture generator produces the defects a real ingest pipeline produces, on fixed intervals so
they're reproducible:

| Field | Defects injected |
| --- | --- |
| `timestamp` | `null`, unparseable string, epoch **seconds** instead of ms, ISO without a UTC offset |
| `confidence` | `null`, key absent entirely, numeric string, 0–100 scale instead of 0–1, out of range (`1.4`) |
| `location` | `null`, empty string, inconsistent casing |
| `description` | `null` |
| `related_ids` | dangling references, self-references |
| `type` | an `unclassified_v2` value the client was never built for |
| *(whole records)* | unknown fields (`sensor_id`, `ingest_lag_ms`, `classification`), and one duplicate id |

The UI's rules for these:

- **Missing is rendered as `—`, never as zero.** A missing confidence is *unknown*, not *low*, and
  collapsing that distinction would actively mislead an analyst.
- **Sorting puts nulls last in both directions**, for the same reason — an unknown value doesn't
  belong at either end of a ranked list.
- **Unknown `type` values render rather than crash.** A new event type shipped by the backend is a
  display gap, not an outage.
- **Related-link validity is resolved server-side**, not in the UI. The API returns each link tagged
  `resolved` or `self`, because the client fundamentally *cannot* tell a dangling reference from one
  it simply hasn't fetched — it only ever holds a window. The modal renders that distinction directly
  so the analyst knows a link is broken rather than clicking into an error.
- **Coercion is conservative.** Numeric strings and 0–100-scale confidences are normalized; a value
  outside any plausible range is treated as missing rather than guessed at.

---

## Performance and bandwidth

The brief calls out limited bandwidth and critical responsiveness, so these were treated as
requirements rather than polish:

- **Virtualized rendering.** ~14 DOM nodes regardless of result-set size.
- **Windowed fetching.** 40 rows per request, triggered ahead of the viewport by the same margin.
- **Debounced search** at 300ms — typing "Region-A" is one request, not eight.
- **Request cancellation.** Every batch carries an `AbortController`. On each render pass, in-flight
  batches whose range has fallen more than one batch outside the viewport are aborted. Fast scrolling
  through a long list otherwise leaves a trail of requests fetching rows nobody will look at, which
  is precisely the wrong behaviour on a constrained link.
- **Retry with exponential backoff** (3 attempts, 1s/2s) for the failure classes worth retrying —
  5xx, 429, and network errors. 4xx responses and aborts are not retried.
- **Partial failure degrades, it doesn't reset.** If a batch fails while rows are already on screen,
  the existing rows stay and a dismissible warning appears. The full-screen error state is reserved
  for the case where the *first* batch never landed and there's genuinely nothing to show.
- **Field projection** so the list request doesn't carry description text it won't render.
- **Skeleton rows** for indices not yet loaded, so scrolling stays at a stable scroll height and the
  layout doesn't jump as batches arrive.

---

## Assumptions

1. **The backend can filter, sort, and paginate.** The whole design rests on this. If it could only
   return an undifferentiated firehose, the answer would be an indexed local store (IndexedDB or a
   worker-side index), not a different UI.
2. **Event ids are the analyst's primary handle**, so they're always visible and monospaced, and
   they're what the breadcrumb trail displays.
3. **Analysts arrive with a question**, not to browse — search and filter are the primary controls,
   and the list is the answer to a query rather than an inbox to work through.
4. **Duplicate ids are possible** (same logical event ingested twice) and are a data-quality signal
   worth surfacing, not something to silently deduplicate.
5. **Recency is the default ordering** an analyst wants, so the default sort is timestamp descending.
6. **Single user, no auth.** Out of scope for the exercise.

---

## Tradeoffs considered

**Infinite scroll over pagination.** Paging through 100k events 25 at a time is a bad experience for
someone scanning for a pattern. The tradeoff is that infinite scroll gives up a stable "page 4" that
can be shared or returned to. Filters are in the URL to recover part of that; a scroll-offset
parameter would recover the rest.

**Remount over in-place reset on query change.** Remounting throws away rows that might still be
valid under the new query. It's the right call anyway: correctly reconciling which cached indices
survive a sort change is a subtle problem, and the cost of being wrong is showing an analyst the
wrong event under the right label.

**Mock module over a real HTTP server.** Faster to run and review, at the cost of not exercising real
serialization or CORS. Mitigated by keeping the API surface `async` and `AbortSignal`-shaped so it
maps onto `fetch` without touching callers.

**Cards over a dense table.** Cards read well and were quicker to build, but they cost vertical
space — see the first item under [What's next](#whats-next)

**Filters in the URL, selected event not.** Filter state is shareable; a link to a specific event
isn't yet. Worth closing, but it needs modal state to integrate with browser history properly rather
than just appending a query parameter.

---

## What's next

Known gaps, in the order I'd address them:

1. **Density.** Rows are a fixed 200px, so roughly four events are visible at once. For an analyst
   scanning for anomalies that's far too few. I'd move the list to a compact table row (~48px) and
   keep the card treatment for the detail modal — the virtualization work already done pays off much
   better at 20+ visible rows.
2. **Anomaly surfacing.** The brief asks the interface to help *identify* anomalies, and right now it
   only helps *find* events. `getSummary()` is written but not yet consumed. I'd add a per-type
   summary strip above the list, a quality marker on rows with missing or coerced fields, and filters
   for "low confidence" and "has unresolved links".
3. **Batch-request deduplication.** Deduplication of in-flight ranges currently relies on internal
   state in `react-window-infinite-loader`, which resets whenever the `isRowLoaded` identity changes —
   i.e. after every successful batch. A range that failed all its retries can therefore be re-requested
   on subsequent scrolls. This needs an explicit requested/failed range set owned by the reducer.
4. **Focus management in the modal.** Escape and initial focus are handled; a full focus trap and
   restoring focus to the originating row on close are not.
5. **Tests.** None currently. The highest-value targets are the reducer's generation-guard logic and
   the normalization functions. both are pure and both are where a regression would be
   silent.
6. **Keyboard navigation in the list.** Arrow-key movement between rows, for the "usability under
   time pressure" case where an analyst shouldn't need the mouse.

---

## Notes on tooling

AI assistance was used during development, primarily for CSS and for scaffolding the fixture
generator. The architecture decisions described above — the reducer with generation guards, the
sparse index map, server-side link resolution, the abort-on-scroll-past behaviour — are mine, and
the commit history reflects which parts were which.
