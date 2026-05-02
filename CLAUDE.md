# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Manifest V3 Chrome extension. Reads the user's Slack search result page DOM, walks every paginated page, and copies a YAML document to the clipboard for use as LLM prompt context. No build step, no framework — plain JS/HTML loaded directly. Iterate by editing files and reloading at `chrome://extensions`.

- `content_script.js` runs in the Slack page. All DOM scraping, pagination, "Show more" expansion, attachment capture, Markdown conversion, and YAML emission live here.
- `popup/popup.{html,js}` is the toolbar popup. Detects page state on open, sends `startExport`, renders progress bar and copy/download UI on completion.
- `manifest.json` requests only `activeTab` + host permission for `https://app.slack.com/*`. No `clipboardWrite`, no `tabs`.

`./icons/build.sh` regenerates icon PNGs from `icons/icon.svg` via `rsvg-convert`. `./build.sh` packages a Web Store ZIP from the runtime files (excludes README, LICENSE, dev-only assets).

## Message flow between popup and content script

Single `chrome.runtime.onMessage` listener in the content script handles two actions:

- `checkSearchPage` (sync response) — popup calls this on open. Returns `{ hasResults, totalCount }` derived from `.c-search_message__content` and the Slack `[class*="resultCounts"]` indicator. Drives the colored ready/warn/error pill.
- `startExport` (fire-and-forget) — popup triggers, content script runs `goToFirstPage()` → `runExport()`. Progress is reported back via `chrome.runtime.sendMessage({ action: "progress", count, total })`; final result via `{ action: "exportComplete", data, count, bytes }`.

Popup must be open to receive the messages. The popup loses focus during long exports — this is why clipboard writes need a fallback (see below).

## Slack DOM contract

Selectors below were verified against the live page via Chrome DevTools — not guessed. Re-verify before changing. Prefer `data-qa` and `aria-label` over class names: Slack hashes class suffixes per build (anything matching `*__[A-Za-z0-9]+` will eventually drift).

- Search message group: `[role="document"]`, content under `.c-search_message__content`
- Message body root: `[data-qa="message-text"]` (do NOT use the parent `.c-search_message__content` — it includes the header, attachments, and `.c-search_message__reactions` "X replies / View thread" noise)
- Embedded/quoted content: `.c-search_message__attachments`
- Truncation buttons: outer = `[data-qa="search_expand"]`, inner (inside quoted blocks) = `.c-rich_text_expand_button`. Click outer first, wait, then inner.
- File attachments: `.c-search_message__file_container`. Filename in `[data-qa="search_result_file"]`'s `aria-label`; URL in `[data-qa="message_file_link"]`'s `href`. Image vs other-file detected via `.p-file_thumbnail__container--image`. Strip `?origin_team=...` query params from the URL before emitting.
- Pagination wrapper: `.c-pagination_wrapper` carries `data-qa-current-page`. Page buttons: `[data-qa="c-pagination_page_btn_<N>"]`. Back/forward arrows: `[data-qa="c-pagination_back_btn"]` / `c-pagination_forward_btn`.
- Total result count: `[class*="resultCounts"]` (class hash varies, prefix is stable). Body matches `(\d+)\s*(?:results?|件|ヒット)/i`.
- Inline rich text formatting (DOM → Markdown):
  - Bold: `<b data-stringify-type="bold">` (no class)
  - Italic / strikethrough: same `data-stringify-type` pattern (`italic`, `strike`)
  - Inline code: `<code class="c-mrkdwn__code">`
  - Code block: `<pre class="c-mrkdwn__pre">`
  - Bullet list: `<ul class="...p-rich_text_list__bullet...">` with `<li data-stringify-indent="N">` for nesting
  - Link: `<a data-stringify-link="url">`
  - **`<br aria-hidden="true">`** — line breaks inside a paragraph. The general `aria-hidden="true"` skip filter must come AFTER the `<br>` check, otherwise multi-line messages collapse to a single line.

## Subtle correctness traps

- **Pagination collapse on long results.** With many pages Slack only renders a window of nearby pages (e.g. on page 20 of 20, only buttons 16-20 are shown — no page-1 button). `goToFirstPage()` must loop, jumping to the smallest-numbered visible page button below the current page, falling back to `[data-qa="c-pagination_back_btn"]` when no smaller button exists. Bounded to 50 iterations.
- **Content-swap race after a pagination click.** The page indicator (`data-qa-current-page`) and the message DOM update at slightly different times. Naive `waitForSearchResult()` after a click succeeds immediately on stale content. Wait for: target page reached AND first message's `data-ts` differs from a snapshot taken before the click AND every group has a timestamp. 5s safety timeout.
- **Clipboard requires document focus.** `navigator.clipboard.writeText` rejects with `NotAllowedError` when the popup loses focus during a long export. The rejection is logged to `chrome://extensions` even when caught in a try/catch. Pre-check `document.hasFocus()` and skip the call when false; surface a "Copy to Clipboard" button so the user's click supplies fresh focus + activation.
- **YAML quoting.** Single-line strings are emitted unquoted to save tokens; only quote when YAML semantics require it (reserved words, number-like, leading special char from `[!&*\[\]{}|<>=,?:#~"'%@\`-]`, contains `: ` or trailing `:`, contains ` #`, control chars). Multi-line content uses `|` block scalars indented 4 spaces. See `yamlNeedsQuoting()` in `content_script.js`.

## Web Store submission

`store-listing.md` is the source of truth for short/detailed description, single-purpose statement, permission justifications, and privacy form answers. Update there first, then mirror short description into `manifest.json`'s `description` and the GitHub repo description. Bump `manifest.json`'s `version` before each upload — `build.sh` reads it to name the output ZIP.
