export interface Identified {
  id: string;
}

export function moveItem<T>(
  items: readonly T[],
  fromIndex: number,
  insertAt: number,
): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return [...items];
  const target = insertAt > fromIndex ? insertAt - 1 : insertAt;
  next.splice(Math.max(0, Math.min(target, next.length)), 0, item);
  return next;
}

export function normalizeOpenTabs(
  openTabs: readonly string[],
  memos: readonly Identified[],
): string[] {
  const known = new Set(memos.map((memo) => memo.id));
  const seen = new Set<string>();
  return openTabs.filter((id) => {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function resolveActiveId(
  activeId: string | null,
  openTabs: readonly string[],
): string | null {
  if (activeId && openTabs.includes(activeId)) return activeId;
  return openTabs[0] ?? null;
}

export function closeOtherTabIds(
  openTabs: readonly string[],
  id: string,
): string[] {
  if (!openTabs.includes(id)) return [...openTabs];
  return openTabs.filter((openId) => openId === id);
}

export function closeRightTabIds(
  openTabs: readonly string[],
  id: string,
): string[] {
  const index = openTabs.indexOf(id);
  if (index === -1) return [...openTabs];
  return openTabs.slice(0, index + 1);
}

export interface TextEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface TextMatch {
  start: number;
  end: number;
}

export function findTextMatches(value: string, query: string): TextMatch[] {
  if (query.length === 0) return [];
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matches: TextMatch[] = [];
  let index = lowerValue.indexOf(lowerQuery);
  while (index !== -1) {
    matches.push({ start: index, end: index + query.length });
    index = lowerValue.indexOf(lowerQuery, index + query.length);
  }
  return matches;
}

const INDENT = "    ";

export function indentWithSpaces(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEdit {
  if (selectionStart === selectionEnd) {
    return {
      value: `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`,
      selectionStart: selectionStart + INDENT.length,
      selectionEnd: selectionStart + INDENT.length,
    };
  }

  const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const insertPositions = [firstLineStart];
  let nextLineStart = value.indexOf("\n", firstLineStart);
  while (nextLineStart !== -1 && nextLineStart + 1 <= effectiveEnd) {
    insertPositions.push(nextLineStart + 1);
    nextLineStart = value.indexOf("\n", nextLineStart + 1);
  }

  let nextValue = value;
  for (let index = insertPositions.length - 1; index >= 0; index -= 1) {
    const position = insertPositions[index];
    nextValue = `${nextValue.slice(0, position)}${INDENT}${nextValue.slice(position)}`;
  }

  const selectionShift =
    insertPositions[0] <= selectionStart ? INDENT.length : 0;
  return {
    value: nextValue,
    selectionStart: selectionStart + selectionShift,
    selectionEnd: selectionEnd + insertPositions.length * INDENT.length,
  };
}

export function outdentWithSpaces(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEdit {
  const lineStarts = selectedLineStarts(value, selectionStart, selectionEnd);
  const removals = lineStarts
    .map((position) => ({
      position,
      length: removableIndentLength(value, position),
    }))
    .filter((removal) => removal.length > 0);

  if (removals.length === 0) {
    return { value, selectionStart, selectionEnd };
  }

  let nextValue = value;
  for (let index = removals.length - 1; index >= 0; index -= 1) {
    const { position, length } = removals[index];
    nextValue = `${nextValue.slice(0, position)}${nextValue.slice(position + length)}`;
  }

  return {
    value: nextValue,
    selectionStart: shiftSelection(selectionStart, removals),
    selectionEnd: shiftSelection(selectionEnd, removals),
  };
}

function selectedLineStarts(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): number[] {
  const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const starts = [firstLineStart];
  let nextLineStart = value.indexOf("\n", firstLineStart);
  while (nextLineStart !== -1 && nextLineStart + 1 <= effectiveEnd) {
    starts.push(nextLineStart + 1);
    nextLineStart = value.indexOf("\n", nextLineStart + 1);
  }
  return starts;
}

function removableIndentLength(value: string, position: number): number {
  if (value[position] === "\t") return 1;
  let count = 0;
  while (count < INDENT.length && value[position + count] === " ") {
    count += 1;
  }
  return count;
}

function shiftSelection(
  selection: number,
  removals: readonly { position: number; length: number }[],
): number {
  let next = selection;
  for (const { position, length } of removals) {
    if (position < selection) {
      next -= Math.min(length, selection - position);
    }
  }
  return next;
}
