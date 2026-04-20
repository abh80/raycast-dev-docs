import { pagePath, readJson, writeJson, pruneCache } from "./storage";
import { getPreferenceValues } from "@raycast/api";
import type { DocPage } from "../providers/types";

interface Prefs {
  cacheLimitMB?: string;
}

function limitBytes(): number {
  const v = getPreferenceValues<Prefs>().cacheLimitMB;
  const mb = Number(v) || 100;
  return mb * 1024 * 1024;
}

export async function getCachedPage(
  providerId: string,
  version: string,
  url: string,
): Promise<DocPage | null> {
  return readJson<DocPage>(pagePath(providerId, version, url));
}

export async function setCachedPage(
  providerId: string,
  version: string,
  url: string,
  page: DocPage,
): Promise<void> {
  await writeJson(pagePath(providerId, version, url), page);
  void pruneCache(providerId, limitBytes()).catch(() => undefined);
}
