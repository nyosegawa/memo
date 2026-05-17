import { invoke } from "@tauri-apps/api/core";
import { moveItem, normalizeOpenTabs, resolveActiveId } from "./model";
import "./styles.css";

type Theme = "system" | "light" | "dark";

interface MemoSummary {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
}

interface AppSnapshot {
  memos: MemoSummary[];
  openTabs: string[];
  activeId: string | null;
  theme: Theme;
}

interface MemoDocument {
  summary: MemoSummary;
  content: string;
}

interface Draft {
  content: string;
  savedContent: string;
  saveTimer: number | null;
  saving: boolean;
  loaded: boolean;
}

const DRAG_THRESHOLD_PX = 4;
const SAVE_DELAY_MS = 240;

const app = mustQuery<HTMLDivElement>("#app");

const state: {
  memos: MemoSummary[];
  openTabs: string[];
  activeId: string | null;
  theme: Theme;
  drafts: Map<string, Draft>;
  dragging: null | {
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
  };
  menu: null | {
    id: string;
    x: number;
    y: number;
  };
  helpOpen: boolean;
} = {
  memos: [],
  openTabs: [],
  activeId: null,
  theme: "system",
  drafts: new Map(),
  dragging: null,
  menu: null,
  helpOpen: false,
};

function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(name, args);
}

function mustQuery<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} is missing`);
  return el;
}

async function load() {
  const snapshot = await cmd<AppSnapshot>("list_memos");
  applySnapshot(snapshot);
  render();
  if (state.openTabs.length === 0 && state.memos.length > 0) {
    await openMemo(state.memos[0].id);
  } else if (state.activeId) {
    await ensureDraft(state.activeId);
    render();
  }
}

function applySnapshot(snapshot: AppSnapshot) {
  state.memos = snapshot.memos;
  state.openTabs = normalizeOpenTabs(snapshot.openTabs, snapshot.memos);
  state.activeId = resolveActiveId(snapshot.activeId, state.openTabs);
  state.theme = snapshot.theme;
  applyTheme();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

function activeMemo(): MemoSummary | null {
  return state.memos.find((memo) => memo.id === state.activeId) ?? null;
}

async function createMemo() {
  const doc = await cmd<MemoDocument>("create_memo");
  state.memos = [
    doc.summary,
    ...state.memos.filter((memo) => memo.id !== doc.summary.id),
  ];
  state.openTabs = [
    ...state.openTabs.filter((id) => id !== doc.summary.id),
    doc.summary.id,
  ];
  state.activeId = doc.summary.id;
  state.drafts.set(doc.summary.id, {
    content: doc.content,
    savedContent: doc.content,
    saveTimer: null,
    saving: false,
    loaded: true,
  });
  await persistTabs();
  render();
}

async function openMemo(id: string) {
  if (!state.openTabs.includes(id)) {
    state.openTabs.push(id);
  }
  state.activeId = id;
  await persistTabs();
  render();
  await ensureDraft(id);
  render();
}

async function ensureDraft(id: string) {
  const existing = state.drafts.get(id);
  if (existing?.loaded) return;
  const doc = await cmd<MemoDocument>("read_memo", { id });
  state.drafts.set(id, {
    content: doc.content,
    savedContent: doc.content,
    saveTimer: null,
    saving: false,
    loaded: true,
  });
  replaceSummary(doc.summary);
}

function replaceSummary(summary: MemoSummary) {
  state.memos = state.memos.map((memo) =>
    memo.id === summary.id ? summary : memo,
  );
}

async function saveMemo(id: string) {
  const draft = state.drafts.get(id);
  if (!draft || draft.content === draft.savedContent) return;
  draft.saving = true;
  renderSaveState();
  try {
    const summary = await cmd<MemoSummary>("save_memo", {
      id,
      content: draft.content,
    });
    draft.savedContent = draft.content;
    replaceSummary(summary);
    renderMemoSummary(summary);
  } finally {
    draft.saving = false;
    renderSaveState();
  }
}

function scheduleSave(id: string) {
  const draft = state.drafts.get(id);
  if (!draft) return;
  if (draft.saveTimer !== null) window.clearTimeout(draft.saveTimer);
  draft.saveTimer = window.setTimeout(() => {
    draft.saveTimer = null;
    void saveMemo(id);
  }, SAVE_DELAY_MS);
}

async function flushSaves() {
  for (const [id, draft] of state.drafts) {
    if (draft.saveTimer !== null) {
      window.clearTimeout(draft.saveTimer);
      draft.saveTimer = null;
    }
    await saveMemo(id);
  }
}

async function closeTab(id: string) {
  await saveMemo(id);
  const index = state.openTabs.indexOf(id);
  state.openTabs = state.openTabs.filter((openId) => openId !== id);
  if (state.activeId === id) {
    state.activeId = state.openTabs[index] ?? state.openTabs[index - 1] ?? null;
  }
  await persistTabs();
  render();
  if (state.activeId) {
    await ensureDraft(state.activeId);
    render();
  }
}

async function deleteMemo(id: string, options: { confirm: boolean }) {
  const memo = state.memos.find((item) => item.id === id);
  if (!memo) return;
  if (options.confirm && !window.confirm(`Delete "${memo.title}"?`)) return;
  const snapshot = await cmd<AppSnapshot>("delete_memo", { id: memo.id });
  state.drafts.delete(memo.id);
  applySnapshot(snapshot);
  render();
  if (state.activeId) {
    await ensureDraft(state.activeId);
    render();
  }
}

async function deleteActiveMemo() {
  const memo = activeMemo();
  if (memo) await deleteMemo(memo.id, { confirm: true });
}

async function persistTabs() {
  await cmd<void>("persist_tabs", {
    openTabs: state.openTabs,
    activeId: state.activeId,
  });
}

async function toggleTheme() {
  state.theme = effectiveTheme() === "dark" ? "light" : "dark";
  applyTheme();
  renderThemeButton();
  await cmd<void>("set_theme", { theme: state.theme });
}

async function reorderMemos(fromIndex: number, insertAt: number) {
  const next = moveItem(state.memos, fromIndex, insertAt);
  state.memos = next;
  render();
  const snapshot = await cmd<AppSnapshot>("reorder_memos", {
    ids: next.map((memo) => memo.id),
  });
  applySnapshot(snapshot);
  render();
}

async function reorderTabs(fromIndex: number, insertAt: number) {
  state.openTabs = moveItem(state.openTabs, fromIndex, insertAt);
  state.activeId =
    state.openTabs[Math.min(insertAt, state.openTabs.length - 1)] ??
    state.activeId;
  await persistTabs();
  render();
}

function rotateTab(direction: 1 | -1) {
  if (state.openTabs.length === 0 || !state.activeId) return;
  const index = state.openTabs.indexOf(state.activeId);
  const next =
    state.openTabs[
      (index + direction + state.openTabs.length) % state.openTabs.length
    ];
  if (next) void openMemo(next);
}

function activateTabIndex(index: number) {
  const id = state.openTabs[index];
  if (id) void openMemo(id);
}

function render() {
  const memo = activeMemo();
  const draft = memo ? state.drafts.get(memo.id) : null;
  app.innerHTML = `
    <section class="shell">
      <aside class="sidebar">
        <div class="sidebar-titlebar"></div>
        <div class="sidebar-head">
          <strong>Memo</strong>
          <div class="toolbar">
            ${themeButton()}
            <button class="icon-button" data-action="new" title="New memo" aria-label="New memo">＋</button>
          </div>
        </div>
        <div class="memo-list" data-list="memo">
          ${state.memos.map((item, index) => memoRow(item, index)).join("")}
        </div>
      </aside>
      <section class="workspace">
        <div class="tabs" data-list="tab">
          ${state.openTabs.map((id, index) => tabItem(id, index)).join("")}
        </div>
        <section class="editor-wrap">
          ${
            memo
              ? `<textarea class="editor" spellcheck="true" aria-label="Memo content" placeholder="Write in markdown...">${escapeHtml(
                  draft?.content ?? "",
                )}</textarea>`
              : `<div class="empty"><button class="primary" data-action="new">Create memo</button></div>`
          }
        </section>
        <div class="statusbar">
          <span data-status-title>${memo ? escapeHtml(memo.title) : "No memo"}</span>
          <span data-save-state>${saveStateText(draft)}</span>
        </div>
      </section>
      ${dragGhost()}
      ${contextMenu()}
      ${shortcutHelp()}
    </section>
  `;
  bindEvents();
}

function memoRow(memo: MemoSummary, index: number): string {
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

function formatCompactDate(ms: number): string {
  const date = new Date(Number(ms));
  const yy = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${yy}/${month}/${day} ${hour}:${minute}`;
}

function tabItem(id: string, index: number): string {
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

function themeButton(): string {
  const theme = effectiveTheme();
  const next = theme === "dark" ? "Light" : "Dark";
  const glyph = theme === "dark" ? "☼" : "◐";
  return `<button class="icon-button" data-action="theme" title="Switch to ${next}" aria-label="Switch to ${next}">${glyph}</button>`;
}

function effectiveTheme(): "light" | "dark" {
  if (state.theme === "light" || state.theme === "dark") return state.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function saveStateText(draft: Draft | null | undefined): string {
  if (!draft) return "";
  if (draft.saving) return "Saving";
  return draft.content === draft.savedContent ? "Saved" : "Edited";
}

function renderSaveState() {
  const el = document.querySelector<HTMLElement>("[data-save-state]");
  if (el)
    el.textContent = saveStateText(
      state.activeId ? state.drafts.get(state.activeId) : null,
    );
}

function renderMemoSummary(summary: MemoSummary) {
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

function renderThemeButton() {
  const button = app.querySelector<HTMLElement>("[data-action='theme']");
  if (!button) return;
  const theme = effectiveTheme();
  const next = theme === "dark" ? "Light" : "Dark";
  button.textContent = theme === "dark" ? "☼" : "◐";
  button.title = `Switch to ${next}`;
  button.setAttribute("aria-label", `Switch to ${next}`);
}

function dragGhost(): string {
  const drag = state.dragging;
  if (!drag?.started) return "";
  return `<div class="drag-ghost" style="transform: translate(${drag.x + 8}px, ${drag.y + 8}px)">${escapeHtml(drag.label)}</div>`;
}

function contextMenu(): string {
  if (!state.menu) return "";
  return `
    <div class="context-menu" style="left: ${state.menu.x}px; top: ${state.menu.y}px">
      <button class="context-item danger" data-menu-delete="${state.menu.id}">Delete</button>
    </div>
  `;
}

function shortcutHelp(): string {
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
          ${shortcutRow("Close tab", ["⌘", "W"])}
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

function shortcutRow(label: string, keys: string[]): string {
  return `
    <div class="shortcut-label">${label}</div>
    <div class="shortcut-keys">${keys.map((key) => `<kbd>${key}</kbd>`).join("")}</div>
  `;
}

function bindEvents() {
  app.querySelectorAll<HTMLElement>("[data-action='new']").forEach((button) => {
    button.addEventListener("click", () => void createMemo());
  });
  app
    .querySelector<HTMLElement>("[data-action='theme']")
    ?.addEventListener("click", () => void toggleTheme());
  app
    .querySelectorAll<HTMLElement>("[data-action='close-help']")
    .forEach((el) => {
      el.addEventListener("click", (event) => {
        if (
          event.target !== event.currentTarget &&
          !(event.target as HTMLElement).matches(".shortcut-close")
        ) {
          return;
        }
        state.helpOpen = false;
        render();
      });
    });
  app.querySelectorAll<HTMLElement>("[data-memo-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (consumeSuppressedClick(row, event)) return;
      const id = row.dataset.memoId;
      if (id) void openMemo(id);
    });
    row.addEventListener("pointerdown", (event) =>
      beginDrag(event, "memo", row),
    );
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const id = row.dataset.memoId;
      if (!id) return;
      state.menu = clampMenu(event.clientX, event.clientY);
      state.menu.id = id;
      render();
    });
  });
  app.querySelectorAll<HTMLElement>("[data-tab-activate]").forEach((tab) => {
    tab.addEventListener("click", (event) => {
      const tabEl = tab.closest<HTMLElement>("[data-tab-id]");
      if (tabEl && consumeSuppressedClick(tabEl, event)) return;
      const id = tab.dataset.tabActivate;
      if (id) void openMemo(id);
    });
  });
  app.querySelectorAll<HTMLElement>("[data-tab-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.tabClose;
      if (id) void closeTab(id);
    });
  });
  app.querySelectorAll<HTMLElement>("[data-tab-id]").forEach((tab) => {
    tab.addEventListener("pointerdown", (event) =>
      beginDrag(event, "tab", tab),
    );
  });
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  editor?.addEventListener("input", () => {
    if (!state.activeId) return;
    const draft = state.drafts.get(state.activeId);
    if (!draft) return;
    draft.content = editor.value;
    scheduleSave(state.activeId);
    renderSaveState();
  });
  app.querySelectorAll<HTMLElement>("[data-menu-delete]").forEach((item) => {
    const runDelete = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = item.dataset.menuDelete;
      state.menu = null;
      render();
      if (id) void deleteMemo(id, { confirm: false });
    };
    item.addEventListener("pointerdown", runDelete);
    item.addEventListener("click", runDelete);
  });
}

function beginDrag(event: PointerEvent, kind: "memo" | "tab", el: HTMLElement) {
  if (event.button !== 0) return;
  if ((event.target as HTMLElement).closest(".tab-close")) return;
  const fromIndex = Number(el.dataset.index);
  const label = el.textContent?.trim() || "";
  const drag = {
    kind,
    fromIndex,
    insertAt: fromIndex,
    started: false,
    label,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    suppressClick: false,
  };
  state.dragging = drag;

  const move = (moveEvent: PointerEvent) => {
    if (!state.dragging) return;
    const dx = moveEvent.clientX - drag.startX;
    const dy = moveEvent.clientY - drag.startY;
    if (!state.dragging.started && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
      return;
    state.dragging = {
      ...state.dragging,
      started: true,
      suppressClick: true,
      x: moveEvent.clientX,
      y: moveEvent.clientY,
      insertAt: computeInsertAt(kind, moveEvent.clientX, moveEvent.clientY),
    };
    renderDragOnly();
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const done = state.dragging;
    state.dragging = null;
    clearDragUi();
    if (!done?.started) return;
    markSuppressClick(el);
    if (
      done.insertAt === done.fromIndex ||
      done.insertAt === done.fromIndex + 1
    )
      return;
    if (kind === "memo") void reorderMemos(done.fromIndex, done.insertAt);
    if (kind === "tab") void reorderTabs(done.fromIndex, done.insertAt);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function renderDragOnly() {
  clearDragUi();
  const wrapper = document.querySelector(".shell");
  if (!wrapper || !state.dragging?.started) return;
  wrapper.insertAdjacentHTML("beforeend", dragGhost());
  drawDropMarker(state.dragging.kind, state.dragging.insertAt);
}

function clearDragUi() {
  document.querySelector(".drag-ghost")?.remove();
  document.querySelector(".drop-marker")?.remove();
}

function drawDropMarker(kind: "memo" | "tab", insertAt: number) {
  const selector = kind === "memo" ? "[data-memo-id]" : "[data-tab-id]";
  const rows = Array.from(app.querySelectorAll<HTMLElement>(selector));
  const list = app.querySelector<HTMLElement>(
    kind === "memo" ? ".memo-list" : ".tabs",
  );
  if (!list) return;
  const listRect = list.getBoundingClientRect();
  const target = rows[insertAt];
  const previous = rows[insertAt - 1];
  const rect =
    target?.getBoundingClientRect() ?? previous?.getBoundingClientRect();
  if (!rect) return;
  const marker = document.createElement("div");
  marker.className = `drop-marker is-${kind}`;
  if (kind === "memo") {
    marker.style.left = `${listRect.left + 8}px`;
    marker.style.top = `${target ? rect.top - 2 : rect.bottom + 2}px`;
    marker.style.width = `${listRect.width - 16}px`;
  } else {
    marker.style.left = `${target ? rect.left - 2 : rect.right + 2}px`;
    marker.style.top = `${listRect.top + 7}px`;
    marker.style.height = `${listRect.height - 8}px`;
  }
  document.body.append(marker);
}

function computeInsertAt(kind: "memo" | "tab", x: number, y: number): number {
  const selector = kind === "memo" ? "[data-memo-id]" : "[data-tab-id]";
  const axis = kind === "memo" ? y : x;
  const rows = Array.from(app.querySelectorAll<HTMLElement>(selector));
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    const middle =
      kind === "memo" ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    if (axis < middle) return index;
  }
  return rows.length;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function markSuppressClick(el: HTMLElement) {
  el.dataset.suppressClick = "true";
  window.setTimeout(() => {
    delete el.dataset.suppressClick;
  }, 0);
}

function clampMenu(x: number, y: number): { id: string; x: number; y: number } {
  const width = 132;
  const height = 40;
  const margin = 8;
  return {
    id: "",
    x: Math.min(Math.max(margin, x), window.innerWidth - width - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - height - margin),
  };
}

function consumeSuppressedClick(el: HTMLElement, event: Event): boolean {
  if (el.dataset.suppressClick !== "true") return false;
  event.preventDefault();
  event.stopPropagation();
  delete el.dataset.suppressClick;
  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.matches("input, textarea, select");
}

window.addEventListener("keydown", (event) => {
  const commonMod = event.metaKey || event.ctrlKey;
  if (commonMod && (event.key === "/" || event.key === "?")) {
    event.preventDefault();
    state.helpOpen = true;
    render();
    return;
  }

  if (event.key === "Escape" && state.menu) {
    state.menu = null;
    render();
    return;
  }
  if (event.key === "Escape" && state.helpOpen) {
    state.helpOpen = false;
    render();
    return;
  }

  if (event.key === "Tab" && event.ctrlKey) {
    event.preventDefault();
    rotateTab(event.shiftKey ? -1 : 1);
    return;
  }

  if (isTypingTarget(event.target)) return;

  if (
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "n"
  ) {
    event.preventDefault();
    void createMemo();
  } else if (commonMod && event.key.toLowerCase() === "w" && state.activeId) {
    event.preventDefault();
    void closeTab(state.activeId);
  } else if (commonMod && event.key === "Backspace") {
    event.preventDefault();
    void deleteActiveMemo();
  } else if (commonMod && /^[1-9]$/.test(event.key)) {
    event.preventDefault();
    activateTabIndex(Number(event.key) - 1);
  }
});

window.addEventListener("pointerdown", (event) => {
  if (!state.menu) return;
  if ((event.target as HTMLElement).closest(".context-menu")) return;
  state.menu = null;
  render();
});

window.addEventListener("beforeunload", () => {
  void flushSaves();
});

void load().catch((err) => {
  app.innerHTML = `<pre class="fatal">${escapeHtml(String(err))}</pre>`;
});
