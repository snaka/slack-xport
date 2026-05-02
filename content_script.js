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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const waitMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      const timestampLabel = group.querySelector(".c-timestamp__label")?.textContent ?? "";
      const rawMessage = group.querySelector(".c-search_message__content")?.textContent ?? "";
      const trimmedMessage = rawMessage
        .replace(new RegExp('^' + escapeRegExp(sender)), '')
        .replace(new RegExp('^.*?' + escapeRegExp(timestampLabel)), '');
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
    chrome.runtime.sendMessage({
      action: "exportComplete",
      data: formatAsYaml(messagePack.messages),
      count: messagePack.messages.length,
    });
    return;
  }

  await waitForSearchResult();
  do {
    await waitMs(800);
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
    runExport({
      messages: [],
      messageSet: new Set(),
      messagePushed: false,
      hasNextPage: true,
    });
    sendResponse({ status: "started" });
  }
  return true;
});
