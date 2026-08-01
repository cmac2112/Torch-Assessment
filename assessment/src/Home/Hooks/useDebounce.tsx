import { useState, useEffect } from "react";

export const useDebounce = (term: string, delay: number = 1000) => {
    const [debounceValue, setDebounceValue] = useState<string>(term);

    useEffect(() =>{
        const timer = setTimeout(() => {
            setDebounceValue(term);
        }, delay);

        return() => {
            clearTimeout(timer);
        }
    }, [term, delay])
    return debounceValue;
}