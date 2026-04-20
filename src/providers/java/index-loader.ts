import { apiBase } from "./versions";
import { fetchText } from "../../lib/http";
import { indexPath, readJson, writeJson } from "../../lib/storage";

export type CompactKind = "t" | "m" | "p";

export interface CompactItem {
  k: CompactKind;
  p?: string;
  c?: string;
  l: string;
  m?: string;
  u?: string;
}

const PROVIDER = "java";

function extractJsonArray(source: string): unknown[] {
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(source.slice(start, end + 1)) as unknown[];
  } catch {
    return [];
  }
}

async function fetchIndexFile(
  version: string,
  file: string,
): Promise<unknown[]> {
  const src = await fetchText(`${apiBase(version)}${file}`);
  return extractJsonArray(src);
}

interface RawType {
  p?: string;
  l?: string;
  m?: string;
}
interface RawMember {
  p?: string;
  c?: string;
  l?: string;
  u?: string;
  m?: string;
}
interface RawPackage {
  l?: string;
  m?: string;
}

function buildCompact(
  types: RawType[],
  members: RawMember[],
  packages: RawPackage[],
): CompactItem[] {
  // Map package name -> module from package index so type/member URLs always get module
  const pkgModule = new Map<string, string>();
  const pkgItems: CompactItem[] = [];
  for (const r of packages) {
    if (!r?.l) continue;
    let l = r.l;
    let m = r.m;
    if (!m && l.includes("/")) {
      const [mod, pkg] = l.split("/", 2);
      m = mod;
      l = pkg;
    }
    if (m) pkgModule.set(l, m);
    const item: CompactItem = { k: "p", l };
    if (m) item.m = m;
    pkgItems.push(item);
  }

  const out: CompactItem[] = [];
  for (const r of types) {
    if (!r?.l || !r?.p) continue;
    const m = r.m ?? pkgModule.get(r.p);
    const item: CompactItem = { k: "t", p: r.p, l: r.l };
    if (m) item.m = m;
    out.push(item);
  }
  for (const r of members) {
    if (!r?.l || !r?.c || !r?.p) continue;
    const m = r.m ?? pkgModule.get(r.p);
    const item: CompactItem = { k: "m", p: r.p, c: r.c, l: r.l };
    if (m) item.m = m;
    if (r.u) item.u = r.u;
    out.push(item);
  }
  out.push(...pkgItems);
  return out;
}

const memoryCache = new Map<string, CompactItem[]>();

export async function getCompactIndex(version: string): Promise<CompactItem[]> {
  const memKey = version;
  const mem = memoryCache.get(memKey);
  if (mem) return mem;

  const cachePath = indexPath(PROVIDER, version, "compact2");
  const cached = await readJson<CompactItem[]>(cachePath);
  if (cached && cached.length > 0) {
    memoryCache.set(memKey, cached);
    return cached;
  }

  const [types, members, packages] = await Promise.all([
    fetchIndexFile(version, "type-search-index.js"),
    fetchIndexFile(version, "member-search-index.js"),
    fetchIndexFile(version, "package-search-index.js"),
  ]);

  const items = buildCompact(
    types as RawType[],
    members as RawMember[],
    packages as RawPackage[],
  );
  await writeJson(cachePath, items);
  memoryCache.set(memKey, items);
  return items;
}
