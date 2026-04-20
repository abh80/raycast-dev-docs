import { fetchText } from "../../lib/http";
import { indexPath, readJson, writeJson } from "../../lib/storage";
import { SCALA_SEARCH_DATA_URL } from "./versions";

export interface CompactScala {
  l: string;
  n: string;
  d: string;
  k: string;
  t?: string;
  x?: string;
}

const PROVIDER = "scala";
const VERSION = "current";

interface RawEntry {
  l?: string;
  n?: string;
  d?: string;
  k?: string;
  t?: string;
  x?: string;
}

const memoryCache = new Map<string, CompactScala[]>();

function parseSearchData(src: string): unknown[] {
  const start = src.indexOf("[");
  const end = src.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(src.slice(start, end + 1)) as unknown[];
  } catch {
    return [];
  }
}

function compact(raw: unknown[]): CompactScala[] {
  const out: CompactScala[] = [];
  for (const r of raw as RawEntry[]) {
    if (!r?.l || !r?.n || !r?.k) continue;
    const item: CompactScala = { l: r.l, n: r.n, d: r.d ?? "", k: r.k };
    if (r.t) item.t = r.t;
    if (r.x) item.x = r.x;
    out.push(item);
  }
  return out;
}

export async function getCompactIndex(): Promise<CompactScala[]> {
  const mem = memoryCache.get(VERSION);
  if (mem) return mem;

  const cachePath = indexPath(PROVIDER, VERSION, "compact1");
  const cached = await readJson<CompactScala[]>(cachePath);
  if (cached && cached.length > 0) {
    memoryCache.set(VERSION, cached);
    return cached;
  }

  const src = await fetchText(SCALA_SEARCH_DATA_URL);
  const raw = parseSearchData(src);
  const items = compact(raw);
  await writeJson(cachePath, items);
  memoryCache.set(VERSION, items);
  return items;
}
