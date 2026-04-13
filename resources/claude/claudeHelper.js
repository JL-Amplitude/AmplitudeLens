(function () {
  function getClaudeConfig() {
    const config = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};

    if (!config.apiKey || !String(config.apiKey).trim()) {
      throw new Error(
        "Claude API key is missing. Open the extension popup → Claude Configuration and enter your key."
      );
    }

    return config;
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
    const config = getClaudeConfig();

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
