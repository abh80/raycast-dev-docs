# Dev Docs

Raycast extension for fast, offline-friendly access to developer API documentation. Fuzzy-search **Java SE**, **Scala 3**, and **MDN JavaScript** straight from Raycast, read rendered pages inline, and jump to the live source when you need more.

![version](https://img.shields.io/badge/version-1.0.0-blue)
![raycast](https://img.shields.io/badge/raycast-extension-red)
![license](https://img.shields.io/badge/license-MIT-green)

---

## Screenshots

Screenshots live under `metadata/`. Raycast picks these up for the Store listing.

| Search | Detail View | Members Browser |
| --- | --- | --- |
| ![search](metadata/dev-docs-1.png) | ![detail](metadata/dev-docs-2.png) | ![members](metadata/dev-docs-3.png) |

---

## Features

- Fuzzy search across types, members, and packages for every supported language.
- Dotted query support — type `Map.get` to jump straight to a method on a specific type. The owner type itself is also surfaced so you can drill in from there.
- Per-language version dropdown (Java 11/17/21/24 today; Scala and MDN follow upstream).
- Last-used version persisted via `LocalStorage` and restored on next launch.
- Rendered Markdown Detail view with metadata sidebar (Module, Package, Since, Deprecated, Superclass, Interfaces — populated where the source provides them).
- "Browse Members" mode drills into a class/trait/object and fuzzy-searches its methods, fields, given/extension members, and nested types without reloading.
- Language-aware code fences in the rendered Markdown — Java signatures fenced as `java`, Scala as `scala`, MDN snippets tagged from the `brush:` class.
- One-keystroke actions: open the live page, copy the URL, copy the fully-qualified name.
- Disk-backed index and page cache under Raycast's `environment.supportPath`, with LRU eviction bounded by a configurable MB budget.
- Provider abstraction (`DocProvider`) — adding a new language is a new module + a new command entry.

---

## Commands

| Name | Description | Source |
| --- | --- | --- |
| Search Java Docs | Fuzzy-search the Java SE API for the selected version and preview pages inline. | docs.oracle.com |
| Search Scala Docs | Fuzzy-search Scala 3 standard library types and members. | scala-lang.org/api/current |
| Search MDN JS Docs | Fuzzy-search the MDN JavaScript reference (built-ins, globals, statements, operators). | developer.mozilla.org |

---

## Supported Kinds

The extension models a unified taxonomy across providers:

| Kind | Java | Scala | MDN |
| --- | --- | --- | --- |
| `class` | ✓ | ✓ | — |
| `interface` | ✓ | — | — |
| `trait` | — | ✓ | — |
| `object` | — | ✓ (singleton + companion) | — |
| `enum` | ✓ | ✓ | — |
| `annotation` | ✓ | — | — |
| `record` | ✓ | — | — |
| `type` | — | ✓ (type alias / opaque) | — |
| `method` | ✓ | ✓ (`def`) | ✓ |
| `field` | ✓ | ✓ (`val`/`var`) | ✓ |
| `given` | — | ✓ | — |
| `extension` | — | ✓ | — |
| `constructor` | ✓ | — | — |
| `package` | ✓ | ✓ | — |
| `module` | ✓ | — | — |

Each kind has a distinct icon in the search list and is grouped into Types / Members / Packages sections.

---

## Preferences

Configure these under Raycast Settings → Extensions → Dev Docs.

| Preference | Type | Default | Description |
| --- | --- | --- | --- |
| Default Java Version | Dropdown | `24` | Version used when no previous selection has been stored. Options: `11`, `17`, `21`, `24`. |
| Page Cache Limit (MB) | Number | `100` | Max disk space for cached rendered pages across **all** providers. LRU eviction. |

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
| --- | --- | --- |
| Enter | Show Docs (rendered Detail view) | Search list |
| Ctrl + Enter | Open in Browser (live source page) | Search list / Detail |
| Ctrl + M | Browse Members (methods / fields / given / nested types) | Search list (container entries) |
| Cmd + Shift + . | Copy URL / Copy FQN | Action Panel |

---

## Search Tips

- **Plain query** — matches against the simple name first, then the FQN. Containers get a small ranking boost.
- **Dotted query** — `Owner.member` splits at the last dot. The `member` part is matched against names, and the `Owner` part is matched against the owning type/package. Type owners themselves are surfaced near the top so you can pivot to the class.
  - Example (Scala): `map.get` → `scala.collection.{immutable,mutable,concurrent}.Map` traits and their `get` methods, plus `HashMap`, `ListMap`, `TreeMap`, `IntMap`, etc.
  - Example (Java): `Map.get` → `java.util.Map.get(Object)` and `java.util.Map.getOrDefault(Object, V)` first, then `Keymap.getAction(...)` and friends.
- **CamelHump / subsequence** — last-resort match for typo tolerance.

---

## How It Works

The extension is split into three layers per provider: index, parser, cache — sharing a single Raycast UI.

1. **Index.** On first launch the provider fetches the upstream search index (`type-search-index.js` + friends for Java, `searchData.js` for Scala, MDN's index JSON), normalises it into a compact in-memory structure, and writes a serialised snapshot to disk. Subsequent launches load the snapshot directly.
2. **Scorer.** A small fuzzy matcher ranks entries against the query — exact / prefix / substring / subsequence on the name, plus FQN scoring. Dotted queries split into owner + member with a separate scoring path.
3. **HTML parser.** When the user opens a page, the raw HTML is fetched, stripped of nav/sidebar chrome, and converted to Markdown via Turndown. Signatures are extracted and re-fenced with the correct language tag. Anchor lookup tolerates Scaladoc/Javadoc IDs containing `:`, `[`, `]`, `(`, `)`.
4. **Disk cache.** Indexes and rendered pages live under `environment.supportPath`. Pages are tracked in an LRU manifest; when total size exceeds the configured budget, the least-recently-accessed entries drop.
5. **Provider abstraction.** Every doc source implements the `DocProvider` contract, so adding a new language is a new module + a command entry — no UI duplication.

### Folder Layout

```
src/
  search-java.tsx              # Entry: Search Java Docs command
  search-scala.tsx             # Entry: Search Scala Docs command
  search-mdn-js.tsx            # Entry: Search MDN JS Docs command
  providers/
    types.ts                   # DocProvider contract + ItemKind taxonomy
    java/
      provider.ts              # Java provider
      index-loader.ts          # Oracle index fetch + compaction
      search.ts                # Scoring + dotted-query handler
      parser.ts                # HTML → Markdown for type / member / package pages
      versions.ts              # URL builders, version list
    scala/
      provider.ts              # Scala 3 provider
      index-loader.ts          # searchData.js fetch + compaction
      search.ts                # Scoring + dotted-query handler
      parser.ts                # Scaladoc → Markdown, signature extraction
      versions.ts              # URL builders, version list
    mdn/
      provider.ts              # MDN JavaScript provider
      index-loader.ts          # MDN index fetch
      search.ts                # Scoring
      parser.ts                # MDN article → Markdown, brush-detected fences
      versions.ts              # URL builders
  components/
    DocSearchList.tsx          # Shared fuzzy-search list view
    DocDetail.tsx              # Shared Markdown detail view with sidebar
    MembersList.tsx            # Shared members browser
  lib/
    http.ts                    # Fetch helpers
    storage.ts                 # LocalStorage + indexPath helpers
    page-cache.ts              # LRU page cache with MB budget
    titles.ts                  # Title shortening + match highlighting
package.json                   # Raycast manifest: commands, preferences
metadata/                      # Store screenshots
```

---

## Adding a New Provider

The provider abstraction makes new doc sources cheap to add. Walkthrough lives at `docs/ADD_MDN_PROVIDER.md`. Short version:

1. **Implement `DocProvider`** — `src/providers/<name>/provider.ts` exporting `id`, `label`, `listVersions`, `defaultVersion`, `prefetch`, `search`, `loadPage`, `externalUrl`, optional `childrenOf`.
2. **Index + scorer** — `index-loader.ts` for the upstream search index, `search.ts` for ranking. Reuse the `scoreLabel` / `scoreFqn` / dotted-query shape from `java/search.ts` or `scala/search.ts`.
3. **Parser** — `parser.ts` returning `DocPage { title, markdown, meta, externalUrl }`. Fence signatures with the correct language tag.
4. **Command entry** — `src/search-<name>.tsx` mounting `<DocSearchList provider={...} />`.
5. **Manifest** — append to `commands` in `package.json` (name, title, description, icon, mode `view`, keywords).

No changes needed to the search list, scorer scaffolding, Detail view, or cache.

---

## Development

Prerequisites: Node.js 18+, Raycast, Raycast developer account.

```bash
git clone https://github.com/abh80/raycast-extension-java-doc.git
cd raycast-extension-java-doc
npm install
```

Run in dev mode (hot-reloads on save, registers commands in your local Raycast):

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

Production build (type-check + bundle):

```bash
npm run build
```

The local support path (where indexes and pages cache) prints to the console on first run. Delete that directory to force a full re-index.

---

## Publishing

```bash
npm run publish
```

Bump `version` in `package.json` and refresh `metadata/` screenshots before publishing.

---

## Credits and Disclaimer

- **Java SE** documentation © Oracle Corporation.
- **Scala 3** documentation © EPFL / Lightbend / Scala Center, licensed Apache 2.0.
- **MDN Web Docs** content © Mozilla and contributors, licensed CC-BY-SA 2.5.

This extension does not redistribute upstream documentation. It fetches publicly available pages on demand and caches them locally for personal, interactive use only. All trademarks are the property of their respective owners. This project is not affiliated with, endorsed by, or sponsored by Oracle Corporation, EPFL, Lightbend, Mozilla, or Raycast Technologies Ltd.

If you are an IP holder and would like the extension adjusted, please open an issue.

---

## License

MIT. See `LICENSE` for the full text.

Copyright (c) 2026 abh80.
