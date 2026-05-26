function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function byteLength(text) {
    return new TextEncoder().encode(String(text)).length;
}

function formatBytes(value) {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
        return "N/A";
    }

    if (value < 1024) {
        return `${value} B`;
    }

    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function getStorageEntries(storageObject) {
    const entries = [];

    try {
        for (let index = 0; index < storageObject.length; index += 1) {
            const key = storageObject.key(index) ?? "";
            const value = storageObject.getItem(key) ?? "";
            const keyBytes = byteLength(key);
            const valueBytes = byteLength(value);
            entries.push({
                key,
                valuePreview: value.length > 80 ? `${value.slice(0, 80)}...` : value,
                keyBytes,
                valueBytes,
                totalBytes: keyBytes + valueBytes
            });
        }
    } catch {
        return {
            supported: false,
            error: "Storage access blocked in this context.",
            entries: []
        };
    }

    return {
        supported: true,
        error: "",
        entries
    };
}

function parseCookies() {
    try {
        if (!document.cookie) {
            return {
                supported: true,
                entries: []
            };
        }

        const entries = document.cookie.split(";").map((rawCookie) => {
            const trimmed = rawCookie.trim();
            const separatorIndex = trimmed.indexOf("=");

            if (separatorIndex === -1) {
                const nameOnly = decodeURIComponent(trimmed);
                return {
                    name: nameOnly,
                    valuePreview: "",
                    bytes: byteLength(trimmed)
                };
            }

            const encodedName = trimmed.slice(0, separatorIndex);
            const encodedValue = trimmed.slice(separatorIndex + 1);
            const name = decodeURIComponent(encodedName);
            const value = decodeURIComponent(encodedValue);
            const valuePreview = value.length > 80 ? `${value.slice(0, 80)}...` : value;

            return {
                name,
                valuePreview,
                bytes: byteLength(trimmed)
            };
        });

        return {
            supported: true,
            entries
        };
    } catch {
        return {
            supported: false,
            entries: [],
            error: "Cookies are blocked or unavailable in this context."
        };
    }
}

async function getQuotaEstimate() {
    if (!navigator.storage?.estimate) {
        return {
            supported: false,
            usage: null,
            quota: null,
            usageDetails: null,
            note: "Storage Quota API is not available in this browser."
        };
    }

    try {
        const estimate = await navigator.storage.estimate();
        const usage = typeof estimate.usage === "number" ? estimate.usage : null;
        const quota = typeof estimate.quota === "number" ? estimate.quota : null;
        const remaining = usage !== null && quota !== null ? Math.max(0, quota - usage) : null;
        const usedPercent = usage !== null && quota ? ((usage / quota) * 100).toFixed(2) : "N/A";

        return {
            supported: true,
            usage,
            quota,
            remaining,
            usedPercent,
            usageDetails: estimate.usageDetails ?? null,
            note: ""
        };
    } catch {
        return {
            supported: false,
            usage: null,
            quota: null,
            usageDetails: null,
            note: "Could not read storage estimate in this browser/context."
        };
    }
}

function summarizeEntries(entries, fieldName) {
    const totalBytes = entries.reduce((sum, item) => sum + (item[fieldName] ?? 0), 0);
    return {
        count: entries.length,
        totalBytes
    };
}

function renderQuotaCard(container, quotaData) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!quotaData.supported) {
        card.innerHTML = `
            <h2>Storage Quota API</h2>
            <p class="tool-note-inline">${escapeHtml(quotaData.note || "Not available.")}</p>
        `;
        container.appendChild(card);
        return;
    }

    const usageDetailsRows = quotaData.usageDetails
        ? Object.entries(quotaData.usageDetails)
            .map(([key, value]) => `<tr>
                <th scope="row">${escapeHtml(key)}</th>
                <td>${escapeHtml(formatBytes(value))}</td>
            </tr>`)
            .join("")
        : `<tr><th scope="row">Details</th><td>Not provided by browser</td></tr>`;

    card.innerHTML = `
        <h2>Storage Quota API</h2>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Used (estimate.usage)</th><td>${escapeHtml(formatBytes(quotaData.usage))}</td></tr>
                <tr><th scope="row">Quota (estimate.quota)</th><td>${escapeHtml(formatBytes(quotaData.quota))}</td></tr>
                <tr><th scope="row">Remaining</th><td>${escapeHtml(formatBytes(quotaData.remaining))}</td></tr>
                <tr><th scope="row">Used %</th><td>${escapeHtml(String(quotaData.usedPercent))}${quotaData.usedPercent !== "N/A" ? "%" : ""}</td></tr>
            </tbody>
        </table>
        <h2 class="subsection-title">Usage Details</h2>
        <table class="info-table">
            <tbody>
                ${usageDetailsRows}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

function renderStorageEntriesCard(container, title, keyLabel, entries, summary, unsupportedNote = "") {
    const card = document.createElement("article");
    card.className = "info-card";

    if (unsupportedNote) {
        card.innerHTML = `
            <h2>${escapeHtml(title)}</h2>
            <p class="tool-note-inline">${escapeHtml(unsupportedNote)}</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!entries.length) {
        card.innerHTML = `
            <h2>${escapeHtml(title)}</h2>
            <p class="tool-note-inline">No entries found.</p>
            <table class="info-table">
                <tbody>
                    <tr><th scope="row">Entries</th><td>0</td></tr>
                    <tr><th scope="row">Total size</th><td>0 B</td></tr>
                </tbody>
            </table>
        `;
        container.appendChild(card);
        return;
    }

    const rows = entries
        .map((entry) => `<tr>
            <th scope="row">${escapeHtml(entry[keyLabel])}</th>
            <td>${escapeHtml(entry.valuePreview)}</td>
            <td>${escapeHtml(formatBytes(entry.totalBytes ?? entry.bytes))}</td>
        </tr>`)
        .join("");

    card.innerHTML = `
        <h2>${escapeHtml(title)}</h2>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Entries</th><td>${escapeHtml(String(summary.count))}</td></tr>
                <tr><th scope="row">Total size</th><td>${escapeHtml(formatBytes(summary.totalBytes))}</td></tr>
            </tbody>
        </table>
        <table class="info-table storage-entries-table">
            <thead>
                <tr>
                    <th scope="col">${escapeHtml(keyLabel === "key" ? "Key" : "Cookie")}</th>
                    <th scope="col">Value preview</th>
                    <th scope="col">Size</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

async function collectStorageAnalytics() {
    const quotaData = await getQuotaEstimate();

    const localData = getStorageEntries(localStorage);
    const sessionData = getStorageEntries(sessionStorage);
    const cookieData = parseCookies();

    const localSummary = summarizeEntries(localData.entries, "totalBytes");
    const sessionSummary = summarizeEntries(sessionData.entries, "totalBytes");
    const cookieSummary = summarizeEntries(cookieData.entries, "bytes");

    return {
        quotaData,
        localData,
        sessionData,
        cookieData,
        localSummary,
        sessionSummary,
        cookieSummary
    };
}

async function renderStorageAnalytics() {
    const grid = document.getElementById("storageGrid");
    const status = document.getElementById("toolStatus");

    if (!grid || !status) {
        return;
    }

    status.textContent = "Collecting storage analytics...";
    status.classList.remove("success");

    const analytics = await collectStorageAnalytics();

    grid.innerHTML = "";

    renderQuotaCard(grid, analytics.quotaData);

    renderStorageEntriesCard(
        grid,
        "localStorage",
        "key",
        analytics.localData.entries,
        analytics.localSummary,
        analytics.localData.supported ? "" : analytics.localData.error
    );

    renderStorageEntriesCard(
        grid,
        "sessionStorage",
        "key",
        analytics.sessionData.entries,
        analytics.sessionSummary,
        analytics.sessionData.supported ? "" : analytics.sessionData.error
    );

    renderStorageEntriesCard(
        grid,
        "Cookies",
        "name",
        analytics.cookieData.entries,
        analytics.cookieSummary,
        analytics.cookieData.supported ? "" : analytics.cookieData.error
    );

    status.textContent = `Analytics updated at ${new Date().toLocaleString()}`;
    status.classList.add("success");
}

function initStorageQuotaTool() {
    const refreshButton = document.getElementById("refreshStorageAnalytics");

    refreshButton?.addEventListener("click", () => {
        renderStorageAnalytics();
    });

    renderStorageAnalytics();
}

initStorageQuotaTool();