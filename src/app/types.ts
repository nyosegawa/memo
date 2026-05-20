export type Theme = "system" | "light" | "dark";

export interface MemoSummary {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AppSnapshot {
  memos: MemoSummary[];
  openTabs: string[];
  activeId: string | null;
  theme: Theme;
}

export interface MemoDocument {
  summary: MemoSummary;
  content: string;
}

export interface Draft {
  content: string;
  savedContent: string;
  saveTimer: number | null;
  saving: boolean;
  loaded: boolean;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
}

export interface EditorSnapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface SearchState {
  open: boolean;
  query: string;
  currentIndex: number;
  focusToken: number;
}

export interface DragState {
  kind: "memo" | "tab";
  fromIndex: number;
  insertAt: number;
  started: boolean;
  suppressClick: boolean;
  label: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export interface MenuState {
  id: string;
  x: number;
  y: number;
}

export interface AppState {
  memos: MemoSummary[];
  openTabs: string[];
  activeId: string | null;
  theme: Theme;
  drafts: Map<string, Draft>;
  scrollTops: Map<string, number>;
  searches: Map<string, SearchState>;
  dragging: DragState | null;
  menu: MenuState | null;
  helpOpen: boolean;
}
