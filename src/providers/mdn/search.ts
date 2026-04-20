import type { ItemKind, SearchItem } from "../types";
import { mdnPageUrl } from "./versions";
import type { CompactMdn } from "./index-loader";

const PROVIDER = "mdn";
const GLOBAL_OBJECTS = "/en-US/docs/Web/JavaScript/Reference/Global_Objects/";
const STATEMENTS = "/en-US/docs/Web/JavaScript/Reference/Statements/";
const OPERATORS = "/en-US/docs/Web/JavaScript/Reference/Operators/";

function kindFor(item: CompactMdn): ItemKind {
  const u = item.u;
  if (u.startsWith(GLOBAL_OBJECTS)) {
    const rest = u.slice(GLOBAL_OBJECTS.length);
    const parts = rest.split("/").filter(Boolean);
    if (parts.length <= 1) return "class";
    return item.t.includes("(") ? "method" : "field";
  }
  if (u.startsWith(STATEMENTS) || u.startsWith(OPERATORS)) return "other";
  return "other";
}

export function parseTitle(item: CompactMdn): {
  title: string;
  subtitle: string;
  fqn: string;
} {
  const u = item.u;
  if (u.startsWith(GLOBAL_OBJECTS)) {
    const rest = u.slice(GLOBAL_OBJECTS.length);
    const parts = rest.split("/").filter(Boolean);
    if (parts.length <= 1) {
      return { title: parts[0] ?? item.t, subtitle: "Global object", fqn: u };
    }
    const obj = parts[0];
    const member = parts.slice(1).join(".");
    const hasParen = item.t.includes("(");
    const display = hasParen ? `${member}()` : member;
    return { title: `${obj}.${display}`, subtitle: obj, fqn: u };
  }
  return { title: item.t, subtitle: "", fqn: u };
}

function scoreLabel(title: string, q: string): number {
  const t = title.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);
  const i = t.indexOf(q);
  if (i !== -1) return 500 - i;
  return subsequence(t, q) ? 150 : 0;
}

function subsequence(hay: string, needle: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function expand(item: CompactMdn, version: string): SearchItem {
  const { title, subtitle, fqn } = parseTitle(item);
  return {
    providerId: PROVIDER,
    version,
    kind: kindFor(item),
    title,
    subtitle,
    fqn,
    url: mdnPageUrl(item.u),
  };
}

export function searchCompact(
  index: CompactMdn[],
  version: string,
  query: string,
  limit: number,
): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const out: SearchItem[] = [];
    for (const it of index) {
      if (kindFor(it) === "class") out.push(expand(it, version));
      if (out.length >= limit) break;
    }
    return out;
  }

  interface Hit {
    item: CompactMdn;
    score: number;
  }
  const hits: Hit[] = [];
  const cap = limit * 10;
  for (const it of index) {
    const { title } = parseTitle(it);
    const s = scoreLabel(title, q);
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

export function searchChildren(
  index: CompactMdn[],
  version: string,
  parentUrlPath: string,
  query: string,
  limit: number,
): SearchItem[] {
  const prefix = parentUrlPath.endsWith("/")
    ? parentUrlPath
    : parentUrlPath + "/";
  const q = query.trim().toLowerCase();
  const candidates = index.filter((it) => it.u.startsWith(prefix));
  if (!q) return candidates.slice(0, limit).map((it) => expand(it, version));
  interface Hit {
    item: CompactMdn;
    score: number;
  }
  const hits: Hit[] = [];
  for (const it of candidates) {
    const { title } = parseTitle(it);
    const s = scoreLabel(title, q);
    if (s > 0) hits.push({ item: it, score: s });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => expand(h.item, version));
}
