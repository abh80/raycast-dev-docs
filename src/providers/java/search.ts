import type { SearchItem, ItemKind } from "../types";
import { buildPackageUrl, buildTypeUrl } from "./versions";
import type { CompactItem } from "./index-loader";

const PROVIDER = "java";

function compactTitle(item: CompactItem): string {
  if (item.k === "m" && item.c) return `${item.c}.${item.l}`;
  return item.l;
}

function compactFqn(item: CompactItem): string {
  if (item.k === "p") return item.l;
  if (item.k === "t") return `${item.p}.${item.l}`;
  return `${item.p}.${item.c}.${item.l}`;
}

function compactKind(item: CompactItem): ItemKind {
  if (item.k === "p") return "package";
  if (item.k === "t") return "class";
  return item.l.includes("(") ? "method" : "field";
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

function expand(item: CompactItem, version: string): SearchItem {
  const kind = compactKind(item);
  const title = compactTitle(item);
  const fqn = compactFqn(item);
  let url: string;
  let anchor: string | undefined;
  if (item.k === "p") {
    url = buildPackageUrl(version, item.l, item.m);
  } else if (item.k === "t") {
    url = buildTypeUrl(version, item.p!, item.l, item.m);
  } else {
    const typeUrl = buildTypeUrl(version, item.p!, item.c!, item.m);
    anchor = item.u ?? item.l;
    url = `${typeUrl}#${anchor}`;
  }
  return {
    providerId: PROVIDER,
    version,
    kind,
    title,
    subtitle: item.k === "p" ? (item.m ?? "") : (item.p ?? ""),
    fqn,
    url,
    anchor,
  };
}

export function searchChildren(
  index: CompactItem[],
  version: string,
  pkg: string,
  className: string,
  query: string,
  limit: number,
): SearchItem[] {
  const q = query.trim().toLowerCase();
  const candidates = index.filter(
    (it) => it.k === "m" && it.p === pkg && it.c === className,
  );
  if (!q) return candidates.slice(0, limit).map((it) => expand(it, version));
  interface Hit {
    item: CompactItem;
    score: number;
  }
  const hits: Hit[] = [];
  for (const it of candidates) {
    const s = scoreLabel(it.l, q);
    if (s > 0) hits.push({ item: it, score: s });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => expand(h.item, version));
}

export function searchCompact(
  index: CompactItem[],
  version: string,
  query: string,
  limit: number,
): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // Return a short first-page slice: prefer types + packages
    const out: SearchItem[] = [];
    for (const it of index) {
      if (it.k !== "m") out.push(expand(it, version));
      if (out.length >= limit) break;
    }
    return out;
  }

  interface Hit {
    item: CompactItem;
    score: number;
  }
  const hits: Hit[] = [];
  const cap = limit * 10;
  for (const it of index) {
    const title = it.k === "m" && it.c ? `${it.c}.${it.l}` : it.l;
    let s = scoreLabel(title, q);
    if (s === 0) {
      const fqn =
        it.k === "p"
          ? it.l
          : it.k === "t"
            ? `${it.p}.${it.l}`
            : `${it.p}.${it.c}.${it.l}`;
      s = scoreFqn(fqn, q);
    }
    if (s > 0) {
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
