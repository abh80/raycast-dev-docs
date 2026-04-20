import { getPreferenceValues } from "@raycast/api";
import type { DocProvider, DocPage, SearchItem } from "../types";
import { JAVA_VERSIONS } from "./versions";
import { getCompactIndex } from "./index-loader";
import { searchChildren, searchCompact } from "./search";
import { fetchText } from "../../lib/http";
import { getCachedPage, setCachedPage } from "../../lib/page-cache";
import {
  parseTypePage,
  parseMemberPage,
  parsePackagePage,
  parseFallback,
} from "./parser";

interface Prefs {
  javaDefaultVersion?: string;
}

const PROVIDER_ID = "java";

function stripAnchor(url: string): string {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

export const javaProvider: DocProvider = {
  id: PROVIDER_ID,
  label: "Java",
  listVersions: () => JAVA_VERSIONS,
  defaultVersion: () => getPreferenceValues<Prefs>().javaDefaultVersion ?? "24",
  prefetch: async (version) => {
    await getCompactIndex(version);
  },
  search: async (version, query, limit) => {
    const index = await getCompactIndex(version);
    return searchCompact(index, version, query, limit);
  },
  childrenOf: async (parent, query, limit) => {
    const parts = parent.fqn.split(".");
    const className = parts.pop() ?? parent.title;
    const pkg = parts.join(".");
    const index = await getCompactIndex(parent.version);
    return searchChildren(index, parent.version, pkg, className, query, limit);
  },
  externalUrl: (item) => item.url,
  loadPage: async (item: SearchItem): Promise<DocPage> => {
    const pageUrl = stripAnchor(item.url);
    const isMember =
      item.kind === "method" ||
      item.kind === "field" ||
      item.kind === "constructor";
    const cacheKey = isMember ? item.url : pageUrl;
    const cached = await getCachedPage(PROVIDER_ID, item.version, cacheKey);
    if (cached && cached.markdown && cached.markdown.trim().length > 50)
      return cached;

    const html = await fetchText(pageUrl);
    let page: DocPage;
    try {
      if (item.kind === "package") page = parsePackagePage(html, item);
      else if (isMember) page = parseMemberPage(html, item);
      else if (
        item.kind === "class" ||
        item.kind === "interface" ||
        item.kind === "enum" ||
        item.kind === "annotation" ||
        item.kind === "record"
      )
        page = parseTypePage(html, item);
      else page = parseFallback(html, item);
    } catch {
      page = parseFallback(html, item);
    }
    await setCachedPage(PROVIDER_ID, item.version, cacheKey, page);
    return page;
  },
};
