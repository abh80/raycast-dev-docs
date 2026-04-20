import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import type { DocProvider, SearchItem } from "../providers/types";

interface Props {
  provider: DocProvider;
  item: SearchItem;
}

export function DocDetail({ provider, item }: Props) {
  const { data, isLoading, error } = useCachedPromise(
    async (it: SearchItem) => provider.loadPage(it),
    [item],
    { keepPreviousData: true },
  );

  const markdown = error
    ? `# Error\n\n${String(error.message ?? error)}\n\n[Open in browser](${item.url})`
    : (data?.markdown ?? `# ${item.title}\n\nLoading…`);

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={item.title}
      metadata={
        data?.meta && data.meta.length > 0 ? (
          <Detail.Metadata>
            {data.meta.map((m, i) => (
              <Detail.Metadata.Label
                key={`${m.label}-${i}`}
                title={m.label}
                text={m.value}
              />
            ))}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Link
              title="Source"
              target={item.url}
              text="Oracle"
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
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
