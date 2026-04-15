(function () {
  const AMPLITUDE_LENS_PROMPT_FILES = {
    productAnalysis: "resources/prompts/productAnalysis.prompt",
    trackingPlan: "resources/prompts/trackingPlan.prompt",
    growthOps: "resources/prompts/growthOps.prompt",
    agcQuick: "resources/prompts/amplitude-growth-consultant/agc-quick.prompt",
    agcDeep: "resources/prompts/amplitude-growth-consultant/agc-deep.prompt",
    agcProvided: "resources/prompts/amplitude-growth-consultant/agc-provided.prompt",
    demoStoryline: "resources/prompts/demoStoryline.prompt",
    stackArchitecture: "resources/prompts/stackArchitecture.prompt"
  };

  async function loadPromptFile(relativePath) {
    const url = chrome.runtime.getURL(relativePath);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Could not load prompt file: ${relativePath}`);
    }

    return response.text();
  }

  async function loadAmplitudeLensPrompts() {
    const entries = await Promise.all(
      Object.entries(AMPLITUDE_LENS_PROMPT_FILES).map(async ([key, path]) => {
        const promptText = await loadPromptFile(path);
        return [key, promptText];
      })
    );

    return Object.fromEntries(entries);
  }

  globalThis.AMPLITUDE_LENS_PROMPTS = {
    load: loadAmplitudeLensPrompts
  };
})();
