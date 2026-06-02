let parsedReport = null;
let lastPdfBlobUrl = "";

function setStatus(elementId, message, type = "") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.classList.remove("success", "error");
    if (type) el.classList.add(type);
}

function getPreviewMode() {
    return document.querySelector('input[name="previewMode"]:checked')?.value || "local";
}

function updatePreviewModeUi() {
    const mode = getPreviewMode();
    const localPanel = document.getElementById("localPreviewPanel");
    const serverPanel = document.getElementById("serverPreviewPanel");
    const copyRestBtn = document.getElementById("copyRestUrl");

    if (localPanel) localPanel.hidden = mode !== "local";
    if (serverPanel) serverPanel.hidden = mode !== "server";
    if (copyRestBtn) copyRestBtn.hidden = mode !== "server";
}

function getVisibleParameters() {
    if (!parsedReport) return [];
    const promptingOnly = document.getElementById("promptingOnly")?.checked;
    return parsedReport.parameters.filter((param) => !promptingOnly || param.forPrompting);
}

function readFormValues() {
    const values = {};
    const fields = document.querySelectorAll("[data-param-name]");
    for (const field of fields) {
        const name = field.dataset.paramName;
        if (!name) continue;

        if (field.type === "checkbox") {
            values[name] = field.checked;
            continue;
        }

        values[name] = field.value;
    }
    return JrxmlParser.coerceParameterValues(
        parsedReport?.parameters ?? [],
        values
    );
}

function getJdbcConfig() {
    const url = document.getElementById("jdbcUrl")?.value.trim();
    if (!url) return null;

    return {
        url,
        user: document.getElementById("jdbcUser")?.value ?? "",
        password: document.getElementById("jdbcPassword")?.value ?? "",
        driver: document.getElementById("jdbcDriver")?.value.trim() || ""
    };
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
}

function renderParameterField(param) {
    const id = `param-${param.name.replace(/[^\w-]/g, "_")}`;
    const defaultValue = escapeHtml(param.defaultValue);
    const description = param.description
        ? `<p class="jrxml-param-desc">${escapeHtml(param.description)}</p>`
        : "";
    const meta = `<p class="jrxml-param-meta"><code>${escapeHtml(param.javaClass)}</code> · ${escapeHtml(param.scope)}</p>`;

    let control = "";

    switch (param.inputType) {
        case "boolean":
            control = `<label class="jrxml-checkbox">
                <input type="checkbox" id="${id}" data-param-name="${escapeHtml(param.name)}" ${param.defaultValue === "true" ? "checked" : ""}>
                <span>true / false</span>
            </label>`;
            break;
        case "integer":
        case "number":
            control = `<input class="jrxml-input" type="number" id="${id}" data-param-name="${escapeHtml(param.name)}" value="${defaultValue}" step="${param.inputType === "integer" ? "1" : "any"}">`;
            break;
        case "date":
            control = `<input class="jrxml-input" type="date" id="${id}" data-param-name="${escapeHtml(param.name)}" value="${defaultValue}">`;
            break;
        case "json":
            control = `<textarea class="jrxml-input jrxml-input-textarea" id="${id}" data-param-name="${escapeHtml(param.name)}" rows="2" placeholder="[] or {}">${defaultValue}</textarea>`;
            break;
        default:
            control = `<input class="jrxml-input" type="text" id="${id}" data-param-name="${escapeHtml(param.name)}" value="${defaultValue}">`;
    }

    return `<article class="jrxml-param-card">
        <label class="jrxml-param-label" for="${id}">${escapeHtml(param.name)}</label>
        ${meta}
        ${description}
        ${control}
    </article>`;
}

function renderParametersForm() {
    const section = document.getElementById("parametersSection");
    const form = document.getElementById("parametersForm");
    const previewBtn = document.getElementById("previewPdfBtn");

    if (!section || !form || !parsedReport) return;

    const visible = getVisibleParameters();
    if (!visible.length) {
        form.innerHTML = `<p class="tool-note-inline">No parameters matched the current filter.</p>`;
    } else {
        form.innerHTML = visible.map(renderParameterField).join("");
    }

    section.hidden = false;
    if (previewBtn) previewBtn.disabled = false;
}

function buildJasperRestUrl() {
    const baseUrl = document.getElementById("jasperBaseUrl")?.value.trim().replace(/\/+$/, "");
    const reportUri = document.getElementById("jasperReportUri")?.value.trim().replace(/^\/+/, "").replace(/\.pdf$/i, "");
    if (!baseUrl || !reportUri) return "";

    const url = new URL(`${baseUrl}/rest_v2/reports/${reportUri}.pdf`);
    const params = readFormValues();
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}

function revokePdfUrl() {
    if (lastPdfBlobUrl) {
        URL.revokeObjectURL(lastPdfBlobUrl);
        lastPdfBlobUrl = "";
    }
}

function showPdfBlob(blob) {
    const section = document.getElementById("previewSection");
    const frame = document.getElementById("pdfPreviewFrame");
    const downloadBtn = document.getElementById("downloadPdfBtn");

    revokePdfUrl();
    lastPdfBlobUrl = URL.createObjectURL(blob);

    if (frame) frame.src = lastPdfBlobUrl;
    if (section) section.hidden = false;
    if (downloadBtn) downloadBtn.disabled = false;
}

async function checkProxyHealth(proxyUrl) {
    const health = await fetch(`${proxyUrl}/api/health`);
    if (!health.ok) {
        throw new Error("Local proxy is not running. Start jasper-proxy-server.js.");
    }
    return health.json();
}

async function requestLocalPdfPreview() {
    const proxyUrl = document.getElementById("proxyUrl")?.value.trim().replace(/\/+$/, "");
    const jrxml = document.getElementById("jrxmlPaste")?.value.trim();

    if (!proxyUrl) {
        setStatus("previewStatus", "Proxy URL is required.", "error");
        return;
    }

    if (!jrxml) {
        setStatus("previewStatus", "JRXML content is required.", "error");
        return;
    }

    setStatus("previewStatus", "Compiling JRXML locally (Java)…", "");
    document.getElementById("previewPdfBtn")?.setAttribute("disabled", "true");

    try {
        const health = await checkProxyHealth(proxyUrl);
        if (!health.localRunner?.available) {
            throw new Error(
                "Local Java runner JAR is missing. Run build-runner.bat or: cd java && mvn package"
            );
        }

        const body = {
            jrxml,
            params: readFormValues()
        };
        const jdbc = getJdbcConfig();
        if (jdbc) body.jdbc = jdbc;

        const response = await fetch(`${proxyUrl}/api/local/preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
            let message = `Local compile failed (HTTP ${response.status}).`;
            if (contentType.includes("application/json")) {
                const errorBody = await response.json();
                message = [errorBody.error, errorBody.details].filter(Boolean).join(" ");
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        showPdfBlob(blob);
        setStatus("previewStatus", "PDF generated locally.", "success");
    } catch (error) {
        setStatus(
            "previewStatus",
            error instanceof Error ? error.message : "Local preview failed.",
            "error"
        );
    } finally {
        document.getElementById("previewPdfBtn")?.removeAttribute("disabled");
    }
}

async function requestServerPdfPreview() {
    const proxyUrl = document.getElementById("proxyUrl")?.value.trim().replace(/\/+$/, "");
    const baseUrl = document.getElementById("jasperBaseUrl")?.value.trim();
    const reportUri = document.getElementById("jasperReportUri")?.value.trim();
    const username = document.getElementById("jasperUsername")?.value ?? "";
    const password = document.getElementById("jasperPassword")?.value ?? "";

    if (!proxyUrl || !baseUrl || !reportUri) {
        setStatus("previewStatus", "Proxy URL, Jasper base URL, and report URI are required.", "error");
        return;
    }

    setStatus("previewStatus", "Requesting PDF from Jasper Server…", "");
    document.getElementById("previewPdfBtn")?.setAttribute("disabled", "true");

    try {
        await checkProxyHealth(proxyUrl);

        const response = await fetch(`${proxyUrl}/api/jasper/preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                baseUrl,
                reportUri,
                username,
                password,
                params: readFormValues()
            })
        });

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
            let message = `Preview failed (HTTP ${response.status}).`;
            if (contentType.includes("application/json")) {
                const errorBody = await response.json();
                message = errorBody.error || message;
            }
            throw new Error(message);
        }

        showPdfBlob(await response.blob());
        setStatus("previewStatus", "PDF loaded from Jasper Server.", "success");
    } catch (error) {
        setStatus(
            "previewStatus",
            error instanceof Error ? error.message : "Server preview failed.",
            "error"
        );
    } finally {
        document.getElementById("previewPdfBtn")?.removeAttribute("disabled");
    }
}

async function requestPdfPreview() {
    if (!parsedReport) {
        setStatus("previewStatus", "Detect parameters from a JRXML file first.", "error");
        return;
    }

    if (getPreviewMode() === "local") {
        await requestLocalPdfPreview();
        return;
    }

    await requestServerPdfPreview();
}

function parseJrxmlFromInputs() {
    const paste = document.getElementById("jrxmlPaste")?.value.trim();
    if (!paste) {
        setStatus("parseStatus", "Choose a JRXML file or paste XML content.", "error");
        return;
    }

    try {
        parsedReport = JrxmlParser.parseJrxml(paste);
        const meta = document.getElementById("reportMeta");
        if (meta) {
            meta.hidden = false;
            meta.textContent = `Report: ${parsedReport.reportName} · ${parsedReport.parameterCount} parameter(s) detected`;
        }
        renderParametersForm();
        setStatus("parseStatus", `Detected ${parsedReport.parameterCount} parameter(s).`, "success");
    } catch (error) {
        parsedReport = null;
        const parametersSection = document.getElementById("parametersSection");
        if (parametersSection) parametersSection.hidden = true;
        setStatus("parseStatus", error instanceof Error ? error.message : "Failed to parse JRXML.", "error");
    }
}

async function loadJrxmlFile(file) {
    if (!file) return;
    const text = await file.text();
    const paste = document.getElementById("jrxmlPaste");
    if (paste) paste.value = text;
    parseJrxmlFromInputs();
}

function clearAll() {
    parsedReport = null;
    revokePdfUrl();
    document.getElementById("jrxmlFile").value = "";
    document.getElementById("jrxmlPaste").value = "";
    const parametersSection = document.getElementById("parametersSection");
    const previewSection = document.getElementById("previewSection");
    const reportMeta = document.getElementById("reportMeta");
    if (parametersSection) parametersSection.hidden = true;
    if (previewSection) previewSection.hidden = true;
    if (reportMeta) reportMeta.hidden = true;
    document.getElementById("previewPdfBtn")?.setAttribute("disabled", "true");
    document.getElementById("downloadPdfBtn")?.setAttribute("disabled", "true");
    setStatus("parseStatus", "");
    setStatus("previewStatus", "");
}

function initJrxmlReportPreview() {
    const fileInput = document.getElementById("jrxmlFile");
    const dropZone = document.getElementById("jrxmlDropZone");

    updatePreviewModeUi();
    document.querySelectorAll('input[name="previewMode"]').forEach((input) => {
        input.addEventListener("change", updatePreviewModeUi);
    });

    document.getElementById("parseJrxmlBtn")?.addEventListener("click", parseJrxmlFromInputs);
    document.getElementById("clearJrxmlBtn")?.addEventListener("click", clearAll);
    document.getElementById("promptingOnly")?.addEventListener("change", () => {
        if (parsedReport) renderParametersForm();
    });

    fileInput?.addEventListener("change", () => loadJrxmlFile(fileInput.files?.[0]));
    dropZone?.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragover");
    });
    dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("is-dragover"));
    dropZone?.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragover");
        loadJrxmlFile(event.dataTransfer?.files?.[0]);
    });

    document.getElementById("copyParamsJson")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(JSON.stringify(readFormValues(), null, 2));
        setStatus("parseStatus", "Parameter JSON copied.", "success");
    });

    document.getElementById("copyRestUrl")?.addEventListener("click", async () => {
        const url = buildJasperRestUrl();
        if (!url) {
            setStatus("previewStatus", "Enter Jasper base URL and report URI first.", "error");
            return;
        }
        await navigator.clipboard.writeText(url);
        setStatus("previewStatus", "REST URL copied.", "success");
    });

    document.getElementById("previewPdfBtn")?.addEventListener("click", requestPdfPreview);
    document.getElementById("downloadPdfBtn")?.addEventListener("click", () => {
        if (!lastPdfBlobUrl) return;
        const anchor = document.createElement("a");
        anchor.href = lastPdfBlobUrl;
        anchor.download = `${parsedReport?.reportName || "report"}-preview.pdf`;
        anchor.click();
    });
}

initJrxmlReportPreview();
