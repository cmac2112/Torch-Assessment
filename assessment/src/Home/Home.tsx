import { useState, useMemo } from "react"
import type {ListParams } from "../../api/mockApi"
import { useDebounce } from "./Hooks/useDebounce"
import type {QueryParams} from "./Types/types"; 
import EventsList from "./Components/EventsList";
import { EventModalProvider } from "./Context/EventModalContext";
import "./Home.css"

const EVENT_TYPES = ["movement", "signal", "alert", "transit"];

const Home = () => {
    const [filters, setFilters] = useState<Omit<ListParams, "search">>();
    const [search, setSearch] = useState<string>("");
    const debouncedSearchTerm = useDebounce(search, 300);

    //dont want to refetch unless our filters or search term changes, filters live in the parent component and are passed down throuh prop to EventList
    const queryParams = useMemo<QueryParams>(
        () => ({ ...filters, search: debouncedSearchTerm }),
    [filters, debouncedSearchTerm],
  );

    // remounts EventsList (discarding its cached rows) whenever the query
  // itself changes, since a different query means a different row at every index
  const queryKey = `${filters?.type ?? ""}|${filters?.sort ?? "timestamp"}|${filters?.dir ?? "desc"}|${debouncedSearchTerm}`;

  return (
    <div className="events">
      <div className="events-toolbar">
        <input
          className="events-search"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
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

        <select
          className="events-sort-select"
          value={filters?.sort ?? "timestamp"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              sort: e.target.value as ListParams["sort"],
            }))
          }
        >
          <option value="timestamp">Sort: Time</option>
          <option value="confidence">Sort: Confidence</option>
          <option value="type">Sort: Type</option>
          <option value="location">Sort: Location</option>
          <option value="id">Sort: ID</option>
          <option value="description">Sort: Description</option>
        </select>

        <button
          type="button"
          className="events-sort-dir"
          onClick={() =>
            setFilters((f) => ({
              ...f,
              dir: (f?.dir ?? "desc") === "asc" ? "desc" : "asc",
            }))
          }
        >
          {(filters?.dir ?? "desc") === "asc" ? "Asc ↑" : "Desc ↓"}
        </button>
      </div>
      <EventModalProvider>
        <EventsList key={queryKey} queryParams={queryParams} />
      </EventModalProvider>
    </div>
  )
}

export default Home
