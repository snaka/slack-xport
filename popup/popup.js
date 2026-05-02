"use strict";

const LARGE_BYTES = 1024 * 1024; // warn if result exceeds 1MB

let exportedData = null;

const mainBtn = document.getElementById("mainBtn");
const confirmCopyBtn = document.getElementById("confirmCopyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const stateEl = document.getElementById("state");
const stateTextEl = document.getElementById("stateText");

const setStatus = (text) => { statusEl.textContent = text; };
const showError = (text) => { errorEl.textContent = text; errorEl.style.display = "block"; };
const clearError = () => { errorEl.style.display = "none"; };

const setState = (kind, text) => {
  stateEl.className = `state ${kind}`;
  stateTextEl.textContent = text;
};

const formatSize = (bytes) => bytes < 1024 * 1024
  ? `${(bytes / 1024).toFixed(1)} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const copyToClipboard = async () => {
  await navigator.clipboard.writeText(exportedData);
  mainBtn.textContent = "Copied!";
  mainBtn.classList.add("copied");
  setTimeout(() => {
    mainBtn.textContent = "Export & Copy";
    mainBtn.classList.remove("copied");
  }, 2000);
};

const detectPageState = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes("app.slack.com")) {
    setState("error", "Open Slack to use this extension.");
    mainBtn.disabled = true;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "checkSearchPage" }, (response) => {
    if (chrome.runtime.lastError) {
      setState("warn", "Reload the Slack tab to activate the extension.");
      mainBtn.disabled = true;
      return;
    }
    if (!response?.hasResults) {
      setState("warn", "Run a message search on Slack first.");
      mainBtn.disabled = true;
      return;
    }
    const n = response.resultCount;
    setState("ready", `Ready — ${n} message${n === 1 ? "" : "s"} on this page.`);
    mainBtn.disabled = false;
  });
};

mainBtn.addEventListener("click", async () => {
  exportedData = null;
  confirmCopyBtn.style.display = "none";
  downloadBtn.style.display = "none";
  clearError();
  mainBtn.disabled = true;
  setStatus("Starting export...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "startExport" }, (response) => {
    if (chrome.runtime.lastError) {
      showError("Could not connect. Try reloading the Slack tab.");
      mainBtn.disabled = false;
      setStatus("");
      return;
    }
    setStatus("Collecting messages...");
  });
});

confirmCopyBtn.addEventListener("click", async () => {
  confirmCopyBtn.style.display = "none";
  await copyToClipboard();
});

downloadBtn.addEventListener("click", () => {
  if (!exportedData) return;
  const blob = new Blob([exportedData], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `slack-export-${new Date().toISOString().slice(0, 10)}.yaml`;
  a.click();
  URL.revokeObjectURL(url);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "progress") {
    setStatus(`Collecting... ${message.count} messages`);
  } else if (message.action === "exportComplete") {
    exportedData = message.data;
    mainBtn.disabled = false;
    downloadBtn.style.display = "block";

    if (message.bytes >= LARGE_BYTES) {
      setStatus(`${message.count} messages (${formatSize(message.bytes)}) — large content.`);
      confirmCopyBtn.style.display = "block";
    } else {
      setStatus(`Done — ${message.count} messages (${formatSize(message.bytes)})`);
      copyToClipboard();
    }
  }
});

detectPageState();
