import { describe, expect, it } from "vitest";
import { createInitialState } from "../app/state";
import { renderShell } from "./render";

describe("renderShell", () => {
  it("marks only top-level chrome gutters as window drag regions", () => {
    const state = createInitialState();
    state.memos = [
      { id: "memo-1", title: "Memo one", createdAtMs: 0, updatedAtMs: 0 },
    ];
    state.openTabs = ["memo-1"];
    state.activeId = "memo-1";
    const container = document.createElement("div");
    container.innerHTML = renderShell(state);

    expect(
      container
        .querySelector(".sidebar-titlebar")
        ?.hasAttribute("data-tauri-drag-region"),
    ).toBe(true);
    expect(
      container.querySelector(".tabs")?.hasAttribute("data-tauri-drag-region"),
    ).toBe(true);
    expect(
      container.querySelector(".tab")?.hasAttribute("data-tauri-drag-region"),
    ).toBe(false);
  });
});
