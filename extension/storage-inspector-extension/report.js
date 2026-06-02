const REPORT_STORAGE_KEY = "storageInspectorLastReport";

async function loadReport() {
    const meta = document.getElementById("reportMeta");
    const results = document.getElementById("reportResults");
    const stored = await chrome.storage.session.get(REPORT_STORAGE_KEY);
    const report = stored[REPORT_STORAGE_KEY];

    if (!report) {
        meta.textContent = "No report yet. Use the extension popup on a website tab and click Inspect.";
        return;
    }

    meta.innerHTML = `
        <strong>${StorageInspectorRender.escapeHtml(report.tab.title || report.page.origin)}</strong><br>
        <code>${StorageInspectorRender.escapeHtml(report.tab.url)}</code><br>
        Collected ${StorageInspectorRender.escapeHtml(report.collectedAt)}
    `;

    StorageInspectorRender.renderStorageReport(report, results);
}

loadReport();
