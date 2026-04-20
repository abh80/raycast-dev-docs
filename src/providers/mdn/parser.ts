import { parse, HTMLElement } from "node-html-parser";
import TurndownService from "turndown";
import type { DocMetaEntry, DocPage, SearchItem } from "../types";

const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
  bulletListMarker: "-",
});

turndown.addRule("preservePre", {
  filter: ["pre"],
  replacement: (_content, node) => {
    const el = node as unknown as {
      textContent?: string;
      getAttribute?: (n: string) => string | null;
    };
    const txt = el.textContent ?? "";
    const cls = el.getAttribute ? (el.getAttribute("class") ?? "") : "";
    const lang = /brush:\s*(\w+)/.exec(cls)?.[1] ?? "js";
    return "\n```" + lang + "\n" + txt.trim() + "\n```\n";
  },
});

function htmlToMd(el: HTMLElement | null | undefined): string {
  if (!el) return "";
  const html = el.innerHTML ?? "";
  if (!html.trim()) return "";
  try {
    return turndown.turndown(html).trim();
  } catch {
    return (el.text ?? "").trim();
  }
}

function textOf(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/\s+/g, " ").trim();
}

function firstMatch(
  root: HTMLElement,
  selectors: string[],
): HTMLElement | null {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function stripNoise(root: HTMLElement): void {
  const selectors = [
    "aside",
    ".on-github",
    ".metadata",
    ".section-content > .sidebar",
    ".sidebar",
    "nav",
    ".prev-next",
    "figure.table-container .bc-table",
    ".bc-table",
    ".bc-legend",
    "#browser_compatibility table",
    ".document-toc-container",
    ".top-navigation-main",
    "#sidebar-quicklinks",
  ];
  for (const s of selectors) {
    for (const el of root.querySelectorAll(s)) {
      el.remove();
    }
  }
}

export function parseMdnPage(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main =
    root.querySelector("main#content") ??
    root.querySelector("main") ??
    root.querySelector("article") ??
    root;
  const article = main.querySelector("article") ?? main;

  stripNoise(article);

  const title = textOf(firstMatch(article, ["h1"])) || item.title;

  const meta: DocMetaEntry[] = [{ label: "URL", value: item.url }];

  const specLink = article.querySelector(
    "section#specifications a, #specifications a",
  );
  if (specLink) {
    const href = specLink.getAttribute("href");
    if (href) meta.push({ label: "Specification", value: href });
  }

  if (
    article.querySelector(
      "#browser_compatibility, section#browser_compatibility",
    )
  ) {
    meta.push({
      label: "Browser compatibility",
      value: item.url + "#browser_compatibility",
    });
  }

  let md = `# ${title}\n\n`;

  const firstPara = article.querySelector("p");
  const summary = htmlToMd(firstPara);
  if (summary) md += summary + "\n\n";

  function sectionBodyHtml(
    id: string,
  ): { label: string; bodyHtml: string } | null {
    const wrapper = article.querySelector(`section[aria-labelledby="${id}"]`);
    if (wrapper) {
      const heading = wrapper.querySelector(`h2#${id}, h3#${id}, [id="${id}"]`);
      const label = textOf(heading) || id;
      const clone = parse(wrapper.outerHTML).querySelector("section");
      if (clone) {
        const h = clone.querySelector(`h2#${id}, h3#${id}, [id="${id}"]`);
        if (h) h.remove();
        return { label, bodyHtml: clone.innerHTML };
      }
    }
    const heading = article.querySelector(`h2#${id}, h3#${id}`);
    if (!heading) return null;
    const label = textOf(heading) || id;
    let sib = heading.nextElementSibling;
    let bodyHtml = "";
    while (sib && sib.tagName !== "H2") {
      bodyHtml += sib.outerHTML;
      sib = sib.nextElementSibling;
    }
    return { label, bodyHtml };
  }

  const syntaxBlock = sectionBodyHtml("syntax");
  if (syntaxBlock?.bodyHtml) {
    const tmp = parse(`<div>${syntaxBlock.bodyHtml}</div>`);
    const pre = tmp.querySelector("pre");
    if (pre) {
      md += "## Syntax\n\n";
      md += htmlToMd(pre) + "\n\n";
    }
  }

  const sectionIds = ["parameters", "return_value", "description", "examples"];
  for (const id of sectionIds) {
    const block = sectionBodyHtml(id);
    if (!block || !block.bodyHtml.trim()) continue;
    md += `## ${block.label}\n\n`;
    const wrapper = parse(`<div>${block.bodyHtml}</div>`);
    md += htmlToMd(wrapper.querySelector("div")) + "\n\n";
  }

  if (md.trim().split("\n").length < 4) {
    md = `# ${title}\n\n` + htmlToMd(article);
  }

  return { title, markdown: md, meta, externalUrl: item.url };
}

export function parseFallback(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const article =
    root.querySelector("article") ?? root.querySelector("main") ?? root;
  stripNoise(article);
  const md = htmlToMd(article);
  return {
    title: item.title,
    markdown: `# ${item.title}\n\n${md}`,
    meta: [{ label: "URL", value: item.url }],
    externalUrl: item.url,
  };
}
