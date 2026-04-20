import type { DocProvider, DocPage, SearchItem } from "../types";
import { MDN_VERSIONS } from "./versions";
import { getCompactIndex } from "./index-loader";
import { searchChildren, searchCompact } from "./search";
import { fetchText } from "../../lib/http";
import { getCachedPage, setCachedPage } from "../../lib/page-cache";
import { parseMdnPage, parseFallback } from "./parser";

const PROVIDER_ID = "mdn";
const VERSION = "current";
const MDN_ORIGIN = "https://developer.mozilla.org";

function urlPath(fullUrl: string): string {
  return fullUrl.startsWith(MDN_ORIGIN)
    ? fullUrl.slice(MDN_ORIGIN.length)
    : fullUrl;
}

export const mdnProvider: DocProvider = {
  id: PROVIDER_ID,
  label: "MDN JS",
  listVersions: () => MDN_VERSIONS,
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
    return searchChildren(
      index,
      parent.version,
      urlPath(parent.url),
      query,
      limit,
    );
  },
  externalUrl: (item) => item.url,
  loadPage: async (item: SearchItem): Promise<DocPage> => {
    const cacheKey = item.url;
    const cached = await getCachedPage(PROVIDER_ID, item.version, cacheKey);
    if (cached && cached.markdown && cached.markdown.trim().length > 50)
      return cached;

    const html = await fetchText(item.url);
    let page: DocPage;
    try {
      page = parseMdnPage(html, item);
    } catch {
      page = parseFallback(html, item);
    }
    await setCachedPage(PROVIDER_ID, item.version, cacheKey, page);
    return page;
  },
};
