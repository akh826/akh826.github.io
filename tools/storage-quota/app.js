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

async function getCacheStorageSnapshot() {
    if (!("caches" in window)) {
        return {
            supported: false,
            error: "Cache Storage API is not available in this browser.",
            caches: []
        };
    }

    try {
        const cacheNames = await caches.keys();
        const cachesList = [];

        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            const entries = [];

            for (const request of requests) {
                let size = 0;
                try {
                    const response = await cache.match(request);
                    if (response) {
                        const blob = await response.clone().blob();
                        size = blob.size;
                    }
                } catch {
                    size = 0;
                }

                entries.push({
                    url: request.url,
                    method: request.method,
                    size
                });
            }

            const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
            cachesList.push({
                name: cacheName,
                entries,
                totalBytes
            });
        }

        return {
            supported: true,
            error: "",
            caches: cachesList
        };
    } catch {
        return {
            supported: false,
            error: "Could not read Cache Storage for this origin.",
            caches: []
        };
    }
}

function openDatabase(name) {
    return new Promise((resolve) => {
        const request = indexedDB.open(name);

        request.onerror = () => {
            resolve({
                name,
                error: request.error?.message ?? "Failed to open database."
            });
        };

        request.onsuccess = () => {
            resolve({ db: request.result });
        };
    });
}

function countObjectStore(db, storeName) {
    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const countRequest = store.count();

            countRequest.onsuccess = () => resolve(countRequest.result ?? 0);
            countRequest.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function getIndexedDbSnapshot() {
    if (!("indexedDB" in window)) {
        return {
            supported: false,
            error: "IndexedDB is not available in this browser.",
            databases: []
        };
    }

    if (!indexedDB.databases) {
        return {
            supported: false,
            error: "indexedDB.databases() is not supported in this browser.",
            databases: []
        };
    }

    try {
        const databaseList = await indexedDB.databases();
        const databases = [];

        for (const databaseMeta of databaseList) {
            const name = databaseMeta.name;

            if (!name) {
                continue;
            }

            const opened = await openDatabase(name);

            if (opened.error || !opened.db) {
                databases.push({
                    name,
                    version: databaseMeta.version ?? "N/A",
                    stores: [],
                    error: opened.error
                });
                continue;
            }

            const db = opened.db;
            const stores = [];

            for (const storeName of db.objectStoreNames) {
                const recordCount = await countObjectStore(db, storeName);
                stores.push({
                    name: storeName,
                    recordCount
                });
            }

            databases.push({
                name,
                version: db.version,
                stores,
                error: ""
            });

            db.close();
        }

        return {
            supported: true,
            error: "",
            databases
        };
    } catch {
        return {
            supported: false,
            error: "Could not enumerate IndexedDB databases for this origin.",
            databases: []
        };
    }
}

async function getServiceWorkerSnapshot() {
    if (!("serviceWorker" in navigator)) {
        return {
            supported: false,
            error: "Service workers are not available in this browser.",
            registrations: []
        };
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const items = registrations.map((registration) => ({
            scope: registration.scope,
            active: registration.active?.scriptURL ?? "",
            waiting: registration.waiting?.scriptURL ?? "",
            installing: registration.installing?.scriptURL ?? ""
        }));

        return {
            supported: true,
            error: "",
            registrations: items
        };
    } catch {
        return {
            supported: false,
            error: "Could not read service worker registrations.",
            registrations: []
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

function renderOriginCard(container) {
    const card = document.createElement("article");
    card.className = "info-card";

    card.innerHTML = `
        <h2>Current origin</h2>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Origin</th><td><code>${escapeHtml(location.origin)}</code></td></tr>
                <tr><th scope="row">Page</th><td><code>${escapeHtml(location.href)}</code></td></tr>
            </tbody>
        </table>
        <p class="tool-note-inline">
            This tool can only read storage for the site you are on now (same-origin policy).
            To inspect another website, open this tool from that site’s origin.
        </p>
    `;

    container.appendChild(card);
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
        <p class="tool-note-inline">
            Totals may include IndexedDB, Cache Storage, and other persisted data for this origin.
            HTTP disk cache is managed by the browser and cannot be listed from JavaScript.
        </p>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Used (estimate.usage)</th><td>${escapeHtml(formatBytes(quotaData.usage))}</td></tr>
                <tr><th scope="row">Quota (estimate.quota)</th><td>${escapeHtml(formatBytes(quotaData.quota))}</td></tr>
                <tr><th scope="row">Remaining</th><td>${escapeHtml(formatBytes(quotaData.remaining))}</td></tr>
                <tr><th scope="row">Used %</th><td>${escapeHtml(String(quotaData.usedPercent))}${quotaData.usedPercent !== "N/A" ? "%" : ""}</td></tr>
            </tbody>
        </table>
        <h3 class="subsection-title">Usage details</h3>
        <table class="info-table">
            <tbody>
                ${usageDetailsRows}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

function renderStorageEntriesCard(container, title, keyLabel, entries, summary, unsupportedNote = "", subtitle = "") {
    const card = document.createElement("article");
    card.className = "info-card";

    const subtitleHtml = subtitle
        ? `<p class="tool-note-inline">${escapeHtml(subtitle)}</p>`
        : "";

    if (unsupportedNote) {
        card.innerHTML = `
            <h2>${escapeHtml(title)}</h2>
            ${subtitleHtml}
            <p class="tool-note-inline">${escapeHtml(unsupportedNote)}</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!entries.length) {
        card.innerHTML = `
            <h2>${escapeHtml(title)}</h2>
            ${subtitleHtml}
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
        ${subtitleHtml}
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

function renderCacheStorageCard(container, cacheData) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!cacheData.supported) {
        card.innerHTML = `
            <h2>Cache Storage</h2>
            <p class="tool-note-inline">${escapeHtml(cacheData.error)}</p>
        `;
        container.appendChild(card);
        return;
    }

    const allEntries = cacheData.caches.flatMap((cacheItem) => cacheItem.entries);
    const totalBytes = cacheData.caches.reduce((sum, cacheItem) => sum + cacheItem.totalBytes, 0);

    if (!allEntries.length) {
        card.innerHTML = `
            <h2>Cache Storage</h2>
            <p class="tool-note-inline">No cache buckets or cached responses for this origin.</p>
            <table class="info-table">
                <tbody>
                    <tr><th scope="row">Cache buckets</th><td>0</td></tr>
                    <tr><th scope="row">Cached responses</th><td>0</td></tr>
                </tbody>
            </table>
        `;
        container.appendChild(card);
        return;
    }

    const cacheSections = cacheData.caches
        .map((cacheItem) => {
            const rows = cacheItem.entries
                .map((entry) => `<tr>
                    <td><code>${escapeHtml(entry.method)}</code></td>
                    <td>${escapeHtml(entry.url.length > 72 ? `${entry.url.slice(0, 72)}...` : entry.url)}</td>
                    <td>${escapeHtml(formatBytes(entry.size))}</td>
                </tr>`)
                .join("");

            return `
                <h3 class="subsection-title">${escapeHtml(cacheItem.name)}</h3>
                <table class="info-table">
                    <tbody>
                        <tr><th scope="row">Responses</th><td>${escapeHtml(String(cacheItem.entries.length))}</td></tr>
                        <tr><th scope="row">Bucket size (estimate)</th><td>${escapeHtml(formatBytes(cacheItem.totalBytes))}</td></tr>
                    </tbody>
                </table>
                <table class="info-table storage-entries-table">
                    <thead>
                        <tr>
                            <th scope="col">Method</th>
                            <th scope="col">URL</th>
                            <th scope="col">Body size</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        })
        .join("");

    card.innerHTML = `
        <h2>Cache Storage</h2>
        <p class="tool-note-inline">
            Programmatic caches used by service workers and PWAs. This is not the browser’s private HTTP cache.
        </p>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Cache buckets</th><td>${escapeHtml(String(cacheData.caches.length))}</td></tr>
                <tr><th scope="row">Cached responses</th><td>${escapeHtml(String(allEntries.length))}</td></tr>
                <tr><th scope="row">Total body size (estimate)</th><td>${escapeHtml(formatBytes(totalBytes))}</td></tr>
            </tbody>
        </table>
        ${cacheSections}
    `;

    container.appendChild(card);
}

function renderIndexedDbCard(container, indexedDbData) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!indexedDbData.supported) {
        card.innerHTML = `
            <h2>IndexedDB</h2>
            <p class="tool-note-inline">${escapeHtml(indexedDbData.error)}</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!indexedDbData.databases.length) {
        card.innerHTML = `
            <h2>IndexedDB</h2>
            <p class="tool-note-inline">No IndexedDB databases for this origin.</p>
        `;
        container.appendChild(card);
        return;
    }

    const sections = indexedDbData.databases
        .map((database) => {
            if (database.error) {
                return `
                    <h3 class="subsection-title">${escapeHtml(database.name)}</h3>
                    <p class="tool-note-inline">${escapeHtml(database.error)}</p>
                `;
            }

            if (!database.stores.length) {
                return `
                    <h3 class="subsection-title">${escapeHtml(database.name)}</h3>
                    <table class="info-table">
                        <tbody>
                            <tr><th scope="row">Version</th><td>${escapeHtml(String(database.version))}</td></tr>
                            <tr><th scope="row">Object stores</th><td>0</td></tr>
                        </tbody>
                    </table>
                `;
            }

            const storeRows = database.stores
                .map((store) => `<tr>
                    <th scope="row">${escapeHtml(store.name)}</th>
                    <td>${escapeHtml(store.recordCount === null ? "N/A" : String(store.recordCount))}</td>
                </tr>`)
                .join("");

            return `
                <h3 class="subsection-title">${escapeHtml(database.name)}</h3>
                <table class="info-table">
                    <tbody>
                        <tr><th scope="row">Version</th><td>${escapeHtml(String(database.version))}</td></tr>
                        <tr><th scope="row">Object stores</th><td>${escapeHtml(String(database.stores.length))}</td></tr>
                    </tbody>
                </table>
                <table class="info-table storage-entries-table">
                    <thead>
                        <tr>
                            <th scope="col">Object store</th>
                            <th scope="col">Record count</th>
                        </tr>
                    </thead>
                    <tbody>${storeRows}</tbody>
                </table>
            `;
        })
        .join("");

    card.innerHTML = `
        <h2>IndexedDB</h2>
        <p class="tool-note-inline">Structured databases used by many web apps for offline data and large payloads.</p>
        ${sections}
    `;

    container.appendChild(card);
}

function renderServiceWorkerCard(container, serviceWorkerData) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!serviceWorkerData.supported) {
        card.innerHTML = `
            <h2>Service workers</h2>
            <p class="tool-note-inline">${escapeHtml(serviceWorkerData.error)}</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!serviceWorkerData.registrations.length) {
        card.innerHTML = `
            <h2>Service workers</h2>
            <p class="tool-note-inline">No service worker registrations for this origin.</p>
        `;
        container.appendChild(card);
        return;
    }

    const rows = serviceWorkerData.registrations
        .map((registration) => `<tr>
            <th scope="row">${escapeHtml(registration.scope)}</th>
            <td>
                <div>Active: ${escapeHtml(registration.active || "—")}</div>
                <div>Waiting: ${escapeHtml(registration.waiting || "—")}</div>
                <div>Installing: ${escapeHtml(registration.installing || "—")}</div>
            </td>
        </tr>`)
        .join("");

    card.innerHTML = `
        <h2>Service workers</h2>
        <table class="info-table storage-entries-table">
            <thead>
                <tr>
                    <th scope="col">Scope</th>
                    <th scope="col">Scripts</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    container.appendChild(card);
}

async function collectStorageAnalytics() {
    const [quotaData, cacheData, indexedDbData, serviceWorkerData] = await Promise.all([
        getQuotaEstimate(),
        getCacheStorageSnapshot(),
        getIndexedDbSnapshot(),
        getServiceWorkerSnapshot()
    ]);

    const localData = getStorageEntries(localStorage);
    const sessionData = getStorageEntries(sessionStorage);
    const cookieData = parseCookies();

    const localSummary = summarizeEntries(localData.entries, "totalBytes");
    const sessionSummary = summarizeEntries(sessionData.entries, "totalBytes");
    const cookieSummary = summarizeEntries(cookieData.entries, "bytes");

    return {
        quotaData,
        cacheData,
        indexedDbData,
        serviceWorkerData,
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

    renderOriginCard(grid);
    renderQuotaCard(grid, analytics.quotaData);

    renderStorageEntriesCard(
        grid,
        "localStorage",
        "key",
        analytics.localData.entries,
        analytics.localSummary,
        analytics.localData.supported ? "" : analytics.localData.error,
        "Persistent key-value storage (often used for site preferences and tokens)."
    );

    renderStorageEntriesCard(
        grid,
        "sessionStorage",
        "key",
        analytics.sessionData.entries,
        analytics.sessionSummary,
        analytics.sessionData.supported ? "" : analytics.sessionData.error,
        "Tab-scoped storage cleared when the tab closes."
    );

    renderStorageEntriesCard(
        grid,
        "Cookies",
        "name",
        analytics.cookieData.entries,
        analytics.cookieSummary,
        analytics.cookieData.supported ? "" : analytics.cookieData.error,
        "Visible cookies for this page path; HttpOnly cookies still exist but may not appear here."
    );

    renderCacheStorageCard(grid, analytics.cacheData);
    renderIndexedDbCard(grid, analytics.indexedDbData);
    renderServiceWorkerCard(grid, analytics.serviceWorkerData);

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
