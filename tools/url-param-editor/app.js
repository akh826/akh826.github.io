const STORAGE_KEY = "urlParamEditorLastUrl";

let paramRowId = 0;

function normalizeUrl(raw) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) {
        return { ok: false, error: "Enter a URL." };
    }

    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

    let parsed;
    try {
        parsed = new URL(withScheme);
    } catch {
        return { ok: false, error: "URL format is invalid." };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
        return { ok: false, error: "Only http and https URLs are allowed." };
    }

    return { ok: true, url: parsed };
}

function setStatus(elementId, message, type = "") {
    const status = document.getElementById(elementId);
    if (!status) return;
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) status.classList.add(type);
}

function getBaseUrlFromParsed(parsed) {
    return `${parsed.origin}${parsed.pathname}`;
}

function createParamRow(key = "", value = "") {
    const id = ++paramRowId;
    const row = document.createElement("tr");
    row.dataset.rowId = String(id);

    row.innerHTML = `
        <td>
            <input class="url-param-cell-input" type="text" data-field="key" value="${escapeAttr(key)}"
                placeholder="key" spellcheck="false" aria-label="Parameter key">
        </td>
        <td>
            <input class="url-param-cell-input" type="text" data-field="value" value="${escapeAttr(value)}"
                placeholder="value" spellcheck="false" aria-label="Parameter value">
        </td>
        <td class="url-param-row-actions">
            <button type="button" class="url-param-remove" aria-label="Remove parameter" title="Remove">×</button>
        </td>
    `;

    return row;
}

function escapeAttr(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function getParamRows() {
    const rows = document.querySelectorAll("#paramBody tr");
    return Array.from(rows).map((row) => {
        const keyInput = row.querySelector('[data-field="key"]');
        const valueInput = row.querySelector('[data-field="value"]');
        return {
            key: keyInput?.value ?? "",
            value: valueInput?.value ?? ""
        };
    });
}

function updateEmptyState() {
    const body = document.getElementById("paramBody");
    const empty = document.getElementById("paramEmpty");
    if (!body || !empty) return;
    const hasRows = body.children.length > 0;
    empty.hidden = hasRows;
}

function buildUrl() {
    const baseInput = document.getElementById("baseUrl");
    const hashInput = document.getElementById("hashPart");
    if (!baseInput) return { ok: false, error: "Base URL is missing." };

    const baseResult = normalizeUrl(baseInput.value);
    if (!baseResult.ok) {
        return { ok: false, error: `Base URL: ${baseResult.error}` };
    }

    const url = baseResult.url;
    url.search = "";

    for (const { key, value } of getParamRows()) {
        const trimmedKey = key.trim();
        if (!trimmedKey) continue;
        url.searchParams.append(trimmedKey, value);
    }

    const hash = String(hashInput?.value ?? "").trim();
    url.hash = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";

    return { ok: true, url: url.href };
}

function refreshOutput() {
    const output = document.getElementById("outputUrl");
    if (!output) return;

    const result = buildUrl();
    if (!result.ok) {
        output.value = "";
        setStatus("outputStatus", result.error, "error");
        return;
    }

    output.value = result.url;
    setStatus("outputStatus", "");
    sessionStorage.setItem(STORAGE_KEY, result.url);
}

function clearParamTable() {
    const body = document.getElementById("paramBody");
    if (body) body.replaceChildren();
    updateEmptyState();
}

function populateFromUrl(parsed) {
    const baseUrl = document.getElementById("baseUrl");
    const hashPart = document.getElementById("hashPart");
    const editorPanel = document.getElementById("editorPanel");
    const urlInput = document.getElementById("urlInput");

    if (baseUrl) baseUrl.value = getBaseUrlFromParsed(parsed);
    if (hashPart) hashPart.value = parsed.hash ? parsed.hash.slice(1) : "";
    if (urlInput) urlInput.value = parsed.href;
    if (editorPanel) editorPanel.hidden = false;

    clearParamTable();
    const body = document.getElementById("paramBody");
    if (!body) return;

    for (const [key, value] of parsed.searchParams.entries()) {
        body.appendChild(createParamRow(key, value));
    }

    updateEmptyState();
    refreshOutput();
}

function addParamRow(key = "", value = "") {
    const body = document.getElementById("paramBody");
    if (!body) return;

    const row = createParamRow(key, value);
    body.appendChild(row);
    updateEmptyState();
    refreshOutput();

    const keyInput = row.querySelector('[data-field="key"]');
    keyInput?.focus();
}

function parseAndLoad(rawUrl) {
    const result = normalizeUrl(rawUrl);
    if (!result.ok) {
        setStatus("inputStatus", result.error, "error");
        return false;
    }

    populateFromUrl(result.url);
    setStatus("inputStatus", "URL parsed. Edit parameters below.", "success");
    return true;
}

function resetEditor() {
    const editorPanel = document.getElementById("editorPanel");
    const urlInput = document.getElementById("urlInput");
    const output = document.getElementById("outputUrl");

    if (urlInput) urlInput.value = "";
    if (output) output.value = "";
    if (editorPanel) editorPanel.hidden = true;

    clearParamTable();
    setStatus("inputStatus", "");
    setStatus("outputStatus", "");
    sessionStorage.removeItem(STORAGE_KEY);
}

async function copyOutputUrl() {
    const output = document.getElementById("outputUrl");
    const url = output?.value?.trim();
    if (!url) {
        setStatus("outputStatus", "Nothing to copy.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(url);
        setStatus("outputStatus", "URL copied to clipboard.", "success");
    } catch {
        output.select();
        const copied = document.execCommand("copy");
        setStatus(
            "outputStatus",
            copied ? "URL copied to clipboard." : "Copy failed. Select the URL and copy manually.",
            copied ? "success" : "error"
        );
    }
}

function initUrlParamEditor() {
    const parseForm = document.getElementById("parseForm");
    const urlInput = document.getElementById("urlInput");
    const paramBody = document.getElementById("paramBody");

    parseForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        parseAndLoad(urlInput?.value);
    });

    document.getElementById("baseUrl")?.addEventListener("input", refreshOutput);
    document.getElementById("hashPart")?.addEventListener("input", refreshOutput);

    paramBody?.addEventListener("input", (event) => {
        if (event.target.matches(".url-param-cell-input")) {
            refreshOutput();
        }
    });

    paramBody?.addEventListener("click", (event) => {
        const removeBtn = event.target.closest(".url-param-remove");
        if (!removeBtn) return;

        const row = removeBtn.closest("tr");
        row?.remove();
        updateEmptyState();
        refreshOutput();
    });

    document.getElementById("addParam")?.addEventListener("click", () => addParamRow());

    document.getElementById("copyUrl")?.addEventListener("click", () => copyOutputUrl());

    document.getElementById("openUrl")?.addEventListener("click", () => {
        const result = buildUrl();
        if (!result.ok) {
            setStatus("outputStatus", result.error, "error");
            return;
        }
        window.open(result.url, "_blank", "noopener,noreferrer");
    });

    document.getElementById("reparseOutput")?.addEventListener("click", () => {
        const output = document.getElementById("outputUrl");
        if (!output?.value.trim()) return;
        if (urlInput) urlInput.value = output.value;
        parseAndLoad(output.value);
    });

    document.getElementById("resetEditor")?.addEventListener("click", resetEditor);

    const params = new URLSearchParams(location.search);
    const queryUrl = params.get("url");
    const savedUrl = sessionStorage.getItem(STORAGE_KEY);
    const initial = queryUrl || savedUrl;

    if (initial) {
        if (urlInput) urlInput.value = initial;
        parseAndLoad(initial);
    }
}

initUrlParamEditor();
