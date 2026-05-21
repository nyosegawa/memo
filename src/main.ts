import * as api from "./app/api";
import {
  findTextMatches,
  indentWithSpaces,
  moveItem,
  outdentWithSpaces,
} from "./app/model";
import {
  activeMemo,
  activeSearchFor,
  applySnapshot,
  applyTheme,
  createInitialState,
  replaceSummary,
  updateSearch,
} from "./app/state";
import { beginDrag } from "./interaction/drag";
import {
  effectiveTheme,
  renderMemoSummary,
  renderSaveState,
  renderShell,
  renderThemeButton,
} from "./ui/render";
import "./styles.css";

const DRAG_THRESHOLD_PX = 4;
const SAVE_DELAY_MS = 240;

const app = mustQuery<HTMLDivElement>("#app");
const state = createInitialState();

interface RenderOptions {
  focusEditor?: boolean;
  focusSearch?: boolean;
  selectSearchText?: boolean;
}

function mustQuery<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} is missing`);
  return el;
}

async function load() {
  applySnapshot(state, await api.listMemos());
  render();
  if (state.openTabs.length === 0 && state.memos.length > 0) {
    await openMemo(state.memos[0].id);
  } else if (state.activeId) {
    await ensureDraft(state.activeId);
    render({ focusEditor: true });
  }
}

function render(options: RenderOptions = {}) {
  preserveActiveScrollTop();
  app.innerHTML = renderShell(state);
  bindEvents();
  restoreActiveScrollTop();
  if (options.focusSearch) {
    selectActiveSearchMatch();
    focusSearchInput(options.selectSearchText ?? false);
  } else if (options.focusEditor) {
    focusEditor();
  }
}

async function createMemo() {
  preserveActiveScrollTop();
  const doc = await api.createMemoDocument();
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
    undoStack: [],
    redoStack: [],
  });
  await persistTabs();
  render({ focusEditor: true });
}

async function openMemo(id: string) {
  preserveActiveScrollTop();
  if (!state.openTabs.includes(id)) {
    state.openTabs.push(id);
  }
  state.activeId = id;
  await persistTabs();
  render();
  await ensureDraft(id);
  render({ focusEditor: true });
}

async function ensureDraft(id: string) {
  const existing = state.drafts.get(id);
  if (existing?.loaded) return;
  const doc = await api.readMemoDocument(id);
  state.drafts.set(id, {
    content: doc.content,
    savedContent: doc.content,
    saveTimer: null,
    saving: false,
    loaded: true,
    undoStack: [],
    redoStack: [],
  });
  replaceSummary(state, doc.summary);
}

async function saveMemo(id: string) {
  const draft = state.drafts.get(id);
  if (!draft || draft.content === draft.savedContent) return;
  draft.saving = true;
  renderSaveState(state);
  try {
    const summary = await api.saveMemoDocument(id, draft.content);
    draft.savedContent = draft.content;
    replaceSummary(state, summary);
    renderMemoSummary(app, state, summary);
  } finally {
    draft.saving = false;
    renderSaveState(state);
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
  preserveActiveScrollTop();
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
    render({ focusEditor: true });
  }
  state.scrollTops.delete(id);
}

async function closeCurrentWindow() {
  await flushSaves();
  await api.hideMainWindow();
}

async function deleteMemo(id: string, options: { confirm: boolean }) {
  preserveActiveScrollTop();
  const memo = state.memos.find((item) => item.id === id);
  if (!memo) return;
  if (options.confirm && !window.confirm(`Delete "${memo.title}"?`)) return;
  const snapshot = await api.deleteMemoDocument(memo.id);
  state.drafts.delete(memo.id);
  state.searches.delete(memo.id);
  applySnapshot(state, snapshot);
  render();
  if (state.activeId) {
    await ensureDraft(state.activeId);
    render({ focusEditor: true });
  }
  state.scrollTops.delete(id);
}

async function deleteActiveMemo() {
  const memo = activeMemo(state);
  if (memo) await deleteMemo(memo.id, { confirm: true });
}

async function persistTabs() {
  await api.persistOpenTabs(state.openTabs, state.activeId);
}

async function toggleTheme() {
  state.theme = effectiveTheme(state) === "dark" ? "light" : "dark";
  applyTheme(state);
  renderThemeButton(app, state);
  await api.persistTheme(state.theme);
}

async function reorderMemos(fromIndex: number, insertAt: number) {
  const next = moveItem(state.memos, fromIndex, insertAt);
  state.memos = next;
  render();
  const snapshot = await api.reorderMemoDocuments(next.map((memo) => memo.id));
  applySnapshot(state, snapshot);
  render();
}

async function reorderTabs(fromIndex: number, insertAt: number) {
  preserveActiveScrollTop();
  state.openTabs = moveItem(state.openTabs, fromIndex, insertAt);
  state.activeId =
    state.openTabs[Math.min(insertAt, state.openTabs.length - 1)] ??
    state.activeId;
  await persistTabs();
  render({ focusEditor: true });
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
      beginDrag(dragContext(), event, "memo", row),
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
      beginDrag(dragContext(), event, "tab", tab),
    );
  });
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  editor?.addEventListener("keydown", (event) => {
    if (handleEditorUndoRedo(editor, event)) return;
    if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    event.preventDefault();
    applyEditorTransform(editor, event.shiftKey ? "outdent" : "indent");
  });
  editor?.addEventListener("input", () => {
    if (!state.activeId) return;
    const draft = state.drafts.get(state.activeId);
    if (!draft) return;
    draft.content = editor.value;
    draft.redoStack = [];
    scheduleSave(state.activeId);
    renderSaveState(state);
  });
  editor?.addEventListener("scroll", () => preserveActiveScrollTop());
  const searchInput = app.querySelector<HTMLInputElement>(
    "[data-search-input]",
  );
  searchInput?.addEventListener("input", () => {
    setSearchQuery(searchInput.value);
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      stepSearch(event.shiftKey ? -1 : 1);
    }
  });
  app
    .querySelector<HTMLElement>("[data-search-prev]")
    ?.addEventListener("click", () => stepSearch(-1));
  app
    .querySelector<HTMLElement>("[data-search-next]")
    ?.addEventListener("click", () => stepSearch(1));
  app
    .querySelector<HTMLElement>("[data-search-close]")
    ?.addEventListener("click", () => closeSearch());
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

function openSearch() {
  if (!state.activeId) return;
  updateSearch(state, state.activeId, (current) => ({
    ...current,
    open: true,
    focusToken: current.focusToken + 1,
  }));
  render({ focusSearch: true, selectSearchText: true });
}

function closeSearch() {
  if (!state.activeId) return;
  updateSearch(state, state.activeId, (current) => ({
    ...current,
    open: false,
  }));
  render({ focusEditor: true });
}

function setSearchQuery(query: string) {
  if (!state.activeId) return;
  updateSearch(state, state.activeId, (current) => ({
    ...current,
    query,
    currentIndex: 0,
  }));
  render({ focusSearch: true });
}

function stepSearch(direction: 1 | -1) {
  if (!state.activeId) return;
  const content = state.drafts.get(state.activeId)?.content ?? "";
  const current = activeSearchFor(state, state.activeId);
  const matches = findTextMatches(content, current.query);
  if (matches.length === 0) return;
  updateSearch(state, state.activeId, (search) => ({
    ...search,
    currentIndex:
      (search.currentIndex + direction + matches.length) % matches.length,
  }));
  render({ focusSearch: true });
}

function selectActiveSearchMatch() {
  if (!state.activeId) return;
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  if (!editor) return;
  const search = activeSearchFor(state, state.activeId);
  const matches = findTextMatches(editor.value, search.query);
  const match = matches[search.currentIndex] ?? matches[0];
  if (!match) return;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(match.start, match.end);
}

function focusSearchInput(selectText: boolean) {
  const input = app.querySelector<HTMLInputElement>("[data-search-input]");
  if (!input) return;
  input.focus({ preventScroll: true });
  if (selectText) {
    input.select();
  } else {
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function focusEditor() {
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  if (!editor) return;
  editor.focus({ preventScroll: true });
}

function preserveActiveScrollTop() {
  if (!state.activeId) return;
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  if (editor) state.scrollTops.set(state.activeId, editor.scrollTop);
}

function restoreActiveScrollTop() {
  if (!state.activeId) return;
  const editor = app.querySelector<HTMLTextAreaElement>(".editor");
  if (!editor) return;
  editor.scrollTop = state.scrollTops.get(state.activeId) ?? 0;
}

function applyEditorTransform(
  editor: HTMLTextAreaElement,
  transform: "indent" | "outdent",
) {
  if (!state.activeId) return;
  const draft = state.drafts.get(state.activeId);
  if (!draft) return;
  const before = editorSnapshot(editor);
  const edit =
    transform === "indent"
      ? indentWithSpaces(
          editor.value,
          editor.selectionStart,
          editor.selectionEnd,
        )
      : outdentWithSpaces(
          editor.value,
          editor.selectionStart,
          editor.selectionEnd,
        );
  if (
    edit.value === before.value &&
    edit.selectionStart === before.selectionStart &&
    edit.selectionEnd === before.selectionEnd
  ) {
    return;
  }
  draft.undoStack.push(before);
  draft.redoStack = [];
  editor.value = edit.value;
  editor.selectionStart = edit.selectionStart;
  editor.selectionEnd = edit.selectionEnd;
  draft.content = edit.value;
  scheduleSave(state.activeId);
  renderSaveState(state);
}

function handleEditorUndoRedo(
  editor: HTMLTextAreaElement,
  event: KeyboardEvent,
): boolean {
  if (!state.activeId || !event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  const wantsUndo = key === "z" && !event.shiftKey;
  const wantsRedo = (key === "z" && event.shiftKey) || key === "y";
  if (!wantsUndo && !wantsRedo) return false;

  const draft = state.drafts.get(state.activeId);
  if (!draft) return false;
  const fromStack = wantsUndo ? draft.undoStack : draft.redoStack;
  const toStack = wantsUndo ? draft.redoStack : draft.undoStack;
  const snapshot = fromStack.pop();
  if (!snapshot) return false;

  event.preventDefault();
  toStack.push(editorSnapshot(editor));
  restoreEditorSnapshot(editor, snapshot);
  draft.content = snapshot.value;
  scheduleSave(state.activeId);
  renderSaveState(state);
  return true;
}

function editorSnapshot(editor: HTMLTextAreaElement) {
  return {
    value: editor.value,
    selectionStart: editor.selectionStart,
    selectionEnd: editor.selectionEnd,
  };
}

function restoreEditorSnapshot(
  editor: HTMLTextAreaElement,
  snapshot: ReturnType<typeof editorSnapshot>,
) {
  editor.value = snapshot.value;
  editor.selectionStart = snapshot.selectionStart;
  editor.selectionEnd = snapshot.selectionEnd;
}

function dragContext() {
  return {
    app,
    state,
    thresholdPx: DRAG_THRESHOLD_PX,
    reorderMemos: (fromIndex: number, insertAt: number) => {
      void reorderMemos(fromIndex, insertAt);
    },
    reorderTabs: (fromIndex: number, insertAt: number) => {
      void reorderTabs(fromIndex, insertAt);
    },
  };
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

  if (
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "f"
  ) {
    event.preventDefault();
    openSearch();
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
  if (event.key === "Escape" && state.activeId) {
    const search = activeSearchFor(state, state.activeId);
    if (search.open) {
      event.preventDefault();
      closeSearch();
      return;
    }
  }

  if (event.key === "Tab" && event.ctrlKey) {
    event.preventDefault();
    rotateTab(event.shiftKey ? -1 : 1);
    return;
  }

  if (
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "n"
  ) {
    event.preventDefault();
    void createMemo();
    return;
  } else if (commonMod && event.key.toLowerCase() === "w") {
    event.preventDefault();
    if (state.activeId) {
      void closeTab(state.activeId);
    } else {
      void closeCurrentWindow();
    }
    return;
  }

  if (isTypingTarget(event.target)) return;

  if (commonMod && event.key === "Backspace") {
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
  app.innerHTML = `<pre class="fatal">${String(err)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")}</pre>`;
});
