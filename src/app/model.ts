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
