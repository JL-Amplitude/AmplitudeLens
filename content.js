(async function () {
  let enthecTechnologiesPromise = null;

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response || null);
      });
    });
  }

  async function loadEnthecTechnologies() {
    if (!enthecTechnologiesPromise) {
      const url = chrome.runtime.getURL("resources/enthec/technologies.json");
      enthecTechnologiesPromise = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Could not load resources/enthec/technologies.json");
          }
          return response.json();
        })
        .then((payload) => payload.technologies || {});
    }
    return enthecTechnologiesPromise;
  }

  function parsePatternValue(value) {
    if (Array.isArray(value)) {
      return value.flatMap((item) => parsePatternValue(item));
    }
    if (typeof value === "object" && value !== null) {
      if ("pattern" in value) {
        return parsePatternValue(value.pattern);
      }
      return [];
    }
    if (typeof value !== "string") {
      return [];
    }

    if (value.includes("\\;")) {
      return [value.split("\\;")[0]];
    }
    if (value.includes(";confidence:") || value.includes(";version:")) {
      return [value.split(";")[0]];
    }

    return [value];
  }

  function regexMatch(candidate, pattern) {
    try {
      return new RegExp(pattern, "i").test(candidate);
    } catch (_error) {
      return candidate.toLowerCase().includes(String(pattern).toLowerCase());
    }
  }

  function matchesAnyPattern(candidate, patternValue) {
    const patterns = parsePatternValue(patternValue);
    if (!patterns.length) {
      return false;
    }

    return patterns.some((pattern) => regexMatch(candidate, pattern));
  }

  function getGlobalValue(path) {
    const parts = path.split(".");
    let value = window;
    for (const part of parts) {
      if (value == null || !(part in value)) {
        return undefined;
      }
      value = value[part];
    }
    return value;
  }

  function categorizeTechnologyName(name, categories) {
    const lower = name.toLowerCase();

    if (
      /analytics|amplitude|google analytics|gtm|mixpanel|segment|posthog|heap|hotjar|matomo/.test(lower)
    ) {
      categories.analytics.add(name);
      return;
    }

    if (
      /react|next\.js|nextjs|vue|angular|nuxt|svelte|ember|jquery|gatsby/.test(lower)
    ) {
      categories.frontend.add(name);
      return;
    }

    if (/nginx|apache|express|node\.js|ruby|php|laravel|django|flask|spring|rails/.test(lower)) {
      categories.backend.add(name);
      return;
    }

    if (/cloudflare|fastly|cloudfront|vercel|netlify|aws|azure|gcp|akamai/.test(lower)) {
      categories.infrastructure.add(name);
      return;
    }

    categories.otherTools.add(name);
  }

  async function detectWithEnthec(pageUrl, headerEntries) {
    const technologies = await loadEnthecTechnologies();
    const detected = [];

    const scripts = [...document.querySelectorAll("script[src]")].map((script) =>
      (script.src || "").toLowerCase()
    );
    const html = document.documentElement ? document.documentElement.outerHTML : "";
    const metaMap = {};
    [...document.querySelectorAll("meta[name],meta[property]")].forEach((meta) => {
      const key = (meta.getAttribute("name") || meta.getAttribute("property") || "").toLowerCase();
      if (!key) {
        return;
      }
      metaMap[key] = meta.getAttribute("content") || "";
    });

    const mergedHeaders = {};
    headerEntries.forEach((entry) => {
      const headers = entry.headers || {};
      Object.entries(headers).forEach(([name, value]) => {
        mergedHeaders[name.toLowerCase()] = String(value || "");
      });
    });

    for (const [name, definition] of Object.entries(technologies)) {
      let matched = false;

      if (!matched && definition.url && matchesAnyPattern(pageUrl, definition.url)) {
        matched = true;
      }

      if (!matched && definition.scriptSrc) {
        matched = scripts.some((src) => matchesAnyPattern(src, definition.scriptSrc));
      }

      if (!matched && definition.html) {
        matched = matchesAnyPattern(html, definition.html);
      }

      if (!matched && definition.headers && typeof definition.headers === "object") {
        matched = Object.entries(definition.headers).some(([headerName, headerPattern]) => {
          const headerValue = mergedHeaders[headerName.toLowerCase()];
          return Boolean(headerValue && matchesAnyPattern(headerValue, headerPattern));
        });
      }

      if (!matched && definition.meta && typeof definition.meta === "object") {
        matched = Object.entries(definition.meta).some(([metaName, metaPattern]) => {
          const metaValue = metaMap[metaName.toLowerCase()];
          return Boolean(metaValue && matchesAnyPattern(metaValue, metaPattern));
        });
      }

      if (!matched && definition.js && typeof definition.js === "object") {
        matched = Object.entries(definition.js).some(([globalPath, jsPattern]) => {
          const globalValue = getGlobalValue(globalPath);
          if (globalValue === undefined) {
            return false;
          }
          if (!jsPattern) {
            return true;
          }
          return matchesAnyPattern(String(globalValue), jsPattern);
        });
      }

      if (matched) {
        detected.push(name);
      }
    }

    return detected;
  }

  function detectFromHeaders(entries) {
    const backend = new Set();
    const infrastructure = new Set();
    const cdn = new Set();
    const evidence = [];

    entries.forEach((entry) => {
      const headers = entry.headers || {};
      const server = (headers.server || "").toLowerCase();
      const poweredBy = (headers["x-powered-by"] || "").toLowerCase();
      const via = (headers.via || "").toLowerCase();

      if (server.includes("nginx")) backend.add("Nginx");
      if (server.includes("apache")) backend.add("Apache");
      if (server.includes("cloudflare")) cdn.add("Cloudflare");
      if (server.includes("vercel")) infrastructure.add("Vercel");
      if (server.includes("netlify")) infrastructure.add("Netlify");
      if (poweredBy.includes("express")) backend.add("Express");
      if (poweredBy.includes("next.js")) backend.add("Next.js");
      if (via.includes("fastly")) cdn.add("Fastly");
      if (headers["x-vercel-id"]) infrastructure.add("Vercel");
      if (headers["cf-ray"]) cdn.add("Cloudflare");
      if (headers["x-amz-cf-id"] || headers["x-amz-cf-pop"]) cdn.add("AWS CloudFront");

      if (Object.keys(headers).length > 0) {
        evidence.push({
          url: entry.url,
          server: headers.server || null,
          poweredBy: headers["x-powered-by"] || null
        });
      }
    });

    return {
      backend,
      infrastructure,
      cdn,
      evidence
    };
  }

  function detectClientTech() {
    const frontend = new Set();
    const analytics = new Set();
    const otherTools = new Set();
    const hints = [];

    const scripts = [...document.querySelectorAll("script[src]")].map((script) =>
      (script.src || "").toLowerCase()
    );
    const inlineScripts = [...document.querySelectorAll("script:not([src])")]
      .map((script) => (script.textContent || "").toLowerCase())
      .join("\n");
    const html = document.documentElement ? document.documentElement.innerHTML.toLowerCase() : "";

    const pushHint = (label) => hints.push(label);

    if (
      window.React ||
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
      scripts.some((src) => src.includes("react"))
    ) {
      frontend.add("React");
      pushHint("React global/script detected");
    }
    if (window.__NEXT_DATA__ || scripts.some((src) => src.includes("_next"))) {
      frontend.add("Next.js");
      pushHint("Next.js runtime marker detected");
    }
    if (window.Vue || window.__VUE__ || scripts.some((src) => src.includes("vue"))) {
      frontend.add("Vue");
      pushHint("Vue global/script detected");
    }
    if (window.angular || scripts.some((src) => src.includes("angular"))) {
      frontend.add("Angular");
      pushHint("Angular global/script detected");
    }
    if (window.__NUXT__ || scripts.some((src) => src.includes("nuxt"))) {
      frontend.add("Nuxt");
      pushHint("Nuxt runtime marker detected");
    }
    if (window.jQuery || scripts.some((src) => src.includes("jquery"))) {
      frontend.add("jQuery");
      pushHint("jQuery detected");
    }

    if (window.amplitude || scripts.some((src) => src.includes("amplitude"))) {
      analytics.add("Amplitude");
      pushHint("Amplitude runtime/script detected");
    }
    if (window.gtag || window.dataLayer || scripts.some((src) => src.includes("googletagmanager"))) {
      analytics.add("Google Analytics / GTM");
      pushHint("Google Analytics/GTM runtime detected");
    }
    if (window.mixpanel || scripts.some((src) => src.includes("mixpanel"))) {
      analytics.add("Mixpanel");
      pushHint("Mixpanel runtime/script detected");
    }
    if (window.analytics || scripts.some((src) => src.includes("segment"))) {
      analytics.add("Segment");
      pushHint("Segment runtime/script detected");
    }
    if (window.posthog || scripts.some((src) => src.includes("posthog"))) {
      analytics.add("PostHog");
      pushHint("PostHog runtime/script detected");
    }

    if (window.Intercom || scripts.some((src) => src.includes("intercom"))) {
      otherTools.add("Intercom");
      pushHint("Intercom detected");
    }
    if (scripts.some((src) => src.includes("hotjar")) || inlineScripts.includes("hotjar")) {
      otherTools.add("Hotjar");
      pushHint("Hotjar detected");
    }

    const likelyAuthenticatedState = /(logout|sign out|my account|workspace|dashboard)/i.test(html);

    return {
      frontend,
      analytics,
      otherTools,
      hints,
      likelyAuthenticatedState
    };
  }

  function buildStackFingerprint(headerSignals, clientSignals) {
    const categories = {
      frontend: [...clientSignals.frontend],
      analytics: [...clientSignals.analytics],
      backend: [...headerSignals.backend],
      infrastructure: [...headerSignals.infrastructure],
      cdn: [...headerSignals.cdn],
      otherTools: [...clientSignals.otherTools]
    };

    const flattened = [
      ...categories.frontend,
      ...categories.analytics,
      ...categories.backend,
      ...categories.infrastructure,
      ...categories.cdn,
      ...categories.otherTools
    ];

    return {
      categories,
      detectedStack: [...new Set(flattened)],
      likelyAuthenticatedState: clientSignals.likelyAuthenticatedState,
      evidence: {
        headerEvidence: headerSignals.evidence.slice(-10),
        runtimeHints: clientSignals.hints
      }
    };
  }

  function fillPromptTemplate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      if (!(key in variables)) {
        return "";
      }
      return variables[key];
    });
  }

  async function buildArchitecturePrompt(stackFingerprint, pageUrl) {
    const stackList = stackFingerprint.detectedStack.length
      ? stackFingerprint.detectedStack.join(", ")
      : "Unknown stack";

    const prompts = await globalThis.AMPLITUDE_LENS_PROMPTS.load();
    const template = prompts.stackArchitecture || "";

    return fillPromptTemplate(template, {
      STACK_LIST: stackList,
      PAGE_URL: pageUrl,
      FRONTEND: stackFingerprint.categories.frontend.join(", ") || "Unknown",
      BACKEND: stackFingerprint.categories.backend.join(", ") || "Unknown",
      INFRASTRUCTURE_CDN:
        [...stackFingerprint.categories.infrastructure, ...stackFingerprint.categories.cdn].join(", ") ||
        "Unknown",
      ANALYTICS: stackFingerprint.categories.analytics.join(", ") || "None detected",
      AUTHENTICATED_STATE: stackFingerprint.likelyAuthenticatedState ? "Yes" : "No"
    });
  }

  async function detectTechStack(pageUrl) {
    const headerResponse = await sendRuntimeMessage({ type: "GET_TAB_NETWORK_HEADERS" });
    const headerEntries = headerResponse && Array.isArray(headerResponse.entries)
      ? headerResponse.entries
      : [];

    const headerSignals = detectFromHeaders(headerEntries);
    const clientSignals = detectClientTech();
    const enthecMatches = await detectWithEnthec(pageUrl, headerEntries);
    enthecMatches.forEach((technology) => {
      categorizeTechnologyName(technology, {
        frontend: clientSignals.frontend,
        analytics: clientSignals.analytics,
        backend: headerSignals.backend,
        infrastructure: headerSignals.infrastructure,
        otherTools: clientSignals.otherTools
      });
    });
    clientSignals.hints.push(
      `Enthec pattern matches: ${enthecMatches.length}`
    );
    const fingerprint = buildStackFingerprint(headerSignals, clientSignals);
    fingerprint.patternMatches = enthecMatches;
    const architecturePrompt = await buildArchitecturePrompt(fingerprint, pageUrl);

    return {
      stackFingerprint: fingerprint,
      architecturePrompt
    };
  }

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

    console.log("[Amplitude Lens] Page data to crawl (DOM extract)", pageData);

    const context = globalThis.AMPLITUDE_LENS_CONTEXT || {};
    const state = await chrome.storage.local.get([
      "amplitudeMcpServer",
      "useEuDataResidency",
      "selectedClaudeModel",
      "developmentMode",
      "crawlMode",
      "providedTaxonomyCsv"
    ]);
    const claudeConfig = globalThis.AMPLITUDE_LENS_CLAUDE_CONFIG || {};
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
    const developmentMode = Boolean(state.developmentMode);
    const crawlMode =
      state.crawlMode === "deep" || state.crawlMode === "provided"
        ? state.crawlMode
        : "quick";
    const providedTaxonomyCsv = state.providedTaxonomyCsv || "";

    const crawledPagePayload = {
      ...pageData,
      region,
      amplitudeMcpServer,
      mcpServerUrl
    };

    let crawlAnalysis = null;
    let techStackDiscovery = null;
    let architecturePrompt = "";

    if (developmentMode) {
      console.log(
        "[Amplitude Lens] Development mode enabled: running tech stack discovery only"
      );
      const techStackOutput = await detectTechStack(pageData.url);
      techStackDiscovery = techStackOutput.stackFingerprint;
      architecturePrompt = techStackOutput.architecturePrompt;
    } else {
      console.log(
        "[Amplitude Lens] About to call orchestrator with crawled page payload",
        crawledPagePayload
      );

      crawlAnalysis = await globalThis.AMPLITUDE_LENS_ORCHESTRATOR.run({
        pageData: crawledPagePayload,
        model: selectedClaudeModel,
        crawlMode,
        providedTaxonomyCsv
      });
    }

    const finalData = {
      mode: developmentMode ? "development" : "full",
      crawlAnalysis,
      techStackDiscovery,
      architecturePrompt
    };

    console.log(
      "[Amplitude Lens] Execution finished; sending analysis to Chrome runtime",
      finalData
    );

    chrome.runtime.sendMessage({
      type: "PAGE_ANALYSIS",
      data: finalData
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