import { environment } from "@raycast/api";
import { mkdir, readFile, writeFile, stat, readdir, unlink } from "fs/promises";
import { createHash } from "crypto";
import { join } from "path";

const ROOT = environment.supportPath;

export function providerDir(providerId: string): string {
  return join(ROOT, providerId);
}

export function indexPath(providerId: string, version: string, kind: string): string {
  return join(providerDir(providerId), "indexes", version, `${kind}.json`);
}

export function pagePath(providerId: string, version: string, url: string): string {
  const hash = createHash("sha1").update(url).digest("hex");
  return join(providerDir(providerId), "pages", version, `${hash}.json`);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const data = await readFile(path, "utf8");
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(join(path, ".."));
  await writeFile(path, JSON.stringify(value), "utf8");
}

interface CacheEntry {
  path: string;
  size: number;
  mtime: number;
}

async function walkFiles(dir: string): Promise<CacheEntry[]> {
  const out: CacheEntry[] = [];
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkFiles(p)));
    } else if (e.isFile()) {
      try {
        const s = await stat(p);
        out.push({ path: p, size: s.size, mtime: s.mtimeMs });
      } catch {
        // ignore
      }
    }
  }
  return out;
}

export async function pruneCache(providerId: string, limitBytes: number): Promise<void> {
  const dir = join(providerDir(providerId), "pages");
  const files = await walkFiles(dir);
  let total = files.reduce((n, f) => n + f.size, 0);
  if (total <= limitBytes) return;
  files.sort((a, b) => a.mtime - b.mtime);
  for (const f of files) {
    if (total <= limitBytes) break;
    try {
      await unlink(f.path);
      total -= f.size;
    } catch {
      // ignore
    }
  }
}
