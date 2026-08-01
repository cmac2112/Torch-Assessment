import { useReducer, useCallback, useMemo } from "react";
import type { RowsState, RowsAction, QueryParams, EventRowData } from "../Types/types";
import { useInfiniteLoader } from "react-window-infinite-loader";
import { List } from "react-window";
import type { ListParams } from "../../../api/mockApi"
import { listEvents } from "../../../api/mockApi";
import EventRow from "./EventRow";
import "../Home.css"
const BATCH_SIZE = 40;
const ROW_HEIGHT = 150;
const LIST_HEIGHT = 640; //hard coded for now, if time allows we can compute this with a useEffect or useLayoutEffect
//bringing this on a vertical screen does not resize it vertically either
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

  const loadMoreRows = useCallback(
    async (startIndex: number, stopIndex: number) => {
      const generation = state.generation;
      const batchParams: ListParams = {
        ...queryParams,
        offset: startIndex,
        limit: stopIndex - startIndex + 1,
      };

      //add abort controllers here next to stop loading of items that were scrolled by too fast (if time allows)
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const result = await listEvents(batchParams);
          dispatch({
            type: "BATCH_SUCCESS",
            generation,
            startIndex,
            items: result.items,
            total: result.total,
          });
          return;
        } catch (err) {
          if (attempt === maxAttempts - 1) {
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
    },
    [queryParams, state.generation],
  );

  const rowCount = state.total ?? BATCH_SIZE;

  const onRowsRendered = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    rowCount,
    minimumBatchSize: BATCH_SIZE,
    threshold: BATCH_SIZE,
  });

  const rowProps = useMemo<EventRowData>(() => ({ rows: state.rows }), [state.rows]);

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
        style={{ height: LIST_HEIGHT, width: "100%" }}
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
