"use strict";

const timestampToTime = (timestamp) => {
  const d = new Date(timestamp * Math.pow(10, 13 - timestamp.length));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const yyyy = d.getFullYear();
  const mm = ("0" + (d.getMonth() + 1)).slice(-2);
  const dd = ("0" + d.getDate()).slice(-2);
  const hh = ("0" + d.getHours()).slice(-2);
  const mi = ("0" + d.getMinutes()).slice(-2);
  const ss = ("0" + d.getSeconds()).slice(-2);
  return `${yyyy}-${mm}-${dd} ${weekday[d.getDay()]} ${hh}:${mi}:${ss}`;
};

const waitMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Convert Slack's rich text DOM to Markdown.
// Confirmed selectors via Chrome DevTools inspection:
//   inline code  : <code class="c-mrkdwn__code">
//   code block   : <pre class="c-mrkdwn__pre">
//   bullet list  : <ul class="...p-rich_text_list__bullet..."> + <li data-stringify-indent="N">
//   bold         : <b data-stringify-type="bold">
//   link         : <a data-stringify-link="url">
//   italic/strike: inferred from same data-stringify-type pattern
const domToMarkdown = (node) => {
  if (node.nodeType === 3) return node.textContent; // text node
  if (node.nodeType !== 1) return '';               // non-element

  const tag = node.tagName.toLowerCase();
  const cls = node.className || '';

  // Inline: br — Slack uses <br aria-hidden="true">, so check before the
  // aria-hidden filter below or line breaks would be silently dropped.
  if (tag === 'br') return '\n';

  // Skip buttons (expand triggers) and hidden elements
  if (tag === 'button') return '';
  if (node.getAttribute('hidden') !== null) return '';
  if (node.getAttribute('aria-hidden') === 'true') return '';

  const inner = () => [...node.childNodes].map(domToMarkdown).join('');

  // Inline: image → Markdown image syntax
  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    const alt = node.getAttribute('alt') || '';
    return src ? `![${alt}](${src})` : '';
  }

  // Inline: link (data-stringify-link holds the canonical URL)
  if (tag === 'a') {
    const href = node.getAttribute('data-stringify-link') || node.getAttribute('href') || '';
    const text = inner();
    return (href && href !== text) ? `[${text}](${href})` : text;
  }

  // Inline: bold  — <b data-stringify-type="bold">
  if (tag === 'b' || node.getAttribute('data-stringify-type') === 'bold') return `**${inner()}**`;

  // Inline: italic — inferred: <i data-stringify-type="italic">
  if (tag === 'i' || node.getAttribute('data-stringify-type') === 'italic') return `_${inner()}_`;

  // Inline: strikethrough — inferred: <s data-stringify-type="strike">
  if (tag === 's' || node.getAttribute('data-stringify-type') === 'strike') return `~~${inner()}~~`;

  // Inline: code — <code class="c-mrkdwn__code">
  if (tag === 'code' || cls.includes('c-mrkdwn__code')) return `\`${inner()}\``;

  // Block: code block — <pre class="c-mrkdwn__pre">
  //   inner div "p-rich_text_block--no-overflow" is a pass-through wrapper
  if (tag === 'pre' || cls.includes('c-mrkdwn__pre')) return `\`\`\`\n${inner()}\n\`\`\`\n`;

  // Block: blockquote
  if (tag === 'blockquote' || cls.includes('p-rich_text_quote')) {
    return inner().trimEnd().split('\n').map(l => `> ${l}`).join('\n') + '\n';
  }

  // Block: list item — <li data-stringify-indent="N">
  //   indent level comes from data-stringify-indent attribute
  if (tag === 'li') {
    const indent = parseInt(node.getAttribute('data-stringify-indent') || '0') * 2;
    const parentUl = node.parentElement;
    const isOrdered = parentUl?.className?.includes('p-rich_text_list__ordered') || tag === 'ol';
    return ' '.repeat(indent) + (isOrdered ? '1. ' : '- ') + inner().trim() + '\n';
  }

  // Block: paragraph / section — each section ends with a newline
  if (cls.includes('p-rich_text_section') || tag === 'p') {
    const text = inner();
    return text ? text.trimEnd() + '\n' : '';
  }

  return inner();
};

const toYamlScalar = (str) => {
  const trimmed = str.replace(/\n+$/, '');
  if (!trimmed.includes('\n')) {
    return '"' + trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return '|\n' + trimmed.split('\n').map(l => '    ' + l).join('\n');
};

const formatAsYaml = (messages) => {
  return messages.map(({ date, channel, sender, message }) => [
    `- date: ${toYamlScalar(date)}`,
    `  channel: ${toYamlScalar(channel)}`,
    `  sender: ${toYamlScalar(sender)}`,
    `  message: ${toYamlScalar(message)}`,
  ].join('\n')).join('\n\n');
};

const waitForSearchResult = () => {
  const observeFunc = () => {
    const groups = document.querySelectorAll(".c-message_group");
    const allHaveTimestamp = [...groups].every(g => {
      const ts = g.querySelector(".c-timestamp");
      return ts && ts.getAttribute("data-ts");
    });
    const el = document.querySelector(".c-search_message__content");
    return (el && allHaveTimestamp) ? el : null;
  };

  return new Promise((resolve) => {
    const el = observeFunc();
    if (el) { resolve(el); return; }
    new MutationObserver((_, observer) => {
      const el = observeFunc();
      if (el) { resolve(el); observer.disconnect(); }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
};

const goToFirstPage = async () => {
  const wrapper = document.querySelector('.c-pagination_wrapper');
  if (!wrapper) return; // single-page result, nothing to do
  const currentPage = wrapper.getAttribute('data-qa-current-page');
  if (!currentPage || currentPage === '1') return;

  const page1Btn = document.querySelector('[data-qa="c-pagination_page_btn_1"]');
  if (!page1Btn) return;
  page1Btn.click();
  await waitMs(800);
  await waitForSearchResult();
};

const expandShowMore = async () => {
  const outerBtns = [...document.querySelectorAll('[data-qa="search_expand"]')]
    .filter(el => el.offsetParent !== null);
  if (outerBtns.length > 0) {
    outerBtns.forEach(btn => btn.click());
    await waitMs(500);
  }

  const innerBtns = [...document.querySelectorAll('.c-rich_text_expand_button')]
    .filter(el => el.offsetParent !== null);
  if (innerBtns.length > 0) {
    innerBtns.forEach(btn => btn.click());
    await waitMs(500);
  }
};

const collectMessagesFromPage = (messagePack) => {
  return new Promise((resolve) => {
    messagePack.messagePushed = false;
    document.querySelectorAll('[role="document"]').forEach((group) => {
      const tsAttr = group.querySelector(".c-timestamp")?.getAttribute("data-ts")?.split(".")[0];
      if (!tsAttr) return;
      const datetime = timestampToTime(tsAttr);
      const channelNameEl = group.querySelector('[data-qa="inline_channel_entity__name"]');
      const channelName = channelNameEl ? channelNameEl.textContent : "DirectMessage";
      const sender = group.querySelector(".c-message__sender_button")?.textContent ?? "";

      const msgEl = group.querySelector('[data-qa="message-text"]');
      const attachEl = group.querySelector(".c-search_message__attachments");
      const messageText = msgEl ? domToMarkdown(msgEl).trim() : "";
      const attachmentText = attachEl ? domToMarkdown(attachEl).trim() : "";
      const trimmedMessage = attachmentText
        ? `${messageText}\n${attachmentText}`.trim()
        : messageText;

      const key = `${datetime}\t${channelName}\t${sender}\t${trimmedMessage}`;
      if (messagePack.messageSet.has(key)) return;
      messagePack.messages.push({ date: datetime, channel: channelName, sender, message: trimmedMessage });
      messagePack.messagePushed = true;
      messagePack.messageSet.add(key);
      group.scrollIntoView();
    });
    resolve(messagePack);
  });
};

const clickNextPage = (messagePack) => {
  messagePack.hasNextPage = false;
  const arrowBtns = document.querySelectorAll(".c-pagination__arrow_btn");
  if (!arrowBtns.length) return Promise.resolve(messagePack);

  const nextBtn = [...arrowBtns].find(e =>
    ["Next page", "次のページ"].includes(e.getAttribute("aria-label"))
  );
  if (!nextBtn) return Promise.resolve(messagePack);

  messagePack.hasNextPage = nextBtn.getAttribute("aria-disabled") === "false";
  if (messagePack.hasNextPage) nextBtn.click();
  return Promise.resolve(messagePack);
};

const checkPageLimit = (messagePack) => {
  if (!document.querySelector(".c-search_message__content")) {
    messagePack.hasNextPage = false;
  }
  return Promise.resolve(messagePack);
};

const runExport = async (messagePack) => {
  if (!messagePack.hasNextPage) {
    const yaml = formatAsYaml(messagePack.messages);
    chrome.runtime.sendMessage({
      action: "exportComplete",
      data: yaml,
      count: messagePack.messages.length,
      bytes: new Blob([yaml]).size,
    });
    return;
  }

  await waitForSearchResult();
  do {
    await waitMs(800);
    await expandShowMore();
    await collectMessagesFromPage(messagePack);
  } while (messagePack.messagePushed);

  chrome.runtime.sendMessage({ action: "progress", count: messagePack.messages.length });

  await clickNextPage(messagePack);
  await waitMs(600);
  await checkPageLimit(messagePack);
  await runExport(messagePack);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "startExport") {
    (async () => {
      await goToFirstPage();
      await runExport({
        messages: [],
        messageSet: new Set(),
        messagePushed: false,
        hasNextPage: true,
      });
    })();
    sendResponse({ status: "started" });
  }
  return true;
});
