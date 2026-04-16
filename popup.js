const analyzeButton = document.getElementById("analyzeBtn");
const crawlResultsEl = document.getElementById("crawlResults");
const techSummarySection = document.getElementById("techSummarySection");
const techResultsEl = document.getElementById("techResults");
const techDetailTabs = document.getElementById("techDetailTabs");
const techDetailTabJson = document.getElementById("techDetailTabJson");
const techDetailTabPrompt = document.getElementById("techDetailTabPrompt");
const discoveryModeSection = document.getElementById("discoveryModeSection");
const crawlModeRadios = document.querySelectorAll('input[name="crawlMode"]');
const providedCsvSection = document.getElementById("providedCsvSection");
const providedCsvInput = document.getElementById("providedCsvInput");
const providedCsvFile = document.getElementById("providedCsvFile");
const developmentModeCheckbox = document.getElementById("developmentMode");
const discoveryOutputSection = document.getElementById("discoveryOutputSection");
const resultTabCrawl = document.getElementById("resultTabCrawl");
const resultTabTech = document.getElementById("resultTabTech");
const crawlResultsActions = document.getElementById("crawlResultsActions");
const copyCrawlResultsBtn = document.getElementById("copyCrawlResultsBtn");
const downloadCrawlResultsBtn = document.getElementById("downloadCrawlResultsBtn");
const mcpRadios = document.querySelectorAll('input[name="amplitudeMcp"]');
const claudeModelSelect = document.getElementById("claudeModelSelect");
const claudeApiKeyInput = document.getElementById("claudeApiKeyInput");
const toggleApiKeyVisibilityBtn = document.getElementById("toggleApiKeyVisibilityBtn");
const apiKeyVisibilityIcon = document.getElementById("apiKeyVisibilityIcon");
const crawlBlockedHint = document.getElementById("crawlBlockedHint");
const architecturePromptSection = document.getElementById("architecturePromptSection");
const architecturePromptText = document.getElementById("architecturePromptText");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const downloadPromptBtn = document.getElementById("downloadPromptBtn");
const sendToGleanBtn = document.getElementById("sendToGleanBtn");
const tabCrawl = document.getElementById("tabCrawl");
const tabConfig = document.getElementById("tabConfig");
const panelCrawl = document.getElementById("panelCrawl");
const panelConfig = document.getElementById("panelConfig");
const configTabClaude = document.getElementById("configTabClaude");
const configTabMcp = document.getElementById("configTabMcp");
const configTabTech = document.getElementById("configTabTech");
const configPanelClaude = document.getElementById("configPanelClaude");
const configPanelMcp = document.getElementById("configPanelMcp");
const configPanelTech = document.getElementById("configPanelTech");
const updateStackTechBtn = document.getElementById("updateStackTechBtn");
const updateStackHint = document.getElementById("updateStackHint");
const stackTechLastUpdated = document.getElementById("stackTechLastUpdated");

const AMPLITUDE_MCP_STORAGE_KEY = "amplitudeMcpServer";
const LEGACY_EU_RESIDENCY_KEY = "useEuDataResidency";
const CLAUDE_MODEL_STORAGE_KEY = "selectedClaudeModel";
const CLAUDE_API_KEY_STORAGE_KEY = "claudeApiKey";
const DEVELOPMENT_MODE_KEY = "developmentMode";
const CRAWL_MODE_STORAGE_KEY = "crawlMode";
const PROVIDED_TAXONOMY_CSV_STORAGE_KEY = "providedTaxonomyCsv";
const DISCOVERY_RUN_STATE_KEY = "discoveryRunState";
const DISCOVERY_RUN_RESULTS_KEY = "discoveryRunResults";

const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
const availableModels = claudeConfig.availableModels || [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" }
];
const defaultClaudeModel = claudeConfig.defaultModel || "claude-sonnet-4-6";
const TECH_STACK_ONLY_MESSAGE = "Just tech stack discovery was performed.";

let crawlInProgress = false;
let currentRunStatus = "idle";
let lastCrawlResultsText = "";
let hasExportableGrowthOpsResult = false;

function syncCrawlResultActionsVisibility() {
  const isGrowthTabActive = resultTabCrawl.classList.contains("result-tab--active");
  const isTechStackOnlyRun =
    (lastCrawlResultsText || "").trim() === TECH_STACK_ONLY_MESSAGE;
  const shouldShow =
    isGrowthTabActive && hasExportableGrowthOpsResult && !isTechStackOnlyRun;
  crawlResultsActions.hidden = !shouldShow;
  crawlResultsActions.style.display = shouldShow ? "flex" : "none";
}

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
  techSummarySection.hidden = isCrawl;
  if (!isCrawl) {
    crawlResultsActions.hidden = true;
    crawlResultsActions.style.display = "none";
    return;
  }
  syncCrawlResultActionsVisibility();
}

function setTechDetailTab(which) {
  const isJson = which === "json";
  techDetailTabJson.classList.toggle("result-tab--active", isJson);
  techDetailTabPrompt.classList.toggle("result-tab--active", !isJson);
  techDetailTabJson.setAttribute("aria-selected", String(isJson));
  techDetailTabPrompt.setAttribute("aria-selected", String(!isJson));
  techResultsEl.hidden = !isJson;
  architecturePromptSection.hidden = isJson;
}

function setDiscoveryOutputVisible(isVisible) {
  discoveryOutputSection.hidden = !isVisible;
  if (!isVisible) {
    crawlResultsActions.hidden = true;
  } else {
    syncCrawlResultActionsVisibility();
  }
}

function clearRenderedResults() {
  crawlResultsEl.innerHTML = "";
  lastCrawlResultsText = "";
  hasExportableGrowthOpsResult = false;
  syncCrawlResultActionsVisibility();
  techResultsEl.innerHTML = "";
  architecturePromptSection.hidden = true;
  architecturePromptText.value = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdownToHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const html = [];
  let inCodeBlock = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      closeList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        html.push("<pre><code>");
      } else {
        inCodeBlock = false;
        html.push("</code></pre>");
      }
      return;
    }

    if (inCodeBlock) {
      html.push(`${escapeHtml(line)}\n`);
      return;
    }

    if (!trimmed) {
      closeList();
      html.push("<p></p>");
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  });

  closeList();
  if (inCodeBlock) {
    html.push("</code></pre>");
  }
  return html.join("");
}

function resolveCrawlResultMarkdown(data) {
  if (!data) {
    return "";
  }

  const crawlPayload = data.crawlAnalysis ? data.crawlAnalysis : data;
  if (typeof crawlPayload === "string") {
    return crawlPayload;
  }
  if (crawlPayload && typeof crawlPayload.markdown === "string") {
    return crawlPayload.markdown;
  }
  if (crawlPayload && typeof crawlPayload.growthOps === "string") {
    return crawlPayload.growthOps;
  }
  if (
    crawlPayload &&
    crawlPayload.growthOps &&
    typeof crawlPayload.growthOps === "object" &&
    typeof crawlPayload.growthOps.markdown === "string"
  ) {
    return crawlPayload.growthOps.markdown;
  }

  return "";
}

async function persistRunState(status, results = null, metadata = {}) {
  const payload = {
    status,
    updatedAt: Date.now(),
    ...metadata
  };

  const writes = [
    chrome.storage.local.set({
      [DISCOVERY_RUN_STATE_KEY]: payload
    })
  ];

  if (results !== null) {
    writes.push(
      chrome.storage.local.set({
        [DISCOVERY_RUN_RESULTS_KEY]: results
      })
    );
  }

  await Promise.all(writes);
}

async function resetToPreExecutionState() {
  currentRunStatus = "idle";
  crawlInProgress = false;
  await chrome.storage.local.remove([DISCOVERY_RUN_STATE_KEY, DISCOVERY_RUN_RESULTS_KEY]);
  clearRenderedResults();
  setResultTab("crawl");
  setDiscoveryOutputVisible(false);
  analyzeButton.textContent = "Start Discovery";
  updateCrawlUiState();
}

function updateCrawlUiState() {
  const developmentMode = developmentModeCheckbox.checked;
  const complete = developmentMode || isClaudeConfigComplete();
  discoveryModeSection.hidden = developmentMode;
  updateProvidedCsvVisibility();

  if (currentRunStatus === "running") {
    analyzeButton.disabled = true;
    crawlBlockedHint.hidden = true;
    return;
  }

  if (currentRunStatus === "completed") {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Execute new discovery";
    crawlBlockedHint.hidden = true;
    return;
  }

  crawlBlockedHint.hidden = developmentMode || complete;
  if (!crawlInProgress) {
    analyzeButton.disabled = !complete;
    analyzeButton.textContent = "Start Discovery";
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

function setConfigTab(which) {
  const isClaude = which === "claude";
  const isMcp = which === "mcp";
  const isTech = which === "tech";

  configTabClaude.classList.toggle("config-tab--active", isClaude);
  configTabMcp.classList.toggle("config-tab--active", isMcp);
  configTabTech.classList.toggle("config-tab--active", isTech);
  configTabClaude.setAttribute("aria-selected", String(isClaude));
  configTabMcp.setAttribute("aria-selected", String(isMcp));
  configTabTech.setAttribute("aria-selected", String(isTech));

  configPanelClaude.hidden = !isClaude;
  configPanelMcp.hidden = !isMcp;
  configPanelTech.hidden = !isTech;
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

function getSelectedCrawlMode() {
  const checked = document.querySelector('input[name="crawlMode"]:checked');
  return checked ? checked.value : "quick";
}

function setSelectedCrawlMode(mode) {
  const normalized = mode === "deep" || mode === "provided" ? mode : "quick";
  crawlModeRadios.forEach((radio) => {
    radio.checked = radio.value === normalized;
  });
}

function updateProvidedCsvVisibility() {
  const developmentMode = developmentModeCheckbox.checked;
  providedCsvSection.hidden =
    developmentMode || getSelectedCrawlMode() !== "provided";
}

function renderCrawlResult(data) {
  if (data && data.mode === "development") {
    crawlResultsEl.innerHTML = `<p class="status">${TECH_STACK_ONLY_MESSAGE}</p>`;
    lastCrawlResultsText = TECH_STACK_ONLY_MESSAGE;
    hasExportableGrowthOpsResult = false;
    syncCrawlResultActionsVisibility();
    return;
  }

  const crawlPayload = data && data.crawlAnalysis ? data.crawlAnalysis : data;
  const markdownOutput = resolveCrawlResultMarkdown(data);
  if (markdownOutput) {
    lastCrawlResultsText = markdownOutput;
    crawlResultsEl.innerHTML = `<div class="markdown-results">${renderMarkdownToHtml(markdownOutput)}</div>`;
  } else {
    lastCrawlResultsText = JSON.stringify(crawlPayload, null, 2);
    crawlResultsEl.innerHTML = `<pre>${lastCrawlResultsText}</pre>`;
  }
  hasExportableGrowthOpsResult = Boolean(
    lastCrawlResultsText.trim() &&
    lastCrawlResultsText.trim() !== TECH_STACK_ONLY_MESSAGE
  );
  syncCrawlResultActionsVisibility();
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
    techDetailTabs.hidden = true;
    setTechDetailTab("json");
    architecturePromptSection.hidden = true;
    architecturePromptText.value = "";
    return;
  }

  techResultsEl.innerHTML = `<pre>${JSON.stringify(techPayload, null, 2)}</pre>`;

  const prompt = data.architecturePrompt || techPayload.architecturePrompt || "";
  if (prompt) {
    techDetailTabs.hidden = false;
    architecturePromptText.value = prompt;
    setTechDetailTab("json");
  } else {
    techDetailTabs.hidden = true;
    setTechDetailTab("json");
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
      DEVELOPMENT_MODE_KEY,
      CRAWL_MODE_STORAGE_KEY,
      PROVIDED_TAXONOMY_CSV_STORAGE_KEY
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
  const savedMode = savedLocal[CRAWL_MODE_STORAGE_KEY];
  setSelectedCrawlMode(savedMode);
  providedCsvInput.value = savedLocal[PROVIDED_TAXONOMY_CSV_STORAGE_KEY] || "";

  updateCrawlUiState();
}

async function restorePersistedDiscoveryState() {
  const stored = await chrome.storage.local.get([
    DISCOVERY_RUN_STATE_KEY,
    DISCOVERY_RUN_RESULTS_KEY
  ]);
  const runState = stored[DISCOVERY_RUN_STATE_KEY];
  const persistedResults = stored[DISCOVERY_RUN_RESULTS_KEY];

  if (!runState || !runState.status) {
    currentRunStatus = "idle";
    clearRenderedResults();
    setDiscoveryOutputVisible(false);
    updateCrawlUiState();
    return;
  }

  currentRunStatus = runState.status;

  if (runState.status === "running") {
    crawlInProgress = true;
    analyzeButton.textContent =
      runState.mode === "development" ? "Running tech discovery..." : "Crawling...";
    analyzeButton.disabled = true;
    crawlBlockedHint.hidden = true;
    return;
  }

  if (runState.status === "completed") {
    crawlInProgress = false;
    if (persistedResults) {
      renderCrawlResult(persistedResults);
      renderTechResult(persistedResults);
      setDiscoveryOutputVisible(true);
    } else {
      setDiscoveryOutputVisible(false);
      clearRenderedResults();
    }
    analyzeButton.textContent = "Execute new discovery";
    analyzeButton.disabled = false;
    crawlBlockedHint.hidden = true;
    return;
  }

  currentRunStatus = "idle";
  clearRenderedResults();
  setDiscoveryOutputVisible(false);
  updateCrawlUiState();
}

renderClaudeModels();
setActiveTab("crawl");
setConfigTab("claude");
setResultTab("crawl");
setDiscoveryOutputVisible(false);
loadPreferences()
  .then(() => restorePersistedDiscoveryState())
  .catch((error) => {
    console.error("[Amplitude Lens] Failed to restore popup state", error);
  });
loadStackTechnologiesMetadata();

tabCrawl.addEventListener("click", () => setActiveTab("crawl"));
tabConfig.addEventListener("click", () => setActiveTab("config"));
configTabClaude.addEventListener("click", () => setConfigTab("claude"));
configTabMcp.addEventListener("click", () => setConfigTab("mcp"));
configTabTech.addEventListener("click", () => setConfigTab("tech"));
resultTabCrawl.addEventListener("click", () => setResultTab("crawl"));
resultTabTech.addEventListener("click", () => setResultTab("tech"));
techDetailTabJson.addEventListener("click", () => setTechDetailTab("json"));
techDetailTabPrompt.addEventListener("click", () => setTechDetailTab("prompt"));

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

crawlModeRadios.forEach((radio) => {
  radio.addEventListener("change", async () => {
    updateProvidedCsvVisibility();
    await chrome.storage.local.set({
      [CRAWL_MODE_STORAGE_KEY]: getSelectedCrawlMode()
    });
  });
});

providedCsvInput.addEventListener("input", async () => {
  await chrome.storage.local.set({
    [PROVIDED_TAXONOMY_CSV_STORAGE_KEY]: providedCsvInput.value
  });
});

providedCsvFile.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  providedCsvInput.value = text;
  await chrome.storage.local.set({
    [PROVIDED_TAXONOMY_CSV_STORAGE_KEY]: text
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

function syncApiKeyVisibilityButton() {
  const isVisible = claudeApiKeyInput.type === "text";
  toggleApiKeyVisibilityBtn.setAttribute(
    "aria-label",
    isVisible ? "Hide API key" : "Show API key"
  );
  toggleApiKeyVisibilityBtn.title = isVisible ? "Hide API key" : "Show API key";
  apiKeyVisibilityIcon.src = isVisible
    ? "icons/mask_text.png"
    : "icons/show_text.png";
}

toggleApiKeyVisibilityBtn.addEventListener("click", () => {
  claudeApiKeyInput.type = claudeApiKeyInput.type === "password" ? "text" : "password";
  syncApiKeyVisibilityButton();
});

syncApiKeyVisibilityButton();

analyzeButton.addEventListener("click", async () => {
  if (currentRunStatus === "running") {
    return;
  }

  if (currentRunStatus === "completed") {
    await resetToPreExecutionState();
    return;
  }

  const developmentMode = developmentModeCheckbox.checked;
  if (!developmentMode && !isClaudeConfigComplete()) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const amplitudeMcpServer = getSelectedMcpServerKey();
  const selectedClaudeModel = claudeModelSelect.value || defaultClaudeModel;
  const apiKey = claudeApiKeyInput.value.trim();
  const crawlMode = getSelectedCrawlMode();
  const providedTaxonomyCsv = providedCsvInput.value;

  console.log("[Amplitude Lens] Lens configuration (Crawl click)", {
    developmentMode,
    crawlMode,
    claudeModel: selectedClaudeModel,
    claudeApiKeyConfigured: Boolean(apiKey),
    amplitudeMcpRegion: amplitudeMcpServer
  });

  crawlInProgress = true;
  currentRunStatus = "running";
  analyzeButton.disabled = true;
  analyzeButton.textContent = developmentMode
    ? "Running tech discovery..."
    : "Crawling...";
  setDiscoveryOutputVisible(false);
  crawlResultsEl.innerHTML = '<p class="status">Running crawl analysis...</p>';
  crawlResultsActions.hidden = true;
  lastCrawlResultsText = "";
  techResultsEl.innerHTML = '<p class="status">Waiting for tech stack discovery...</p>';
  setResultTab(developmentMode ? "tech" : "crawl");
  architecturePromptSection.hidden = true;
  architecturePromptText.value = "";

  await persistRunState("running", null, {
    mode: developmentMode ? "development" : "full",
    startedAt: Date.now()
  });

  await Promise.all([
    chrome.storage.local.set({
      [AMPLITUDE_MCP_STORAGE_KEY]: amplitudeMcpServer,
      [CLAUDE_MODEL_STORAGE_KEY]: selectedClaudeModel,
      [DEVELOPMENT_MODE_KEY]: developmentMode,
      [CRAWL_MODE_STORAGE_KEY]: crawlMode,
      [PROVIDED_TAXONOMY_CSV_STORAGE_KEY]: providedTaxonomyCsv
    }),
    chrome.storage.session.set({
      [CLAUDE_API_KEY_STORAGE_KEY]: apiKey
    })
  ]);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (runtimeKey) => {
        globalThis.AMPLITUDE_LENS_RUNTIME = {
          ...(globalThis.AMPLITUDE_LENS_RUNTIME || {}),
          claudeApiKey: runtimeKey
        };
      },
      args: [apiKey]
    });

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
    setDiscoveryOutputVisible(true);
    crawlResultsEl.innerHTML = `<p class="status">Execution failed: ${error.message}</p>`;
    techResultsEl.innerHTML = `<p class="status">Execution failed: ${error.message}</p>`;
    crawlInProgress = false;
    currentRunStatus = "completed";
    analyzeButton.textContent = "Execute new discovery";
    analyzeButton.disabled = false;
    await persistRunState(
      "completed",
      {
        mode: developmentMode ? "development" : "crawl",
        error: error.message
      },
      {
        completedAt: Date.now()
      }
    );
    updateCrawlUiState();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "PAGE_ANALYSIS") {
    return;
  }

  renderCrawlResult(message.data);
  renderTechResult(message.data);
  setDiscoveryOutputVisible(true);
  if (message.data && message.data.techStackDiscovery) {
    setResultTab("tech");
  }

  crawlInProgress = false;
  currentRunStatus = "completed";
  analyzeButton.textContent = "Execute new discovery";
  analyzeButton.disabled = false;
  persistRunState("completed", message.data, {
    completedAt: Date.now()
  }).catch((error) => {
    console.error("[Amplitude Lens] Failed to persist completed discovery state", error);
  });
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

copyCrawlResultsBtn.addEventListener("click", async () => {
  if (!hasExportableGrowthOpsResult) {
    return;
  }
  const payload = (lastCrawlResultsText || "").trim();
  if (!payload) {
    return;
  }

  await navigator.clipboard.writeText(payload);
  copyCrawlResultsBtn.textContent = "Copied";
  setTimeout(() => {
    copyCrawlResultsBtn.textContent = "Copy Ops";
  }, 1200);
});

downloadCrawlResultsBtn.addEventListener("click", () => {
  if (!hasExportableGrowthOpsResult) {
    return;
  }
  const payload = (lastCrawlResultsText || "").trim();
  if (!payload) {
    return;
  }

  const blob = new Blob([payload], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "amplitude-growth-opportunities.md";
  a.click();
  URL.revokeObjectURL(url);
});

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for Glean tab to load"));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

sendToGleanBtn.addEventListener("click", async () => {
  const prompt = architecturePromptText.value.trim();
  if (!prompt) {
    return;
  }

  console.log("[Amplitude Lens] Send to Glean - button clicked");
  console.log("[Amplitude Lens] Send to Glean - prompt payload", prompt);
  console.log("[Amplitude Lens] Send to Glean - prompt length", prompt.length);

  try {
    sendToGleanBtn.disabled = true;
    sendToGleanBtn.textContent = "Opening Glean...";

    const tab = await chrome.tabs.create({
      url: "https://app.glean.com/chat",
      active: false
    });

    await waitForTabComplete(tab.id);

    sendToGleanBtn.textContent = "Injecting prompt...";

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (promptText) => {
        const selectors = [
          '[aria-label="Explore a topic…"]',
          '.ql-editor[contenteditable="true"]',
          '[data-placeholder="Explore a topic…"]',
          'div[contenteditable="true"]'
        ];

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const escapeHtml = (value) =>
          value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

        const waitForElement = (selector, timeout = 8000) =>
          new Promise((resolve, reject) => {
            const intervalId = setInterval(() => {
              const el = document.querySelector(selector);
              if (el) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(el);
              }
            }, 200);

            const timeoutId = setTimeout(() => {
              clearInterval(intervalId);
              reject(new Error(`Element not found for selector: ${selector}`));
            }, timeout);
          });

        let editor = null;
        for (const selector of selectors) {
          try {
            editor = await waitForElement(selector, 5000);
            break;
          } catch (_error) {
            // Try next selector
          }
        }

        if (!editor) {
          return { ok: false, reason: "Glean editor not found" };
        }

        editor.focus();
        const html = promptText
          .split("\n")
          .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
          .join("");
        editor.innerHTML = html;
        editor.dispatchEvent(new Event("input", { bubbles: true }));

        await sleep(300);
        editor.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true
          })
        );

        return { ok: true };
      },
      args: [prompt]
    });

    if (!result || !result.ok) {
      throw new Error(result && result.reason ? result.reason : "Could not inject prompt");
    }

    console.log("[Amplitude Lens] Send to Glean - injection success", result);

    sendToGleanBtn.textContent = "Sent to Glean";
    setTimeout(() => {
      sendToGleanBtn.textContent = "Send to Glean";
      sendToGleanBtn.disabled = false;
    }, 1400);
  } catch (error) {
    console.error("[Amplitude Lens] Send to Glean - injection failed", {
      error: error.message,
      prompt
    });
    updateStackHint.textContent = `Send to Glean failed: ${error.message}`;
    sendToGleanBtn.textContent = "Send to Glean";
    sendToGleanBtn.disabled = false;
  }
});

updateStackTechBtn.addEventListener("click", async () => {
  const command = "node scripts/update-stack-technologies.mjs";
  await navigator.clipboard.writeText(command);
  updateStackHint.textContent =
    `Command copied: ${command}. Run it in the project root, then reload the extension.`;
});
