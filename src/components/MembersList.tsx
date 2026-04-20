import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import type { DocProvider, SearchItem } from "../providers/types";
import { DocDetail } from "./DocDetail";
import { isPrefixMatch, matchedSubstring, shortenTitle } from "../lib/titles";

interface Props {
  provider: DocProvider;
  parent: SearchItem;
}

const LIMIT = 200;

export function MembersList({ provider, parent }: Props) {
  const [query, setQuery] = useState("");

  const { data: results = [], isLoading } = useCachedPromise(
    async (q: string): Promise<SearchItem[]> => {
      if (!provider.childrenOf) return [];
      try {
        return await provider.childrenOf(parent, q, LIMIT);
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Load members failed",
          message: String((e as Error).message ?? e),
        });
        return [];
      }
    },
    [query],
    { keepPreviousData: true },
  );

  const methods = results.filter(
    (r) => r.kind === "method" || r.kind === "constructor",
  );
  const fields = results.filter((r) => r.kind === "field");

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`${parent.title} — Members`}
      searchBarPlaceholder={`Search members of ${parent.title}…`}
      onSearchTextChange={setQuery}
      throttle
    >
      <List.Section title="Methods" subtitle={String(methods.length)}>
        {methods.map((it) => (
          <MemberItem
            key={it.url}
            provider={provider}
            item={it}
            icon={Icon.Bolt}
            query={query}
          />
        ))}
      </List.Section>
      <List.Section title="Fields" subtitle={String(fields.length)}>
        {fields.map((it) => (
          <MemberItem
            key={it.url}
            provider={provider}
            item={it}
            icon={Icon.Circle}
            query={query}
          />
        ))}
      </List.Section>
    </List>
  );
}

function MemberItem({
  provider,
  item,
  icon,
  query,
}: {
  provider: DocProvider;
  item: SearchItem;
  icon: Icon;
  query: string;
}) {
  const baseTitle = item.title.includes(".")
    ? item.title.split(".").slice(1).join(".")
    : item.title;
  const { display, extra } = shortenTitle(baseTitle);
  const keywords = extra.includes(item.title) ? extra : [item.title, ...extra];
  const match = matchedSubstring(baseTitle, query);
  const prefix = isPrefixMatch(baseTitle, query);
  const accessories: List.Item.Accessory[] = [];
  if (match) accessories.push({ tag: { value: match, color: Color.Green } });
  accessories.push({ text: item.kind });
  const iconValue = prefix ? { source: icon, tintColor: Color.Green } : icon;

  return (
    <List.Item
      icon={iconValue}
      title={display}
      subtitle={item.subtitle}
      keywords={keywords}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Docs"
            icon={Icon.Document}
            target={<DocDetail provider={provider} item={item} />}
          />
          <Action.OpenInBrowser
            url={provider.externalUrl(item)}
            title="Open in Browser"
            shortcut={{ modifiers: ["ctrl"], key: "return" }}
          />
          <Action.CopyToClipboard
            title="Copy URL"
            content={item.url}
            icon={Icon.Link}
          />
          <Action.CopyToClipboard
            title="Copy Fully Qualified Name"
            content={item.fqn}
            icon={Icon.Text}
          />
        </ActionPanel>
      }
    />
  );
}
