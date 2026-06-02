function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
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

function summarizeKeyValueEntries(entries, field = "totalBytes") {
    return {
        count: entries.length,
        totalBytes: entries.reduce((sum, item) => sum + (item[field] ?? 0), 0)
    };
}

function renderKeyValueSection(title, note, data, keyField = "key") {
    if (!data.supported) {
        return `<section class="section"><h2>${escapeHtml(title)}</h2><p class="empty">${escapeHtml(data.error)}</p></section>`;
    }
    const summary = summarizeKeyValueEntries(data.entries);
    if (!data.entries.length) {
        return `<section class="section"><h2>${escapeHtml(title)}</h2>${note ? `<p class="section-note">${escapeHtml(note)}</p>` : ""}<p class="empty">No entries.</p></section>`;
    }
    const rows = data.entries
        .map(
            (entry) => `<tr>
        <th scope="row">${escapeHtml(entry[keyField])}</th>
        <td>${escapeHtml(entry.valuePreview)} <span class="empty">(${escapeHtml(formatBytes(entry.totalBytes ?? entry.bytes))})</span></td>
    </tr>`
        )
        .join("");
    return `<section class="section">
        <h2>${escapeHtml(title)}</h2>
        ${note ? `<p class="section-note">${escapeHtml(note)}</p>` : ""}
        <table><tbody>
            <tr><th scope="row">Entries</th><td>${summary.count}</td></tr>
            <tr><th scope="row">Size</th><td>${escapeHtml(formatBytes(summary.totalBytes))}</td></tr>
            ${rows}
        </tbody></table>
    </section>`;
}

function renderCookieSection(cookies) {
    if (!cookies.length) {
        return `<section class="section"><h2>Cookies</h2><p class="empty">No cookies for this URL.</p></section>`;
    }
    const rows = cookies
        .map(
            (cookie) => `<tr>
        <th scope="row">${escapeHtml(cookie.name)}</th>
        <td>
            ${escapeHtml(cookie.valuePreview)}
            <div class="empty">HttpOnly: ${cookie.httpOnly ? "yes" : "no"} · ${escapeHtml(cookie.source)}</div>
        </td>
    </tr>`
        )
        .join("");
    const totalBytes = cookies.reduce((sum, item) => sum + (item.bytes ?? 0), 0);
    return `<section class="section">
        <h2>Cookies</h2>
        <p class="section-note">Includes HttpOnly cookies via chrome.cookies (extension only).</p>
        <table><tbody>
            <tr><th scope="row">Entries</th><td>${cookies.length}</td></tr>
            <tr><th scope="row">Size (estimate)</th><td>${escapeHtml(formatBytes(totalBytes))}</td></tr>
            ${rows}
        </tbody></table>
    </section>`;
}

function renderCacheSection(cache) {
    if (!cache.supported) {
        return `<section class="section"><h2>Cache Storage</h2><p class="empty">${escapeHtml(cache.error)}</p></section>`;
    }
    const allEntries = cache.caches.flatMap((item) => item.entries);
    if (!allEntries.length) {
        return `<section class="section"><h2>Cache Storage</h2><p class="empty">No cache buckets.</p></section>`;
    }
    const rows = cache.caches
        .flatMap((bucket) =>
            bucket.entries.map(
                (entry) => `<tr>
            <th scope="row">${escapeHtml(bucket.name)}</th>
            <td>${escapeHtml(entry.method)} ${escapeHtml(entry.url)} (${escapeHtml(formatBytes(entry.size))})</td>
        </tr>`
            )
        )
        .join("");
    return `<section class="section"><h2>Cache Storage</h2><table><tbody>${rows}</tbody></table></section>`;
}

function renderIndexedDbSection(indexedDb) {
    if (!indexedDb.supported) {
        return `<section class="section"><h2>IndexedDB</h2><p class="empty">${escapeHtml(indexedDb.error)}</p></section>`;
    }
    if (!indexedDb.databases.length) {
        return `<section class="section"><h2>IndexedDB</h2><p class="empty">No databases.</p></section>`;
    }
    const rows = indexedDb.databases
        .flatMap((database) =>
            database.stores.length
                ? database.stores.map(
                      (store) => `<tr>
                <th scope="row">${escapeHtml(database.name)}</th>
                <td>${escapeHtml(store.name)} — ${escapeHtml(String(store.recordCount ?? "N/A"))} records (v${escapeHtml(String(database.version))})</td>
            </tr>`
                  )
                : [
                      `<tr><th scope="row">${escapeHtml(database.name)}</th><td>v${escapeHtml(String(database.version))}, no stores</td></tr>`
                  ]
        )
        .join("");
    return `<section class="section"><h2>IndexedDB</h2><table><tbody>${rows}</tbody></table></section>`;
}

function renderQuotaSection(quota) {
    if (!quota.supported) {
        return `<section class="section"><h2>Quota</h2><p class="empty">${escapeHtml(quota.note || "Unavailable")}</p></section>`;
    }
    const detailRows = quota.usageDetails
        ? Object.entries(quota.usageDetails)
              .map(([key, value]) => `<tr><th scope="row">${escapeHtml(key)}</th><td>${escapeHtml(formatBytes(value))}</td></tr>`)
              .join("")
        : "";
    return `<section class="section">
        <h2>Quota</h2>
        <table><tbody>
            <tr><th scope="row">Used</th><td>${escapeHtml(formatBytes(quota.usage))}</td></tr>
            <tr><th scope="row">Quota</th><td>${escapeHtml(formatBytes(quota.quota))}</td></tr>
            ${detailRows}
        </tbody></table>
    </section>`;
}

function renderStorageReport(report, targetElement) {
    const html = [
        renderQuotaSection(report.page.quota),
        renderKeyValueSection(
            "localStorage",
            "Persistent preferences and tokens.",
            report.page.localStorage
        ),
        renderKeyValueSection("sessionStorage", "Cleared when the tab closes.", report.page.sessionStorage),
        renderCookieSection(report.cookies),
        renderCacheSection(report.page.cache),
        renderIndexedDbSection(report.page.indexedDb)
    ].join("");

    targetElement.innerHTML = html;
}

window.StorageInspectorRender = {
    escapeHtml,
    formatBytes,
    renderStorageReport
};
