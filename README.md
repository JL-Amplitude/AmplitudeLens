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
