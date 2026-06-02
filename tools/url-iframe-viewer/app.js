const STORAGE_KEY = "urlIframeViewerLastUrl";
const LOAD_TIMEOUT_MS = 15000;

let loadToken = 0;
let loadTimeoutId = null;

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

    return { ok: true, url: parsed.href };
}

function setStatus(message, type = "") {
    const status = document.getElementById("viewerStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) status.classList.add(type);
}

function updateActionButtons(enabled, url = "") {
    document.getElementById("openNewTab")?.toggleAttribute("disabled", !enabled);
    document.getElementById("reloadFrame")?.toggleAttribute("disabled", !enabled);

    const newTabBtn = document.getElementById("openNewTab");
    if (newTabBtn && url) {
        newTabBtn.dataset.url = url;
    }
}

function applyFrameHeight() {
    const range = document.getElementById("frameHeight");
    const output = document.getElementById("frameHeightValue");
    const stage = document.querySelector(".iframe-viewer-stage");
    if (!range || !stage) return;

    const height = Number.parseInt(range.value, 10);
    if (output) output.textContent = `${height} px`;
    stage.style.setProperty("--iframe-viewer-height", `${height}px`);
}

function getViewerElements() {
    return {
        stage: document.querySelector(".iframe-viewer-stage"),
        frame: document.getElementById("previewFrame"),
        placeholder: document.getElementById("framePlaceholder")
    };
}

function showLoadingOverlay(url) {
    const { stage, frame, placeholder } = getViewerElements();
    if (!stage || !frame || !placeholder) return;

    if (loadTimeoutId !== null) {
        clearTimeout(loadTimeoutId);
        loadTimeoutId = null;
    }

    stage.classList.add("is-loading");
    placeholder.textContent = `Loading ${url}…`;
    placeholder.hidden = false;
    frame.hidden = false;
}

function finishLoading(url, token, timedOut = false) {
    if (token !== loadToken) return;

    const { stage, frame, placeholder } = getViewerElements();
    if (!stage || !frame || !placeholder) return;

    if (loadTimeoutId !== null) {
        clearTimeout(loadTimeoutId);
        loadTimeoutId = null;
    }

    stage.classList.remove("is-loading");
    placeholder.hidden = true;
    frame.hidden = false;

    if (timedOut) {
        setStatus(
            "Load is taking longer than expected, or the site blocks embedding. Try Open in new tab.",
            "error"
        );
        return;
    }

    setStatus(`Loaded ${url}`, "success");
}

function loadUrlInFrame(url) {
    const { frame } = getViewerElements();
    if (!frame) return;

    const token = ++loadToken;
    showLoadingOverlay(url);

    const onLoad = () => {
        if (token !== loadToken) return;
        const src = frame.getAttribute("src") || frame.src || "";
        if (!src || src === "about:blank") return;
        frame.removeEventListener("load", onLoad);
        finishLoading(url, token, false);
    };

    frame.addEventListener("load", onLoad);

    loadTimeoutId = window.setTimeout(() => {
        frame.removeEventListener("load", onLoad);
        finishLoading(url, token, true);
    }, LOAD_TIMEOUT_MS);

    const currentSrc = frame.src;
    if (currentSrc === url) {
        frame.src = "about:blank";
        window.requestAnimationFrame(() => {
            if (token === loadToken) {
                frame.src = url;
            }
        });
    } else {
        frame.src = url;
    }

    sessionStorage.setItem(STORAGE_KEY, url);
    updateActionButtons(true, url);
    setStatus(`Loading ${url}…`);
}

function clearFrame() {
    loadToken += 1;

    const { stage, frame, placeholder } = getViewerElements();

    if (loadTimeoutId !== null) {
        clearTimeout(loadTimeoutId);
        loadTimeoutId = null;
    }

    if (frame) {
        frame.removeAttribute("src");
        frame.hidden = true;
    }

    if (stage) {
        stage.classList.remove("is-loading");
    }

    if (placeholder) {
        placeholder.textContent = "Enter a URL and click Open in frame.";
        placeholder.hidden = false;
    }

    updateActionButtons(false);
    setStatus("");
}

function initUrlIframeViewer() {
    const form = document.getElementById("urlForm");
    const urlInput = document.getElementById("urlInput");
    const frameHeight = document.getElementById("frameHeight");

    applyFrameHeight();
    frameHeight?.addEventListener("input", applyFrameHeight);

    form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const result = normalizeUrl(urlInput?.value);
        if (!result.ok) {
            setStatus(result.error, "error");
            return;
        }
        if (urlInput) urlInput.value = result.url;
        loadUrlInFrame(result.url);
    });

    document.getElementById("openNewTab")?.addEventListener("click", () => {
        const url = document.getElementById("openNewTab")?.dataset.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    });

    document.getElementById("reloadFrame")?.addEventListener("click", () => {
        const frame = document.getElementById("previewFrame");
        const url = frame?.src;
        if (!url || url === "about:blank") return;
        loadUrlInFrame(url);
    });

    document.getElementById("clearFrame")?.addEventListener("click", () => {
        if (urlInput) urlInput.value = "";
        clearFrame();
        sessionStorage.removeItem(STORAGE_KEY);
    });

    const params = new URLSearchParams(location.search);
    const queryUrl = params.get("url");
    const savedUrl = sessionStorage.getItem(STORAGE_KEY);
    const initial = queryUrl || savedUrl;

    if (initial) {
        const result = normalizeUrl(initial);
        if (result.ok) {
            if (urlInput) urlInput.value = result.url;
            loadUrlInFrame(result.url);
        }
    }
}

initUrlIframeViewer();
