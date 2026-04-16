(function () {
  const CLAUDE_API_KEY_SESSION_KEY = "claudeApiKey";

  async function getClaudeConfigForRequest() {
    const base = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
    const runtimeApiKey = String(
      (globalThis.AMPLITUDE_LENS_RUNTIME && globalThis.AMPLITUDE_LENS_RUNTIME.claudeApiKey) || ""
    ).trim();
    let apiKey = runtimeApiKey;

    if (!apiKey) {
      try {
        const sessionData = await chrome.storage.session.get(CLAUDE_API_KEY_SESSION_KEY);
        apiKey = String(sessionData[CLAUDE_API_KEY_SESSION_KEY] || "").trim();
      } catch (_error) {
        // In some injection contexts storage.session access is restricted.
      }
    }

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

  async function sendClaudeRequestViaBackground({ url, headers, body }) {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "CLAUDE_MESSAGES_REQUEST",
          url,
          headers,
          body
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });

    if (!result || !result.ok) {
      const details =
        result && result.error
          ? result.error
          : JSON.stringify(result && result.payload ? result.payload : {});
      throw new Error(`Claude API request failed (${result ? result.status : 0}): ${details}`);
    }

    return result.payload;
  }

  async function executeClaudePrompt({
    prompt,
    model,
    maxTokens = 2200,
    temperature = 0.2
  }) {
    const config = await getClaudeConfigForRequest();
    const payload = await sendClaudeRequestViaBackground({
      url: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: {
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
      }
    });
    return extractClaudeText(payload);
  }

  globalThis.AMPLITUDE_LENS_CLAUDE = {
    executePrompt: executeClaudePrompt
  };
})();
