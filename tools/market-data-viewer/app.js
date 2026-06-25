const TICKER_STORAGE_KEY = "marketDataTickers";
const MAX_TICKERS = 8;

const CHART_COLORS = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#ca8a04",
    "#9333ea",
    "#0891b2",
    "#ea580c",
    "#4f46e5"
];

const INDICATOR_COLORS = ["#7c3aed", "#0d9488", "#db2777", "#65a30d", "#b45309"];

let priceChart = null;
let indicatorChart = null;
let searchTimer = null;
let selectedTickers = [];
let tickerBars = new Map();
let chartResizeObserver = null;
let apiSetupMode = false;

function getFormulas() {
    return window.MARKET_FORMULAS ?? [];
}

function getFormulaById(id) {
    return getFormulas().find((f) => f.id === id);
}

function setStatus(message, type = "") {
    const status = document.getElementById("fetchStatus");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function formatDateInput(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function loadSavedTickers() {
    try {
        const raw = localStorage.getItem(TICKER_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
            selectedTickers = parsed
                .filter((item) => item && item.ticker)
                .slice(0, MAX_TICKERS)
                .map((item) => ({ ticker: item.ticker, name: item.name || item.ticker }));
        }
    } catch {
        selectedTickers = [];
    }
}

function saveTickers() {
    localStorage.setItem(TICKER_STORAGE_KEY, JSON.stringify(selectedTickers));
}

function renderTickerChips() {
    const wrap = document.getElementById("tickerChips");
    if (!wrap) {
        return;
    }

    if (!selectedTickers.length) {
        wrap.innerHTML = '<p class="mkt-empty-hint">No tickers selected. Search and add symbols above.</p>';
        return;
    }

    wrap.innerHTML = selectedTickers
        .map(
            (item, index) => `
        <span class="mkt-chip" data-index="${index}">
            <span class="mkt-chip-ticker">${item.ticker}</span>
            <span class="mkt-chip-name">${item.name}</span>
            <button type="button" class="mkt-chip-remove" data-index="${index}" aria-label="Remove ${item.ticker}">&times;</button>
        </span>`
        )
        .join("");

    wrap.querySelectorAll(".mkt-chip-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.index);
            const removed = selectedTickers[idx];
            selectedTickers.splice(idx, 1);
            if (removed) {
                tickerBars.delete(removed.ticker);
            }
            saveTickers();
            renderTickerChips();
            updateIndicatorTargetOptions();
            renderCharts();
        });
    });
}

function updateIndicatorTargetOptions() {
    const select = document.getElementById("indicatorTarget");
    if (!select) {
        return;
    }

    const current = select.value;
    select.innerHTML = selectedTickers
        .map((item) => `<option value="${item.ticker}">${item.ticker}</option>`)
        .join("");

    if (selectedTickers.some((item) => item.ticker === current)) {
        select.value = current;
    }
}

function addTicker(item) {
    if (selectedTickers.some((t) => t.ticker === item.ticker)) {
        setStatus(`${item.ticker} is already selected.`, "error");
        return;
    }
    if (selectedTickers.length >= MAX_TICKERS) {
        setStatus(`Maximum ${MAX_TICKERS} tickers allowed.`, "error");
        return;
    }

    selectedTickers.push({ ticker: item.ticker, name: item.name });
    saveTickers();
    renderTickerChips();
    updateIndicatorTargetOptions();
    setStatus(`Added ${item.ticker}.`, "success");
}

function renderSearchResults(results) {
    const list = document.getElementById("searchResults");
    if (!list) {
        return;
    }

    if (!results.length) {
        list.innerHTML = "";
        list.hidden = true;
        return;
    }

    list.innerHTML = results
        .map(
            (item) => `
        <li>
            <button type="button" class="mkt-search-item" data-ticker="${item.ticker}" data-name="${item.name.replace(/"/g, "&quot;")}">
                <span class="mkt-search-ticker">${item.ticker}</span>
                <span class="mkt-search-name">${item.name}</span>
            </button>
        </li>`
        )
        .join("");
    list.hidden = false;

    list.querySelectorAll(".mkt-search-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            addTicker({ ticker: btn.dataset.ticker, name: btn.dataset.name });
            document.getElementById("tickerSearch").value = "";
            list.innerHTML = "";
            list.hidden = true;
        });
    });
}

async function searchTickers(query) {
    if (!query || query.length < 1) {
        renderSearchResults([]);
        return;
    }
    if (!window.MassiveAPI.hasApiKey()) {
        setStatus("Save your API key before searching tickers.", "error");
        return;
    }

    try {
        const results = await window.MassiveAPI.searchTickers(query);
        renderSearchResults(results);
    } catch (error) {
        setStatus(error.message, "error");
        renderSearchResults([]);
    }
}

function getDateRange() {
    const fromInput = document.getElementById("dateFrom");
    const toInput = document.getElementById("dateTo");
    return {
        from: fromInput?.value,
        to: toInput?.value
    };
}

function getChartMode() {
    return document.getElementById("chartMode")?.value || "percent";
}

function getTimespan() {
    return document.getElementById("timespan")?.value || "day";
}

function getIndicatorConfig() {
    const formulaId = document.getElementById("indicatorSelect")?.value || "";
    if (!formulaId) {
        return null;
    }

    const formula = getFormulaById(formulaId);
    if (!formula) {
        return null;
    }

    const params = {};
    for (const param of formula.params || []) {
        const field = document.getElementById(`ind-param-${param.id}`);
        const raw = field ? Number(field.value) : param.default;
        params[param.id] = param.integer ? Math.trunc(raw) : raw;
    }

    return {
        formula,
        params,
        target: document.getElementById("indicatorTarget")?.value || selectedTickers[0]?.ticker
    };
}

function buildLabels(bars) {
    return bars.map((bar) => {
        const d = new Date(bar.t);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
    });
}

function transformSeries(bars, mode) {
    const closes = bars.map((b) => b.c);
    if (mode === "price") {
        return closes;
    }
    const base = closes[0];
    if (!base) {
        return closes.map(() => null);
    }
    return closes.map((c) => ((c - base) / base) * 100);
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
    return null;
}

function chartGridColor() {
    const isDark = document.body.classList.contains("dark");
    return isDark ? "#334155" : "#dbe3ee";
}

function chartTextColor() {
    const isDark = document.body.classList.contains("dark");
    return isDark ? "#94a3b8" : "#6b7280";
}

function ensureChartLibrary() {
    if (typeof Chart === "undefined") {
        throw new Error("Chart.js failed to load. Check your network connection and refresh.");
    }
}

function observeChartResize(chart, container) {
    if (!container || typeof ResizeObserver === "undefined") {
        return;
    }

    if (chartResizeObserver) {
        chartResizeObserver.disconnect();
    }

    chartResizeObserver = new ResizeObserver(() => {
        if (chart) {
            chart.resize();
        }
    });
    chartResizeObserver.observe(container);
}

function renderPriceChart(labels, datasets) {
    const canvas = document.getElementById("priceChart");
    const container = canvas?.closest(".mkt-chart-canvas-wrap");
    if (!canvas) {
        return;
    }

    if (!datasets.length) {
        setStatus("No chart data to plot.", "error");
        return;
    }

    try {
        ensureChartLibrary();
    } catch (error) {
        setStatus(error.message, "error");
        return;
    }

    priceChart = destroyChart(priceChart);

    const mode = getChartMode();
    try {
        priceChart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { labels: { color: chartTextColor() } },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const value = ctx.parsed.y;
                                if (value === null || value === undefined) {
                                    return `${ctx.dataset.label}: —`;
                                }
                                if (mode === "percent") {
                                    return `${ctx.dataset.label}: ${value.toFixed(2)}%`;
                                }
                                return `${ctx.dataset.label}: $${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: chartTextColor(), maxTicksLimit: 10 },
                        grid: { color: chartGridColor() }
                    },
                    y: {
                        ticks: {
                            color: chartTextColor(),
                            callback(value) {
                                return mode === "percent" ? `${value}%` : `$${value}`;
                            }
                        },
                        grid: { color: chartGridColor() }
                    }
                }
            }
        });

        observeChartResize(priceChart, container);
        requestAnimationFrame(() => priceChart?.resize());
    } catch (error) {
        setStatus(`Chart error: ${error.message}`, "error");
    }
}

function renderIndicatorChart(labels, datasets, formula) {
    const wrap = document.getElementById("indicatorChartWrap");
    const canvas = document.getElementById("indicatorChart");
    if (!wrap || !canvas) {
        return;
    }

    indicatorChart = destroyChart(indicatorChart);

    if (!datasets.length) {
        wrap.hidden = true;
        return;
    }

    wrap.hidden = false;
    document.getElementById("indicatorChartTitle").textContent = formula.title;

    try {
        ensureChartLibrary();
        indicatorChart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { labels: { color: chartTextColor() } }
                },
                scales: {
                    x: {
                        ticks: { color: chartTextColor(), maxTicksLimit: 10 },
                        grid: { color: chartGridColor() }
                    },
                    y: {
                        ticks: { color: chartTextColor() },
                        grid: { color: chartGridColor() },
                        ...(formula.id === "rsi"
                            ? { min: 0, max: 100 }
                            : {})
                    }
                }
            }
        });

        const container = canvas.closest(".mkt-chart-canvas-wrap");
        observeChartResize(indicatorChart, container);
        requestAnimationFrame(() => indicatorChart?.resize());
    } catch (error) {
        setStatus(`Indicator chart error: ${error.message}`, "error");
    }
}

function renderCharts() {
    const mode = getChartMode();
    const indicatorConfig = getIndicatorConfig();

    if (!selectedTickers.length || tickerBars.size === 0) {
        priceChart = destroyChart(priceChart);
        indicatorChart = destroyChart(indicatorChart);
        const wrap = document.getElementById("indicatorChartWrap");
        if (wrap) {
            wrap.hidden = true;
        }
        return;
    }

    const primaryBars = tickerBars.get(selectedTickers[0].ticker) || [];
    if (!primaryBars.length) {
        return;
    }

    const labels = buildLabels(primaryBars);
    const datasets = [];

    selectedTickers.forEach((item, index) => {
        const bars = tickerBars.get(item.ticker);
        if (!bars || !bars.length) {
            return;
        }

        const aligned = alignBarsToLabels(primaryBars, bars);
        datasets.push({
            label: item.ticker,
            data: transformSeries(aligned, mode),
            borderColor: CHART_COLORS[index % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15,
            spanGaps: true
        });
    });

    if (indicatorConfig?.formula?.chartType === "overlay" && indicatorConfig.target) {
        const targetBars = tickerBars.get(indicatorConfig.target);
        if (targetBars) {
            const aligned = alignBarsToLabels(primaryBars, targetBars);
            const result = indicatorConfig.formula.compute(aligned, indicatorConfig.params);
            result.series.forEach((series, idx) => {
                datasets.push({
                    label: `${indicatorConfig.target} ${series.label}`,
                    data: series.data,
                    borderColor: INDICATOR_COLORS[idx % INDICATOR_COLORS.length],
                    backgroundColor: INDICATOR_COLORS[idx % INDICATOR_COLORS.length],
                    borderWidth: 1.5,
                    borderDash: idx === 0 ? [] : [4, 3],
                    pointRadius: 0,
                    tension: 0.15,
                    spanGaps: true
                });
            });
        }
    }

    renderPriceChart(labels, datasets);

    if (indicatorConfig?.formula?.chartType === "panel" && indicatorConfig.target) {
        const targetBars = tickerBars.get(indicatorConfig.target);
        if (targetBars) {
            const aligned = alignBarsToLabels(primaryBars, targetBars);
            const result = indicatorConfig.formula.compute(aligned, indicatorConfig.params);
            const panelDatasets = result.series.map((series, idx) => ({
                type: series.style === "bar" ? "bar" : "line",
                label: series.label,
                data: series.data,
                borderColor: INDICATOR_COLORS[idx % INDICATOR_COLORS.length],
                backgroundColor:
                    series.style === "bar"
                        ? series.data.map((v) =>
                              v === null ? "transparent" : v >= 0 ? "#16a34a88" : "#dc262688"
                          )
                        : INDICATOR_COLORS[idx % INDICATOR_COLORS.length],
                borderWidth: series.style === "bar" ? 0 : 1.5,
                pointRadius: 0,
                tension: 0.15,
                spanGaps: true,
                order: series.style === "bar" ? 2 : 1
            }));
            renderIndicatorChart(labels, panelDatasets, indicatorConfig.formula);
            return;
        }
    }

    indicatorChart = destroyChart(indicatorChart);
    const wrap = document.getElementById("indicatorChartWrap");
    if (wrap) {
        wrap.hidden = true;
    }
}

function alignBarsToLabels(referenceBars, bars) {
    const byTime = new Map(bars.map((b) => [b.t, b]));
    return referenceBars.map((ref) => byTime.get(ref.t) || { ...ref, c: null, o: null, h: null, l: null, v: null });
}

async function fetchAllData() {
    if (!window.MassiveAPI.hasApiKey()) {
        setStatus("Save your Massive API key first.", "error");
        return;
    }
    if (!selectedTickers.length) {
        setStatus("Add at least one ticker.", "error");
        return;
    }

    const { from, to } = getDateRange();
    if (!from || !to) {
        setStatus("Choose a valid date range.", "error");
        return;
    }
    if (from > to) {
        setStatus("Start date must be before end date.", "error");
        return;
    }

    const btn = document.getElementById("fetchBtn");
    btn.disabled = true;
    setStatus("Fetching market data…");

    tickerBars.clear();
    const timespan = getTimespan();
    let hadError = false;

    for (const item of selectedTickers) {
        try {
            const bars = await window.MassiveAPI.getAggregates(item.ticker, from, to, {
                multiplier: 1,
                timespan
            });
            if (!bars.length) {
                setStatus(`No data returned for ${item.ticker}.`, "error");
                hadError = true;
            } else {
                tickerBars.set(item.ticker, bars);
            }
        } catch (error) {
            setStatus(`${item.ticker}: ${error.message}`, "error");
            hadError = true;
        }
    }

    btn.disabled = false;

    if (tickerBars.size > 0) {
        try {
            renderCharts();
            if (!hadError) {
                setStatus(`Loaded ${tickerBars.size} ticker(s).`, "success");
            }
        } catch (error) {
            setStatus(`Plot error: ${error.message}`, "error");
        }
    }
}

function renderIndicatorParams() {
    const formulaId = document.getElementById("indicatorSelect")?.value;
    const wrap = document.getElementById("indicatorParams");
    if (!wrap) {
        return;
    }

    const formula = getFormulaById(formulaId);
    if (!formula || !formula.params?.length) {
        wrap.innerHTML = "";
        return;
    }

    wrap.innerHTML = formula.params
        .map(
            (param) => `
        <label class="mkt-field mkt-field-compact">
            <span class="invest-label">${param.label}</span>
            <input
                type="number"
                class="invest-input"
                id="ind-param-${param.id}"
                value="${param.default}"
                min="${param.min ?? ""}"
                max="${param.max ?? ""}"
                step="${param.step ?? 1}"
            />
        </label>`
        )
        .join("");

    wrap.querySelectorAll("input").forEach((input) => {
        input.addEventListener("change", renderCharts);
    });
}

function populateIndicatorSelect() {
    const select = document.getElementById("indicatorSelect");
    if (!select) {
        return;
    }

    const formulas = getFormulas();
    const groups = new Map();
    formulas.forEach((formula) => {
        const cat = formula.category || "Other";
        if (!groups.has(cat)) {
            groups.set(cat, []);
        }
        groups.get(cat).push(formula);
    });

    let html = '<option value="">None</option>';
    groups.forEach((items, category) => {
        html += `<optgroup label="${category}">`;
        items.forEach((formula) => {
            html += `<option value="${formula.id}">${formula.title}</option>`;
        });
        html += "</optgroup>";
    });

    select.innerHTML = html;
    const desc = document.getElementById("indicatorDescription");
    select.addEventListener("change", () => {
        const formula = getFormulaById(select.value);
        if (desc) {
            desc.textContent = formula?.description || "";
        }
        renderIndicatorParams();
        renderCharts();
    });
}

function setRangePreset(days) {
    const to = new Date();
    const from = addDays(to, -days);
    document.getElementById("dateFrom").value = formatDateInput(from);
    document.getElementById("dateTo").value = formatDateInput(to);
}

function setApiKeyStatus(message, type = "") {
    const status = document.getElementById("apiKeyStatus");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function updateApiKeyVisibility() {
    const hasKey = window.MassiveAPI?.hasApiKey() ?? false;
    const showApp = hasKey && !apiSetupMode;

    const gate = document.getElementById("apiKeyGate");
    const toolNote = document.getElementById("apiKeyToolNote");
    const pageHeader = document.getElementById("mktPageHeader");
    const appContent = document.getElementById("mktAppContent");
    const layout = document.getElementById("mktLayout");

    if (gate) {
        gate.hidden = showApp;
    }
    if (toolNote) {
        toolNote.hidden = showApp;
    }
    if (pageHeader) {
        pageHeader.hidden = showApp;
    }
    if (appContent) {
        appContent.hidden = !showApp;
    }
    if (layout) {
        layout.classList.toggle("mkt-layout--gate-only", !showApp);
    }

    if (showApp) {
        requestAnimationFrame(() => {
            priceChart?.resize();
            indicatorChart?.resize();
        });
    }
}

function enterApiKeySetup() {
    apiSetupMode = true;
    const input = document.getElementById("apiKeyInput");
    if (input && window.MassiveAPI.hasApiKey()) {
        input.value = window.MassiveAPI.getApiKey();
    }
    updateApiKeyVisibility();
    input?.focus();
}

function initApiKeySection() {
    const input = document.getElementById("apiKeyInput");

    if (window.MassiveAPI.hasApiKey()) {
        input.value = window.MassiveAPI.getApiKey();
    }

    document.getElementById("saveApiKeyBtn")?.addEventListener("click", () => {
        window.MassiveAPI.setApiKey(input.value);
        if (window.MassiveAPI.hasApiKey()) {
            apiSetupMode = false;
            setApiKeyStatus("Key saved in this browser", "success");
        } else {
            setApiKeyStatus("No key saved");
        }
        updateApiKeyVisibility();
    });

    document.getElementById("clearApiKeyBtn")?.addEventListener("click", () => {
        window.MassiveAPI.clearApiKey();
        input.value = "";
        apiSetupMode = false;
        setApiKeyStatus("No key saved");
        updateApiKeyVisibility();
        priceChart = destroyChart(priceChart);
        indicatorChart = destroyChart(indicatorChart);
        tickerBars.clear();
    });

    document.getElementById("changeApiKeyBtn")?.addEventListener("click", enterApiKeySetup);

    updateApiKeyVisibility();
}

function initControls() {
    const today = new Date();
    document.getElementById("dateTo").value = formatDateInput(today);
    document.getElementById("dateFrom").value = formatDateInput(addDays(today, -365));

    document.querySelectorAll("[data-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
            setRangePreset(Number(btn.dataset.range));
        });
    });

    const searchInput = document.getElementById("tickerSearch");
    searchInput?.addEventListener("input", () => {
        clearTimeout(searchTimer);
        const query = searchInput.value.trim();
        searchTimer = setTimeout(() => searchTickers(query), 300);
    });

    searchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const query = searchInput.value.trim().toUpperCase();
            if (query) {
                addTicker({ ticker: query, name: query });
                searchInput.value = "";
                renderSearchResults([]);
            }
        }
    });

    document.getElementById("fetchBtn")?.addEventListener("click", fetchAllData);
    document.getElementById("chartMode")?.addEventListener("change", renderCharts);
    document.getElementById("timespan")?.addEventListener("change", fetchAllData);
    document.getElementById("indicatorTarget")?.addEventListener("change", renderCharts);
    document.getElementById("dateFrom")?.addEventListener("change", () => setStatus(""));
    document.getElementById("dateTo")?.addEventListener("change", () => setStatus(""));

    document.getElementById("themeToggle")?.addEventListener("click", () => {
        requestAnimationFrame(() => renderCharts());
    });
}

function init() {
    loadSavedTickers();
    renderTickerChips();
    updateIndicatorTargetOptions();
    populateIndicatorSelect();
    renderIndicatorParams();
    initApiKeySection();
    initControls();
}

function boot() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}

boot();
