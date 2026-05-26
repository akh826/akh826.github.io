function formatMaybeNumber(value, suffix = "") {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "N/A";
    }

    return `${value}${suffix}`;
}

function getConnectionObject() {
    return (
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection ||
        null
    );
}

function getConnectionSnapshot() {
    const connection = getConnectionObject();

    if (!connection) {
        return {
            supported: false,
            note: "Network Information API is not available in this browser."
        };
    }

    return {
        supported: true,
        effectiveType: connection.effectiveType ?? "N/A",
        downlinkMbps: typeof connection.downlink === "number" ? connection.downlink : null,
        rttMs: typeof connection.rtt === "number" ? connection.rtt : null,
        saveData: typeof connection.saveData === "boolean" ? connection.saveData : null,
        downlinkMaxMbps:
            typeof connection.downlinkMax === "number" ? connection.downlinkMax : null,
        type: connection.type ?? "N/A"
    };
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function flattenInfo(data, prefix = "") {
    const rows = [];

    Object.entries(data).forEach(([key, value]) => {
        const label = prefix ? `${prefix} › ${key}` : key;

        if (value && typeof value === "object" && !Array.isArray(value)) {
            rows.push(...flattenInfo(value, label));
            return;
        }

        rows.push({
            label,
            value:
                value === null || value === undefined || value === ""
                    ? "N/A"
                    : typeof value === "boolean"
                        ? value
                            ? "Yes"
                            : "No"
                        : String(value)
        });
    });

    return rows;
}

function renderSection(container, title, data) {
    const card = document.createElement("article");
    card.className = "info-card";

    const heading = document.createElement("h2");
    heading.textContent = title;
    card.appendChild(heading);

    const table = document.createElement("table");
    table.className = "info-table";
    table.innerHTML = "<tbody></tbody>";

    const tbody = table.querySelector("tbody");

    flattenInfo(data).forEach(({ label, value }) => {
        const row = document.createElement("tr");
        const shortLabel = label.includes("›") ? label.split("›").pop().trim() : label;
        row.innerHTML = `<th scope="row">${escapeHtml(shortLabel)}</th><td>${escapeHtml(value)}</td>`;
        tbody.appendChild(row);
    });

    card.appendChild(table);
    container.appendChild(card);
}

function addLogItem(logElement, message) {
    if (!logElement) {
        return;
    }

    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    logElement.prepend(item);

    while (logElement.childElementCount > 20) {
        logElement.removeChild(logElement.lastElementChild);
    }
}

function updateOnlineBadge(badgeElement, summaryElement) {
    if (!badgeElement || !summaryElement) {
        return;
    }

    const online = navigator.onLine;
    badgeElement.textContent = online ? "Online" : "Offline";
    badgeElement.classList.toggle("is-online", online);
    badgeElement.classList.toggle("is-offline", !online);

    const connection = getConnectionSnapshot();

    if (!connection.supported) {
        summaryElement.textContent = connection.note;
        return;
    }

    summaryElement.textContent = `type: ${connection.effectiveType}, downlink: ${formatMaybeNumber(
        connection.downlinkMbps,
        " Mbps"
    )}, rtt: ${formatMaybeNumber(connection.rttMs, " ms")}`;
}

function normalizePingUrl(input) {
    const raw = (input || "").trim();
    if (!raw) {
        return "";
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
        return new URL(withProtocol).toString();
    } catch {
        return "";
    }
}

async function pingTargetUrl(url, sampleCount = 3, timeoutMs = 6000) {
    const durations = [];
    let successCount = 0;

    for (let index = 0; index < sampleCount; index += 1) {
        const controller = new AbortController();
        const startedAt = performance.now();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            await fetch(`${url}${url.includes("?") ? "&" : "?"}ping=${Date.now()}_${index}`, {
                method: "GET",
                cache: "no-store",
                mode: "no-cors",
                signal: controller.signal
            });

            const endedAt = performance.now();
            durations.push(endedAt - startedAt);
            successCount += 1;
        } catch {
            const endedAt = performance.now();
            durations.push(endedAt - startedAt);
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    if (!durations.length) {
        return {
            target: url,
            avgMs: null,
            minMs: null,
            maxMs: null,
            successCount: 0,
            sampleCount
        };
    }

    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;

    return {
        target: url,
        avgMs: avg,
        minMs: min,
        maxMs: max,
        successCount,
        sampleCount
    };
}

function formatMsStat(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "N/A";
    }

    return `${value.toFixed(1)} ms`;
}

function getPingStatus(result) {
    if (result.successCount === 0) {
        return { label: "Failed", className: "is-failed" };
    }

    if (result.successCount < result.sampleCount) {
        return { label: "Partial", className: "is-partial" };
    }

    return { label: "Success", className: "is-success" };
}

function getSelectedPingTargets() {
    const checkedInputs = [...document.querySelectorAll("#pingTargetList input[type='checkbox']:checked")];
    const selected = checkedInputs.map((item) => normalizePingUrl(item.value)).filter(Boolean);

    const customInput = document.getElementById("customPingUrl");
    const normalizedCustom = normalizePingUrl(customInput?.value || "");
    if (normalizedCustom) {
        selected.push(normalizedCustom);
    }

    return [...new Set(selected)];
}

function renderPingResults(results) {
    const wrap = document.getElementById("pingResultsWrap");
    const table = document.getElementById("pingResultsTable");
    const tbody = table?.querySelector("tbody");

    if (!wrap || !tbody) {
        return;
    }

    tbody.innerHTML = "";

    results.forEach((result) => {
        const status = getPingStatus(result);
        const row = document.createElement("tr");
        row.innerHTML = `
            <th scope="row">${escapeHtml(result.target)}</th>
            <td>${escapeHtml(formatMsStat(result.avgMs))}</td>
            <td>${escapeHtml(formatMsStat(result.minMs))}</td>
            <td>${escapeHtml(formatMsStat(result.maxMs))}</td>
            <td>${escapeHtml(`${result.successCount}/${result.sampleCount} success`)}</td>
            <td><span class="ping-status-chip ${status.className}">${escapeHtml(status.label)}</span></td>
        `;
        tbody.appendChild(row);
    });

    wrap.hidden = results.length === 0;
}

async function runPingBatch(targets, sampleCount = 3) {
    const results = [];

    for (const target of targets) {
        const result = await pingTargetUrl(target, sampleCount);
        results.push(result);
    }

    return results;
}

async function runLatencyProbe(sampleCount = 5) {
    const durations = [];
    const target = `${window.location.href.split("#")[0]}?latency_probe=${Date.now()}`;

    for (let index = 0; index < sampleCount; index += 1) {
        const startedAt = performance.now();

        try {
            await fetch(`${target}&sample=${index}`, {
                cache: "no-store",
                method: "GET"
            });
        } catch {
            const endedAt = performance.now();
            durations.push(endedAt - startedAt);
            continue;
        }

        const endedAt = performance.now();
        durations.push(endedAt - startedAt);
    }

    if (!durations.length) {
        return null;
    }

    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const jitter = max - min;

    return {
        sampleCount: durations.length,
        minMs: min.toFixed(1),
        maxMs: max.toFixed(1),
        avgMs: avg.toFixed(1),
        jitterMs: jitter.toFixed(1),
        samplesMs: durations.map((value) => value.toFixed(1)).join(", ")
    };
}

function extractIpFromCandidate(candidateText) {
    const match = candidateText.match(
        /candidate:\S+\s+\d+\s+\S+\s+\d+\s+([a-fA-F0-9:.]+)\s+\d+\s+typ\s+\S+/
    );

    if (!match) {
        return null;
    }

    return match[1];
}

function isPrivateOrLocalIp(ip) {
    if (ip === "::1" || ip.startsWith("fe80:")) {
        return true;
    }

    return (
        /^10\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
        /^127\./.test(ip)
    );
}

async function discoverLocalIpsViaWebRtc(timeoutMs = 3500) {
    const RTCPeerConnectionCtor =
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection;

    if (!RTCPeerConnectionCtor) {
        return {
            supported: false,
            ips: [],
            note: "WebRTC RTCPeerConnection is not available in this browser."
        };
    }

    const pc = new RTCPeerConnectionCtor({ iceServers: [] });
    const discoveredIps = new Set();

    return new Promise((resolve) => {
        let settled = false;

        function finish(note = "") {
            if (settled) {
                return;
            }

            settled = true;
            pc.onicecandidate = null;
            pc.close();

            resolve({
                supported: true,
                ips: [...discoveredIps],
                note
            });
        }

        pc.onicecandidate = (event) => {
            if (!event.candidate) {
                finish();
                return;
            }

            const candidateText = event.candidate.candidate;
            const ip = extractIpFromCandidate(candidateText);

            if (ip && isPrivateOrLocalIp(ip)) {
                discoveredIps.add(ip);
            }
        };

        pc.createDataChannel("network-check");

        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch(() => finish("Could not create WebRTC session."));

        window.setTimeout(() => {
            finish("Timed out while waiting for ICE candidates.");
        }, timeoutMs);
    });
}

let latestData = {
    status: null,
    networkInfo: null,
    latency: null,
    webrtc: null,
    pingResults: [],
    measuredAt: null
};

async function refreshNetworkInfo(gridElement, statusElement, badgeElement, summaryElement) {
    updateOnlineBadge(badgeElement, summaryElement);

    const networkInfo = getConnectionSnapshot();

    latestData = {
        ...latestData,
        status: navigator.onLine ? "Online" : "Offline",
        networkInfo,
        measuredAt: new Date().toISOString()
    };

    if (!gridElement) {
        return;
    }

    gridElement.innerHTML = "";

    renderSection(gridElement, "Connection status", {
        online: navigator.onLine,
        measuredAt: latestData.measuredAt
    });

    renderSection(gridElement, "Network Information API", networkInfo);

    renderSection(gridElement, "Latency probe", latestData.latency ?? {
        note: "Not run yet. Click \"Run latency test\"."
    });

    renderSection(gridElement, "WebRTC local IP discovery", latestData.webrtc ?? {
        note: "Not run yet. Click \"Run WebRTC local IP test\"."
    });

    if (statusElement) {
        statusElement.textContent = `Updated at ${new Date().toLocaleString()}`;
        statusElement.classList.add("success");
    }
}

async function initNetworkTool() {
    const grid = document.getElementById("infoGrid");
    const status = document.getElementById("toolStatus");
    const refreshBtn = document.getElementById("refreshNetworkInfo");
    const latencyBtn = document.getElementById("runLatencyTest");
    const webrtcBtn = document.getElementById("runWebrtcTest");
    const badge = document.getElementById("onlineBadge");
    const summary = document.getElementById("connectionSummary");
    const eventLog = document.getElementById("eventLog");
    const pingButton = document.getElementById("runPingTest");
    const pingStatus = document.getElementById("pingStatus");

    if (!grid) {
        return;
    }

    const handleOnline = () => {
        addLogItem(eventLog, "Browser reported online event.");
        refreshNetworkInfo(grid, status, badge, summary);
    };

    const handleOffline = () => {
        addLogItem(eventLog, "Browser reported offline event.");
        refreshNetworkInfo(grid, status, badge, summary);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const connection = getConnectionObject();
    connection?.addEventListener?.("change", () => {
        addLogItem(eventLog, "Network Information API values changed.");
        refreshNetworkInfo(grid, status, badge, summary);
    });

    refreshBtn?.addEventListener("click", () => {
        status.textContent = "Refreshing...";
        status.classList.remove("success");
        refreshNetworkInfo(grid, status, badge, summary);
    });

    latencyBtn?.addEventListener("click", async () => {
        if (!status) {
            return;
        }

        status.textContent = "Running latency test...";
        status.classList.remove("success");

        const result = await runLatencyProbe(5);
        latestData.latency = result ?? { note: "Latency test failed in this environment." };

        addLogItem(eventLog, "Latency test completed.");
        await refreshNetworkInfo(grid, status, badge, summary);
    });

    webrtcBtn?.addEventListener("click", async () => {
        if (!status) {
            return;
        }

        status.textContent = "Running WebRTC local IP test...";
        status.classList.remove("success");

        const webrtcResult = await discoverLocalIpsViaWebRtc();
        latestData.webrtc = {
            supported: webrtcResult.supported,
            localIps: webrtcResult.ips.length ? webrtcResult.ips.join(", ") : "No local/private IPs discovered",
            note: webrtcResult.note || ""
        };

        addLogItem(eventLog, "WebRTC local IP test completed.");
        await refreshNetworkInfo(grid, status, badge, summary);
    });

    pingButton?.addEventListener("click", async () => {
        if (!pingStatus) {
            return;
        }

        const targets = getSelectedPingTargets();
        if (!targets.length) {
            pingStatus.textContent = "Select at least one preset target or enter a valid custom URL.";
            pingStatus.classList.remove("success");
            return;
        }

        pingStatus.textContent = "Running ping tests...";
        pingStatus.classList.remove("success");

        const results = await runPingBatch(targets, 3);
        latestData.pingResults = results;
        renderPingResults(results);

        const totalSuccesses = results.reduce((sum, item) => sum + item.successCount, 0);
        const totalSamples = results.reduce((sum, item) => sum + item.sampleCount, 0);

        pingStatus.textContent = `Ping test completed: ${totalSuccesses}/${totalSamples} successful samples.`;
        pingStatus.classList.toggle("success", totalSuccesses > 0);
        addLogItem(eventLog, "Website ping test completed.");
    });

    addLogItem(eventLog, "Network monitor initialized.");
    await refreshNetworkInfo(grid, status, badge, summary);
    renderPingResults(latestData.pingResults);
}

initNetworkTool();