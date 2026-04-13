(function () {
  const CLAUDE_API_KEY_SESSION_KEY = "claudeApiKey";

  async function getClaudeConfigForRequest() {
    const base = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
    const sessionData = await chrome.storage.session.get(CLAUDE_API_KEY_SESSION_KEY);
    const apiKey = String(sessionData[CLAUDE_API_KEY_SESSION_KEY] || "").trim();

    if (!apiKey) {
      throw new Error(
        "Claude API key is missing. Open the extension popup → Lens Configuration and enter your key."
      );
    }

    return {
      apiUrl: base.apiUrl,
      anthropicVersion: base.anthropicVersion,
      defaultModel: base.defaultModel,
      user: base.user,
      role: base.role,
      apiKey
    };
  }

  function extractClaudeText(responseJson) {
    if (!responseJson || !Array.isArray(responseJson.content)) {
      throw new Error("Unexpected Claude response format");
    }

    const textParts = responseJson.content
      .filter((item) => item && item.type === "text")
      .map((item) => item.text)
      .filter(Boolean);

    return textParts.join("\n").trim();
  }

  async function executeClaudePrompt({
    prompt,
    model,
    maxTokens = 2200,
    temperature = 0.2
  }) {
    const config = await getClaudeConfigForRequest();

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion
      },
      body: JSON.stringify({
        model: model || config.defaultModel,
        max_tokens: maxTokens,
        temperature,
        system: `You are ${config.role}.`,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        metadata: {
          user_id: config.user
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return extractClaudeText(payload);
  }

  globalThis.AMPLITUDE_LENS_CLAUDE = {
    executePrompt: executeClaudePrompt
  };
})();
