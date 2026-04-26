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
    const el = node as unknown as { textContent?: string };
    const txt = el.textContent ?? "";
    return "\n```scala\n" + txt.trim() + "\n```\n";
  },
});

turndown.addRule("signatureBlock", {
  filter: (node) => {
    const el = node as unknown as {
      nodeName?: string;
      getAttribute?: (n: string) => string | null;
    };
    if (el.nodeName !== "DIV" && el.nodeName !== "SPAN") return false;
    const cls = el.getAttribute ? (el.getAttribute("class") ?? "") : "";
    return /\b(signature|documentableSignature|memberSignature)\b/.test(cls);
  },
  replacement: (_content, node) => {
    const el = node as unknown as { textContent?: string };
    const raw = el.textContent ?? "";
    const txt = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return "\n```scala\n" + txt + "\n```\n";
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

function stripNoise(root: HTMLElement): void {
  const selectors = [
    "nav",
    ".side-menu",
    ".mobile-menu",
    "#leftColumn",
    "#footer",
    ".breadcrumbs",
    ".tools",
    ".table-of-content",
    "script",
    "style",
  ];
  for (const s of selectors) {
    for (const el of root.querySelectorAll(s)) el.remove();
  }
}

function findById(root: HTMLElement, id: string): HTMLElement | null {
  if (!id) return null;
  const escaped = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    const hit = root.querySelector(`[id="${escaped}"]`);
    if (hit) return hit;
  } catch {
    // selector parse failure — fall through to manual scan
  }
  const stack: HTMLElement[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.getAttribute && cur.getAttribute("id") === id) return cur;
    for (const child of cur.childNodes) {
      if (child instanceof HTMLElement) stack.push(child);
    }
  }
  return null;
}

const CONTAINER_CLASS_RE =
  /\b(documentableElement|documentableItem|memberSection|member-detail|detail|expand|doc-content)\b/;

function findAnchored(root: HTMLElement, anchor: string): HTMLElement | null {
  if (!anchor) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(anchor);
    } catch {
      return anchor;
    }
  })();
  const candidates = new Set<string>([
    anchor,
    decoded,
    anchor.replace(/^#/, ""),
    decoded.replace(/^#/, ""),
  ]);
  let el: HTMLElement | null = null;
  for (const id of candidates) {
    el = findById(root, id);
    if (el) break;
  }
  if (!el) return null;
  let cur: HTMLElement | null = el;
  for (let i = 0; i < 12 && cur; i++) {
    const cls = cur.getAttribute("class") ?? "";
    if (CONTAINER_CLASS_RE.test(cls)) return cur;
    cur = cur.parentNode as HTMLElement | null;
  }
  return el;
}

export function parseScalaPage(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main =
    root.querySelector("main") ??
    root.querySelector("#content") ??
    root.querySelector("body") ??
    root;
  stripNoise(main);

  const meta: DocMetaEntry[] = [{ label: "URL", value: item.url }];
  if (item.subtitle) meta.push({ label: "Package", value: item.subtitle });

  if (item.anchor) {
    const section = findAnchored(main, item.anchor);
    if (section) {
      const title =
        textOf(section.querySelector("h1, h2, h3, .documentableName")) ||
        item.title;
      const sigEl = section.querySelector(
        ".signature, .documentableSignature, .memberSignature",
      );
      const sig = textOf(sigEl);
      sigEl?.remove();
      let md = `# ${title}\n\n*${item.fqn}*\n\n`;
      if (sig) md += "```scala\n" + sig + "\n```\n\n";
      md += htmlToMd(section);
      return { title, markdown: md, meta, externalUrl: item.url };
    }
  }

  const title = textOf(main.querySelector("h1")) || item.title;
  const cover =
    main.querySelector(".cover") ??
    main.querySelector("#definition-container") ??
    main;
  const signature = main.querySelector(
    ".signature, .cover-main-content .signature, .documentableName",
  );
  const description = main.querySelector(
    ".cover-body, .documentableBrief, .cover-description, .documentation",
  );

  let md = `# ${title}\n\n`;
  if (item.fqn) md += `*${item.fqn}*\n\n`;
  if (signature) {
    const sig = textOf(signature);
    if (sig) md += "```scala\n" + sig + "\n```\n\n";
  }
  if (description) {
    const d = htmlToMd(description);
    if (d) md += d + "\n\n";
  }
  if (md.trim().split("\n").length < 3) {
    md = `# ${title}\n\n` + htmlToMd(cover);
  }

  return { title, markdown: md, meta, externalUrl: item.url };
}

export function parseFallback(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main = root.querySelector("main") ?? root.querySelector("body") ?? root;
  stripNoise(main);
  const md = htmlToMd(main);
  return {
    title: item.title,
    markdown: `# ${item.title}\n\n${md}`,
    meta: [{ label: "URL", value: item.url }],
    externalUrl: item.url,
  };
}
