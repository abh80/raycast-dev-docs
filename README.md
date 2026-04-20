# Dev Docs

Raycast extension for searching developer documentation locally.

## Commands

- **Search Java Docs** — fuzzy search across Java SE classes, methods, fields, and packages. Renders inline; `Ctrl + Enter` opens Oracle docs in browser.

## Java Versions

11 (LTS), 17 (LTS), 21 (LTS), 24 (Latest).

Version dropdown in the search bar. Last-used version persists per-command in `LocalStorage`; falls back to the preference default.

## Preferences

- `Default Java Version` — initial version when no last-used value is stored.
- `Page Cache Limit (MB)` — LRU disk cache budget for rendered pages.

## Architecture

Provider abstraction lives in `src/providers/types.ts`. To add a new docs source (Python, MDN, etc.), implement `DocProvider` and add a new command entry in `package.json` that renders `<DocSearchList provider={newProvider} />`.

```
src/
  lib/              shared: storage, http, cache, fuzzy search
  providers/
    types.ts        DocProvider + SearchItem + DocPage interfaces
    java/           Java SE implementation
  components/       provider-agnostic UI (DocSearchList, DocDetail)
  search-java.tsx   command entry
```

## Setup

```bash
npm install
npm run dev
```

Add a 512x512 `assets/extension-icon.png` before publishing.

## How It Works

1. On open, loads the merged search index (`type-search-index.js` + `member-search-index.js` + `package-search-index.js`) for the chosen version from docs.oracle.com. Cached in `environment.supportPath/java/indexes/<version>/all.json`.
2. Typing filters the index client-side with a custom score (exact > prefix > substring > subsequence).
3. `Enter` fetches the HTML page, parses structured sections (class/member/package) via `node-html-parser`, renders Markdown. Cached to disk per URL.
4. `Ctrl + Enter` opens the live Oracle URL.
