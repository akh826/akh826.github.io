/**
 * Injected into the active tab. Must be self-contained (no imports).
 * Returns a JSON-serializable storage snapshot for that page origin.
 */
async function collectPageStorage() {
    function byteLength(text) {
        return new TextEncoder().encode(String(text)).length;
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
                    valuePreview: value.length > 120 ? `${value.slice(0, 120)}...` : value,
                    totalBytes: keyBytes + valueBytes
                });
            }
            return { supported: true, error: "", entries };
        } catch (error) {
            return {
                supported: false,
                error: error instanceof Error ? error.message : "Storage blocked.",
                entries: []
            };
        }
    }

    function parseDocumentCookies() {
        try {
            if (!document.cookie) {
                return { supported: true, entries: [] };
            }
            const entries = document.cookie.split(";").map((rawCookie) => {
                const trimmed = rawCookie.trim();
                const separatorIndex = trimmed.indexOf("=");
                if (separatorIndex === -1) {
                    return {
                        name: decodeURIComponent(trimmed),
                        valuePreview: "",
                        bytes: byteLength(trimmed),
                        httpOnly: false,
                        source: "document.cookie"
                    };
                }
                const name = decodeURIComponent(trimmed.slice(0, separatorIndex));
                const value = decodeURIComponent(trimmed.slice(separatorIndex + 1));
                return {
                    name,
                    valuePreview: value.length > 120 ? `${value.slice(0, 120)}...` : value,
                    bytes: byteLength(trimmed),
                    httpOnly: false,
                    source: "document.cookie"
                };
            });
            return { supported: true, entries };
        } catch (error) {
            return {
                supported: false,
                entries: [],
                error: error instanceof Error ? error.message : "Cookie read failed."
            };
        }
    }

    async function getQuotaEstimate() {
        if (!navigator.storage?.estimate) {
            return { supported: false, note: "Storage Quota API unavailable." };
        }
        try {
            const estimate = await navigator.storage.estimate();
            return {
                supported: true,
                usage: estimate.usage ?? null,
                quota: estimate.quota ?? null,
                usageDetails: estimate.usageDetails ?? null
            };
        } catch {
            return { supported: false, note: "Could not read quota." };
        }
    }

    async function getCacheStorageSnapshot() {
        if (!("caches" in window)) {
            return { supported: false, error: "Cache Storage unavailable.", caches: [] };
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
                            size = (await response.clone().blob()).size;
                        }
                    } catch {
                        size = 0;
                    }
                    entries.push({ url: request.url, method: request.method, size });
                }
                cachesList.push({
                    name: cacheName,
                    entries,
                    totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0)
                });
            }
            return { supported: true, caches: cachesList };
        } catch (error) {
            return {
                supported: false,
                error: error instanceof Error ? error.message : "Cache read failed.",
                caches: []
            };
        }
    }

    function openDatabase(name) {
        return new Promise((resolve) => {
            const request = indexedDB.open(name);
            request.onerror = () =>
                resolve({ error: request.error?.message ?? "Open failed." });
            request.onsuccess = () => resolve({ db: request.result });
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
        if (!("indexedDB" in window) || !indexedDB.databases) {
            return {
                supported: false,
                error: "indexedDB.databases() not supported.",
                databases: []
            };
        }
        try {
            const databaseList = await indexedDB.databases();
            const databases = [];
            for (const databaseMeta of databaseList) {
                const name = databaseMeta.name;
                if (!name) continue;
                const opened = await openDatabase(name);
                if (opened.error || !opened.db) {
                    databases.push({ name, version: databaseMeta.version ?? "N/A", stores: [], error: opened.error });
                    continue;
                }
                const db = opened.db;
                const stores = [];
                for (const storeName of db.objectStoreNames) {
                    stores.push({
                        name: storeName,
                        recordCount: await countObjectStore(db, storeName)
                    });
                }
                databases.push({ name, version: db.version, stores });
                db.close();
            }
            return { supported: true, databases };
        } catch (error) {
            return {
                supported: false,
                error: error instanceof Error ? error.message : "IndexedDB read failed.",
                databases: []
            };
        }
    }

    async function getServiceWorkerSnapshot() {
        if (!("serviceWorker" in navigator)) {
            return { supported: false, registrations: [] };
        }
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            return {
                supported: true,
                registrations: registrations.map((registration) => ({
                    scope: registration.scope,
                    active: registration.active?.scriptURL ?? "",
                    waiting: registration.waiting?.scriptURL ?? "",
                    installing: registration.installing?.scriptURL ?? ""
                }))
            };
        } catch {
            return { supported: false, registrations: [] };
        }
    }

    const [quota, cache, indexedDb, serviceWorkers] = await Promise.all([
        getQuotaEstimate(),
        getCacheStorageSnapshot(),
        getIndexedDbSnapshot(),
        getServiceWorkerSnapshot()
    ]);

    return {
        collectedAt: new Date().toISOString(),
        origin: location.origin,
        href: location.href,
        localStorage: getStorageEntries(localStorage),
        sessionStorage: getStorageEntries(sessionStorage),
        documentCookies: parseDocumentCookies(),
        quota,
        cache,
        indexedDb,
        serviceWorkers
    };
}

collectPageStorage();
