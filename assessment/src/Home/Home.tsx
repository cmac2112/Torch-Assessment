import { useState, useMemo } from "react"
import type {ListParams } from "../../api/mockApi"
import { useDebounce } from "./Hooks/useDebounce"
import type {QueryParams} from "./Types/types"; 
import EventsList from "./Components/EventsList";
import "./Home.css"


const Home = () => {
    const [filters, setFilters] = useState<Omit<ListParams, "search">>();
    const [search, setSearch] = useState<string>("");
    const debouncedSearchTerm = useDebounce(search, 300);

    //dont want to refetch unless our filters or search term changes, filters live in the parent component and are passed down throuh prop to EventList
    const queryParams = useMemo<QueryParams>(
        () => ({ ...filters, search: debouncedSearchTerm }),
    [filters, debouncedSearchTerm],
  );
  return (
    <div>
        <p>filters here next</p>
      <EventsList queryParams={queryParams} />
    </div>
  )
}

export default Home
