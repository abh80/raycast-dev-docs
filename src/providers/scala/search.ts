import type { ItemKind, SearchItem } from "../types";
import { scalaPageUrl } from "./versions";
import type { CompactScala } from "./index-loader";

const PROVIDER = "scala";

function kindOf(k: string): ItemKind {
  switch (k) {
    case "class":
    case "object":
    case "enum":
      return "class";
    case "trait":
      return "interface";
    case "def":
      return "method";
    case "val":
    case "var":
    case "given":
      return "field";
    case "type":
    case "static":
      return "other";
    case "package":
      return "package";
    default:
      return "other";
  }
}

function fqnOf(item: CompactScala): string {
  return item.d ? `${item.d}.${item.n}` : item.n;
}

function isContainer(k: string): boolean {
  return (
    k === "class" ||
    k === "trait" ||
    k === "object" ||
    k === "enum" ||
    k === "package"
  );
}

function scoreLabel(title: string, q: string): number {
  const t = title.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);
  const i = t.indexOf(q);
  if (i !== -1) return 500 - i;
  return subsequence(t, q) ? 150 : 0;
}

function scoreFqn(fqn: string, q: string): number {
  const f = fqn.toLowerCase();
  if (f.endsWith("." + q)) return 750;
  const i = f.indexOf(q);
  if (i !== -1) return 300 - Math.min(i, 250);
  return 0;
}

function subsequence(hay: string, needle: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function expand(item: CompactScala, version: string): SearchItem {
  const kind = kindOf(item.k);
  const fqn = fqnOf(item);
  const anchorIdx = item.l.indexOf("#");
  const anchor = anchorIdx === -1 ? undefined : item.l.slice(anchorIdx + 1);
  return {
    providerId: PROVIDER,
    version,
    kind,
    title: item.n,
    subtitle: item.d,
    fqn,
    url: scalaPageUrl(item.l),
    anchor,
  };
}

export function searchCompact(
  index: CompactScala[],
  version: string,
  query: string,
  limit: number,
): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const out: SearchItem[] = [];
    for (const it of index) {
      if (isContainer(it.k)) out.push(expand(it, version));
      if (out.length >= limit) break;
    }
    return out;
  }

  interface Hit {
    item: CompactScala;
    score: number;
  }
  const hits: Hit[] = [];
  const cap = limit * 10;
  for (const it of index) {
    let s = scoreLabel(it.n, q);
    if (s === 0) s = scoreFqn(fqnOf(it), q);
    if (s > 0) {
      if (isContainer(it.k)) s += 50;
      hits.push({ item: it, score: s });
      if (hits.length > cap * 2) {
        hits.sort((a, b) => b.score - a.score);
        hits.length = cap;
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => expand(h.item, version));
}

export function searchChildren(
  index: CompactScala[],
  version: string,
  parentFqn: string,
  query: string,
  limit: number,
): SearchItem[] {
  const q = query.trim().toLowerCase();
  const candidates = index.filter((it) => it.d === parentFqn);
  if (!q) return candidates.slice(0, limit).map((it) => expand(it, version));
  interface Hit {
    item: CompactScala;
    score: number;
  }
  const hits: Hit[] = [];
  for (const it of candidates) {
    const s = scoreLabel(it.n, q);
    if (s > 0) hits.push({ item: it, score: s });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => expand(h.item, version));
}
