import { findTextMatches } from "../app/model";
import { activeMemo, activeSearch } from "../app/state";
import type { AppState, Draft, MemoSummary } from "../app/types";
import { escapeAttr, escapeHtml, formatCompactDate } from "./html";

export function renderShell(state: AppState): string {
  const memo = activeMemo(state);
  const draft = memo ? state.drafts.get(memo.id) : null;
  const search = activeSearch(state);
  return `
    <section class="shell">
      <aside class="sidebar">
        <div class="sidebar-titlebar"></div>
        <div class="sidebar-head">
          <strong>Memo</strong>
          <div class="toolbar">
            ${themeButton(state)}
            <button class="icon-button" data-action="new" title="New memo" aria-label="New memo">＋</button>
          </div>
        </div>
        <div class="memo-list" data-list="memo">
          ${state.memos.map((item, index) => memoRow(state, item, index)).join("")}
        </div>
      </aside>
      <section class="workspace">
        <div class="tabs" data-list="tab">
          ${state.openTabs.map((id, index) => tabItem(state, id, index)).join("")}
        </div>
        <section class="editor-wrap">
          ${
            memo
              ? `${search.open ? searchBar(draft?.content ?? "", search.query, search.currentIndex) : ""}
                <textarea class="editor" spellcheck="true" aria-label="Memo content" placeholder="Write in markdown...">${escapeHtml(
                  draft?.content ?? "",
                )}</textarea>`
              : `<div class="empty">
                  <button class="empty-create" data-action="new" aria-label="New memo">
                    <span class="empty-create-icon" aria-hidden="true">＋</span>
                    <span class="empty-create-copy">
                      <span class="empty-create-title">New memo</span>
                      <span class="empty-create-subtitle">Start writing</span>
                    </span>
                  </button>
                </div>`
          }
        </section>
        <div class="statusbar">
          <span data-status-title>${memo ? escapeHtml(memo.title) : "No memo"}</span>
          <span data-save-state>${saveStateText(draft)}</span>
        </div>
      </section>
      ${dragGhost(state)}
      ${contextMenu(state)}
      ${shortcutHelp(state)}
    </section>
  `;
}

export function effectiveTheme(state: AppState): "light" | "dark" {
  if (state.theme === "light" || state.theme === "dark") return state.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function saveStateText(draft: Draft | null | undefined): string {
  if (!draft) return "";
  if (draft.saving) return "Saving";
  return draft.content === draft.savedContent ? "Saved" : "Edited";
}

export function renderSaveState(state: AppState) {
  const el = document.querySelector<HTMLElement>("[data-save-state]");
  if (!el) return;
  el.textContent = saveStateText(
    state.activeId ? state.drafts.get(state.activeId) : null,
  );
}

export function renderMemoSummary(
  app: HTMLElement,
  state: AppState,
  summary: MemoSummary,
) {
  const row = app.querySelector<HTMLElement>(
    `[data-memo-id="${CSS.escape(summary.id)}"]`,
  );
  if (row) {
    row.title = summary.title;
    const title = row.querySelector<HTMLElement>(".memo-title");
    if (title) title.textContent = summary.title;
    const meta = row.querySelector<HTMLElement>(".memo-meta");
    if (meta) {
      meta.innerHTML = memoMeta(summary);
      meta.setAttribute("aria-label", memoMetaLabel(summary));
    }
  }
  const tab = app.querySelector<HTMLElement>(
    `[data-tab-id="${CSS.escape(summary.id)}"]`,
  );
  if (tab) {
    tab.title = summary.title;
    const tabTitle = tab.querySelector<HTMLElement>(".tab-main");
    if (tabTitle) tabTitle.textContent = summary.title;
  }
  if (state.activeId === summary.id) {
    const statusTitle = app.querySelector<HTMLElement>("[data-status-title]");
    if (statusTitle) statusTitle.textContent = summary.title;
  }
}

export function renderThemeButton(app: HTMLElement, state: AppState) {
  const button = app.querySelector<HTMLElement>("[data-action='theme']");
  if (!button) return;
  const theme = effectiveTheme(state);
  const next = theme === "dark" ? "Light" : "Dark";
  button.textContent = theme === "dark" ? "☼" : "◐";
  button.title = `Switch to ${next}`;
  button.setAttribute("aria-label", `Switch to ${next}`);
}

export function dragGhost(state: AppState): string {
  const drag = state.dragging;
  if (!drag?.started) return "";
  return `<div class="drag-ghost" style="transform: translate(${drag.x + 8}px, ${drag.y + 8}px)">${escapeHtml(drag.label)}</div>`;
}

function memoRow(state: AppState, memo: MemoSummary, index: number): string {
  const active = state.activeId === memo.id ? " is-active" : "";
  return `
    <button class="memo-row${active}" data-memo-id="${memo.id}" data-index="${index}" title="${escapeAttr(memo.title)}">
      <span class="memo-title">${escapeHtml(memo.title)}</span>
      <span class="memo-meta" aria-label="${memoMetaLabel(memo)}">${memoMeta(memo)}</span>
    </button>
  `;
}

function memoMeta(memo: MemoSummary): string {
  return `<span class="memo-meta-item" title="Created"><span class="memo-meta-icon" aria-hidden="true">◷</span>${formatCompactDate(memo.createdAtMs)}</span><span class="memo-meta-item" title="Updated"><span class="memo-meta-icon" aria-hidden="true">↻</span>${formatCompactDate(memo.updatedAtMs)}</span>`;
}

function memoMetaLabel(memo: MemoSummary): string {
  return escapeAttr(
    `Created ${formatCompactDate(memo.createdAtMs)}; Updated ${formatCompactDate(memo.updatedAtMs)}`,
  );
}

function tabItem(state: AppState, id: string, index: number): string {
  const memo = state.memos.find((item) => item.id === id);
  if (!memo) return "";
  const active = state.activeId === id ? " is-active" : "";
  return `
    <div class="tab${active}" data-tab-id="${id}" data-index="${index}" title="${escapeAttr(memo.title)}">
      <button class="tab-main" data-tab-activate="${id}">${escapeHtml(memo.title)}</button>
      <button class="tab-close" data-tab-close="${id}" aria-label="Close tab">×</button>
    </div>
  `;
}

function themeButton(state: AppState): string {
  const theme = effectiveTheme(state);
  const next = theme === "dark" ? "Light" : "Dark";
  const glyph = theme === "dark" ? "☼" : "◐";
  return `<button class="icon-button" data-action="theme" title="Switch to ${next}" aria-label="Switch to ${next}">${glyph}</button>`;
}

function contextMenu(state: AppState): string {
  if (!state.menu) return "";
  if (state.menu.kind === "memo") {
    return `
      <div class="context-menu" style="left: ${state.menu.x}px; top: ${state.menu.y}px" role="menu">
        <button class="context-item danger" data-menu-delete="${state.menu.id}" role="menuitem">Delete</button>
      </div>
    `;
  }
  const hasRight = state.menu.index < state.openTabs.length - 1;
  const hasOthers = state.openTabs.length > 1;
  return `
    <div class="context-menu context-menu-tab" style="left: ${state.menu.x}px; top: ${state.menu.y}px" role="menu">
      <button class="context-item" data-menu-close="${state.menu.id}" role="menuitem">
        <span>Close tab</span>
        <span class="context-shortcut" aria-hidden="true">⌘W</span>
      </button>
      <button class="context-item" data-menu-close-others="${state.menu.id}" role="menuitem"${hasOthers ? "" : " disabled"}>
        <span>Close other tabs</span>
        <span class="context-shortcut" aria-hidden="true">⌘⌥W</span>
      </button>
      <button class="context-item" data-menu-close-right="${state.menu.id}" role="menuitem"${hasRight ? "" : " disabled"}>
        <span>Close tabs to the right</span>
      </button>
      <button class="context-item" data-menu-close-all role="menuitem">
        <span>Close all tabs</span>
        <span class="context-shortcut" aria-hidden="true">⌘⇧W</span>
      </button>
      <div class="context-divider"></div>
      <button class="context-item" data-menu-copy-path="${state.menu.id}" role="menuitem">
        <span>Copy path</span>
        <span class="context-shortcut" aria-hidden="true">⌘⇧C</span>
      </button>
      <button class="context-item" data-menu-reveal="${state.menu.id}" role="menuitem">
        <span>Show in file manager</span>
        <span class="context-shortcut" aria-hidden="true">⌘⇧R</span>
      </button>
    </div>
  `;
}

function shortcutHelp(state: AppState): string {
  if (!state.helpOpen) return "";
  return `
    <div class="shortcut-overlay" data-action="close-help" role="presentation">
      <section class="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
        <header class="shortcut-header">
          <h2 id="shortcut-title">Keyboard shortcuts</h2>
          <button class="shortcut-close" data-action="close-help" aria-label="Close">×</button>
        </header>
        <div class="shortcut-grid">
          ${shortcutRow("New memo", ["⌘", "N"])}
          ${shortcutRow("Find in editor", ["⌘", "F"])}
          ${shortcutRow("Close tab", ["⌘", "W"])}
          ${shortcutRow("Close other tabs", ["⌘", "⌥", "W"])}
          ${shortcutRow("Close all tabs", ["⌘", "⇧", "W"])}
          ${shortcutRow("Copy memo path", ["⌘", "⇧", "C"])}
          ${shortcutRow("Show in file manager", ["⌘", "⇧", "R"])}
          ${shortcutRow("Next tab", ["⌃", "Tab"])}
          ${shortcutRow("Previous tab", ["⌃", "⇧", "Tab"])}
          ${shortcutRow("Jump to tab", ["⌘", "1…9"])}
          ${shortcutRow("Delete active memo", ["⌘", "⌫"])}
          ${shortcutRow("Shortcut help", ["⌘", "/"])}
          ${shortcutRow("Dismiss", ["Esc"])}
        </div>
      </section>
    </div>
  `;
}

function searchBar(value: string, query: string, currentIndex: number): string {
  const matches = findTextMatches(value, query);
  const current =
    matches.length > 0 ? Math.min(currentIndex, matches.length - 1) : 0;
  const count =
    query.length === 0
      ? ""
      : matches.length > 0
        ? `${current + 1} / ${matches.length}`
        : "0 / 0";
  const disabled = matches.length === 0 ? " disabled" : "";
  return `
    <search class="search-bar" aria-label="Find in editor" data-search-bar>
      <span class="search-bar-icon" aria-hidden="true">⌕</span>
      <input
        class="search-bar-input"
        type="text"
        placeholder="Find in editor"
        value="${escapeAttr(query)}"
        data-search-input
      />
      <span class="search-bar-count" aria-live="polite">${count}</span>
      <button class="search-bar-btn" data-search-prev aria-label="Previous match"${disabled}>⌃</button>
      <button class="search-bar-btn" data-search-next aria-label="Next match"${disabled}>⌄</button>
      <button class="search-bar-btn" data-search-close aria-label="Close search">×</button>
    </search>
  `;
}

function shortcutRow(label: string, keys: string[]): string {
  return `
    <div class="shortcut-label">${label}</div>
    <div class="shortcut-keys">${keys.map((key) => `<kbd>${key}</kbd>`).join("")}</div>
  `;
}
