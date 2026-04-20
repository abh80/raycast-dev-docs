/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Java Version - Default Java SE version when opening Search Java Docs for the first time */
  "javaDefaultVersion": "11" | "17" | "21" | "24",
  /** Page Cache Limit (MB) - Max disk space for cached rendered pages across all providers. LRU eviction. */
  "cacheLimitMB": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-java` command */
  export type SearchJava = ExtensionPreferences & {}
  /** Preferences accessible in the `search-mdn-js` command */
  export type SearchMdnJs = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-java` command */
  export type SearchJava = {}
  /** Arguments passed to the `search-mdn-js` command */
  export type SearchMdnJs = {}
}

