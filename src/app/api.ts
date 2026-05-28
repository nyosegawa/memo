import { invoke } from "@tauri-apps/api/core";
import type { AppSnapshot, MemoDocument, MemoSummary, Theme } from "./types";

function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(name, args);
}

export function listMemos(): Promise<AppSnapshot> {
  return cmd<AppSnapshot>("list_memos");
}

export function createMemoDocument(): Promise<MemoDocument> {
  return cmd<MemoDocument>("create_memo");
}

export function readMemoDocument(id: string): Promise<MemoDocument> {
  return cmd<MemoDocument>("read_memo", { id });
}

export function saveMemoDocument(
  id: string,
  content: string,
): Promise<MemoSummary> {
  return cmd<MemoSummary>("save_memo", { id, content });
}

export function deleteMemoDocument(id: string): Promise<AppSnapshot> {
  return cmd<AppSnapshot>("delete_memo", { id });
}

export function reorderMemoDocuments(ids: string[]): Promise<AppSnapshot> {
  return cmd<AppSnapshot>("reorder_memos", { ids });
}

export function persistOpenTabs(
  openTabs: string[],
  activeId: string | null,
): Promise<void> {
  return cmd<void>("persist_tabs", { openTabs, activeId });
}

export function persistTheme(theme: Theme): Promise<void> {
  return cmd<void>("set_theme", { theme });
}

export function getMemoPath(id: string): Promise<string> {
  return cmd<string>("memo_path", { id });
}

export function revealMemoInFileManager(id: string): Promise<void> {
  return cmd<void>("reveal_memo_in_file_manager", { id });
}

export function hideMainWindow(): Promise<void> {
  return cmd<void>("hide_main_window");
}
