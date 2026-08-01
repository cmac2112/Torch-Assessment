import { useReducer, useCallback, useMemo, useRef } from "react";
import type { RowsState, RowsAction, QueryParams, EventRowData } from "../Types/types";
import { useInfiniteLoader } from "react-window-infinite-loader";
import { List } from "react-window";
import type { ListParams } from "../../../api/mockApi"
import { listEvents, isAbort, isRetryable } from "../../../api/mockApi";
import EventRow from "./EventRow";
import "../Home.css"
const BATCH_SIZE = 40;
const ROW_HEIGHT = 200;
interface EventListProps{
    queryParams: QueryParams;

}

const initialRowsState: RowsState = {
  rows: new Map(),
  total: null,
  status: "loading",
  error: undefined,
  generation: 0,
};
const rowsReducer = (state: RowsState, action: RowsAction): RowsState => {
    switch(action.type){
        case "RESET":
            return { ...initialRowsState, generation: state.generation + 1}
        case "BATCH_FAIL":
            if (action.generation !== state.generation) return state;
      // keep whatever rows we already have on screenonly fall back to the
      // full error view if the very first batch never landed, otherwise we should keep the current data on the screen
      //and attempt to keep loading it every one in a 'while' 
      return { ...state, status: state.rows.size > 0 ? "ready" : "error", error: action.error };
        case "BATCH_SUCCESS":{
            if(action.generation !== state.generation) return state;
            const rows = new Map(state.rows);
            action.items.forEach((item, i) => rows.set(action.startIndex + i, item));
            return { ...state, rows, total: action.total, status: "ready", error: undefined };
        }
    }
}
const EventsList:React.FC<EventListProps> = ({queryParams}) => {
  const [state, dispatch] = useReducer(rowsReducer, initialRowsState);

  const isRowLoaded = useCallback((index: number) =>
     state.rows.has(index),
   [state.rows]);

  // In-flight batch fetches, keyed by "startIndex-stopIndex", so we can abort
  // ones the user has already scrolled past instead of letting them finish uselessly.
  const pendingRef = useRef(new Map<string, { startIndex: number; stopIndex: number; controller: AbortController }>());

  const loadMoreRows = useCallback(
    async (startIndex: number, stopIndex: number) => {
      const generation = state.generation;
      const batchParams: ListParams = {
        ...queryParams,
        offset: startIndex,
        limit: stopIndex - startIndex + 1,
      };

      //create a new abort controller for each request, if the user passes the stopIndex before the rows
      //are done loading, then we need to cancel the request
      const batchKey = `${startIndex}-${stopIndex}`;
      const controller = new AbortController();
      pendingRef.current.set(batchKey, { startIndex, stopIndex, controller });

      const maxAttempts = 3;
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const result = await listEvents(batchParams, controller.signal);
            dispatch({
              type: "BATCH_SUCCESS",
              generation,
              startIndex,
              items: result.items,
              total: result.total,
            });
            return;
          } catch (err) {
            if (isAbort(err)) return;
            // a 4xx won't succeed on a second try — only 5xx/429/network errors are worth
            // spending a constrained connection on
            if (!isRetryable(err) || attempt === maxAttempts - 1) {
              dispatch({
                type: "BATCH_FAIL",
                generation,
                error: err instanceof Error ? err.message : String(err),
              });
              return;
            }
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          }
        }
      } finally {
        pendingRef.current.delete(batchKey);
      }
    },
    [queryParams, state.generation],
  );

  const rowCount = state.total ?? BATCH_SIZE;

  const infiniteLoaderOnRowsRendered = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    rowCount,
    minimumBatchSize: BATCH_SIZE,
    threshold: BATCH_SIZE,
  });

  // Abort any in-flight batch that has fallen outside the visible range 
  // so fast scrolling doesn't leave requests running for stuff that will never even be seen
  const onRowsRendered = useCallback(
    (indices: { startIndex: number; stopIndex: number }) => {
      infiniteLoaderOnRowsRendered(indices);
      const rangeStart = indices.startIndex - BATCH_SIZE;
      const rangeStop = indices.stopIndex + BATCH_SIZE;
      pendingRef.current.forEach(({ startIndex, stopIndex, controller }, key) => {
        if (stopIndex < rangeStart || startIndex > rangeStop) {
          controller.abort();
          pendingRef.current.delete(key);
        }
      });
    },
    [infiniteLoaderOnRowsRendered],
  );

  const rowProps = useMemo<EventRowData>(
    () => ({ rows: state.rows }),
    [state.rows],
  );

  const rowKey = useCallback(
    (index: number, data: EventRowData) => {
      const id = data.rows.get(index)?.id;
      return id !== undefined ? String(id) : index;
    },
    [],
  );

  if (state.status === "error" && state.rows.size === 0) {
    return (
      <div className="events-error">
        <p>Failed to load events: {state.error}</p>
        <button className="events-retry" onClick={() => dispatch({ type: "RESET" })}>
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "ready" && state.total === 0) {
    return <p className="events-status">No events match your filters.</p>;
  }

  return (
    <>
      {state.error && (
        <div className="events-warning">
          <span>Some rows failed to load: {state.error}</span>
          <button className="events-retry" onClick={() => dispatch({ type: "RESET" })}>
            Retry
          </button>
        </div>
      )}

      <List
        rowComponent={EventRow}
        rowCount={rowCount}
        rowHeight={ROW_HEIGHT}
        rowProps={rowProps}
        rowKey={rowKey}
        onRowsRendered={onRowsRendered}
        overscanCount={10}
        style={{ height: "80vh", width: "100%" }}
        className="events-list"
        role="list"
        aria-label="Events"
      />

      <p className="events-count">
        {state.total !== null ? `${state.rows.size} of ${state.total} loaded` : "Loading…"}
      </p>
    </>
  );
}

export default EventsList
