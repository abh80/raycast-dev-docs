import type { ProviderVersion } from "../types";

export const SCALA_VERSIONS: ProviderVersion[] = [
  { id: "current", label: "Scala 3" },
];

export const SCALA_ORIGIN = "https://scala-lang.org/api/current";
export const SCALA_SEARCH_DATA_URL = `${SCALA_ORIGIN}/scripts/searchData.js`;

export function scalaPageUrl(rel: string): string {
  return `${SCALA_ORIGIN}/${rel.replace(/^\//, "")}`;
}
