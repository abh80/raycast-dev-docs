import { fetchText } from "../../lib/http";
import { indexPath, readJson, writeJson } from "../../lib/storage";
import { MDN_SEARCH_INDEX_URL } from "./versions";

export interface CompactMdn {
  t: string;
  u: string;
}

const PROVIDER = "mdn";
const VERSION = "current";
const JS_PREFIX = "/en-US/docs/Web/JavaScript/";

interface RawEntry {
  title?: string;
  url?: string;
}

const memoryCache = new Map<string, CompactMdn[]>();

function filterJs(raw: unknown[]): CompactMdn[] {
  const out: CompactMdn[] = [];
  for (const r of raw as RawEntry[]) {
    if (!r?.title || !r?.url) continue;
    if (!r.url.startsWith(JS_PREFIX)) continue;
    out.push({ t: r.title, u: r.url });
  }
  return out;
}

export async function getCompactIndex(): Promise<CompactMdn[]> {
  const memKey = VERSION;
  const mem = memoryCache.get(memKey);
  if (mem) return mem;

  const cachePath = indexPath(PROVIDER, VERSION, "compact1");
  const cached = await readJson<CompactMdn[]>(cachePath);
  if (cached && cached.length > 0) {
    memoryCache.set(memKey, cached);
    return cached;
  }

  const src = await fetchText(MDN_SEARCH_INDEX_URL);
  let raw: unknown[] = [];
  try {
    raw = JSON.parse(src) as unknown[];
  } catch {
    raw = [];
  }
  const items = filterJs(raw);
  await writeJson(cachePath, items);
  memoryCache.set(memKey, items);
  return items;
}
