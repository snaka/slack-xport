"use strict";

let exportedData = null;

const exportBtn = document.getElementById("exportBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");

const setStatus = (text) => { statusEl.textContent = text; };
const showError = (text) => { errorEl.textContent = text; errorEl.style.display = "block"; };
const clearError = () => { errorEl.style.display = "none"; };

exportBtn.addEventListener("click", async () => {
  exportedData = null;
  downloadBtn.style.display = "none";
  clearError();
  exportBtn.disabled = true;
  setStatus("Starting export...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes("app.slack.com")) {
    showError("Please open Slack and run a search first.");
    exportBtn.disabled = false;
    setStatus("");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "startExport" }, (response) => {
    if (chrome.runtime.lastError) {
      showError("Could not connect. Try reloading the Slack tab.");
      exportBtn.disabled = false;
      setStatus("");
      return;
    }
    setStatus("Collecting messages...");
  });
});

downloadBtn.addEventListener("click", () => {
  if (!exportedData) return;
  const blob = new Blob([exportedData], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `slack-export-${new Date().toISOString().slice(0, 10)}.tsv`;
  a.click();
  URL.revokeObjectURL(url);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "progress") {
    setStatus(`Collecting... ${message.count} messages`);
  } else if (message.action === "exportComplete") {
    exportedData = message.data;
    exportBtn.disabled = false;
    setStatus(`Done — ${message.count} messages collected.`);
    downloadBtn.style.display = "block";
  }
});
