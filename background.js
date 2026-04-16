const MAX_HEADERS_PER_TAB = 150;
const tabHeaders = new Map();

function normalizeHeaders(headers) {
  if (!Array.isArray(headers)) {
    return {};
  }

  const normalized = {};
  headers.forEach((header) => {
    const name = (header.name || "").toLowerCase();
    if (!name) {
      return;
    }
    normalized[name] = header.value || "";
  });

  return normalized;
}

function trackHeaders(details) {
  if (details.tabId < 0) {
    return;
  }

  const snapshot = {
    url: details.url,
    type: details.type,
    statusCode: details.statusCode,
    headers: normalizeHeaders(details.responseHeaders)
  };

  const list = tabHeaders.get(details.tabId) || [];
  list.push(snapshot);

  if (list.length > MAX_HEADERS_PER_TAB) {
    list.splice(0, list.length - MAX_HEADERS_PER_TAB);
  }

  tabHeaders.set(details.tabId, list);
}

chrome.webRequest.onCompleted.addListener(
  trackHeaders,
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHeaders.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_NETWORK_HEADERS") {
    const tabId = sender.tab ? sender.tab.id : -1;
    sendResponse({
      entries: tabId >= 0 ? tabHeaders.get(tabId) || [] : []
    });
    return;
  }

  if (message.type === "CLAUDE_MESSAGES_REQUEST") {
    (async () => {
      try {
        const response = await fetch(message.url, {
          method: "POST",
          headers: message.headers || {},
          body: JSON.stringify(message.body || {})
        });

        const responseText = await response.text();
        let payload;
        try {
          payload = JSON.parse(responseText);
        } catch (_error) {
          payload = responseText;
        }

        sendResponse({
          ok: response.ok,
          status: response.status,
          payload
        });
      } catch (error) {
        sendResponse({
          ok: false,
          status: 0,
          error: error.message
        });
      }
    })();

    return true;
  }
});
