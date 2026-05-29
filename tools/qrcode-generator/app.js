function setStatus(statusElement, message, isSuccess = false) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.classList.toggle("success", isSuccess);
}

function getQrCanvas(outputElement) {
    return outputElement?.querySelector("canvas") ?? null;
}

function getQrImage(outputElement) {
    return outputElement?.querySelector("img") ?? null;
}

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function triggerDownload(dataUrl, filename) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function buildExportCanvas(source, marginPx) {
    const canvas = document.createElement("canvas");
    canvas.width = source.width + marginPx * 2;
    canvas.height = source.height + marginPx * 2;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return null;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, marginPx, marginPx);

    return canvas;
}

function initQrGenerator() {
    const textInput = document.getElementById("qrText");
    const sizeInput = document.getElementById("qrSize");
    const marginInput = document.getElementById("qrMargin");
    const levelInput = document.getElementById("qrLevel");
    const sizeValue = document.getElementById("qrSizeValue");
    const marginValue = document.getElementById("qrMarginValue");
    const outputElement = document.getElementById("qrOutput");
    const previewWrap = document.getElementById("qrPreviewWrap");
    const statusElement = document.getElementById("toolStatus");

    const generateButton = document.getElementById("generateQr");
    const downloadButton = document.getElementById("downloadQr");
    const copyTextButton = document.getElementById("copyText");
    const clearTextButton = document.getElementById("clearText");

    if (!textInput || !sizeInput || !marginInput || !levelInput || !outputElement) {
        return;
    }

    if (typeof QRCode === "undefined") {
        setStatus(statusElement, "QR library failed to load. Please refresh and try again.", false);
        return;
    }

    let inputDebounceTimer = null;

    function readSettings() {
        return {
            text: textInput.value,
            size: toPositiveInt(sizeInput.value, 256),
            marginModules: toPositiveInt(marginInput.value, 2),
            level: levelInput.value
        };
    }

    function updateValueLabels() {
        const { size, marginModules } = readSettings();

        if (sizeValue) {
            sizeValue.textContent = `${size} px`;
        }

        if (marginValue) {
            marginValue.textContent = `${marginModules} modules`;
        }
    }

    function setQuietZone(marginModules) {
        // QR module size is approximately size / 33 for typical versions.
        const visualMarginPx = marginModules * 8;
        if (previewWrap) {
            previewWrap.style.padding = `${visualMarginPx}px`;
        }
    }

    function renderQrCode() {
        const { text, size, marginModules, level } = readSettings();
        const normalizedText = text.trim();

        outputElement.innerHTML = "";
        downloadButton.disabled = true;
        setQuietZone(marginModules);

        if (!normalizedText) {
            setStatus(statusElement, "Enter text or URL to generate a QR code.");
            return;
        }

        const correctionLevel = QRCode.CorrectLevel[level] ?? QRCode.CorrectLevel.M;

        new QRCode(outputElement, {
            text: normalizedText,
            width: size,
            height: size,
            correctLevel: correctionLevel
        });

        downloadButton.disabled = false;
        setStatus(statusElement, `QR code generated (${size} x ${size}).`, true);
    }

    async function downloadQrCode() {
        const { marginModules } = readSettings();
        const marginPx = marginModules * 8;

        const canvas = getQrCanvas(outputElement);
        if (canvas) {
            const exportCanvas = buildExportCanvas(canvas, marginPx);
            if (!exportCanvas) {
                setStatus(statusElement, "Could not build image export.");
                return;
            }

            triggerDownload(exportCanvas.toDataURL("image/png"), "qrcode.png");
            setStatus(statusElement, "Downloaded PNG.", true);
            return;
        }

        const image = getQrImage(outputElement);
        if (!image || !image.src) {
            setStatus(statusElement, "Generate a QR code before downloading.");
            return;
        }

        const sourceImage = new Image();
        sourceImage.src = image.src;

        await sourceImage.decode();

        const exportCanvas = buildExportCanvas(sourceImage, marginPx);
        if (!exportCanvas) {
            setStatus(statusElement, "Could not build image export.");
            return;
        }

        triggerDownload(exportCanvas.toDataURL("image/png"), "qrcode.png");
        setStatus(statusElement, "Downloaded PNG.", true);
    }

    async function copyText() {
        const text = textInput.value;

        if (!text.trim()) {
            setStatus(statusElement, "Nothing to copy yet.");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setStatus(statusElement, "Text copied to clipboard.", true);
        } catch {
            setStatus(statusElement, "Clipboard access was blocked by this browser.");
        }
    }

    function clearAll() {
        textInput.value = "";
        outputElement.innerHTML = "";
        downloadButton.disabled = true;
        setStatus(statusElement, "Cleared.");
    }

    function scheduleRender() {
        if (inputDebounceTimer) {
            clearTimeout(inputDebounceTimer);
        }

        inputDebounceTimer = window.setTimeout(() => {
            renderQrCode();
        }, 200);
    }

    updateValueLabels();
    setQuietZone(readSettings().marginModules);

    textInput.value = "https://akh826.github.io";
    renderQrCode();

    generateButton?.addEventListener("click", renderQrCode);
    downloadButton?.addEventListener("click", () => {
        downloadQrCode().catch(() => {
            setStatus(statusElement, "Failed to download PNG.");
        });
    });
    copyTextButton?.addEventListener("click", copyText);
    clearTextButton?.addEventListener("click", clearAll);

    textInput.addEventListener("input", scheduleRender);

    sizeInput.addEventListener("input", () => {
        updateValueLabels();
        scheduleRender();
    });

    marginInput.addEventListener("input", () => {
        updateValueLabels();
        setQuietZone(readSettings().marginModules);
        scheduleRender();
    });

    levelInput.addEventListener("change", renderQrCode);
}

document.addEventListener("DOMContentLoaded", initQrGenerator);
