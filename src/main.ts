import { getCurrentWindow } from "@tauri-apps/api/window";
import * as api from "./app/api";
import { moveItem } from "./app/model";
import {
  activeMemo,
  applySnapshot,
  applyTheme,
  createInitialState,
  replaceSummary,
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
    render();
  }
}

function render() {
  app.innerHTML = renderShell(state);
  bindEvents();
}

async function createMemo() {
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
  const doc = await api.readMemoDocument(id);
  state.drafts.set(id, {
    content: doc.content,
    savedContent: doc.content,
    saveTimer: null,
    saving: false,
    loaded: true,
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

async function closeCurrentWindow() {
  await flushSaves();
  await getCurrentWindow().close();
}

async function deleteMemo(id: string, options: { confirm: boolean }) {
  const memo = state.memos.find((item) => item.id === id);
  if (!memo) return;
  if (options.confirm && !window.confirm(`Delete "${memo.title}"?`)) return;
  const snapshot = await api.deleteMemoDocument(memo.id);
  state.drafts.delete(memo.id);
  applySnapshot(state, snapshot);
  render();
  if (state.activeId) {
    await ensureDraft(state.activeId);
    render();
  }
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
  editor?.addEventListener("input", () => {
    if (!state.activeId) return;
    const draft = state.drafts.get(state.activeId);
    if (!draft) return;
    draft.content = editor.value;
    scheduleSave(state.activeId);
    renderSaveState(state);
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
