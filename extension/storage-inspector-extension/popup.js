const REPORT_STORAGE_KEY = "storageInspectorLastReport";

function isInspectableUrl(url) {
    if (!url) return false;
    const blockedPrefixes = [
        "chrome://",
        "chrome-extension://",
        "edge://",
        "about:",
        "devtools://",
        "view-source:"
    ];
    return !blockedPrefixes.some((prefix) => url.startsWith(prefix));
}

function mapChromeCookies(cookies) {
    return cookies.map((cookie) => {
        const value = cookie.value ?? "";
        return {
            name: cookie.name,
            valuePreview: value.length > 120 ? `${value.slice(0, 120)}...` : value,
            bytes: new TextEncoder().encode(`${cookie.name}=${value}`).length,
            httpOnly: Boolean(cookie.httpOnly),
            secure: Boolean(cookie.secure),
            sameSite: cookie.sameSite ?? "",
            domain: cookie.domain ?? "",
            path: cookie.path ?? "",
            source: "chrome.cookies API"
        };
    });
}

async function inspectActiveTab() {
    const status = document.getElementById("status");
    const results = document.getElementById("results");
    const tabMeta = document.getElementById("tabMeta");
    const openReportBtn = document.getElementById("openReportBtn");
    const inspectBtn = document.getElementById("inspectBtn");

    status.textContent = "Inspecting active tab...";
    status.className = "popup-status";
    inspectBtn.disabled = true;
    openReportBtn.disabled = true;
    results.hidden = true;
    tabMeta.hidden = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id || !isInspectableUrl(tab.url)) {
            status.textContent =
                "Cannot inspect this page. Open a normal website tab (http/https), then try again.";
            status.className = "popup-status error";
            return;
        }

        const [{ result: page }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["page-collector.js"]
        });

        let cookies = [];
        try {
            cookies = await chrome.cookies.getAll({ url: tab.url });
        } catch {
            cookies = page.documentCookies?.entries ?? [];
        }

        const report = {
            tab: {
                id: tab.id,
                title: tab.title ?? "",
                url: tab.url
            },
            page,
            cookies: mapChromeCookies(cookies),
            collectedAt: new Date().toISOString()
        };

        await chrome.storage.session.set({ [REPORT_STORAGE_KEY]: report });

        tabMeta.hidden = false;
        tabMeta.innerHTML = `
            <div><strong>Origin</strong> <code>${StorageInspectorRender.escapeHtml(page.origin)}</code></div>
            <div><strong>Tab</strong> ${StorageInspectorRender.escapeHtml(tab.title || tab.url)}</div>
        `;

        results.hidden = false;
        StorageInspectorRender.renderStorageReport(report, results);

        status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
        status.className = "popup-status success";
        openReportBtn.disabled = false;
    } catch (error) {
        status.textContent =
            error instanceof Error
                ? error.message
                : "Inspection failed. Reload the tab and try again.";
        status.className = "popup-status error";
    } finally {
        inspectBtn.disabled = false;
    }
}

document.getElementById("inspectBtn")?.addEventListener("click", () => {
    inspectActiveTab();
});

document.getElementById("openReportBtn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
});

inspectActiveTab();
