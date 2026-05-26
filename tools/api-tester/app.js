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

    if (!bodyInputWrap || !attachmentsWrap || !requestBody) {
        return;
    }

    const hasTextBody = bodyType === "json" || bodyType === "text" || bodyType === "form-data";
    bodyInputWrap.hidden = !hasTextBody;
    attachmentsWrap.hidden = bodyType !== "form-data";

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

        const files = document.getElementById("requestAttachments")?.files;
        if (files?.length) {
            [...files].forEach((file) => {
                formData.append("files[]", file, file.name);
            });
        }

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

        const startedAt = performance.now();
        const response = await fetch(url, {
            method,
            headers,
            body
        });
        const endedAt = performance.now();

        const rawText = await response.text();
        const contentType = response.headers.get("content-type") || "";
        const prettyBody = tryFormatResponseBody(rawText, contentType);

        if (responseSummary) {
            responseSummary.textContent = `${response.status} ${response.statusText} | ${method} ${url} | ${(endedAt - startedAt).toFixed(2)} ms`;
        }

        if (responseHeaders) {
            responseHeaders.textContent = headersToText(response.headers);
        }

        if (responseBody) {
            responseBody.textContent = prettyBody;
        }

        setStatus("Request completed.", response.ok);
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

    renderAuthFields(authType?.value || "none");
    updateBodyControls();
}

initApiTester();