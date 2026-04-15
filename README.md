# AmplitudeLens
AI-powered product analytics discovery assistant. Chrome extension to crawl a customer site and generate a proper tracking plan demo-wise.

**What it does**

1. **On any site**
   - Infers product flows
   - Suggests tracking plan
   - Identifies growth opportunities
2. **One-click export to demo narrative**

**Stack:** Browser extension + Claude API + Amplitude MCP

**Use case:** Live during discovery/demo

## Icons
The extension uses the following icons:

- `icon16` — pinned toolbar button
- `icon32` — Windows taskbar / retina toolbar
- `icon48` — Extensions management page
- `icon128` — Chrome Web Store listing

## Architecture Flow
AmplitudeLens follows a simple client-orchestrator-analysis pipeline to inspect a page, run AI reasoning, and return actionable output to the popup UI.

1. **Chrome Extension**  
   The user starts a crawl from the popup.
2. **Extract page/app context**  
   A content script gathers contextual signals from the current page (URL, title, links, forms, and interaction elements).
3. **POST to Backend Orchestrator**  
   The extension sends the collected context as a JSON payload to the selected backend endpoint.
4. **Backend runs Claude Prompt Chain**  
   The backend executes a sequence of Claude prompts to interpret product behavior, infer tracking opportunities, and identify likely critical paths.
5. **Aggregate Structured Results**  
   Backend outputs are normalized into a structured analysis object.
6. **Return JSON to Extension UI**  
   The final JSON response is sent back to the extension and rendered in the popup for review.

## Prompts Execution Flow
The prompts should not run independently. They are chained logically because later prompts depend on outputs from earlier ones.

1. **Product Analysis Prompt**  
   ↓
2. **Tracking Plan Prompt**  
   ↓
3. **Growth Opportunities Prompt**  
   ↓
4. **Demo Storyline Prompt**

## Architecture stack discovery
AmplitudeLens enriches tech stack discovery with Enthec WebAppAnalyzer technology fingerprints bundled inside the extension.

- **Pattern source**  
  Technology definitions are fetched from `enthec/webappanalyzer` and merged at build time by `scripts/update-stack-technologies.mjs`.
- **Bundled for reliability**  
  The merged dataset is saved as `resources/enthec/technologies.json`, so detection runs offline and avoids runtime CORS/network issues.
- **Runtime matching**  
  During discovery mode, the extension evaluates Enthec patterns against the live page URL, response headers, script sources, DOM HTML, meta tags, and runtime globals.
- **Consolidated output**  
  Matches are grouped into a stack fingerprint and used to generate the architecture prompt that can be copied or downloaded for Glean.

## Available Claude Skills

### amplitude-growth-consultant
The `amplitude-growth-consultant` skill performs the following workflow:

- **URL only**  
  Automatically invokes the `taxonomy-discovery` skill first, then runs the full analysis.
- **URL + CSV taxonomy**  
  Jumps straight to analysis using the provided events.
- **Input modes**  
  Three input modes are supported:

| Mode | How to trigger | Turnaround | What happens |
| --- | --- | --- | --- |
| provided | URL + CSV taxonomy | Instant | Skips to analysis directly |
| quick (default) | URL only, or "quick/fast/brief" | < 60s | Infers 10–15 events inline from web research |
| deep | "deep/full/detailed/use turbodemo" | 5–10 min | Invokes turbodemo-taxonomy for a full CSV |
- **Output format**  
  Returns pure JSON designed for downstream consumption (for example this Chrome extension), with these fields:
  - `intro` — executive summary for display in a UI
  - `industry` + `taxonomy_source` — metadata
  - `friction_points` — 4–6 items with severity, evidence tied to taxonomy events, and industry benchmarks
  - `amplitude_use_cases` — up to 4, each naming a specific Amplitude blade and feature (Analytics, Experiment, Session Replay, Guides & Surveys, Amplitude AI)
  - `experiments` — 3–5 items with full if/then/because hypotheses, success/guardrail events, and the friction point they address

## FAQ

### Why Use a Backend Instead of Calling Claude Directly?

- **Security**  
  Never expose API keys in the extension frontend.
- **Prompt Orchestration**  
  Run multiple prompts sequentially or in parallel, and manage dependencies between prompts.
- **Caching / Logging**  
  Cache previous analyses and track latency or failures.
- **Future Extensibility**  
  Add integrations later (for example Salesforce, MCP, or Slack) without changing the extension architecture.
