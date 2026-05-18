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
  dragging: DragState | null;
  menu: MenuState | null;
  helpOpen: boolean;
}
