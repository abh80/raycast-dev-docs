export type ItemKind =
  | "class"
  | "interface"
  | "enum"
  | "annotation"
  | "record"
  | "method"
  | "field"
  | "constructor"
  | "package"
  | "module"
  | "other";

export interface SearchItem {
  providerId: string;
  version: string;
  kind: ItemKind;
  title: string;
  subtitle?: string;
  fqn: string;
  url: string;
  anchor?: string;
}

export interface DocMetaEntry {
  label: string;
  value: string;
}

export interface DocPage {
  title: string;
  markdown: string;
  meta?: DocMetaEntry[];
  externalUrl: string;
}

export interface ProviderVersion {
  id: string;
  label: string;
}

export interface DocProvider {
  id: string;
  label: string;
  listVersions(): ProviderVersion[];
  defaultVersion(): string;
  prefetch(version: string): Promise<void>;
  search(version: string, query: string, limit: number): Promise<SearchItem[]>;
  loadPage(item: SearchItem): Promise<DocPage>;
  externalUrl(item: SearchItem): string;
  /** Return children (members) of a container item (class/interface). Optional. */
  childrenOf?(
    parent: SearchItem,
    query: string,
    limit: number,
  ): Promise<SearchItem[]>;
}
