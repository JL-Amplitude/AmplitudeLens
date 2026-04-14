const analyzeButton = document.getElementById("analyzeBtn");
const crawlResultsEl = document.getElementById("crawlResults");
const techResultsEl = document.getElementById("techResults");
const developmentModeCheckbox = document.getElementById("developmentMode");
const resultTabCrawl = document.getElementById("resultTabCrawl");
const resultTabTech = document.getElementById("resultTabTech");
const mcpRadios = document.querySelectorAll('input[name="amplitudeMcp"]');
const claudeModelSelect = document.getElementById("claudeModelSelect");
const claudeApiKeyInput = document.getElementById("claudeApiKeyInput");
const crawlBlockedHint = document.getElementById("crawlBlockedHint");
const architecturePromptSection = document.getElementById("architecturePromptSection");
const architecturePromptText = document.getElementById("architecturePromptText");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const downloadPromptBtn = document.getElementById("downloadPromptBtn");
const tabCrawl = document.getElementById("tabCrawl");
const tabConfig = document.getElementById("tabConfig");
const panelCrawl = document.getElementById("panelCrawl");
const panelConfig = document.getElementById("panelConfig");
const updateStackTechBtn = document.getElementById("updateStackTechBtn");
const updateStackHint = document.getElementById("updateStackHint");
const stackTechLastUpdated = document.getElementById("stackTechLastUpdated");

const AMPLITUDE_MCP_STORAGE_KEY = "amplitudeMcpServer";
const LEGACY_EU_RESIDENCY_KEY = "useEuDataResidency";
const CLAUDE_MODEL_STORAGE_KEY = "selectedClaudeModel";
const CLAUDE_API_KEY_STORAGE_KEY = "claudeApiKey";
const DEVELOPMENT_MODE_KEY = "developmentMode";

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

function setResultTab(which) {
  const isCrawl = which === "crawl";
  resultTabCrawl.classList.toggle("result-tab--active", isCrawl);
  resultTabTech.classList.toggle("result-tab--active", !isCrawl);
  resultTabCrawl.setAttribute("aria-selected", String(isCrawl));
  resultTabTech.setAttribute("aria-selected", String(!isCrawl));
  crawlResultsEl.hidden = !isCrawl;
  techResultsEl.hidden = isCrawl;
}

function updateCrawlUiState() {
  const developmentMode = developmentModeCheckbox.checked;
  const complete = developmentMode || isClaudeConfigComplete();

  crawlBlockedHint.hidden = developmentMode || complete;
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

function getSelectedMcpServerKey() {
  const checked = document.querySelector('input[name="amplitudeMcp"]:checked');
  return checked ? checked.value : "MCP_US_SERVER_REGION";
}

function setMcpRadiosFromKey(key) {
  const valid =
    key === "MCP_EU_SERVER_REGION"
      ? "MCP_EU_SERVER_REGION"
      : "MCP_US_SERVER_REGION";
  mcpRadios.forEach((radio) => {
    radio.checked = radio.value === valid;
  });
}

function renderCrawlResult(data) {
  const crawlPayload = data && data.crawlAnalysis ? data.crawlAnalysis : data;
  crawlResultsEl.innerHTML = `<pre>${JSON.stringify(crawlPayload, null, 2)}</pre>`;
}

function formatGeneratedAt(isoDateString) {
  if (!isoDateString) {
    return "unknown";
  }
  const parsed = new Date(isoDateString);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }
  return parsed.toLocaleString();
}

async function loadStackTechnologiesMetadata() {
  try {
    const url = chrome.runtime.getURL("resources/enthec/technologies.json");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Could not load technologies metadata");
    }

    const payload = await response.json();
    const generatedAt = formatGeneratedAt(payload.generatedAt);
    const count = payload.technologyCount || "unknown";

    stackTechLastUpdated.textContent =
      `Stack technologies last updated: ${generatedAt} (${count} technologies)`;
  } catch (_error) {
    stackTechLastUpdated.textContent =
      "Stack technologies last updated: unavailable";
  }
}

function renderTechResult(data) {
  const techPayload = data && data.techStackDiscovery
    ? data.techStackDiscovery
    : data && data.stackFingerprint
      ? { stackFingerprint: data.stackFingerprint }
      : null;

  if (!techPayload) {
    techResultsEl.innerHTML = '<p class="status">No tech stack discovery result for this run.</p>';
    architecturePromptSection.hidden = true;
    architecturePromptText.value = "";
    return;
  }

  techResultsEl.innerHTML = `<pre>${JSON.stringify(techPayload, null, 2)}</pre>`;

  const prompt = data.architecturePrompt || techPayload.architecturePrompt || "";
  if (prompt) {
    architecturePromptSection.hidden = false;
    architecturePromptText.value = prompt;
  } else {
    architecturePromptSection.hidden = true;
    architecturePromptText.value = "";
  }
}

async function loadPreferences() {
  const [savedLocal, savedSession] = await Promise.all([
    chrome.storage.local.get([
      AMPLITUDE_MCP_STORAGE_KEY,
      LEGACY_EU_RESIDENCY_KEY,
      CLAUDE_MODEL_STORAGE_KEY,
      CLAUDE_API_KEY_STORAGE_KEY,
      DEVELOPMENT_MODE_KEY
    ]),
    chrome.storage.session.get([CLAUDE_API_KEY_STORAGE_KEY])
  ]);

  let mcpKey = savedLocal[AMPLITUDE_MCP_STORAGE_KEY];
  if (mcpKey !== "MCP_US_SERVER_REGION" && mcpKey !== "MCP_EU_SERVER_REGION") {
    mcpKey = savedLocal[LEGACY_EU_RESIDENCY_KEY]
      ? "MCP_EU_SERVER_REGION"
      : "MCP_US_SERVER_REGION";
    await chrome.storage.local.set({ [AMPLITUDE_MCP_STORAGE_KEY]: mcpKey });
  }
  setMcpRadiosFromKey(mcpKey);

  let apiKeyValue = savedSession[CLAUDE_API_KEY_STORAGE_KEY] || "";
  if (!apiKeyValue && savedLocal[CLAUDE_API_KEY_STORAGE_KEY]) {
    apiKeyValue = savedLocal[CLAUDE_API_KEY_STORAGE_KEY];
    await chrome.storage.session.set({
      [CLAUDE_API_KEY_STORAGE_KEY]: apiKeyValue
    });
    await chrome.storage.local.remove(CLAUDE_API_KEY_STORAGE_KEY);
  }
  claudeApiKeyInput.value = apiKeyValue;

  const savedModel = savedLocal[CLAUDE_MODEL_STORAGE_KEY] || defaultClaudeModel;
  const ids = new Set(availableModels.map((m) => m.id));
  claudeModelSelect.value = ids.has(savedModel) ? savedModel : defaultClaudeModel;
  developmentModeCheckbox.checked = Boolean(savedLocal[DEVELOPMENT_MODE_KEY]);

  updateCrawlUiState();
}

renderClaudeModels();
setActiveTab("crawl");
setResultTab("crawl");
loadPreferences();
loadStackTechnologiesMetadata();

tabCrawl.addEventListener("click", () => setActiveTab("crawl"));
tabConfig.addEventListener("click", () => setActiveTab("config"));
resultTabCrawl.addEventListener("click", () => setResultTab("crawl"));
resultTabTech.addEventListener("click", () => setResultTab("tech"));

mcpRadios.forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (radio.checked) {
      await chrome.storage.local.set({
        [AMPLITUDE_MCP_STORAGE_KEY]: radio.value
      });
    }
  });
});

developmentModeCheckbox.addEventListener("change", async () => {
  await chrome.storage.local.set({
    [DEVELOPMENT_MODE_KEY]: developmentModeCheckbox.checked
  });
  updateCrawlUiState();
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
    await chrome.storage.session.set({
      [CLAUDE_API_KEY_STORAGE_KEY]: claudeApiKeyInput.value.trim()
    });
  }, 400);
});

claudeApiKeyInput.addEventListener("blur", async () => {
  clearTimeout(apiKeyPersistTimer);
  await chrome.storage.session.set({
    [CLAUDE_API_KEY_STORAGE_KEY]: claudeApiKeyInput.value.trim()
  });
});

analyzeButton.addEventListener("click", async () => {
  const developmentMode = developmentModeCheckbox.checked;
  if (!developmentMode && !isClaudeConfigComplete()) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const amplitudeMcpServer = getSelectedMcpServerKey();
  const selectedClaudeModel = claudeModelSelect.value || defaultClaudeModel;
  const apiKey = claudeApiKeyInput.value.trim();

  console.log("[Amplitude Lens] Lens configuration (Crawl click)", {
    developmentMode,
    claudeModel: selectedClaudeModel,
    claudeApiKeyConfigured: Boolean(apiKey),
    amplitudeMcpRegion: amplitudeMcpServer
  });

  crawlInProgress = true;
  analyzeButton.disabled = true;
  analyzeButton.textContent = developmentMode
    ? "Running tech discovery..."
    : "Crawling...";
  crawlResultsEl.innerHTML = '<p class="status">Running crawl analysis...</p>';
  techResultsEl.innerHTML = '<p class="status">Waiting for tech stack discovery...</p>';
  setResultTab(developmentMode ? "tech" : "crawl");
  architecturePromptSection.hidden = true;
  architecturePromptText.value = "";

  await Promise.all([
    chrome.storage.local.set({
      [AMPLITUDE_MCP_STORAGE_KEY]: amplitudeMcpServer,
      [CLAUDE_MODEL_STORAGE_KEY]: selectedClaudeModel,
      [DEVELOPMENT_MODE_KEY]: developmentMode
    }),
    chrome.storage.session.set({
      [CLAUDE_API_KEY_STORAGE_KEY]: apiKey
    })
  ]);

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
    crawlResultsEl.innerHTML = `<p class="status">Execution failed: ${error.message}</p>`;
    techResultsEl.innerHTML = `<p class="status">Execution failed: ${error.message}</p>`;
    crawlInProgress = false;
    analyzeButton.textContent = "Start crawl";
    updateCrawlUiState();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "PAGE_ANALYSIS") {
    return;
  }

  renderCrawlResult(message.data);
  renderTechResult(message.data);
  if (message.data && message.data.techStackDiscovery) {
    setResultTab("tech");
  }

  crawlInProgress = false;
  analyzeButton.textContent = "Start crawl";
  updateCrawlUiState();
});

copyPromptBtn.addEventListener("click", async () => {
  const prompt = architecturePromptText.value.trim();
  if (!prompt) {
    return;
  }

  await navigator.clipboard.writeText(prompt);
  copyPromptBtn.textContent = "Copied";
  setTimeout(() => {
    copyPromptBtn.textContent = "Copy prompt";
  }, 1200);
});

downloadPromptBtn.addEventListener("click", () => {
  const prompt = architecturePromptText.value.trim();
  if (!prompt) {
    return;
  }

  const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "amplitude-architecture-prompt.txt";
  a.click();
  URL.revokeObjectURL(url);
});

updateStackTechBtn.addEventListener("click", async () => {
  const command = "node scripts/update-stack-technologies.mjs";
  await navigator.clipboard.writeText(command);
  updateStackHint.textContent =
    `Command copied: ${command}. Run it in the project root, then reload the extension.`;
});
