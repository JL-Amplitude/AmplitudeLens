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
      "useEuDataResidency",
      "selectedClaudeModel"
    ]);
    const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
    const useEuDataResidency = Boolean(state.useEuDataResidency);
    const selectedClaudeModel =
      state.selectedClaudeModel || claudeConfig.defaultModel || "claude-sonnet-4-6";

    const analysis = await globalThis.AMPLITUDE_LENS_ORCHESTRATOR.run({
      pageData: {
        ...pageData,
        region: useEuDataResidency ? "EU" : "US",
        mcpRegionUrl: useEuDataResidency
          ? context.MCP_EU_SERVER_REGION
          : context.MCP_US_SERVER_REGION
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