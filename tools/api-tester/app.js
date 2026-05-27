function getStaticApiBaseUrl() {
    return new URL("./api/", window.location.href).href;
}

function resolveStaticEndpointUrl(path) {
    return new URL(path, getStaticApiBaseUrl()).href;
}

const MOCK_STATUS_PARAM = "__mockStatus";
let staticApiManifest = null;
let mockApiSwActive = false;

function isStaticApiUrl(urlString) {
    try {
        const target = new URL(urlString, window.location.href);
        const apiBase = new URL(getStaticApiBaseUrl());
        return target.href.startsWith(apiBase.href);
    } catch {
        return false;
    }
}

function getMockStatusSelectValue() {
    return document.getElementById("staticApiMockStatus")?.value || "auto";
}

function getEffectiveMockStatus(urlString) {
    if (!isStaticApiUrl(urlString)) {
        return null;
    }

    const selectValue = getMockStatusSelectValue();

    if (selectValue !== "auto") {
        return Number.parseInt(selectValue, 10);
    }

    const preset = getSelectedStaticPreset();
    if (preset?.simulateStatus) {
        return preset.simulateStatus;
    }

    return 200;
}

function buildRequestUrlWithMockStatus(urlString) {
    const mockStatus = getEffectiveMockStatus(urlString);

    if (!mockStatus || mockStatus === 200) {
        try {
            const url = new URL(urlString, window.location.href);
            url.searchParams.delete(MOCK_STATUS_PARAM);
            return url.toString();
        } catch {
            return urlString;
        }
    }

    const url = new URL(urlString, window.location.href);
    url.searchParams.set(MOCK_STATUS_PARAM, String(mockStatus));
    return url.toString();
}

function getStatusText(status) {
    const map = {
        200: "OK",
        201: "Created",
        204: "No Content",
        403: "Forbidden",
        404: "Not Found",
        422: "Unprocessable Entity",
        500: "Internal Server Error",
        503: "Service Unavailable"
    };

    return map[status] || "";
}

async function registerMockApiServiceWorker() {
    const help = document.getElementById("mockStatusHelp");

    if (!("serviceWorker" in navigator)) {
        if (help) {
            help.textContent = "Service workers unavailable — status is simulated in the response panel only.";
        }
        return;
    }

    if (window.location.protocol === "file:") {
        if (help) {
            help.textContent = "Open via localhost or GitHub Pages to simulate real HTTP status codes.";
        }
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register("./mock-api-sw.js", {
            scope: "./"
        });

        await navigator.serviceWorker.ready;
        mockApiSwActive = Boolean(registration.active);

        if (help) {
            help.textContent = mockApiSwActive
                ? "Mock API active — GET/POST/PUT/DELETE routes and status simulation are handled by the service worker."
                : "Registering mock API service worker…";
        }
    } catch {
        mockApiSwActive = false;
        if (help) {
            help.textContent = "Could not register service worker — status is simulated in the response panel only.";
        }
    }
}

function getStaticApiPath(urlString) {
    try {
        const target = new URL(urlString, window.location.href);
        const apiBase = new URL(getStaticApiBaseUrl());

        if (!target.href.startsWith(apiBase.href)) {
            return null;
        }

        return decodeURIComponent(target.href.slice(apiBase.href.length).replace(/^\//, "").split("?")[0]);
    } catch {
        return null;
    }
}

function findStaticApiRoute(urlString, method) {
    if (!staticApiManifest?.endpoints) {
        return null;
    }

    const apiPath = getStaticApiPath(urlString);

    if (!apiPath) {
        return null;
    }

    const normalizedMethod = method.toUpperCase();

    return staticApiManifest.endpoints.find((endpoint) => {
        const endpointMethod = (endpoint.method || "GET").toUpperCase();
        const endpointPath = endpoint.path.replace(/^\/+|\/+$/g, "");
        return endpointMethod === normalizedMethod && endpointPath === apiPath.replace(/^\/+|\/+$/g, "");
    }) || null;
}

function isMutatingMethod(method) {
    return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function parseFormDataPayload(formData) {
    const fields = {};
    const files = [];

    formData.forEach((value, key) => {
        if (value instanceof File) {
            files.push({
                field: key,
                name: value.name,
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

function serializeRequestBody(body) {
    if (body === undefined || body === null) {
        return null;
    }

    if (body instanceof FormData) {
        return parseFormDataPayload(body);
    }

    if (typeof body === "string") {
        if (!body.trim()) {
            return null;
        }

        try {
            return JSON.parse(body);
        } catch {
            return body;
        }
    }

    return body;
}

function mergeEchoIntoPayload(payload, requestPayload) {
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
        payload.data.received = requestPayload;
    } else {
        payload.received = requestPayload;
    }

    return payload;
}

async function buildMockMutationPayload(route, body) {
    const response = await fetch(resolveStaticEndpointUrl(route.responsePath));

    if (!response.ok) {
        throw new Error(`Response template not found: ${route.responsePath}`);
    }

    const payload = await response.json();

    if (!route.echoBody) {
        return payload;
    }

    const requestPayload = serializeRequestBody(body);

    if (requestPayload === null) {
        return payload;
    }

    return mergeEchoIntoPayload(payload, requestPayload);
}

function updateStaticPresetButton() {
    const button = document.getElementById("sendStaticPresetBtn");
    const preset = getSelectedStaticPreset();

    if (!button) {
        return;
    }

    button.textContent = preset?.method ? `Send ${preset.method}` : "Send request";
}

async function loadStaticApiManifest() {
    const presetSelect = document.getElementById("staticApiPreset");
    const desc = document.getElementById("staticApiDesc");

    if (!presetSelect) {
        return;
    }

    try {
        const response = await fetch(resolveStaticEndpointUrl("manifest.json"));
        if (!response.ok) {
            throw new Error("Manifest not found");
        }

        staticApiManifest = await response.json();
        const endpoints = staticApiManifest.endpoints ?? [];

        endpoints.forEach((endpoint) => {
            const option = document.createElement("option");
            option.value = endpoint.path;
            option.textContent = `${endpoint.method} ${endpoint.title}`;
            option.dataset.description = endpoint.description || "";
            option.dataset.method = endpoint.method || "GET";
            if (endpoint.simulateStatus) {
                option.dataset.simulateStatus = String(endpoint.simulateStatus);
            }
            presetSelect.appendChild(option);
        });

        if (desc && staticApiManifest.description) {
            desc.textContent = staticApiManifest.description;
        }

        updateStaticPresetButton();
    } catch {
        if (desc) {
            desc.textContent = "Static API manifest could not be loaded. Open this tool via a web server or GitHub Pages.";
        }
    }
}

function getSelectedStaticPreset() {
    const presetSelect = document.getElementById("staticApiPreset");
    if (!presetSelect || !presetSelect.value) {
        return null;
    }

    const selectedOption = presetSelect.selectedOptions[0];
    const method = selectedOption?.dataset.method || "GET";
    const endpoint = staticApiManifest?.endpoints?.find(
        (item) => item.path === presetSelect.value && (item.method || "GET") === method
    );
    const simulateStatus = endpoint?.simulateStatus
        ?? (selectedOption?.dataset.simulateStatus
            ? Number.parseInt(selectedOption.dataset.simulateStatus, 10)
            : null);

    return {
        path: presetSelect.value,
        method,
        description: endpoint?.description || selectedOption?.dataset.description || "",
        simulateStatus,
        sampleBody: endpoint?.sampleBody || "",
        responsePath: endpoint?.responsePath || "",
        echoBody: Boolean(endpoint?.echoBody),
        url: resolveStaticEndpointUrl(presetSelect.value)
    };
}

function updateStaticEndpointHint() {
    const hint = document.getElementById("staticApiEndpointHint");
    const preset = getSelectedStaticPreset();

    if (!hint) {
        return;
    }

    if (!preset) {
        hint.hidden = true;
        hint.textContent = "";
        return;
    }

    hint.hidden = false;

    const mockStatus = getEffectiveMockStatus(preset.url);
    const statusNote =
        mockStatus && mockStatus !== 200
            ? ` | simulated status ${mockStatus} ${getStatusText(mockStatus)}`.trim()
            : "";

    hint.textContent = `${preset.method} ${preset.url}${statusNote}${preset.description ? ` — ${preset.description}` : ""}`;
}

function loadStaticPresetIntoRequest() {
    const preset = getSelectedStaticPreset();

    if (!preset) {
        setStatus("Select a static API preset first.");
        return;
    }

    const methodSelect = document.getElementById("requestMethod");
    const urlInput = document.getElementById("requestUrl");
    const bodyType = document.getElementById("bodyType");
    const requestBody = document.getElementById("requestBody");

    if (methodSelect) {
        methodSelect.value = preset.method;
    }

    if (urlInput) {
        urlInput.value = buildRequestUrlWithMockStatus(preset.url);
    }

    if (bodyType && requestBody) {
        if (preset.sampleBody) {
            bodyType.value = "json";
            requestBody.value = preset.sampleBody;
        } else {
            bodyType.value = "none";
            requestBody.value = "";
        }

        updateBodyControls();
    }

    updateStaticPresetButton();
    setStatus("Static API preset loaded into request builder.", true);
}

async function sendStaticPresetRequest() {
    loadStaticPresetIntoRequest();
    await sendRequest();
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createFormParamRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "api-row";

    row.innerHTML = `
        <input class="api-input form-param-key" type="text" placeholder="Parameter name" value="${escapeHtml(key)}">
        <input class="api-input form-param-value" type="text" placeholder="Parameter value" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-outline remove-row">Remove</button>
    `;

    row.querySelector(".remove-row")?.addEventListener("click", () => {
        row.remove();
    });

    return row;
}

function getFormParamEntries() {
    return [...document.querySelectorAll("#formParamsList .api-row")]
        .map((row) => ({
            key: row.querySelector(".form-param-key")?.value.trim() || "",
            value: row.querySelector(".form-param-value")?.value || ""
        }))
        .filter((item) => item.key);
}

function renderAttachmentList(fileList) {
    const list = document.getElementById("attachmentList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!fileList?.length) {
        return;
    }

    [...fileList].forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "attachment-row";
        row.dataset.index = String(index);

        row.innerHTML = `
            <div class="attachment-meta">
                <span class="attachment-label">${escapeHtml(file.name)}</span>
                <small>${formatFileSize(file.size)} · ${escapeHtml(file.type || "unknown type")}</small>
            </div>
            <label class="api-field attachment-name-field">
                <span>Upload filename</span>
                <input type="text" class="api-input attachment-custom-name" value="${escapeHtml(file.name)}"
                    placeholder="Filename sent to the server" autocomplete="off">
            </label>
        `;

        list.appendChild(row);
    });
}

function getAttachmentUploadEntries() {
    const fileInput = document.getElementById("requestAttachments");
    const files = fileInput?.files;

    if (!files?.length) {
        return [];
    }

    const rows = [...document.querySelectorAll("#attachmentList .attachment-row")];

    return [...files].map((file, index) => {
        const customName = rows[index]?.querySelector(".attachment-custom-name")?.value.trim();
        return {
            file,
            uploadName: customName || file.name
        };
    });
}

function initAttachmentControls() {
    const fileInput = document.getElementById("requestAttachments");
    const dropZone = document.getElementById("fileDropZone");
    const formParamsList = document.getElementById("formParamsList");

    if (!fileInput || !dropZone) {
        return;
    }

    const syncFiles = (fileList) => {
        if (!fileList?.length) {
            fileInput.value = "";
            renderAttachmentList(null);
            return;
        }

        const dataTransfer = new DataTransfer();
        [...fileList].forEach((file) => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        renderAttachmentList(fileInput.files);
    };

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener("change", () => {
        renderAttachmentList(fileInput.files);
    });

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");
        syncFiles(event.dataTransfer?.files);
    });

    document.getElementById("addFormParamRow")?.addEventListener("click", () => {
        formParamsList?.appendChild(createFormParamRow());
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function setStatus(message, isSuccess = false) {
    const status = document.getElementById("requestStatus");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("success", isSuccess);
}

function createHeaderRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "api-row";

    row.innerHTML = `
        <input class="api-input header-key" type="text" placeholder="Header name" value="${escapeHtml(key)}">
        <input class="api-input header-value" type="text" placeholder="Header value" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-outline remove-row">Remove</button>
    `;

    row.querySelector(".remove-row")?.addEventListener("click", () => {
        row.remove();
    });

    return row;
}

function getHeaderEntries() {
    const rows = [...document.querySelectorAll("#headersList .api-row")];

    return rows
        .map((row) => ({
            key: row.querySelector(".header-key")?.value.trim() || "",
            value: row.querySelector(".header-value")?.value || ""
        }))
        .filter((item) => item.key);
}

function renderAuthFields(authType) {
    const authFields = document.getElementById("authFields");
    if (!authFields) {
        return;
    }

    if (authType === "bearer") {
        authFields.innerHTML = `
            <label class="api-field">
                <span>Bearer Token</span>
                <input id="authBearerToken" class="api-input" type="text" placeholder="eyJhbGci...">
            </label>
        `;
        return;
    }

    if (authType === "basic") {
        authFields.innerHTML = `
            <div class="api-grid-2">
                <label class="api-field">
                    <span>Username</span>
                    <input id="authBasicUser" class="api-input" type="text" placeholder="username">
                </label>
                <label class="api-field">
                    <span>Password</span>
                    <input id="authBasicPass" class="api-input" type="password" placeholder="password">
                </label>
            </div>
        `;
        return;
    }

    if (authType === "apikey") {
        authFields.innerHTML = `
            <div class="api-grid-2">
                <label class="api-field">
                    <span>Header Name</span>
                    <input id="authApiKeyName" class="api-input" type="text" placeholder="x-api-key" value="x-api-key">
                </label>
                <label class="api-field">
                    <span>API Key</span>
                    <input id="authApiKeyValue" class="api-input" type="text" placeholder="your-api-key">
                </label>
            </div>
        `;
        return;
    }

    authFields.innerHTML = "";
}

function updateBodyControls() {
    const bodyType = document.getElementById("bodyType")?.value || "none";
    const bodyInputWrap = document.getElementById("bodyInputWrap");
    const attachmentsWrap = document.getElementById("attachmentsWrap");
    const requestBody = document.getElementById("requestBody");
    const bodyTypeHint = document.getElementById("bodyTypeHint");

    if (!bodyInputWrap || !attachmentsWrap || !requestBody) {
        return;
    }

    const hasTextBody = bodyType === "json" || bodyType === "text" || bodyType === "form-data";
    bodyInputWrap.hidden = !hasTextBody;
    attachmentsWrap.hidden = bodyType !== "form-data";

    if (bodyTypeHint) {
        bodyTypeHint.textContent = bodyType === "form-data"
            ? "File attachments require Multipart Form Data. Uploaded files appear in mock responses under received.files."
            : bodyType === "json"
                ? "JSON body only — switch to Multipart Form Data to attach files."
                : "";
    }

    if (bodyType === "json") {
        requestBody.placeholder = '{"name":"demo"}';
    } else if (bodyType === "text") {
        requestBody.placeholder = "plain text body";
    } else if (bodyType === "form-data") {
        requestBody.placeholder = '{"note":"optional form field values"}';
    } else {
        requestBody.placeholder = "";
        requestBody.value = "";
    }
}

function buildHeaders() {
    const headers = new Headers();

    getHeaderEntries().forEach(({ key, value }) => {
        headers.set(key, value);
    });

    const authType = document.getElementById("authType")?.value || "none";

    if (authType === "bearer") {
        const token = document.getElementById("authBearerToken")?.value.trim() || "";
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    if (authType === "basic") {
        const username = document.getElementById("authBasicUser")?.value || "";
        const password = document.getElementById("authBasicPass")?.value || "";
        if (username || password) {
            const encoded = btoa(`${username}:${password}`);
            headers.set("Authorization", `Basic ${encoded}`);
        }
    }

    if (authType === "apikey") {
        const keyName = document.getElementById("authApiKeyName")?.value.trim() || "";
        const keyValue = document.getElementById("authApiKeyValue")?.value || "";
        if (keyName && keyValue) {
            headers.set(keyName, keyValue);
        }
    }

    return headers;
}

function buildBodyAndHeaders(headers) {
    const bodyType = document.getElementById("bodyType")?.value || "none";
    const textBody = document.getElementById("requestBody")?.value || "";

    if (bodyType === "none") {
        return undefined;
    }

    if (bodyType === "json") {
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        if (!textBody.trim()) {
            return "{}";
        }

        // Validate JSON before sending.
        JSON.parse(textBody);
        return textBody;
    }

    if (bodyType === "text") {
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "text/plain;charset=UTF-8");
        }

        return textBody;
    }

    if (bodyType === "form-data") {
        headers.delete("Content-Type");
        const formData = new FormData();

        getFormParamEntries().forEach(({ key, value }) => {
            formData.append(key, value);
        });

        if (textBody.trim()) {
            try {
                const parsed = JSON.parse(textBody);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    Object.entries(parsed).forEach(([key, value]) => {
                        formData.append(key, value === null || value === undefined ? "" : String(value));
                    });
                } else {
                    formData.append("payload", textBody);
                }
            } catch {
                formData.append("payload", textBody);
            }
        }

        const fieldName = document.getElementById("fileFieldName")?.value.trim() || "file";
        const attachments = getAttachmentUploadEntries();

        attachments.forEach(({ file, uploadName }) => {
            formData.append(fieldName, file, uploadName);
        });

        return formData;
    }

    return undefined;
}

function headersToText(headers) {
    const lines = [];
    headers.forEach((value, key) => {
        lines.push(`${key}: ${value}`);
    });

    return lines.length ? lines.join("\n") : "(no headers)";
}

function tryFormatResponseBody(text, contentType) {
    if (!text) {
        return "(empty body)";
    }

    const isLikelyJson = contentType.includes("application/json") || contentType.includes("+json");
    if (!isLikelyJson) {
        return text;
    }

    try {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return text;
    }
}

async function sendRequest() {
    const method = document.getElementById("requestMethod")?.value || "GET";
    const url = document.getElementById("requestUrl")?.value.trim() || "";
    const responseSummary = document.getElementById("responseSummary");
    const responseHeaders = document.getElementById("responseHeaders");
    const responseBody = document.getElementById("responseBody");

    if (!url) {
        setStatus("Please provide a request URL.");
        return;
    }

    setStatus("Sending request...");

    try {
        const headers = buildHeaders();
        const body = ["GET", "HEAD"].includes(method)
            ? undefined
            : buildBodyAndHeaders(headers);

        const route = findStaticApiRoute(url, method);
        const requestedMockStatus = getEffectiveMockStatus(url);
        const usingMockStatus = requestedMockStatus && requestedMockStatus !== 200 && isStaticApiUrl(url);
        const requestUrl = buildRequestUrlWithMockStatus(url);
        const startedAt = performance.now();

        if (isMutatingMethod(method) && route?.responsePath && !mockApiSwActive) {
            const payload = await buildMockMutationPayload(route, body);
            const endedAt = performance.now();
            const displayStatus = requestedMockStatus || route.simulateStatus || 200;
            const displayStatusText = getStatusText(displayStatus);
            const displayOk = displayStatus >= 200 && displayStatus < 300;
            const prettyBody = JSON.stringify(payload, null, 2);

            if (responseSummary) {
                responseSummary.textContent = `${displayStatus} ${displayStatusText} | ${method} ${url} | ${(endedAt - startedAt).toFixed(2)} ms (client mock)`;
            }

            if (responseHeaders) {
                responseHeaders.textContent = "content-type: application/json\nx-mock-api: true\nx-mock-status: " + displayStatus;
            }

            if (responseBody) {
                responseBody.textContent = prettyBody;
            }

            setStatus("Mock POST/PUT/DELETE response generated in browser.", displayOk);
            return;
        }

        const response = await fetch(requestUrl, {
            method,
            headers,
            body
        });
        const endedAt = performance.now();

        const rawText = await response.text();
        const contentType = response.headers.get("content-type") || "";
        const prettyBody = tryFormatResponseBody(rawText, contentType);

        let displayStatus = response.status;
        let displayStatusText = response.statusText;
        let displayOk = response.ok;

        if (usingMockStatus && !mockApiSwActive) {
            displayStatus = requestedMockStatus;
            displayStatusText = getStatusText(requestedMockStatus);
            displayOk = requestedMockStatus >= 200 && requestedMockStatus < 300;
        }

        if (responseSummary) {
            const mockNote =
                usingMockStatus && !mockApiSwActive ? " (UI simulated — use HTTPS for real status)" : "";
            responseSummary.textContent = `${displayStatus} ${displayStatusText} | ${method} ${url} | ${(endedAt - startedAt).toFixed(2)} ms${mockNote}`;
        }

        if (responseHeaders) {
            responseHeaders.textContent = headersToText(response.headers);
        }

        if (responseBody) {
            responseBody.textContent = prettyBody;
        }

        setStatus("Request completed.", displayOk);
    } catch (error) {
        if (responseSummary) {
            responseSummary.textContent = `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        }

        if (responseHeaders) {
            responseHeaders.textContent = "-";
        }

        if (responseBody) {
            responseBody.textContent = "The browser blocked the request or the network request failed. Check CORS policy and endpoint availability.";
        }

        setStatus("Request failed. This may be a CORS restriction.");
    }
}

function clearResponse() {
    const responseSummary = document.getElementById("responseSummary");
    const responseHeaders = document.getElementById("responseHeaders");
    const responseBody = document.getElementById("responseBody");

    if (responseSummary) {
        responseSummary.textContent = "No response yet.";
    }

    if (responseHeaders) {
        responseHeaders.textContent = "-";
    }

    if (responseBody) {
        responseBody.textContent = "-";
    }

    setStatus("Response cleared.", true);
}

function initCollapsibleCards() {
    const cards = document.querySelectorAll("[data-collapsible]");

    cards.forEach((card) => {
        const button = card.querySelector("[data-collapse-toggle]");
        const body = card.querySelector("[data-collapse-body]");

        if (!button || !body) {
            return;
        }

        button.addEventListener("click", () => {
            const isExpanded = button.getAttribute("aria-expanded") === "true";
            const willExpand = !isExpanded;

            button.setAttribute("aria-expanded", String(willExpand));
            button.setAttribute("aria-label", willExpand ? "Hide section" : "Expand section");
            card.classList.toggle("is-collapsed", !willExpand);
        });
    });
}

function initApiTester() {
    const headersList = document.getElementById("headersList");
    const authType = document.getElementById("authType");
    const bodyType = document.getElementById("bodyType");

    if (!headersList) {
        return;
    }

    headersList.appendChild(createHeaderRow("Accept", "application/json"));

    document.getElementById("addHeaderRow")?.addEventListener("click", () => {
        headersList.appendChild(createHeaderRow());
    });

    authType?.addEventListener("change", () => {
        renderAuthFields(authType.value);
    });

    bodyType?.addEventListener("change", updateBodyControls);

    document.getElementById("sendRequestBtn")?.addEventListener("click", sendRequest);
    document.getElementById("clearResponseBtn")?.addEventListener("click", clearResponse);
    document.getElementById("loadStaticPresetBtn")?.addEventListener("click", loadStaticPresetIntoRequest);
    document.getElementById("sendStaticPresetBtn")?.addEventListener("click", sendStaticPresetRequest);
    document.getElementById("staticApiPreset")?.addEventListener("change", () => {
        updateStaticEndpointHint();
        updateStaticPresetButton();
    });
    document.getElementById("staticApiMockStatus")?.addEventListener("change", () => {
        updateStaticEndpointHint();

        const urlInput = document.getElementById("requestUrl");
        if (urlInput?.value.trim() && isStaticApiUrl(urlInput.value)) {
            urlInput.value = buildRequestUrlWithMockStatus(urlInput.value);
        }
    });

    renderAuthFields(authType?.value || "none");
    updateBodyControls();
    initAttachmentControls();
    initCollapsibleCards();
    registerMockApiServiceWorker().then(loadStaticApiManifest);
}

initApiTester();