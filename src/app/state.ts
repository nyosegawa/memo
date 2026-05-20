import { normalizeOpenTabs, resolveActiveId } from "./model";
import type { AppSnapshot, AppState, MemoSummary, SearchState } from "./types";

export const DEFAULT_SEARCH_STATE: SearchState = {
  open: false,
  query: "",
  currentIndex: 0,
  focusToken: 0,
};

export function createInitialState(): AppState {
  return {
    memos: [],
    openTabs: [],
    activeId: null,
    theme: "system",
    drafts: new Map(),
    scrollTops: new Map(),
    searches: new Map(),
    dragging: null,
    menu: null,
    helpOpen: false,
  };
}

export function applySnapshot(state: AppState, snapshot: AppSnapshot) {
  state.memos = snapshot.memos;
  state.openTabs = normalizeOpenTabs(snapshot.openTabs, snapshot.memos);
  state.activeId = resolveActiveId(snapshot.activeId, state.openTabs);
  state.theme = snapshot.theme;
  applyTheme(state);
}

export function applyTheme(state: AppState) {
  document.documentElement.dataset.theme = state.theme;
}

export function activeMemo(state: AppState): MemoSummary | null {
  return state.memos.find((memo) => memo.id === state.activeId) ?? null;
}

export function activeSearch(state: AppState): SearchState {
  return activeSearchFor(state, state.activeId);
}

export function activeSearchFor(
  state: AppState,
  id: string | null,
): SearchState {
  if (!id) return DEFAULT_SEARCH_STATE;
  return state.searches.get(id) ?? DEFAULT_SEARCH_STATE;
}

export function updateSearch(
  state: AppState,
  id: string,
  update: (current: SearchState) => SearchState,
) {
  state.searches.set(
    id,
    update(state.searches.get(id) ?? DEFAULT_SEARCH_STATE),
  );
}

export function replaceSummary(state: AppState, summary: MemoSummary) {
  state.memos = state.memos.map((memo) =>
    memo.id === summary.id ? summary : memo,
  );
}
