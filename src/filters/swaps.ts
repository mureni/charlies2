import type { Filter } from "@/filters";
import { Filters } from "@/filters";
import { Swaps } from "@/filters/swaps/manager";

const FILTER_ID = "swaps";

const createPreBrainFilter = (): Filter => ({
   id: FILTER_ID,
   stage: "preBrain",
   apply: (text, context, phase) => (phase === "learn" ? Swaps.apply(text, context, "learn") : text)
});

const createPostBrainFilter = (): Filter => ({
   id: FILTER_ID,
   stage: "postBrain",
   apply: (text, context, phase) => (phase === "respond" ? Swaps.apply(text, context, "respond") : text)
});

const filters: Filter[] = [createPreBrainFilter(), createPostBrainFilter()];

const registerSwapFilters = (): void => {
   Filters.unregister(FILTER_ID);
   Filters.registerAll(filters);
};

const unregisterSwapFilters = (): void => {
   Filters.unregister(FILTER_ID);
};

export type RegisterSwapFilters = typeof registerSwapFilters;
export type UnregisterSwapFilters = typeof unregisterSwapFilters;
export { filters, registerSwapFilters, unregisterSwapFilters };
