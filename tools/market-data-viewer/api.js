/**
 * Massive.com REST API client (browser-side).
 * Docs: https://massive.com/docs/rest/stocks/aggregates/custom-bars
 */
const MASSIVE_STORAGE_KEY = "massiveApiKey";
const MASSIVE_BASE_URL = "https://api.massive.com";

window.MassiveAPI = {
    getApiKey() {
        return localStorage.getItem(MASSIVE_STORAGE_KEY) || "";
    },

    setApiKey(key) {
        const trimmed = String(key || "").trim();
        if (trimmed) {
            localStorage.setItem(MASSIVE_STORAGE_KEY, trimmed);
        } else {
            localStorage.removeItem(MASSIVE_STORAGE_KEY);
        }
    },

    clearApiKey() {
        localStorage.removeItem(MASSIVE_STORAGE_KEY);
    },

    hasApiKey() {
        return Boolean(this.getApiKey());
    },

    async request(path, params = {}) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error("API key is required. Save your Massive API key first.");
        }

        const url = new URL(`${MASSIVE_BASE_URL}${path}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        });
        url.searchParams.set("apiKey", apiKey);

        const response = await fetch(url.toString());
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = payload.error || payload.message || `HTTP ${response.status}`;
            throw new Error(message);
        }

        const hasResults = Array.isArray(payload.results) && payload.results.length > 0;
        if (payload.status && payload.status !== "OK" && !hasResults) {
            throw new Error(payload.error || payload.message || `API status: ${payload.status}`);
        }

        return payload;
    },

    async searchTickers(query, limit = 12) {
        const payload = await this.request("/v3/reference/tickers", {
            search: query,
            market: "stocks",
            active: true,
            limit,
            sort: "ticker",
            order: "asc"
        });

        return (payload.results || []).map((item) => ({
            ticker: item.ticker,
            name: item.name,
            exchange: item.primary_exchange
        }));
    },

    async getAggregates(ticker, from, to, options = {}) {
        const multiplier = options.multiplier ?? 1;
        const timespan = options.timespan ?? "day";
        const path =
            `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/` +
            `${multiplier}/${timespan}/${from}/${to}`;

        const payload = await this.request(path, {
            adjusted: true,
            sort: "asc",
            limit: 50000
        });

        return (payload.results || []).map((bar) => ({
            t: bar.t,
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v
        }));
    }
};
