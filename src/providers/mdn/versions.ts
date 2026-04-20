import type { ProviderVersion } from "../types";

export const MDN_VERSIONS: ProviderVersion[] = [
  { id: "current", label: "Latest" },
];

export const MDN_ORIGIN = "https://developer.mozilla.org";
export const MDN_SEARCH_INDEX_URL = `${MDN_ORIGIN}/en-US/search-index.json`;

export function mdnPageUrl(path: string): string {
  return `${MDN_ORIGIN}${path}`;
}
