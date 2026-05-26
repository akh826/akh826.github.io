const PERMISSION_QUERIES = [
    { key: "geolocation", permissionName: "geolocation", label: "Geolocation" },
    { key: "camera", permissionName: "camera", label: "Camera" },
    { key: "microphone", permissionName: "microphone", label: "Microphone" },
    { key: "notifications", permissionName: "notifications", label: "Notifications" },
    { key: "clipboardRead", permissionName: "clipboard-read", label: "Clipboard Read" },
    { key: "clipboardWrite", permissionName: "clipboard-write", label: "Clipboard Write" }
];

const DEVICE_LABELS = {
    audioinput: "Microphone",
    videoinput: "Camera",
    audiooutput: "Audio Output"
};

let permissionStatusRefs = [];
let activeTestStream = null;
let activeAudioContext = null;
let activeAnalyser = null;
let activeMicSource = null;
let micMeterFrame = null;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function toStatusLabel(state) {
    if (!state) {
        return "unknown";
    }

    return String(state).toLowerCase();
}

function toStateChipClass(state) {
    switch (toStatusLabel(state)) {
        case "granted":
            return "state-granted";
        case "denied":
            return "state-denied";
        case "prompt":
            return "state-prompt";
        default:
            return "state-unsupported";
    }
}

async function queryPermissionItem(definition) {
    if (!navigator.permissions?.query) {
        return {
            ...definition,
            state: "unsupported",
            details: "Permissions API not available in this browser.",
            statusRef: null
        };
    }

    try {
        const status = await navigator.permissions.query({ name: definition.permissionName });
        return {
            ...definition,
            state: status.state,
            details: "",
            statusRef: status
        };
    } catch {
        return {
            ...definition,
            state: "unsupported",
            details: "Permission name unsupported or blocked by this browser.",
            statusRef: null
        };
    }
}

async function getPermissionMatrix() {
    const rows = await Promise.all(PERMISSION_QUERIES.map((item) => queryPermissionItem(item)));
    permissionStatusRefs = rows
        .map((item) => item.statusRef)
        .filter((statusRef) => statusRef && typeof statusRef.addEventListener === "function");
    return rows;
}

function normalizeDevice(device, index) {
    const typeLabel = DEVICE_LABELS[device.kind] ?? device.kind;
    const label = device.label || `${typeLabel} ${index + 1} (label hidden until permission granted)`;

    return {
        kind: device.kind,
        type: typeLabel,
        label,
        deviceId: device.deviceId || "N/A",
        groupId: device.groupId || "N/A"
    };
}

async function getMediaDevicesInfo() {
    if (!navigator.mediaDevices?.enumerateDevices) {
        return {
            supported: false,
            note: "MediaDevices API is not available in this browser.",
            devices: []
        };
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const relevantDevices = devices
            .filter((device) => ["audioinput", "videoinput", "audiooutput"].includes(device.kind))
            .map(normalizeDevice);

        return {
            supported: true,
            note: "",
            devices: relevantDevices
        };
    } catch {
        return {
            supported: false,
            note: "Could not enumerate media devices. Browser may require secure context (HTTPS) and permission.",
            devices: []
        };
    }
}

function renderPermissionsCard(container, permissionRows) {
    const card = document.createElement("article");
    card.className = "info-card";

    card.innerHTML = `
        <h2>Permissions API Matrix</h2>
        <table class="info-table permissions-table">
            <thead>
                <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">State</th>
                    <th scope="col">Notes</th>
                </tr>
            </thead>
            <tbody>
                ${permissionRows
            .map((row) => {
                const state = toStatusLabel(row.state);
                const notes = row.details || "-";
                return `<tr>
                            <th scope="row">${escapeHtml(row.label)}</th>
                            <td><span class="permission-state ${toStateChipClass(state)}">${escapeHtml(state)}</span></td>
                            <td>${escapeHtml(notes)}</td>
                        </tr>`;
            })
            .join("")}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

function renderDevicesCard(container, deviceInfo) {
    const card = document.createElement("article");
    card.className = "info-card";

    if (!deviceInfo.supported) {
        card.innerHTML = `
            <h2>Media Devices</h2>
            <p class="tool-note-inline">${escapeHtml(deviceInfo.note || "Not available.")}</p>
        `;
        container.appendChild(card);
        return;
    }

    if (!deviceInfo.devices.length) {
        card.innerHTML = `
            <h2>Media Devices</h2>
            <p class="tool-note-inline">No microphones, cameras, or audio outputs were detected.</p>
        `;
        container.appendChild(card);
        return;
    }

    card.innerHTML = `
        <h2>Media Devices</h2>
        <table class="info-table devices-table">
            <thead>
                <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Label</th>
                    <th scope="col">Device ID</th>
                </tr>
            </thead>
            <tbody>
                ${deviceInfo.devices
            .map(
                (device) => `<tr>
                            <th scope="row">${escapeHtml(device.type)}</th>
                            <td>${escapeHtml(device.label)}</td>
                            <td>${escapeHtml(device.deviceId)}</td>
                        </tr>`
            )
            .join("")}
            </tbody>
        </table>
    `;

    container.appendChild(card);
}

async function requestMediaAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not available in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((track) => track.stop());
}

function setMicLevel(fillElement, textElement, value) {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    if (fillElement) {
        fillElement.style.width = `${safeValue.toFixed(0)}%`;
    }

    if (textElement) {
        textElement.textContent = `Mic level: ${safeValue.toFixed(0)}%`;
    }
}

function stopMediaTester(videoElement, fillElement, textElement, mediaStatusElement) {
    if (micMeterFrame) {
        cancelAnimationFrame(micMeterFrame);
        micMeterFrame = null;
    }

    if (activeMicSource) {
        activeMicSource.disconnect();
        activeMicSource = null;
    }

    if (activeAnalyser) {
        activeAnalyser.disconnect();
        activeAnalyser = null;
    }

    if (activeAudioContext) {
        activeAudioContext.close();
        activeAudioContext = null;
    }

    if (activeTestStream) {
        activeTestStream.getTracks().forEach((track) => track.stop());
        activeTestStream = null;
    }

    if (videoElement) {
        videoElement.srcObject = null;
    }

    setMicLevel(fillElement, textElement, 0);

    if (textElement) {
        textElement.textContent = "Mic level: idle";
    }

    if (mediaStatusElement) {
        mediaStatusElement.textContent = "Media test stopped.";
        mediaStatusElement.classList.remove("success");
    }
}

function startMicMeterLoop(fillElement, textElement) {
    if (!activeAnalyser) {
        setMicLevel(fillElement, textElement, 0);
        return;
    }

    const sampleSize = activeAnalyser.fftSize;
    const data = new Uint8Array(sampleSize);

    const tick = () => {
        if (!activeAnalyser) {
            return;
        }

        activeAnalyser.getByteTimeDomainData(data);

        let sumSquares = 0;
        for (let index = 0; index < data.length; index += 1) {
            const normalized = (data[index] - 128) / 128;
            sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / data.length);
        const percent = Math.min(100, rms * 250);
        setMicLevel(fillElement, textElement, percent);

        micMeterFrame = requestAnimationFrame(tick);
    };

    micMeterFrame = requestAnimationFrame(tick);
}

async function startMediaTester(videoElement, fillElement, textElement, mediaStatusElement) {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not available in this browser.");
    }

    stopMediaTester(videoElement, fillElement, textElement);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    activeTestStream = stream;

    if (videoElement) {
        videoElement.srcObject = stream;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
        if (mediaStatusElement) {
            mediaStatusElement.textContent = "Camera started, but live mic meter is not supported here.";
            mediaStatusElement.classList.remove("success");
        }
        return;
    }

    activeAudioContext = new AudioContextCtor();
    activeMicSource = activeAudioContext.createMediaStreamSource(stream);
    activeAnalyser = activeAudioContext.createAnalyser();
    activeAnalyser.fftSize = 1024;
    activeMicSource.connect(activeAnalyser);

    startMicMeterLoop(fillElement, textElement);

    if (mediaStatusElement) {
        mediaStatusElement.textContent = "Media test running. Speak to see mic level movement.";
        mediaStatusElement.classList.add("success");
    }
}

async function runAudit(gridElement, statusElement) {
    if (!gridElement || !statusElement) {
        return;
    }

    statusElement.textContent = "Running media and permissions audit...";
    statusElement.classList.remove("success");

    const [permissions, devices] = await Promise.all([getPermissionMatrix(), getMediaDevicesInfo()]);

    gridElement.innerHTML = "";
    renderPermissionsCard(gridElement, permissions);
    renderDevicesCard(gridElement, devices);

    statusElement.textContent = `Audit updated at ${new Date().toLocaleString()}`;
    statusElement.classList.add("success");
}

function bindPermissionChangeEvents(onChange) {
    permissionStatusRefs.forEach((statusRef) => {
        statusRef.addEventListener("change", onChange);
    });
}

async function initMediaPermissionsAudit() {
    const grid = document.getElementById("auditGrid");
    const status = document.getElementById("toolStatus");
    const refreshButton = document.getElementById("refreshAudit");
    const requestButton = document.getElementById("requestMediaAccess");
    const startTestButton = document.getElementById("startMediaTest");
    const stopTestButton = document.getElementById("stopMediaTest");
    const cameraPreview = document.getElementById("cameraPreview");
    const micLevelFill = document.getElementById("micLevelFill");
    const micLevelText = document.getElementById("micLevelText");
    const mediaTestStatus = document.getElementById("mediaTestStatus");

    if (!grid || !status) {
        return;
    }

    await runAudit(grid, status);

    bindPermissionChangeEvents(() => {
        runAudit(grid, status);
    });

    navigator.mediaDevices?.addEventListener?.("devicechange", () => {
        runAudit(grid, status);
    });

    refreshButton?.addEventListener("click", () => {
        runAudit(grid, status);
    });

    requestButton?.addEventListener("click", async () => {
        status.textContent = "Requesting camera and microphone access...";
        status.classList.remove("success");

        try {
            await requestMediaAccess();
            status.textContent = "Media access granted or completed. Refreshing audit...";
            status.classList.add("success");
        } catch {
            status.textContent = "Media access was blocked or unavailable in this browser.";
            status.classList.remove("success");
        }

        await runAudit(grid, status);
    });

    startTestButton?.addEventListener("click", async () => {
        if (mediaTestStatus) {
            mediaTestStatus.textContent = "Starting media test...";
            mediaTestStatus.classList.remove("success");
        }

        try {
            await startMediaTester(cameraPreview, micLevelFill, micLevelText, mediaTestStatus);
            startTestButton.disabled = true;
            if (stopTestButton) {
                stopTestButton.disabled = false;
            }

            await runAudit(grid, status);
        } catch {
            if (mediaTestStatus) {
                mediaTestStatus.textContent = "Could not start test. Camera or microphone access was blocked.";
                mediaTestStatus.classList.remove("success");
            }
        }
    });

    stopTestButton?.addEventListener("click", () => {
        stopMediaTester(cameraPreview, micLevelFill, micLevelText, mediaTestStatus);
        stopTestButton.disabled = true;
        if (startTestButton) {
            startTestButton.disabled = false;
        }
    });

    window.addEventListener("beforeunload", () => {
        stopMediaTester(cameraPreview, micLevelFill, micLevelText);
    });
}

initMediaPermissionsAudit();