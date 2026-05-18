import { normalizeOpenTabs, resolveActiveId } from "./model";
import type { AppSnapshot, AppState, MemoSummary } from "./types";

export function createInitialState(): AppState {
  return {
    memos: [],
    openTabs: [],
    activeId: null,
    theme: "system",
    drafts: new Map(),
    scrollTops: new Map(),
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

export function replaceSummary(state: AppState, summary: MemoSummary) {
  state.memos = state.memos.map((memo) =>
    memo.id === summary.id ? summary : memo,
  );
}
