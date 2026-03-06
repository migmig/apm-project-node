function resolveApiKey() {
  const fromQuery = new URLSearchParams(window.location.search).get("apiKey");
  const fromStorage = window.localStorage.getItem("apm.apiKey");
  const apiKey = fromQuery || fromStorage || "";

  if (fromQuery && fromQuery !== fromStorage) {
    window.localStorage.setItem("apm.apiKey", fromQuery);
  }

  return apiKey;
}

export function withApiKey(url) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return url;
  }

  const requestUrl = new URL(url, window.location.origin);
  if (!requestUrl.searchParams.has("apiKey")) {
    requestUrl.searchParams.set("apiKey", apiKey);
  }

  return `${requestUrl.pathname}${requestUrl.search}`;
}

export async function fetchJson(url) {
  const response = await fetch(withApiKey(url));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
