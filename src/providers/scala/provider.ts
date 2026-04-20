import type { DocProvider, DocPage, SearchItem } from "../types";
import { SCALA_VERSIONS } from "./versions";
import { getCompactIndex } from "./index-loader";
import { searchChildren, searchCompact } from "./search";
import { fetchText } from "../../lib/http";
import { getCachedPage, setCachedPage } from "../../lib/page-cache";
import { parseScalaPage, parseFallback } from "./parser";

const PROVIDER_ID = "scala";
const VERSION = "current";

function stripAnchor(url: string): string {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

export const scalaProvider: DocProvider = {
  id: PROVIDER_ID,
  label: "Scala 3",
  listVersions: () => SCALA_VERSIONS,
  defaultVersion: () => VERSION,
  prefetch: async () => {
    await getCompactIndex();
  },
  search: async (version, query, limit) => {
    const index = await getCompactIndex();
    return searchCompact(index, version, query, limit);
  },
  childrenOf: async (parent, query, limit) => {
    const index = await getCompactIndex();
    return searchChildren(index, parent.version, parent.fqn, query, limit);
  },
  externalUrl: (item) => item.url,
  loadPage: async (item: SearchItem): Promise<DocPage> => {
    const pageUrl = stripAnchor(item.url);
    const cacheKey = item.anchor ? item.url : pageUrl;
    const cached = await getCachedPage(PROVIDER_ID, item.version, cacheKey);
    if (cached && cached.markdown && cached.markdown.trim().length > 50)
      return cached;

    const html = await fetchText(pageUrl);
    let page: DocPage;
    try {
      page = parseScalaPage(html, item);
    } catch {
      page = parseFallback(html, item);
    }
    await setCachedPage(PROVIDER_ID, item.version, cacheKey, page);
    return page;
  },
};
