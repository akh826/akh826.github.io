const MOCK_STATUS_PARAM = "__mockStatus";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  204: "No Content",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  503: "Service Unavailable"
};

let cachedManifest = null;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (!requestUrl.pathname.includes("/api/")) {
    return;
  }

  const method = event.request.method.toUpperCase();
  const mockStatusRaw = requestUrl.searchParams.get(MOCK_STATUS_PARAM);
  const isMutating = MUTATING_METHODS.has(method);
  const isStatusOverride = Boolean(mockStatusRaw) && method === "GET";

  if (!isMutating && !isStatusOverride) {
    return;
  }

  event.respondWith(handleApiRequest(event.request, requestUrl, method, mockStatusRaw));
});

function getApiBaseUrl(requestUrl) {
  const marker = "/api/";
  const index = requestUrl.href.indexOf(marker);
  return requestUrl.href.slice(0, index + marker.length);
}

function getApiPath(requestUrl) {
  const marker = "/api/";
  const index = requestUrl.pathname.lastIndexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(requestUrl.pathname.slice(index + marker.length));
}

function normalizePath(path) {
  return path.replace(/^\/+|\/+$/g, "");
}

async function loadManifest(apiBaseUrl) {
  if (cachedManifest) {
    return cachedManifest;
  }

  const response = await fetch(`${apiBaseUrl}manifest.json`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Manifest not found");
  }

  cachedManifest = await response.json();
  return cachedManifest;
}

function findRoute(manifest, apiPath, method) {
  const normalizedPath = normalizePath(apiPath);

  return (manifest.endpoints ?? []).find((endpoint) => {
    const endpointMethod = (endpoint.method || "GET").toUpperCase();
    const endpointPath = normalizePath(endpoint.path);
    return endpointMethod === method && endpointPath === normalizedPath;
  });
}

async function readRequestPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (methodHasNoBody(request.method)) {
    return null;
  }

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartPayload(await request.formData());
  }

  const text = await request.text();

  if (!text) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function parseMultipartPayload(formData) {
  const fields = {};
  const files = [];

  formData.forEach((value, key) => {
    if (isFileLike(value)) {
      files.push({
        field: key,
        name: value.name || "untitled",
        size: value.size,
        type: value.type || "application/octet-stream"
      });
      return;
    }

    const textValue = String(value);

    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      if (!Array.isArray(fields[key])) {
        fields[key] = [fields[key]];
      }
      fields[key].push(textValue);
    } else {
      fields[key] = textValue;
    }
  });

  if (!Object.keys(fields).length && !files.length) {
    return null;
  }

  return files.length ? { fields, files } : { fields };
}

function isFileLike(value) {
  if (typeof File !== "undefined" && value instanceof File) {
    return true;
  }

  return typeof Blob !== "undefined" && value instanceof Blob && typeof value.name === "string";
}

function methodHasNoBody(method) {
  return method === "GET" || method === "HEAD";
}

function mergeEcho(payload, requestPayload, echoBody) {
  if (!echoBody || requestPayload === null || requestPayload === undefined) {
    return payload;
  }

  const merged = JSON.parse(JSON.stringify(payload));

  if (merged.data && typeof merged.data === "object" && !Array.isArray(merged.data)) {
    merged.data.received = requestPayload;
  } else {
    merged.received = requestPayload;
  }

  return merged;
}

async function loadResponseTemplate(apiBaseUrl, responsePath) {
  const response = await fetch(new URL(responsePath, apiBaseUrl).toString(), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Response template not found: ${responsePath}`);
  }

  return response.json();
}

function buildJsonResponse(payload, status) {
  const safeStatus = Number.isFinite(status) ? status : 200;
  const body = payload === null ? "" : JSON.stringify(payload, null, 2);

  return new Response(body, {
    status: safeStatus,
    statusText: STATUS_TEXT[safeStatus] || "",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Mock-API": "true",
      "X-Mock-Status": String(safeStatus)
    }
  });
}

async function handleMockMutation(request, requestUrl, route, mockStatusRaw, apiBaseUrl) {
  const requestPayload = await readRequestPayload(request);
  const template = await loadResponseTemplate(apiBaseUrl, route.responsePath);
  const payload = mergeEcho(template, requestPayload, route.echoBody);

  const status = mockStatusRaw
    ? Number.parseInt(mockStatusRaw, 10)
    : route.simulateStatus || 200;

  return buildJsonResponse(payload, status);
}

async function handleMockStatusGet(request, requestUrl, mockStatusRaw) {
  const cleanUrl = new URL(requestUrl);
  cleanUrl.searchParams.delete(MOCK_STATUS_PARAM);

  const status = Number.parseInt(mockStatusRaw, 10);
  const safeStatus = Number.isFinite(status) ? status : 200;

  const upstream = await fetch(cleanUrl.toString(), {
    method: request.method,
    headers: request.headers,
    cache: "no-store"
  });

  const body = await upstream.text();
  const headers = new Headers(upstream.headers);
  headers.set("X-Mock-Status", String(safeStatus));
  headers.set("X-Mock-API", "true");

  return new Response(body, {
    status: safeStatus,
    statusText: STATUS_TEXT[safeStatus] || "",
    headers
  });
}

async function handleApiRequest(request, requestUrl, method, mockStatusRaw) {
  const apiBaseUrl = getApiBaseUrl(requestUrl);
  const apiPath = getApiPath(requestUrl);

  if (MUTATING_METHODS.has(method)) {
    try {
      const manifest = await loadManifest(apiBaseUrl);
      const route = findRoute(manifest, apiPath, method);

      if (route?.responsePath) {
        return handleMockMutation(request, requestUrl, route, mockStatusRaw, apiBaseUrl);
      }

      return buildJsonResponse(
        {
          success: false,
          error: {
            code: "ROUTE_NOT_FOUND",
            message: `No mock route for ${method} ${apiPath}`,
            status: 404
          }
        },
        mockStatusRaw ? Number.parseInt(mockStatusRaw, 10) : 404
      );
    } catch (error) {
      return buildJsonResponse(
        {
          success: false,
          error: {
            code: "MOCK_HANDLER_ERROR",
            message: error instanceof Error ? error.message : "Mock handler failed",
            status: 500
          }
        },
        500
      );
    }
  }

  if (mockStatusRaw && method === "GET") {
    return handleMockStatusGet(request, requestUrl, mockStatusRaw);
  }

  return fetch(request);
}
