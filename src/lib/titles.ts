export function shortenTitle(
  title: string,
  max = 60,
): { display: string; extra: string[] } {
  if (title.length <= max) {
    return { display: title, extra: [] };
  }

  const extra: string[] = [title];
  for (const seg of title.split(".")) {
    if (seg && seg !== title) extra.push(seg);
  }

  let display: string;
  const parenIdx = title.indexOf("(");
  if (parenIdx >= 0) {
    const head = title.slice(0, parenIdx);
    const closeIdx = title.lastIndexOf(")");
    const hasParams =
      closeIdx > parenIdx + 1 &&
      title.slice(parenIdx + 1, closeIdx).trim().length > 0;
    display = head + (hasParams ? "(...)" : "()");
  } else if (title.includes(".")) {
    const last = title.split(".").pop() ?? title;
    display = last.length > max ? last.slice(0, max) : last;
  } else {
    display = title.slice(0, max);
  }

  return { display, extra };
}

/**
 * Compute the matching substring of `query` within `title` (case-insensitive).
 * Returns the matched slice from `title` if a contiguous substring match exists,
 * otherwise returns null. Subsequence-only matches return null (no contiguous span to highlight).
 */
export function matchedSubstring(title: string, query: string): string | null {
  if (!query) return null;
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  const idx = t.indexOf(q);
  if (idx < 0) return null;
  return title.slice(idx, idx + query.length);
}

export function isPrefixMatch(title: string, query: string): boolean {
  if (!query) return false;
  return title.toLowerCase().startsWith(query.toLowerCase());
}
