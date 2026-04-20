import type { ProviderVersion } from "../types";

export const JAVA_VERSIONS: ProviderVersion[] = [
  { id: "11", label: "Java 11 (LTS)" },
  { id: "17", label: "Java 17 (LTS)" },
  { id: "21", label: "Java 21 (LTS)" },
  { id: "24", label: "Java 24 (Latest)" },
];

export function apiBase(version: string): string {
  return `https://docs.oracle.com/en/java/javase/${version}/docs/api/`;
}

export function buildTypeUrl(
  version: string,
  pkg: string,
  name: string,
  module?: string,
): string {
  const base = apiBase(version);
  const pkgPath = pkg.replace(/\./g, "/");
  if (module) return `${base}${module}/${pkgPath}/${name}.html`;
  return `${base}${pkgPath}/${name}.html`;
}

export function buildPackageUrl(
  version: string,
  pkg: string,
  module?: string,
): string {
  const base = apiBase(version);
  const pkgPath = pkg.replace(/\./g, "/");
  if (module) return `${base}${module}/${pkgPath}/package-summary.html`;
  return `${base}${pkgPath}/package-summary.html`;
}
