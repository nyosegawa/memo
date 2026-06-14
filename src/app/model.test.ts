import { describe, expect, it } from "vitest";
import {
  closeEditorHistoryGroup,
  closeOtherTabIds,
  closeRightTabIds,
  findTextMatches,
  indentWithSpaces,
  moveItem,
  normalizeOpenTabs,
  outdentWithSpaces,
  recordEditorHistory,
  redoEditorHistory,
  resolveActiveId,
  undoEditorHistory,
} from "./model";
import type { EditorHistoryEntry, EditorSnapshot } from "./types";

describe("findTextMatches", () => {
  it("finds case-insensitive non-overlapping matches", () => {
    expect(findTextMatches("Alpha beta alpha", "ALPHA")).toEqual([
      { start: 0, end: 5 },
      { start: 11, end: 16 },
    ]);
  });

  it("returns no matches for an empty query", () => {
    expect(findTextMatches("alpha", "")).toEqual([]);
  });

  it("advances by query length for repeated text", () => {
    expect(findTextMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });
});

describe("moveItem", () => {
  it("moves an item before a later insertion point", () => {
    expect(moveItem(["a", "b", "c", "d"], 1, 4)).toEqual(["a", "c", "d", "b"]);
  });

  it("moves an item before an earlier insertion point", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("keeps the original order for an invalid source index", () => {
    expect(moveItem(["a", "b"], 9, 0)).toEqual(["a", "b"]);
  });
});

describe("tab persistence model", () => {
  const memos = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("drops unknown and duplicate restored tabs", () => {
    expect(normalizeOpenTabs(["b", "x", "b", "a"], memos)).toEqual(["b", "a"]);
  });

  it("falls back to the first open tab when the active tab is gone", () => {
    expect(resolveActiveId("x", ["b", "a"])).toBe("b");
  });

  it("uses null when there are no open tabs", () => {
    expect(resolveActiveId("x", [])).toBeNull();
  });

  it("keeps only the requested tab when closing other tabs", () => {
    expect(closeOtherTabIds(["a", "b", "c"], "b")).toEqual(["b"]);
  });

  it("keeps tabs through the requested tab when closing tabs to the right", () => {
    expect(closeRightTabIds(["a", "b", "c"], "b")).toEqual(["a", "b"]);
  });

  it("leaves tabs unchanged when tab close helpers receive an unknown id", () => {
    expect(closeOtherTabIds(["a", "b"], "x")).toEqual(["a", "b"]);
    expect(closeRightTabIds(["a", "b"], "x")).toEqual(["a", "b"]);
  });
});

describe("indentWithSpaces", () => {
  it("inserts four spaces at the caret", () => {
    expect(indentWithSpaces("ab", 1, 1)).toEqual({
      value: "a    b",
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it("indents every selected line", () => {
    expect(indentWithSpaces("one\ntwo\nthree", 1, 7)).toEqual({
      value: "    one\n    two\nthree",
      selectionStart: 5,
      selectionEnd: 15,
    });
  });

  it("does not indent the next line when selection ends at its start", () => {
    expect(indentWithSpaces("one\ntwo\n", 0, 4)).toEqual({
      value: "    one\ntwo\n",
      selectionStart: 4,
      selectionEnd: 8,
    });
  });
});

describe("outdentWithSpaces", () => {
  it("removes up to four spaces from the current line", () => {
    expect(outdentWithSpaces("    ab", 6, 6)).toEqual({
      value: "ab",
      selectionStart: 2,
      selectionEnd: 2,
    });
  });

  it("outdents every selected line", () => {
    expect(outdentWithSpaces("    one\n    two\nthree", 5, 17)).toEqual({
      value: "one\ntwo\nthree",
      selectionStart: 1,
      selectionEnd: 9,
    });
  });

  it("does not outdent unindented lines", () => {
    expect(outdentWithSpaces("one\n  two", 0, 8)).toEqual({
      value: "one\ntwo",
      selectionStart: 0,
      selectionEnd: 6,
    });
  });
});

describe("editor history", () => {
  const snapshot = (
    value: string,
    selectionStart = value.length,
    selectionEnd = selectionStart,
  ): EditorSnapshot => ({ value, selectionStart, selectionEnd });

  it("groups continuous typing into one undo step", () => {
    const undoStack: EditorHistoryEntry[] = [];
    const redoStack: EditorHistoryEntry[] = [];

    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot(""),
      snapshot("a"),
      "insertText",
      100,
    );
    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot("a"),
      snapshot("ab"),
      "insertText",
      200,
    );

    expect(undoStack).toHaveLength(1);
    expect(undoEditorHistory(undoStack, redoStack)).toEqual(snapshot(""));
    expect(redoEditorHistory(undoStack, redoStack)).toEqual(snapshot("ab"));
  });

  it("keeps paste and typing as separate undo steps", () => {
    const undoStack: EditorHistoryEntry[] = [];
    const redoStack: EditorHistoryEntry[] = [];

    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot(""),
      snapshot("hello"),
      "insertFromPaste",
      100,
    );
    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot("hello"),
      snapshot("hello!"),
      "insertText",
      200,
    );

    expect(undoStack).toHaveLength(2);
    expect(undoEditorHistory(undoStack, redoStack)).toEqual(snapshot("hello"));
    expect(undoEditorHistory(undoStack, redoStack)).toEqual(snapshot(""));
  });

  it("breaks a typing group after an explicit boundary", () => {
    const undoStack: EditorHistoryEntry[] = [];
    const redoStack: EditorHistoryEntry[] = [];

    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot(""),
      snapshot("a"),
      "insertText",
      100,
    );
    closeEditorHistoryGroup(undoStack);
    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot("a"),
      snapshot("ab"),
      "insertText",
      200,
    );

    expect(undoStack).toHaveLength(2);
    expect(undoEditorHistory(undoStack, redoStack)).toEqual(snapshot("a"));
  });

  it("clears redo history when a new edit is recorded", () => {
    const undoStack: EditorHistoryEntry[] = [];
    const redoStack: EditorHistoryEntry[] = [];

    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot(""),
      snapshot("a"),
      "insertText",
      100,
    );
    expect(undoEditorHistory(undoStack, redoStack)).toEqual(snapshot(""));
    recordEditorHistory(
      undoStack,
      redoStack,
      snapshot(""),
      snapshot("b"),
      "insertText",
      200,
    );

    expect(redoStack).toHaveLength(0);
    expect(redoEditorHistory(undoStack, redoStack)).toBeNull();
  });
});
