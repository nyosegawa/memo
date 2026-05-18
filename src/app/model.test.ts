import { describe, expect, it } from "vitest";
import {
  indentWithSpaces,
  moveItem,
  normalizeOpenTabs,
  resolveActiveId,
} from "./model";

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
