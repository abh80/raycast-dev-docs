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
    const txt = (node as unknown as { textContent: string }).textContent ?? "";
    return "\n```java\n" + txt.trim() + "\n```\n";
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

function firstMatch(root: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function collectNotes(dl: HTMLElement | null): DocMetaEntry[] {
  if (!dl) return [];
  const out: DocMetaEntry[] = [];
  const kids = dl.childNodes.filter((n) => n instanceof HTMLElement) as HTMLElement[];
  let label = "";
  for (const k of kids) {
    if (k.tagName === "DT") label = textOf(k).replace(/:$/, "");
    else if (k.tagName === "DD" && label) out.push({ label, value: textOf(k) });
  }
  return out;
}

function collectAllNotes(root: HTMLElement): DocMetaEntry[] {
  const out: DocMetaEntry[] = [];
  for (const dl of root.querySelectorAll("dl.notes")) {
    out.push(...collectNotes(dl));
  }
  return out;
}

function summarize(main: HTMLElement): string {
  let md = "";
  const summaries = main.querySelectorAll("section.summary > section, section.summary-list > section");
  for (const s of summaries) {
    const h = textOf(firstMatch(s, ["h2", "h3"]));
    if (!h) continue;
    const entries: string[] = [];
    const seen = new Set<string>();
    for (const cell of s.querySelectorAll(".col-first a, .col-second a, .col-summary-item-name a")) {
      const t = textOf(cell);
      if (t && !seen.has(t)) {
        seen.add(t);
        entries.push(t);
      }
    }
    if (entries.length === 0) continue;
    md += `## ${h}\n\n`;
    for (const e of entries.slice(0, 60)) md += `- ${e}\n`;
    md += "\n";
  }
  return md;
}

export function parseTypePage(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main = root.querySelector("main") ?? root.querySelector("body") ?? root;
  const title = textOf(firstMatch(main, [".header .title", "h1.title", "h1"])) || item.fqn;

  const headerText = textOf(main.querySelector(".header"));
  const moduleMatch = headerText.match(/Module\s+([\w.]+)/);
  const packageMatch = headerText.match(/Package\s+([\w.]+)/);
  const module = moduleMatch?.[1] ?? "";
  const pkg = packageMatch?.[1] ?? "";

  const signatureEl = firstMatch(main, [
    ".class-description .type-signature",
    "section.class-description .type-signature",
    ".type-signature",
    "pre.type-signature",
  ]);

  const inheritanceEl = main.querySelector(".inheritance");

  const descEl = firstMatch(main, [
    ".class-description .description .block",
    ".class-description section.description .block",
    ".class-description > .block",
    "section.class-description > .block",
    ".description > .block",
    "section.description > .block",
    ".class-description",
    "section.class-description",
    ".description",
    "section.description",
  ]);

  const notes = collectAllNotes(
    firstMatch(main, [".class-description", "section.class-description", ".description", "section.description"]) ?? main,
  );

  const sig = textOf(signatureEl);
  const inheritance = textOf(inheritanceEl);
  let desc = htmlToMd(descEl);

  if (!desc) {
    desc = htmlToMd(firstMatch(main, ["section.description", ".description", ".block"]));
  }

  let md = `# ${title}\n\n`;
  if (pkg) md += `*Package ${pkg}*\n\n`;
  if (sig) md += "```java\n" + sig + "\n```\n\n";
  if (inheritance) md += `**Inheritance:** ${inheritance}\n\n`;
  if (desc) md += desc + "\n\n";

  for (const n of notes.filter((n) => n.label !== "Since" && n.label !== "Deprecated")) {
    md += `**${n.label}:** ${n.value}\n\n`;
  }

  md += summarize(main);

  if (md.trim().split("\n").length < 4) {
    // Nothing useful parsed — dump whole main
    md = `# ${title}\n\n` + htmlToMd(main);
  }

  const meta: DocMetaEntry[] = [];
  if (module) meta.push({ label: "Module", value: module });
  if (pkg) meta.push({ label: "Package", value: pkg });
  for (const n of notes.slice(0, 6)) meta.push(n);

  return { title, markdown: md, meta, externalUrl: item.url };
}

export function parseMemberPage(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main = root.querySelector("main") ?? root;
  const section = findMemberSection(main, item.anchor ?? "");

  if (!section) return parseTypePage(html, item);

  const name = textOf(firstMatch(section, ["h3", "h4", "h2"])) || item.title;
  const sig = textOf(firstMatch(section, [".member-signature", "pre.member-signature", ".signature"]));
  let desc = htmlToMd(firstMatch(section, [".block", ".description .block", "section.description"]));
  const notes = collectAllNotes(section);

  if (!desc) desc = htmlToMd(section);

  let md = `# ${name}\n\n`;
  md += `*${item.fqn}*\n\n`;
  if (sig) md += "```java\n" + sig + "\n```\n\n";
  if (desc) md += desc + "\n\n";
  for (const n of notes) md += `**${n.label}:** ${n.value}\n\n`;

  const meta: DocMetaEntry[] = [
    { label: "Declared in", value: item.fqn.split(".").slice(0, -1).join(".") },
  ];
  for (const n of notes.slice(0, 4)) meta.push(n);

  return { title: name, markdown: md, meta, externalUrl: item.url };
}

function findMemberSection(root: HTMLElement, anchor: string): HTMLElement | null {
  if (!anchor) return null;
  const candidates = [
    `section.detail[id="${anchor}"]`,
    `section[id="${anchor}"]`,
    `[id="${anchor}"]`,
  ];
  for (const sel of candidates) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      // bad selector char
    }
  }
  // Fallback: scan all sections for exact id match
  for (const s of root.querySelectorAll("section")) {
    if (s.getAttribute("id") === anchor) return s;
  }
  return null;
}

export function parsePackagePage(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main = root.querySelector("main") ?? root;
  const title = textOf(firstMatch(main, [".header .title", "h1.title", "h1"])) || `Package ${item.fqn}`;
  let desc = htmlToMd(firstMatch(main, [".package-description", "section.package-description", ".description", "section.description"]));
  if (!desc) desc = "";

  let md = `# ${title}\n\n`;
  if (desc) md += desc + "\n\n";
  md += summarize(main);

  return { title, markdown: md, meta: [{ label: "Package", value: item.fqn }], externalUrl: item.url };
}

export function parseFallback(html: string, item: SearchItem): DocPage {
  const root = parse(html);
  const main = root.querySelector("main") ?? root.querySelector("body") ?? root;
  const md = htmlToMd(main);
  return { title: item.title, markdown: `# ${item.title}\n\n${md}`, meta: [], externalUrl: item.url };
}
