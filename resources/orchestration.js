(function () {
  function applyPromptVariables(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      if (!(key in variables)) {
        return "";
      }

      const value = variables[key];
      return typeof value === "string" ? value : JSON.stringify(value, null, 2);
    });
  }

  function tryParseJsonValue(value) {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }

  async function executePromptStep({
    model,
    promptName,
    promptTemplate,
    variables
  }) {
    console.log(
      `[Amplitude Lens] Orchestration: starting prompt step "${promptName}" (model: ${model || "default"})`
    );

    try {
      const resolvedPrompt = applyPromptVariables(promptTemplate, variables);

      const rawResult = await globalThis.AMPLITUDE_LENS_CLAUDE.executePrompt({
        prompt: resolvedPrompt,
        model
      });

      const parsed = tryParseJsonValue(rawResult);

      console.log(
        `[Amplitude Lens] Orchestration: finished prompt step "${promptName}"`,
        parsed
      );

      return parsed;
    } catch (error) {
      console.error(
        `[Amplitude Lens] Orchestration: prompt step "${promptName}" failed`,
        error
      );
      throw error;
    }
  }

  async function runAmplitudeLensPromptOrchestration({ pageData, model }) {
    const prompts = await globalThis.AMPLITUDE_LENS_PROMPTS.load();

    const productAnalysisPromise = executePromptStep({
      model,
      promptName: "productAnalysis",
      promptTemplate: prompts.productAnalysis,
      variables: { PAGE_DATA: pageData }
    });

    const growthOpsPromise = executePromptStep({
      model,
      promptName: "growthOps",
      promptTemplate: prompts.growthOps,
      variables: { PAGE_DATA: pageData }
    });

    const productAnalysis = await productAnalysisPromise;

    const trackingPlanPromise = executePromptStep({
      model,
      promptName: "trackingPlan",
      promptTemplate: prompts.trackingPlan,
      variables: {
        JOURNEYS_JSON: productAnalysis
      }
    });

    const [trackingPlan, growthOps] = await Promise.all([
      trackingPlanPromise,
      growthOpsPromise
    ]);

    const demoStoryline = await executePromptStep({
      model,
      promptName: "demoStoryline",
      promptTemplate: prompts.demoStoryline,
      variables: {
        FULL_ANALYSIS: {
          productAnalysis,
          trackingPlan,
          growthOps
        }
      }
    });

    return {
      productAnalysis,
      growthOps,
      trackingPlan,
      demoStoryline
    };
  }

  globalThis.AMPLITUDE_LENS_ORCHESTRATOR = {
    run: runAmplitudeLensPromptOrchestration
  };
})();
