# Task: Add MDN Web Docs (JavaScript) Provider

Hand this doc to a fresh Claude session to extend the `dev-docs` Raycast extension with a second command: **Search MDN JS Docs**.

---

## Project snapshot (what already exists)

- Raycast extension: `dev-docs` (`author: abh80`, `version: 1.0.0`)
- Windows dev, PowerShell preferred. Node already installed, `npm install` done.
- Entry: `src/search-java.tsx` → renders `<DocSearchList provider={javaProvider} />`.
- Provider abstraction in `src/providers/types.ts`:
  ```ts
  interface DocProvider {
    id: string;
    label: string;
    listVersions(): ProviderVersion[];
    defaultVersion(): string;
    prefetch(version: string): Promise<void>;
    search(version: string, query: string, limit: number): Promise<SearchItem[]>;
    loadPage(item: SearchItem): Promise<DocPage>;
    externalUrl(item: SearchItem): string;
    childrenOf?(parent: SearchItem, query: string, limit: number): Promise<SearchItem[]>;
  }
  ```
- Shared infra (reuse, do NOT duplicate):
  - `src/lib/storage.ts` — `indexPath`, `pagePath`, `readJson`, `writeJson`, `pruneCache`
  - `src/lib/http.ts` — `fetchText(url, timeoutMs)`
  - `src/lib/page-cache.ts` — `getCachedPage`, `setCachedPage` (LRU per provider)
  - `src/lib/titles.ts` — `shortenTitle`, `matchedSubstring`, `isPrefixMatch`
- UI components reusable with any `DocProvider`:
  - `src/components/DocSearchList.tsx`
  - `src/components/DocDetail.tsx`
  - `src/components/MembersList.tsx` (optional, only if `childrenOf` is set)
- Existing Java provider for reference: `src/providers/java/` (`versions.ts`, `index-loader.ts`, `search.ts`, `parser.ts`, `provider.ts`).

## Goal

Add a `search-mdn-js` command that fuzzy-searches MDN JavaScript reference (global objects, built-ins, statements, operators, grammar), renders pages inline as Markdown, supports Ctrl+Enter to open on MDN, and reuses all UI components.

## MDN specifics (data source)

- MDN content is open-source at <https://github.com/mdn/content>. Pages live under `files/en-us/web/javascript/`.
- Preferred data source for an index: MDN's search JSON at `https://developer.mozilla.org/en-US/search-index.json` — one big JSON array of `{ title, url }` entries for en-US. Filter for `url.startsWith("/en-US/docs/Web/JavaScript/")`.
- Live page URL pattern: `https://developer.mozilla.org${url}` (url already begins with `/en-US/docs/...`).
- For parsing: MDN pages expose clean HTML. Look at `<main id="content">` → `<article>` with sections like `#short_description`, `#syntax`, `#parameters`, `#return_value`, `#description`, `#examples`, `#browser_compatibility`, `#specifications`. Many pages also include a `<pre class="brush: js">` code block convention for syntax.

### Versioning

MDN is rolling — no discrete versions. Use a single pseudo-version:
```ts
[{ id: "current", label: "Latest" }]
```
Skip the version dropdown UX (still shows but with one option). Or improve `DocSearchList` later to hide the dropdown when `versions.length === 1`.

## Item kinds

Map MDN page URL to `ItemKind`:
- `/Web/JavaScript/Reference/Global_Objects/<Obj>` → `class`
- `/Web/JavaScript/Reference/Global_Objects/<Obj>/<member>` → `method` if signature contains `(`, else `field`
- `/Web/JavaScript/Reference/Statements/...` → `other`
- `/Web/JavaScript/Reference/Operators/...` → `other`
- `/Web/JavaScript/Guide/...` → `other`
- Else → `other`

Derive `title`, `subtitle`, `fqn` from the URL path + page title. For a global object member:
- `title` = `ObjName.member` (e.g., `Array.prototype.map` → display `map`)
- `fqn` = the URL path
- `subtitle` = parent object

## File plan

Create these new files. Do not touch Java provider or shared UI.

```
src/providers/mdn/
  versions.ts        // exports MDN_VERSIONS = [{id:"current", label:"Latest"}]
  index-loader.ts    // fetch + parse search-index.json, filter Web/JavaScript/*, produce CompactItem[]
  search.ts          // fuzzy scorer + expand (mirror java/search.ts shape)
  parser.ts          // HTML → Markdown (reuse turndown + node-html-parser)
  provider.ts        // export mdnProvider: DocProvider
src/search-mdn-js.tsx // command entry: <DocSearchList provider={mdnProvider}/>
```

Update `package.json` to add a second entry in `commands`:
```json
{
  "name": "search-mdn-js",
  "title": "Search MDN JS Docs",
  "description": "Search JavaScript reference on MDN Web Docs",
  "mode": "view",
  "keywords": ["javascript", "js", "mdn", "mozilla", "web", "ecmascript", "dom", "api", "reference"]
}
```

No new preferences needed. Omit `mdnDefaultVersion`. `cacheLimitMB` already applies globally.

## Parser guidance

MDN pages are cleaner than javadoc. Minimal viable extraction:
1. `main article` is the container.
2. Remove nav/aside/toc: strip `.section-content > .sidebar`, `aside`, `.on-github`, `.metadata`.
3. Title: `<h1>` at top.
4. First `<p>` after title → summary. Collect `<section aria-labelledby="syntax">` as code.
5. Turndown the rest of the article body.
6. Populate `meta` with: `URL` (external), `Specification` (if `section#specifications a`), `Browser compatibility` (skip rendering the BCD table — too wide for Detail; link out instead).

If parsing fails → fall back to turndown-ing whole `article`.

## Children (`childrenOf`)

Implement for "classes" (global objects with prototype methods). For a parent whose URL is `/Web/JavaScript/Reference/Global_Objects/Array`, list items where the URL starts with that path + `/`. Reuse compact index in-memory.

## Index caching

- Compact form:
  ```ts
  type CompactMdn = { t: string; u: string }
  ```
- Cache path: `indexPath("mdn", "current", "compact1")`
- Memory cache via a `Map<string, CompactMdn[]>` at module scope, same pattern as Java.

## UX parity

Ensure:
- `Ctrl + Enter` opens `externalUrl` (built-in action shortcut already set by `DocSearchList` — provider only needs to return the correct URL).
- `Ctrl + M` shows children if `childrenOf` returns ≥1.
- Fuzzy match accessory + green prefix tint automatic via `DocSearchList`.
- Long titles (e.g., `Array.prototype.flatMap()`) auto-shortened via existing `shortenTitle`.

## Testing plan

1. `npm install` (no new deps — turndown + node-html-parser already present).
2. `npm run dev`.
3. Trigger "Search MDN JS Docs". Typing `array` shows Array, Array.prototype.map, Array.prototype.filter etc.
4. Enter on `Array.prototype.map` → Markdown with summary + syntax + description.
5. Ctrl+Enter → opens MDN page in browser.
6. Ctrl+M on `Array` → list of prototype methods, searchable.

## Style / repo conventions

- PowerShell for any shell cmd (user is on Windows).
- No emojis anywhere in code or docs.
- Strict TypeScript. No `any` unless locally cast with `as`. Prefer `unknown` + narrow.
- Avoid adding deps without asking user first.
- Commits should be small, logically grouped. Use the user's SSH signing — already configured via `gpg.format=ssh`, key at `C:/Users/abh80/.ssh/gpg-key`, passphrase `abhinav277`. For backdating, set `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE`. Use an `SSH_ASKPASS` helper if signing prompts block.
- Do NOT add Co-Authored-By lines.

## Out of scope (explicitly)

- Offline content mirror (MDN content repo clone). Stick to live fetch + page cache.
- Browser compatibility table rendering.
- Multiple locales. English (`en-US`) only.
- Non-JS MDN content (CSS, HTML, HTTP, etc.) — future work, keep provider narrowly scoped.

## Reference: exact shape of MDN search-index.json

```json
[
  { "title": "Array", "url": "/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" },
  { "title": "Array.prototype.map()", "url": "/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map" },
  ...
]
```

## Acceptance criteria

- `npm run lint` clean.
- Both commands appear in Raycast: `Search Java Docs`, `Search MDN JS Docs`.
- MDN command: search → render → Ctrl+Enter → Ctrl+M all work for `Array`, `Promise`, `String`.
- Disk usage stays under `cacheLimitMB` after ~50 page loads (LRU prune runs).
- No changes needed in `src/components/*` or `src/lib/*` (pure additive extension).

---

When starting the new chat, paste this file's contents and also attach the repo path `D:\dev\apps\raycast-extension-java-doc`.
