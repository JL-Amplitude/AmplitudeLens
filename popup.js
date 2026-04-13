const analyzeButton = document.getElementById("analyzeBtn");
const resultsEl = document.getElementById("results");
const mcpRadios = document.querySelectorAll('input[name="amplitudeMcp"]');
const claudeModelSelect = document.getElementById("claudeModelSelect");
const claudeApiKeyInput = document.getElementById("claudeApiKeyInput");
const crawlBlockedHint = document.getElementById("crawlBlockedHint");
const tabCrawl = document.getElementById("tabCrawl");
const tabConfig = document.getElementById("tabConfig");
const panelCrawl = document.getElementById("panelCrawl");
const panelConfig = document.getElementById("panelConfig");

const AMPLITUDE_MCP_STORAGE_KEY = "amplitudeMcpServer";
const LEGACY_EU_RESIDENCY_KEY = "useEuDataResidency";
const CLAUDE_MODEL_STORAGE_KEY = "selectedClaudeModel";
const CLAUDE_API_KEY_STORAGE_KEY = "claudeApiKey";

const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
const availableModels = claudeConfig.availableModels || [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" }
];
const defaultClaudeModel = claudeConfig.defaultModel || "claude-sonnet-4-6";

let crawlInProgress = false;

function renderClaudeModels() {
  claudeModelSelect.innerHTML = "";

  availableModels.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    claudeModelSelect.appendChild(option);
  });
}

function isClaudeConfigComplete() {
  const apiKeyOk = claudeApiKeyInput.value.trim().length > 0;
  const modelOk =
    Boolean(claudeModelSelect.value) && claudeModelSelect.options.length > 0;
  return apiKeyOk && modelOk;
}

function updateCrawlUiState() {
  const complete = isClaudeConfigComplete();
  crawlBlockedHint.hidden = complete;
  if (!crawlInProgress) {
    analyzeButton.disabled = !complete;
  }
}

function setActiveTab(which) {
  const isCrawl = which === "crawl";
  tabCrawl.setAttribute("aria-selected", String(isCrawl));
  tabConfig.setAttribute("aria-selected", String(!isCrawl));
  tabCrawl.classList.toggle("tab--active", isCrawl);
  tabConfig.classList.toggle("tab--active", !isCrawl);
  panelCrawl.hidden = !isCrawl;
  panelConfig.hidden = isCrawl;
}

tabCrawl.addEventListener("click", () => setActiveTab("crawl"));
tabConfig.addEventListener("click", () => setActiveTab("config"));

function getSelectedMcpServerKey() {
  const checked = document.querySelector('input[name="amplitudeMcp"]:checked');
  return checked ? checked.value : "MCP_US_SERVER_REGION";
}

function setMcpRadiosFromKey(key) {
  const valid = key === "MCP_EU_SERVER_REGION" ? "MCP_EU_SERVER_REGION" : "MCP_US_SERVER_REGION";
  mcpRadios.forEach((radio) => {
    radio.checked = radio.value === valid;
  });
}

async function loadPreferences() {
  const saved = await chrome.storage.local.get([
    AMPLITUDE_MCP_STORAGE_KEY,
    LEGACY_EU_RESIDENCY_KEY,
    CLAUDE_MODEL_STORAGE_KEY,
    CLAUDE_API_KEY_STORAGE_KEY
  ]);

  let mcpKey = saved[AMPLITUDE_MCP_STORAGE_KEY];
  if (mcpKey !== "MCP_US_SERVER_REGION" && mcpKey !== "MCP_EU_SERVER_REGION") {
    mcpKey = saved[LEGACY_EU_RESIDENCY_KEY]
      ? "MCP_EU_SERVER_REGION"
      : "MCP_US_SERVER_REGION";
    await chrome.storage.local.set({ [AMPLITUDE_MCP_STORAGE_KEY]: mcpKey });
  }
  setMcpRadiosFromKey(mcpKey);

  claudeApiKeyInput.value = saved[CLAUDE_API_KEY_STORAGE_KEY] || "";

  const savedModel = saved[CLAUDE_MODEL_STORAGE_KEY] || defaultClaudeModel;
  const ids = new Set(availableModels.map((m) => m.id));
  claudeModelSelect.value = ids.has(savedModel) ? savedModel : defaultClaudeModel;

  updateCrawlUiState();
}

renderClaudeModels();
setActiveTab("crawl");
loadPreferences();

mcpRadios.forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (radio.checked) {
      await chrome.storage.local.set({
        [AMPLITUDE_MCP_STORAGE_KEY]: radio.value
      });
    }
  });
});

claudeModelSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [CLAUDE_MODEL_STORAGE_KEY]: claudeModelSelect.value
  });
  updateCrawlUiState();
});

let apiKeyPersistTimer;

claudeApiKeyInput.addEventListener("input", () => {
  updateCrawlUiState();
  clearTimeout(apiKeyPersistTimer);
  apiKeyPersistTimer = setTimeout(async () => {
    await chrome.storage.local.set({
      [CLAUDE_API_KEY_STORAGE_KEY]: claudeApiKeyInput.value.trim()
    });
  }, 400);
});

claudeApiKeyInput.addEventListener("blur", async () => {
  clearTimeout(apiKeyPersistTimer);
  await chrome.storage.local.set({
    [CLAUDE_API_KEY_STORAGE_KEY]: claudeApiKeyInput.value.trim()
  });
});

analyzeButton.addEventListener("click", async () => {
  if (!isClaudeConfigComplete()) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const amplitudeMcpServer = getSelectedMcpServerKey();
  const selectedClaudeModel = claudeModelSelect.value || defaultClaudeModel;
  const apiKey = claudeApiKeyInput.value.trim();

  crawlInProgress = true;
  analyzeButton.disabled = true;
  analyzeButton.textContent = "Crawling...";
  resultsEl.innerHTML = '<p class="status">Running crawler on current page...</p>';

  await chrome.storage.local.set({
    [AMPLITUDE_MCP_STORAGE_KEY]: amplitudeMcpServer,
    [CLAUDE_MODEL_STORAGE_KEY]: selectedClaudeModel,
    [CLAUDE_API_KEY_STORAGE_KEY]: apiKey
  });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "resources/context.js",
        "resources/claude/claudeCredentials.js",
        "resources/claude/claudeHelper.js",
        "resources/prompts.js",
        "resources/orchestration.js",
        "content.js"
      ]
    });
  } catch (error) {
    resultsEl.innerHTML = `<p class="status">Crawler failed: ${error.message}</p>`;
    crawlInProgress = false;
    analyzeButton.textContent = "Start crawl";
    updateCrawlUiState();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_ANALYSIS") {
    resultsEl.innerHTML = `<pre>${JSON.stringify(message.data, null, 2)}</pre>`;
    crawlInProgress = false;
    analyzeButton.textContent = "Start crawl";
    updateCrawlUiState();
  }
});
