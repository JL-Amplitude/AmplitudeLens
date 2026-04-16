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

  async function runAmplitudeLensPromptOrchestration({
    pageData,
    model,
    crawlMode = "quick",
    providedTaxonomyCsv = ""
  }) {
    const prompts = await globalThis.AMPLITUDE_LENS_PROMPTS.load();
    const growthPromptByMode = {
      quick: prompts.agcQuick,
      deep: prompts.agcDeep,
      provided: prompts.agcProvided
    };
    const selectedGrowthPrompt =
      growthPromptByMode[crawlMode] || growthPromptByMode.quick || prompts.growthOps;

    /*
    // Execute the product analysis prompt
    const productAnalysisPromise = executePromptStep({
      model,
      promptName: "productAnalysis",
      promptTemplate: prompts.productAnalysis,
      variables: { PAGE_DATA: pageData }
    });
    */

    // Execute the growth ops prompt
    console.log("[Amplitude Lens] Orchestration: Executing growth ops prompt", {
      crawlMode,
      promptTemplate: selectedGrowthPrompt
    });
    const growthOpsPromise = executePromptStep({
      model,
      promptName: "growthOps",
      promptTemplate: selectedGrowthPrompt,
      variables: {
        PAGE_DATA: pageData,
        PAGE_URL: pageData.url || "",
        CSV_TAXONOMY: providedTaxonomyCsv || ""
      }
    });
    let growthOps;
    try {
      growthOps = await growthOpsPromise;
      console.log("[Amplitude Lens] Orchestration: Growth ops prompt completed");
    } catch (error) {
      console.error("[Amplitude Lens] Orchestration: Growth ops prompt failed", error);
      throw error;
    }
    
    /*
    // Await for product analysis prompt to be completed
    const productAnalysis = await productAnalysisPromise;

    // Execute the tracking plan prompt
    const trackingPlanPromise = executePromptStep({
      model,
      promptName: "trackingPlan",
      promptTemplate: prompts.trackingPlan,
      variables: {
        JOURNEYS_JSON: productAnalysis
      }
    });
    */
    
    /*
    // Await for tracking plan and growth ops prompts to be completed
    const [trackingPlan, growthOps] = await Promise.all([
      trackingPlanPromise,
      growthOpsPromise
    ]);

    // Execute the demo storyline prompt
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
    */

    return {
      //productAnalysis,
      growthOps
      //trackingPlan,
      //demoStoryline
    };
  }

  globalThis.AMPLITUDE_LENS_ORCHESTRATOR = {
    run: runAmplitudeLensPromptOrchestration
  };
})();
