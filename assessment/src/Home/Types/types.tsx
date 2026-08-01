import type {ListParams, RawEvent } from "../../../api/mockApi"
export type RowsAction = 
| {type: "RESET"} 
| {type: "BATCH_SUCCESS", generation: number; startIndex: number; items: RawEvent[]; total: number}
| {type: "BATCH_FAIL", generation: number; error: string; }


export type QueryParams = Omit<ListParams, "offset" | "limit">;

export interface RowsState{
    rows: Map<number, RawEvent>;
    total: number | null;
    status: string;
    error?: string;
    generation: number;
}
export interface EventRowData {
  rows: Map<number, RawEvent>;
}
