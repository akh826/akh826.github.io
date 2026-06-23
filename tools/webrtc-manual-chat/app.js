const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const ICE_GATHER_TIMEOUT_MS = 12000;

let peerConnection = null;
let dataChannel = null;
let activeRole = "host";
let localAlias = "You";

function getRtcCtor() {
    return window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
}

function setSignalingStatus(message, type = "") {
    const status = document.getElementById("signalingStatus");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function setConnectionUi(state, meta = "") {
    const badge = document.getElementById("connectionBadge");
    const metaEl = document.getElementById("connectionMeta");

    if (badge) {
        badge.textContent = state;
        badge.dataset.state = state.toLowerCase().replace(/\s+/g, "-");
    }

    if (metaEl) {
        metaEl.textContent = meta;
    }
}

function updateChatAvailability(connected) {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");
    const hint = document.getElementById("chatHint");

    if (input) {
        input.disabled = !connected;
    }

    if (sendBtn) {
        sendBtn.disabled = !connected;
    }

    if (hint) {
        hint.textContent = connected ? "Messages are sent peer-to-peer." : "Connect via signaling first.";
    }
}

function encodeSignal(sessionDescription) {
    const payload = JSON.stringify({
        type: sessionDescription.type,
        sdp: sessionDescription.sdp
    });

    return btoa(payload);
}

function decodeSignal(encoded) {
    const trimmed = String(encoded ?? "").trim();
    if (!trimmed) {
        throw new Error("Paste the full offer or answer string.");
    }

    let parsed;
    try {
        parsed = JSON.parse(atob(trimmed));
    } catch {
        throw new Error("Signal text is invalid. Copy the entire encoded block without edits.");
    }

    if (!parsed?.type || !parsed?.sdp) {
        throw new Error("Signal payload is missing type or SDP.");
    }

    return parsed;
}

function waitForIceGathering(pc, timeoutMs = ICE_GATHER_TIMEOUT_MS) {
    if (pc.iceGatheringState === "complete") {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, timeoutMs);

        function onStateChange() {
            if (pc.iceGatheringState === "complete") {
                window.clearTimeout(timer);
                pc.removeEventListener("icegatheringstatechange", onStateChange);
                resolve();
            }
        }

        pc.addEventListener("icegatheringstatechange", onStateChange);
    });
}

function createPeerConnection() {
    const RTCPeerConnectionCtor = getRtcCtor();
    if (!RTCPeerConnectionCtor) {
        throw new Error("WebRTC is not supported in this browser.");
    }

    const pc = new RTCPeerConnectionCtor({ iceServers: ICE_SERVERS });

    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;

        if (state === "connected") {
            setConnectionUi("Connected", "Data channel is open. You can send messages.");
            setSignalingStatus("Peer connection established.", "success");
            updateChatAvailability(true);
        } else if (state === "connecting") {
            setConnectionUi("Connecting", "Negotiation applied. Waiting for the peer link.");
        } else if (state === "disconnected") {
            setConnectionUi("Disconnected", "The peer link dropped. Reset to try again.");
            updateChatAvailability(false);
        } else if (state === "failed") {
            setConnectionUi("Failed", "Connection failed. Check NAT/firewall or reset and retry.");
            setSignalingStatus("Connection failed. Try creating a fresh offer/answer pair.", "error");
            updateChatAvailability(false);
        } else if (state === "closed") {
            setConnectionUi("Closed", "Session ended.");
            updateChatAvailability(false);
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
            setSignalingStatus(
                "ICE negotiation failed. Some networks block direct P2P — try another network or browser.",
                "error"
            );
        }
    };

    return pc;
}

function attachDataChannel(channel) {
    dataChannel = channel;

    channel.onopen = () => {
        setConnectionUi("Connected", "Data channel is open. You can send messages.");
        updateChatAvailability(true);
        appendSystemMessage("Data channel opened.");
    };

    channel.onclose = () => {
        updateChatAvailability(false);
        appendSystemMessage("Data channel closed.");
    };

    channel.onmessage = (event) => {
        appendChatMessage("Peer", String(event.data ?? ""));
    };

    channel.onerror = () => {
        setSignalingStatus("Data channel error.", "error");
    };
}

function appendSystemMessage(text) {
    appendChatMessage("System", text, true);
}

function appendChatMessage(author, text, isSystem = false) {
    const log = document.getElementById("messageLog");
    const empty = document.getElementById("messageEmpty");

    if (!log) {
        return;
    }

    if (empty) {
        empty.hidden = true;
    }

    const item = document.createElement("div");
    item.className = isSystem ? "webrtc-message webrtc-message-system" : "webrtc-message";

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    item.innerHTML = `
        <div class="webrtc-message-meta">
            <span class="webrtc-message-author">${escapeHtml(author)}</span>
            <time class="webrtc-message-time" datetime="${new Date().toISOString()}">${time}</time>
        </div>
        <div class="webrtc-message-body">${escapeHtml(text)}</div>
    `;

    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function copyTextFromTextarea(textareaId, buttonId) {
    const textarea = document.getElementById(textareaId);
    const button = document.getElementById(buttonId);

    if (!textarea?.value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(textarea.value);
        setSignalingStatus("Copied to clipboard.", "success");
    } catch {
        textarea.select();
        document.execCommand("copy");
        setSignalingStatus("Copied to clipboard.", "success");
    }

    if (button) {
        const original = button.textContent;
        button.textContent = "Copied!";
        window.setTimeout(() => {
            button.textContent = original;
        }, 1200);
    }
}

function teardownSession() {
    if (dataChannel) {
        dataChannel.onopen = null;
        dataChannel.onclose = null;
        dataChannel.onmessage = null;
        dataChannel.onerror = null;

        try {
            dataChannel.close();
        } catch {
            // ignore close errors during reset
        }
    }

    if (peerConnection) {
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.ondatachannel = null;

        try {
            peerConnection.close();
        } catch {
            // ignore close errors during reset
        }
    }

    peerConnection = null;
    dataChannel = null;

    updateChatAvailability(false);
    setConnectionUi("Idle", "Choose a role to begin signaling.");
    setSignalingStatus("");

    ["hostOfferOut", "hostAnswerIn", "guestOfferIn", "guestAnswerOut"].forEach((id) => {
        const field = document.getElementById(id);
        if (field) {
            field.value = "";
        }
    });

    document.getElementById("copyHostOfferBtn")?.toggleAttribute("disabled", true);
    document.getElementById("applyHostAnswerBtn")?.toggleAttribute("disabled", true);
    document.getElementById("createAnswerBtn")?.toggleAttribute("disabled", true);
    document.getElementById("copyGuestAnswerBtn")?.toggleAttribute("disabled", true);
}

function setRole(role) {
    activeRole = role;

    const hostBtn = document.getElementById("roleHost");
    const guestBtn = document.getElementById("roleGuest");
    const hostSteps = document.getElementById("hostSteps");
    const guestSteps = document.getElementById("guestSteps");

    const isHost = role === "host";

    hostBtn?.classList.toggle("active", isHost);
    guestBtn?.classList.toggle("active", !isHost);
    hostBtn?.setAttribute("aria-selected", String(isHost));
    guestBtn?.setAttribute("aria-selected", String(!isHost));

    if (hostSteps) {
        hostSteps.hidden = !isHost;
    }

    if (guestSteps) {
        guestSteps.hidden = isHost;
    }

    if (!peerConnection) {
        setConnectionUi("Idle", isHost ? "Host: create an offer to start." : "Guest: wait for an offer from the host.");
    }
}

async function hostCreateOffer() {
    try {
        teardownSession();
        setRole("host");

        peerConnection = createPeerConnection();
        attachDataChannel(peerConnection.createDataChannel("chat", { ordered: true }));

        setConnectionUi("Gathering ICE", "Creating offer and collecting network candidates…");
        setSignalingStatus("Creating offer…");

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await waitForIceGathering(peerConnection);

        const encoded = encodeSignal(peerConnection.localDescription);
        const offerField = document.getElementById("hostOfferOut");

        if (offerField) {
            offerField.value = encoded;
        }

        document.getElementById("copyHostOfferBtn")?.removeAttribute("disabled");
        document.getElementById("applyHostAnswerBtn")?.removeAttribute("disabled");

        setConnectionUi("Waiting for answer", "Send the offer to the guest and paste their answer.");
        setSignalingStatus("Offer ready. Copy it to the guest.", "success");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not create offer.";
        setSignalingStatus(message, "error");
        teardownSession();
    }
}

async function hostApplyAnswer() {
    const answerField = document.getElementById("hostAnswerIn");
    const encoded = answerField?.value?.trim();

    if (!encoded) {
        setSignalingStatus("Paste the guest answer first.", "error");
        return;
    }

    if (!peerConnection) {
        setSignalingStatus("Create an offer before applying an answer.", "error");
        return;
    }

    try {
        const answer = decodeSignal(encoded);
        await peerConnection.setRemoteDescription(answer);

        setConnectionUi("Connecting", "Answer applied. Establishing peer link…");
        setSignalingStatus("Answer applied. Waiting for connection…", "success");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not apply answer.";
        setSignalingStatus(message, "error");
    }
}

async function guestCreateAnswer() {
    const offerField = document.getElementById("guestOfferIn");
    const encoded = offerField?.value?.trim();

    if (!encoded) {
        setSignalingStatus("Paste the host offer first.", "error");
        return;
    }

    try {
        teardownSession();
        setRole("guest");

        peerConnection = createPeerConnection();
        peerConnection.ondatachannel = (event) => {
            attachDataChannel(event.channel);
        };

        const offer = decodeSignal(encoded);
        await peerConnection.setRemoteDescription(offer);

        setConnectionUi("Gathering ICE", "Creating answer and collecting network candidates…");
        setSignalingStatus("Creating answer…");

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await waitForIceGathering(peerConnection);

        const answerOut = document.getElementById("guestAnswerOut");
        const answerEncoded = encodeSignal(peerConnection.localDescription);

        if (answerOut) {
            answerOut.value = answerEncoded;
        }

        document.getElementById("copyGuestAnswerBtn")?.removeAttribute("disabled");

        setConnectionUi("Waiting for host", "Send the answer back to the host so they can apply it.");
        setSignalingStatus("Answer ready. Copy it to the host.", "success");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not create answer.";
        setSignalingStatus(message, "error");
        teardownSession();
    }
}

function sendChatMessage(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed || !dataChannel || dataChannel.readyState !== "open") {
        return;
    }

    dataChannel.send(trimmed);
    appendChatMessage(localAlias, trimmed);
}

function initWebrtcManualChat() {
    const rtcCtor = getRtcCtor();
    if (!rtcCtor) {
        setConnectionUi("Unsupported", "WebRTC is not available in this browser.");
        setSignalingStatus("RTCPeerConnection is not supported here.", "error");
        return;
    }

    localAlias = `You (${activeRole})`;

    document.getElementById("roleHost")?.addEventListener("click", () => {
        if (!peerConnection) {
            setRole("host");
        }
    });

    document.getElementById("roleGuest")?.addEventListener("click", () => {
        if (!peerConnection) {
            setRole("guest");
        }
    });

    document.getElementById("createOfferBtn")?.addEventListener("click", hostCreateOffer);
    document.getElementById("applyHostAnswerBtn")?.addEventListener("click", hostApplyAnswer);
    document.getElementById("createAnswerBtn")?.addEventListener("click", guestCreateAnswer);

    document.getElementById("copyHostOfferBtn")?.addEventListener("click", () => {
        copyTextFromTextarea("hostOfferOut", "copyHostOfferBtn");
    });

    document.getElementById("copyGuestAnswerBtn")?.addEventListener("click", () => {
        copyTextFromTextarea("guestAnswerOut", "copyGuestAnswerBtn");
    });

    document.getElementById("resetSessionBtn")?.addEventListener("click", () => {
        teardownSession();
        setSignalingStatus("Session reset.", "success");
    });

    document.getElementById("guestOfferIn")?.addEventListener("input", (event) => {
        const hasValue = Boolean(event.target.value.trim());
        document.getElementById("createAnswerBtn")?.toggleAttribute("disabled", !hasValue);
    });

    document.getElementById("chatForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("messageInput");
        if (!input) {
            return;
        }

        sendChatMessage(input.value);
        input.value = "";
        input.focus();
    });

    window.addEventListener("beforeunload", teardownSession);

    setRole("host");
    updateChatAvailability(false);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWebrtcManualChat);
} else {
    initWebrtcManualChat();
}
