(async function () {
  try {
    const pageData = {
      title: document.title,
      url: window.location.href,
      buttons: [...document.querySelectorAll("button")]
        .map((b) => b.innerText)
        .filter(Boolean),
      links: [...document.querySelectorAll("a")]
        .map((a) => a.innerText)
        .filter(Boolean)
        .slice(0, 30),
      forms: [...document.querySelectorAll("form")].length
    };

    const context = globalThis.AMPLITUDE_LENS_CONTEXT || {};
    const state = await chrome.storage.local.get([
      "amplitudeMcpServer",
      "useEuDataResidency",
      "selectedClaudeModel",
      "claudeApiKey"
    ]);
    const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
    const apiKeyFromPopup = (state.claudeApiKey || "").trim();
    globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG = {
      ...claudeConfig,
      apiKey: apiKeyFromPopup
    };
    let amplitudeMcpServer = state.amplitudeMcpServer;
    if (
      amplitudeMcpServer !== "MCP_US_SERVER_REGION" &&
      amplitudeMcpServer !== "MCP_EU_SERVER_REGION"
    ) {
      amplitudeMcpServer = state.useEuDataResidency
        ? "MCP_EU_SERVER_REGION"
        : "MCP_US_SERVER_REGION";
    }

    const mcpServerUrl =
      context[amplitudeMcpServer] || context.MCP_US_SERVER_REGION;
    const region = amplitudeMcpServer === "MCP_EU_SERVER_REGION" ? "EU" : "US";
    const selectedClaudeModel =
      state.selectedClaudeModel || claudeConfig.defaultModel || "claude-sonnet-4-6";

    const analysis = await globalThis.AMPLITUDE_LENS_ORCHESTRATOR.run({
      pageData: {
        ...pageData,
        region,
        amplitudeMcpServer,
        mcpServerUrl
      },
      model: selectedClaudeModel
    });

    chrome.runtime.sendMessage({
      type: "PAGE_ANALYSIS",
      data: analysis
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: "PAGE_ANALYSIS",
      data: {
        error: error.message
      }
    });
  }
})();