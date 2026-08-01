import { useState, useMemo, useEffect } from "react"
import type {ListParams } from "../../api/mockApi"
import { useDebounce } from "./Hooks/useDebounce"
import type {QueryParams} from "./Types/types";
import EventsList from "./Components/EventsList";
import { EventModalProvider } from "./Context/EventModalContext";
import "./Home.css"

const EVENT_TYPES = ["movement", "signal", "alert", "transit"];
const SORT_VALUES = ["timestamp", "confidence", "id", "type", "location", "description"];
const DIR_VALUES = ["asc", "desc"];
const DEFAULT_SORT: ListParams["sort"] = "timestamp";
const DEFAULT_DIR: ListParams["dir"] = "desc";

// type/sort/dir come from the URL so a refresh (or a shared link) keeps the same filters
const readFiltersFromUrl = (): Omit<ListParams, "search"> => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const sort = params.get("sort");
  const dir = params.get("dir");
  return {
    type: EVENT_TYPES.includes(type ?? "") ? (type as string) : undefined,
    sort: SORT_VALUES.includes(sort ?? "") ? (sort as ListParams["sort"]) : undefined,
    dir: DIR_VALUES.includes(dir ?? "") ? (dir as ListParams["dir"]) : undefined,
  };
};

const Home = () => {
    const [filters, setFilters] = useState<Omit<ListParams, "search">>(readFiltersFromUrl);
    const [search, setSearch] = useState<string>("");
    const debouncedSearchTerm = useDebounce(search, 300);

    useEffect(() => {
      const params = new URLSearchParams(window.location.search);

      if (filters?.type) params.set("type", filters.type);
      else params.delete("type");

      if (filters?.sort && filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
      else params.delete("sort");

      if (filters?.dir && filters.dir !== DEFAULT_DIR) params.set("dir", filters.dir);
      else params.delete("dir");

      const query = params.toString();
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", newUrl);
    }, [filters?.type, filters?.sort, filters?.dir]);

    //dont want to refetch unless our filters or search term changes, filters live in the parent component and are passed down throuh prop to EventList
    const queryParams = useMemo<QueryParams>(
        () => ({ ...filters, search: debouncedSearchTerm }),
    [filters, debouncedSearchTerm],
  );

    // remounts EventsList whenever the query
  // itself changes, since a different query means a different row at every index
  const queryKey = `${filters?.type ?? ""}|${filters?.sort ?? DEFAULT_SORT}|${filters?.dir ?? DEFAULT_DIR}|${debouncedSearchTerm}`;

  const sortDir = filters?.dir ?? DEFAULT_DIR;

  return (
    <div className="events">
      <div className="events-toolbar" role="search">
        <div className="events-field events-field-grow">
          <label className="events-label" htmlFor="events-search">
            Search
          </label>
          <input
            id="events-search"
            className="events-search"
            type="search"
            placeholder="id, type, location, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="events-field">
          <label className="events-label" htmlFor="events-type">
            Type
          </label>
          <select
            id="events-type"
            className="events-select"
            value={filters?.type ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                type: e.target.value || undefined,
              }))
            }
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="events-field">
          <label className="events-label" htmlFor="events-sort">
            Sort by
          </label>
          <select
            id="events-sort"
            className="events-select events-sort-select"
            value={filters?.sort ?? DEFAULT_SORT}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sort: e.target.value as ListParams["sort"],
              }))
            }
          >
            <option value="timestamp">Time</option>
            <option value="confidence">Confidence</option>
            <option value="type">Type</option>
            <option value="location">Location</option>
            <option value="id">ID</option>
            <option value="description">Description</option>
          </select>
        </div>

        <div className="events-field">
          <span className="events-label" aria-hidden="true">
            Order
          </span>
          <button
            type="button"
            className="events-sort-dir"
            aria-pressed={sortDir === "asc"}
            aria-label={`Sort order: ${sortDir === "asc" ? "ascending" : "descending"}. Activate to reverse.`}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                dir: (f?.dir ?? DEFAULT_DIR) === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span aria-hidden="true">{sortDir === "asc" ? "Asc ↑" : "Desc ↓"}</span>
          </button>
        </div>
      </div>
      <EventModalProvider>
        <EventsList key={queryKey} queryParams={queryParams} />
      </EventModalProvider>
    </div>
  )
}

export default Home
