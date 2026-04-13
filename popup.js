const analyzeButton = document.getElementById("analyzeBtn");
const resultsEl = document.getElementById("results");
const euResidencyCheckbox = document.getElementById("euResidencyCheckbox");
const claudeModelSelect = document.getElementById("claudeModelSelect");
const RESIDENCY_STORAGE_KEY = "useEuDataResidency";
const CLAUDE_MODEL_STORAGE_KEY = "selectedClaudeModel";

const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
const availableModels = claudeConfig.availableModels || [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" }
];
const defaultClaudeModel = claudeConfig.defaultModel || "claude-sonnet-4-6";

function renderClaudeModels() {
  claudeModelSelect.innerHTML = "";

  availableModels.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    claudeModelSelect.appendChild(option);
  });
}

async function loadPreferences() {
  const saved = await chrome.storage.local.get([
    RESIDENCY_STORAGE_KEY,
    CLAUDE_MODEL_STORAGE_KEY
  ]);
  euResidencyCheckbox.checked = Boolean(saved[RESIDENCY_STORAGE_KEY]);
  claudeModelSelect.value = saved[CLAUDE_MODEL_STORAGE_KEY] || defaultClaudeModel;
}

renderClaudeModels();
loadPreferences();

euResidencyCheckbox.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [RESIDENCY_STORAGE_KEY]: euResidencyCheckbox.checked
  });
});

claudeModelSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [CLAUDE_MODEL_STORAGE_KEY]: claudeModelSelect.value
  });
});

analyzeButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const useEuDataResidency = euResidencyCheckbox.checked;
  const selectedClaudeModel = claudeModelSelect.value || defaultClaudeModel;

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Crawling...";
  resultsEl.innerHTML = '<p class="status">Running crawler on current page...</p>';

  await chrome.storage.local.set({
    [RESIDENCY_STORAGE_KEY]: useEuDataResidency,
    [CLAUDE_MODEL_STORAGE_KEY]: selectedClaudeModel
  });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "resources/context.js",
        "resources/credentials/claudeCredentials.js",
        "resources/claudeHelper.js",
        "resources/prompts.js",
        "resources/orchestration.js",
        "content.js"
      ]
    });
  } catch (error) {
    resultsEl.innerHTML = `<p class="status">Crawler failed: ${error.message}</p>`;
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Start crawl";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_ANALYSIS") {
    resultsEl.innerHTML = `<pre>${JSON.stringify(message.data, null, 2)}</pre>`;
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Start crawl";
  }
});