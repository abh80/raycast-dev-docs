import type { ItemKind, SearchItem } from "../types";
import { scalaPageUrl } from "./versions";
import type { CompactScala } from "./index-loader";

const PROVIDER = "scala";

function kindOf(k: string): ItemKind {
  switch (k) {
    case "class":
      return "class";
    case "object":
    case "package object":
      return "object";
    case "trait":
      return "trait";
    case "enum":
      return "enum";
    case "def":
      return "method";
    case "val":
    case "var":
      return "field";
    case "given":
      return "given";
    case "extension":
      return "extension";
    case "type":
      return "type";
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
    k === "package" ||
    k === "package object"
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

function ownerBoost(d: string, owner: string): number {
  if (!owner) return 0;
  if (!d) return 0;
  const dl = d.toLowerCase();
  if (dl === owner) return 400;
  if (dl.endsWith("." + owner)) return 350;
  if (dl.includes("." + owner + ".")) return 200;
  if (dl.includes(owner)) return 100;
  return 0;
}

function scoreDotted(
  it: CompactScala,
  owner: string,
  name: string,
  full: string,
): number {
  const memberRaw = scoreLabel(it.n, name);
  const memberScore =
    memberRaw > 0 ? memberRaw + ownerBoost(it.d, owner) : 0;
  const ownerRaw = scoreLabel(it.n, owner);
  let ownerScore = 0;
  if (ownerRaw > 0 && isContainer(it.k)) {
    ownerScore = ownerRaw + 50;
    if (it.n.toLowerCase() === owner) ownerScore += 1000;
  }
  const fqnScore = scoreFqn(fqnOf(it), full);
  return Math.max(memberScore, ownerScore, fqnScore);
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

  const dot = q.lastIndexOf(".");
  const owner = dot > 0 ? q.slice(0, dot) : "";
  const name = dot > 0 ? q.slice(dot + 1) : q;

  interface Hit {
    item: CompactScala;
    score: number;
  }
  const hits: Hit[] = [];
  const cap = limit * 10;
  for (const it of index) {
    let s: number;
    if (dot > 0) {
      s = scoreDotted(it, owner, name, q);
    } else {
      s = scoreLabel(it.n, q);
      if (s === 0) s = scoreFqn(fqnOf(it), q);
      if (s > 0 && isContainer(it.k)) s += 50;
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
  const SCALA_DEBUG = false;
  if (SCALA_DEBUG && q === "map.get") {
    console.log(
      `[scala-debug] q="${q}" hits=${hits.length} limit=${limit} returning=${Math.min(hits.length, limit)}`,
    );
    const kindCounts = new Map<string, number>();
    for (const h of hits.slice(0, limit)) {
      kindCounts.set(h.item.k, (kindCounts.get(h.item.k) ?? 0) + 1);
    }
    console.log(
      "[scala-debug] returned kinds:",
      Array.from(kindCounts.entries())
        .map(([k, n]) => `${k}=${n}`)
        .join(" "),
    );
    for (const h of hits.slice(0, 15)) {
      console.log(
        `[scala-debug]   score=${h.score} k=${h.item.k} n=${h.item.n} d=${h.item.d}`,
      );
    }
  }
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
