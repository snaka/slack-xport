# Chrome Web Store listing draft

Reference text used during the Web Store submission. Not bundled with the
extension and not shipped to end users.

## Short description (max 132 chars)

> Copy Slack search results as Markdown-formatted YAML, ready to paste into LLM prompts.

## Detailed description (English)

slack-xport turns a Slack search result page into LLM-ready context with one click.

Pasting Slack threads into ChatGPT, Claude, or any LLM as context is common — but copying messages by hand is tedious, loses formatting, and breaks across pagination. slack-xport automates the entire flow so you can focus on the prompt instead of the copying.

WHAT IT DOES
- Walks every page of a Slack search result automatically
- Expands "Show more" truncations, including those nested inside quoted blocks
- Preserves Markdown formatting: bold, italic, strikethrough, inline code, code blocks, bullet/ordered lists, links, blockquotes
- Captures file/image attachments as Markdown image syntax
- Strips Slack tracking parameters from attachment URLs to keep token count low
- Outputs YAML with block scalars, so multi-line messages stay readable
- Auto-copies the result to your clipboard

HOW TO USE
1. Open Slack at app.slack.com and run a message search
2. Click the slack-xport toolbar icon
3. Click "Export & Copy"

The popup shows a status pill so it is clear when the extension is ready, when it is collecting messages, and when the result has been copied. If the result is over 1 MB you will be asked to confirm before copying. A "Download as YAML file" link is available as a fallback.

PRIVACY
Everything runs locally in your browser. No data is sent to any external server. No analytics, no tracking. Required permissions are limited to activeTab and host permission for https://app.slack.com/* — the minimum needed to read the search result DOM and copy text to your clipboard.

ACKNOWLEDGEMENTS
Built on top of the DOM scraping logic from xshoji/slack-search-result-exporter (MIT-licensed bookmarklet), extended into a packaged extension with richer formatting and an LLM-oriented output.

OPEN SOURCE
https://github.com/snaka/slack-xport

## Detailed description (日本語) — optional alternate

Slackの検索結果をワンクリックでLLMのコンテキストに使える形でクリップボードにコピーします。

ChatGPTやClaudeなどのLLMに「このSlackのスレッド見てほしい」と渡すために手動でコピペするのは面倒で、書式が崩れたり、ページ送りで途切れたりしがちです。slack-xport はこの作業を自動化します。

【できること】
- 検索結果の全ページを自動で巡回
- 「Show more」（引用ブロック内のものを含む）を自動展開
- Markdown 書式（太字・斜体・コード・コードブロック・箇条書き・引用・リンク）を保持
- 画像/ファイル添付を Markdown 形式で取得（Slack のトラッキングパラメタは除去してトークン節約）
- 改行をそのまま保持できる YAML 形式で出力
- 完了後に自動でクリップボードへコピー

【使い方】
1. app.slack.com で検索を実行
2. ツールバーの slack-xport アイコンをクリック
3. 「Export & Copy」を押すだけ

進捗は状態バッジで一目でわかります。出力が 1MB を超える場合は確認ダイアログが出ます。YAMLファイルとしてダウンロードする選択肢もあります。

【プライバシー】
すべてブラウザ内で完結します。外部サーバーへの送信、トラッキング、解析は一切ありません。必要な権限は activeTab と app.slack.com のホスト権限のみです。

【オープンソース】
https://github.com/snaka/slack-xport

## Single purpose statement

> slack-xport's single purpose is to copy the messages on a Slack search result page to the clipboard as a single YAML document, so they can be used as context in an LLM prompt.

## Permission justifications

### activeTab
> Used to send a message to the content script in the user's Slack tab when the user clicks the toolbar action, and to read the active tab's URL to confirm it is on app.slack.com before doing anything. No other tabs are accessed.

### Host permission for https://app.slack.com/*
> Required to inject the content script that reads search result DOM elements (message text, sender, timestamp, attachments) on the user's Slack web client. The extension is limited to this single host. No other origins are matched.

### clipboardWrite (implicit via navigator.clipboard.writeText in popup)
> Not requested in manifest. We rely on the user gesture (button click in the popup) to allow clipboard writes via the standard navigator.clipboard.writeText API.

## Category
Productivity

## Languages
English (primary), Japanese

## Privacy practices form — quick answers

- Do you collect or use user data? **No**
- Personally identifiable information: **No**
- Health information: **No**
- Financial information: **No**
- Authentication information: **No**
- Personal communications: **Read in-page only — never transmitted off-device.**
- Location: **No**
- Web history: **No**
- User activity: **No**
- Website content: **Read in-page only (the message text in the active Slack search result tab) and written to the user's clipboard. Never transmitted off-device.**
