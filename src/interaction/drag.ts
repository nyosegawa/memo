import type { AppState } from "../app/types";
import { dragGhost } from "../ui/render";

interface DragContext {
  app: HTMLElement;
  state: AppState;
  thresholdPx: number;
  reorderMemos: (fromIndex: number, insertAt: number) => void;
  reorderTabs: (fromIndex: number, insertAt: number) => void;
}

export function beginDrag(
  context: DragContext,
  event: PointerEvent,
  kind: "memo" | "tab",
  el: HTMLElement,
) {
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
  context.state.dragging = drag;

  const move = (moveEvent: PointerEvent) => {
    if (!context.state.dragging) return;
    const dx = moveEvent.clientX - drag.startX;
    const dy = moveEvent.clientY - drag.startY;
    if (
      !context.state.dragging.started &&
      Math.hypot(dx, dy) < context.thresholdPx
    ) {
      return;
    }
    context.state.dragging = {
      ...context.state.dragging,
      started: true,
      suppressClick: true,
      x: moveEvent.clientX,
      y: moveEvent.clientY,
      insertAt: computeInsertAt(
        context.app,
        kind,
        moveEvent.clientX,
        moveEvent.clientY,
      ),
    };
    renderDragOnly(context);
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const done = context.state.dragging;
    context.state.dragging = null;
    clearDragUi();
    if (!done?.started) return;
    markSuppressClick(el);
    if (
      done.insertAt === done.fromIndex ||
      done.insertAt === done.fromIndex + 1
    ) {
      return;
    }
    if (kind === "memo") context.reorderMemos(done.fromIndex, done.insertAt);
    if (kind === "tab") context.reorderTabs(done.fromIndex, done.insertAt);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function renderDragOnly(context: DragContext) {
  clearDragUi();
  const wrapper = document.querySelector(".shell");
  if (!wrapper || !context.state.dragging?.started) return;
  wrapper.insertAdjacentHTML("beforeend", dragGhost(context.state));
  drawDropMarker(
    context.app,
    context.state.dragging.kind,
    context.state.dragging.insertAt,
  );
}

function clearDragUi() {
  document.querySelector(".drag-ghost")?.remove();
  document.querySelector(".drop-marker")?.remove();
}

function drawDropMarker(
  app: HTMLElement,
  kind: "memo" | "tab",
  insertAt: number,
) {
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

function computeInsertAt(
  app: HTMLElement,
  kind: "memo" | "tab",
  x: number,
  y: number,
): number {
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

function markSuppressClick(el: HTMLElement) {
  el.dataset.suppressClick = "true";
  window.setTimeout(() => {
    delete el.dataset.suppressClick;
  }, 0);
}
