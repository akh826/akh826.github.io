function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatMs(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "N/A";
    }

    return `${value.toFixed(2)} ms`;
}

function formatSignedMs(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "N/A";
    }

    const sign = value >= 0 ? "+" : "-";
    return `${sign}${Math.abs(value).toFixed(2)} ms`;
}

function getNavigationEntry() {
    const entries = performance.getEntriesByType("navigation");
    if (!entries.length) {
        return null;
    }

    return entries[0];
}

function buildNavigationPhases(nav) {
    if (!nav) {
        return [];
    }

    const rawPhases = [
        { label: "DNS lookup", value: nav.domainLookupEnd - nav.domainLookupStart },
        { label: "TCP handshake", value: nav.connectEnd - nav.connectStart },
        {
            label: "TLS negotiation",
            value:
                nav.secureConnectionStart > 0
                    ? nav.connectEnd - nav.secureConnectionStart
                    : 0
        },
        { label: "Request", value: nav.responseStart - nav.requestStart },
        { label: "TTFB", value: nav.responseStart - nav.requestStart },
        { label: "Response download", value: nav.responseEnd - nav.responseStart },
        { label: "DOM parsing", value: nav.domInteractive - nav.responseEnd },
        { label: "DOM content loaded", value: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart },
        { label: "Load event", value: nav.loadEventEnd - nav.loadEventStart },
        { label: "Total (navigationStart -> loadEnd)", value: nav.loadEventEnd }
    ];

    return rawPhases.map((phase) => ({
        ...phase,
        value: typeof phase.value === "number" && phase.value >= 0 ? phase.value : 0
    }));
}

function renderNavigationCard(container, navEntry) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!navEntry) {
        card.innerHTML = `
            <h2>Navigation Timing API</h2>
            <p class="tool-note-inline">Navigation timing entry was not available for this page load.</p>
        `;
        container.appendChild(card);
        return;
    }

    const phases = buildNavigationPhases(navEntry);
    const maxValue = Math.max(...phases.map((phase) => phase.value), 1);

    const phaseRows = phases
        .map((phase) => {
            const width = Math.max(2, (phase.value / maxValue) * 100);
            return `
                <tr>
                    <th scope="row">${escapeHtml(phase.label)}</th>
                    <td>${escapeHtml(formatMs(phase.value))}</td>
                    <td>
                        <div class="timing-bar-track">
                            <div class="timing-bar-fill" style="width:${width.toFixed(1)}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");

    card.innerHTML = `
        <h2>Navigation Timing API</h2>
        <table class="info-table timing-table">
            <thead>
                <tr>
                    <th scope="col">Stage</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Relative bar</th>
                </tr>
            </thead>
            <tbody>
                ${phaseRows}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

async function getServerEpochFromSameOrigin(sampleIndex) {
    const requestUrl = `${window.location.href.split("#")[0]}?clock_sample=${Date.now()}_${sampleIndex}`;

    const response = await fetch(requestUrl, {
        method: "GET",
        cache: "no-store"
    });

    const serverDateHeader = response.headers.get("date");
    if (!serverDateHeader) {
        throw new Error("Same-origin response did not include Date header.");
    }

    const serverEpochMs = new Date(serverDateHeader).getTime();
    if (Number.isNaN(serverEpochMs)) {
        throw new Error("Same-origin Date header could not be parsed.");
    }

    return serverEpochMs;
}

async function getServerEpochFromWorldTimeApi() {
    const response = await fetch(`https://worldtimeapi.org/api/ip?cacheBust=${Date.now()}`, {
        method: "GET",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`WorldTimeAPI request failed (${response.status}).`);
    }

    const data = await response.json();
    const serverEpochMs = data?.utc_datetime ? new Date(data.utc_datetime).getTime() : NaN;

    if (Number.isNaN(serverEpochMs)) {
        throw new Error("WorldTimeAPI did not provide a valid utc_datetime.");
    }

    return serverEpochMs;
}

async function getServerEpochFromTimeApiIo() {
    const response = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=UTC&cacheBust=${Date.now()}`, {
        method: "GET",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`timeapi.io request failed (${response.status}).`);
    }

    const data = await response.json();

    // Prefer explicit epoch fields when present to avoid timezone parsing ambiguity.
    if (typeof data?.unixTime === "number") {
        return data.unixTime * 1000;
    }

    if (typeof data?.epochTime === "number") {
        return data.epochTime * 1000;
    }

    const isoCandidate = data?.dateTimeUtc ?? data?.dateTime ?? null;

    let serverEpochMs = NaN;
    if (typeof isoCandidate === "string" && isoCandidate.trim()) {
        // timeapi.io can return datetime strings without timezone suffix.
        // If no offset/Z is present, treat it as UTC for this endpoint (timeZone=UTC).
        const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoCandidate);
        const normalizedIso = hasTimezone ? isoCandidate : `${isoCandidate}Z`;
        serverEpochMs = new Date(normalizedIso).getTime();
    }

    if (Number.isNaN(serverEpochMs)) {
        throw new Error("timeapi.io did not provide a valid datetime value.");
    }

    return serverEpochMs;
}

async function getServerEpochWithFallback(sampleIndex) {
    const sourceErrors = [];

    const providers = [
        {
            label: "same-origin-date-header",
            getServerEpoch: () => getServerEpochFromSameOrigin(sampleIndex)
        },
        {
            label: "worldtimeapi",
            getServerEpoch: () => getServerEpochFromWorldTimeApi()
        },
        {
            label: "timeapi-io",
            getServerEpoch: () => getServerEpochFromTimeApiIo()
        }
    ];

    for (const provider of providers) {
        try {
            const serverEpochMs = await provider.getServerEpoch();
            return {
                source: provider.label,
                serverEpochMs,
                sourceErrors
            };
        } catch (error) {
            sourceErrors.push(`${provider.label}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
    }

    throw new Error(sourceErrors.join(" | "));
}

async function measureClockSample(sampleIndex) {

    const t1Date = Date.now();
    const t1Perf = performance.now();

    const serverEpochResult = await getServerEpochWithFallback(sampleIndex);

    const t4Perf = performance.now();
    const t4Date = Date.now();

    const roundTripMs = t4Perf - t1Perf;
    const midpointClientEpochMs = (t1Date + t4Date) / 2;
    const offsetMs = midpointClientEpochMs - serverEpochResult.serverEpochMs;
    const perfDateDeltaMs = (t4Date - t1Date) - (t4Perf - t1Perf);

    return {
        roundTripMs,
        midpointClientEpochMs,
        serverEpochMs: serverEpochResult.serverEpochMs,
        offsetMs,
        perfDateDeltaMs,
        source: serverEpochResult.source
    };
}

function summarizeClockSamples(samples) {
    const avg = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

    const offsets = samples.map((sample) => sample.offsetMs);
    const rtts = samples.map((sample) => sample.roundTripMs);
    const deltas = samples.map((sample) => sample.perfDateDeltaMs);

    const averageOffsetMs = avg(offsets);
    const averageRttMs = avg(rtts);
    const averagePerfDateDeltaMs = avg(deltas);

    const sourceCounts = samples.reduce((accumulator, sample) => {
        const key = sample.source || "unknown";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
    }, {});

    const sourceUsed = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

    return {
        sampleCount: samples.length,
        averageOffsetMs,
        minOffsetMs: Math.min(...offsets),
        maxOffsetMs: Math.max(...offsets),
        averageRttMs,
        averagePerfDateDeltaMs,
        sourceUsed
    };
}

async function runClockDriftBenchmark(sampleCount = 5) {
    const samples = [];

    for (let index = 0; index < sampleCount; index += 1) {
        try {
            const sample = await measureClockSample(index);
            samples.push(sample);
        } catch {
            continue;
        }
    }

    if (!samples.length) {
        return {
            supported: false,
            note: "Clock drift test could not run. Time sources were unavailable (Date header and fallback time APIs).",
            summary: null
        };
    }

    return {
        supported: true,
        note: "",
        summary: summarizeClockSamples(samples)
    };
}

function renderClockCard(container, driftResult) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!driftResult) {
        card.innerHTML = `
            <h2>Client Clock Drift</h2>
            <p class="tool-note-inline">Not run yet. Click "Run clock drift test".</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!driftResult.supported || !driftResult.summary) {
        card.innerHTML = `
            <h2>Client Clock Drift</h2>
            <p class="tool-note-inline">${escapeHtml(driftResult.note || "Clock drift test unavailable.")}</p>
        `;
        container.appendChild(card);
        return;
    }

    const summary = driftResult.summary;

    card.innerHTML = `
        <h2>Client Clock Drift</h2>
        <table class="info-table">
            <tbody>
                <tr><th scope="row">Samples</th><td>${escapeHtml(String(summary.sampleCount))}</td></tr>
                <tr><th scope="row">Time source</th><td>${escapeHtml(summary.sourceUsed)}</td></tr>
                <tr><th scope="row">Estimated clock offset (avg)</th><td>${escapeHtml(formatSignedMs(summary.averageOffsetMs))}</td></tr>
                <tr><th scope="row">Offset range</th><td>${escapeHtml(`${formatSignedMs(summary.minOffsetMs)} to ${formatSignedMs(summary.maxOffsetMs)}`)}</td></tr>
                <tr><th scope="row">Average RTT</th><td>${escapeHtml(formatMs(summary.averageRttMs))}</td></tr>
                <tr><th scope="row">Date.now() vs performance.now() drift (avg)</th><td>${escapeHtml(formatSignedMs(summary.averagePerfDateDeltaMs))}</td></tr>
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

let latestClockResult = null;

function renderBenchmarks(clockResult = latestClockResult) {
    const grid = document.getElementById("benchmarksGrid");
    const status = document.getElementById("toolStatus");

    if (!grid || !status) {
        return;
    }

    const navEntry = getNavigationEntry();
    grid.innerHTML = "";
    renderNavigationCard(grid, navEntry);
    renderClockCard(grid, clockResult);

    status.textContent = `Benchmarks updated at ${new Date().toLocaleString()}`;
    status.classList.add("success");
}

async function initPerformanceTimeBenchmarks() {
    const refreshButton = document.getElementById("refreshBenchmarks");
    const clockButton = document.getElementById("runClockDrift");
    const status = document.getElementById("toolStatus");

    refreshButton?.addEventListener("click", () => {
        if (status) {
            status.textContent = "Refreshing benchmarks...";
            status.classList.remove("success");
        }

        renderBenchmarks();
    });

    clockButton?.addEventListener("click", async () => {
        if (status) {
            status.textContent = "Running clock drift test...";
            status.classList.remove("success");
        }

        latestClockResult = await runClockDriftBenchmark(5);
        renderBenchmarks(latestClockResult);
    });

    renderBenchmarks();
}

initPerformanceTimeBenchmarks();