import { Action, ActionPanel, Color, Icon, List, LocalStorage, showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import type { DocProvider, ItemKind, SearchItem } from "../providers/types";
import { DocDetail } from "./DocDetail";
import { MembersList } from "./MembersList";
import { isPrefixMatch, matchedSubstring, shortenTitle } from "../lib/titles";

const TYPE_KINDS: ReadonlySet<ItemKind> = new Set(["class", "interface", "enum", "annotation", "record"]);

interface Props {
  provider: DocProvider;
}

const KIND_ICON: Record<ItemKind, Icon> = {
  class: Icon.Box,
  interface: Icon.Hashtag,
  enum: Icon.List,
  annotation: Icon.At,
  record: Icon.Tray,
  method: Icon.Bolt,
  field: Icon.Circle,
  constructor: Icon.Hammer,
  package: Icon.Folder,
  module: Icon.Layers,
  other: Icon.Document,
};

const KIND_SECTION: Partial<Record<ItemKind, string>> = {
  class: "Types",
  interface: "Types",
  enum: "Types",
  annotation: "Types",
  record: "Types",
  method: "Members",
  field: "Members",
  constructor: "Members",
  package: "Packages",
  module: "Packages",
};

function sectionFor(kind: ItemKind): string {
  return KIND_SECTION[kind] ?? "Other";
}

const LIMIT = 80;

export function DocSearchList({ provider }: Props) {
  const versions = provider.listVersions();
  const storageKey = `${provider.id}:lastVersion`;
  const [version, setVersion] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const stored = await LocalStorage.getItem<string>(storageKey);
      const initial =
        stored && versions.some((v) => v.id === stored) ? stored : provider.defaultVersion();
      setVersion(initial);
    })();
  }, [storageKey, provider]);

  const onVersionChange = async (v: string) => {
    setVersion(v);
    await LocalStorage.setItem(storageKey, v);
  };

  const { data: results = [], isLoading } = useCachedPromise(
    async (v: string | null, q: string) => {
      if (!v) return [] as SearchItem[];
      try {
        return await provider.search(v, q, LIMIT);
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Search failed",
          message: String((e as Error).message ?? e),
        });
        return [] as SearchItem[];
      }
    },
    [version, query],
    { keepPreviousData: true },
  );

  const sections = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const it of results) {
      const s = sectionFor(it.kind);
      const arr = map.get(s) ?? [];
      arr.push(it);
      map.set(s, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <List
      isLoading={isLoading || version === null}
      searchBarPlaceholder={`Search ${provider.label} docs…`}
      onSearchTextChange={setQuery}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Version" value={version ?? provider.defaultVersion()} onChange={onVersionChange}>
          {versions.map((v) => (
            <List.Dropdown.Item key={v.id} title={v.label} value={v.id} />
          ))}
        </List.Dropdown>
      }
    >
      {sections.map(([section, entries]) => (
        <List.Section key={section} title={section} subtitle={String(entries.length)}>
          {entries.map((it) => {
            const { display, extra } = shortenTitle(it.title);
            const match = matchedSubstring(it.title, query);
            const prefix = isPrefixMatch(it.title, query);
            const accessories: List.Item.Accessory[] = [];
            if (match) accessories.push({ tag: { value: match, color: Color.Green } });
            accessories.push({ text: it.kind });
            const iconValue = prefix
              ? { source: KIND_ICON[it.kind], tintColor: Color.Green }
              : KIND_ICON[it.kind];
            return (
            <List.Item
              key={`${it.kind}:${it.url}`}
              icon={iconValue}
              title={display}
              subtitle={it.subtitle}
              keywords={extra}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <Action.Push title="Show Docs" icon={Icon.Document} target={<DocDetail provider={provider} item={it} />} />
                  <Action.OpenInBrowser
                    url={provider.externalUrl(it)}
                    title="Open in Browser"
                    shortcut={{ modifiers: ["ctrl"], key: "return" }}
                  />
                  {provider.childrenOf && TYPE_KINDS.has(it.kind) && (
                    <Action.Push
                      title="Browse Members"
                      icon={Icon.List}
                      shortcut={{ modifiers: ["ctrl"], key: "m" }}
                      target={<MembersList provider={provider} parent={it} />}
                    />
                  )}
                  <Action.CopyToClipboard title="Copy URL" content={it.url} icon={Icon.Link} />
                  <Action.CopyToClipboard title="Copy Fully Qualified Name" content={it.fqn} icon={Icon.Text} />
                </ActionPanel>
              }
            />
            );
          })}
        </List.Section>
      ))}
    </List>
  );
}
