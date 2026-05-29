function setStatus(statusElement, message, isSuccess = false) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.classList.toggle("success", isSuccess);
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;

    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }

    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function mimeToLabel(mimeType) {
    if (mimeType === "image/png") {
        return "PNG";
    }

    if (mimeType === "image/jpeg") {
        return "JPEG";
    }

    if (mimeType === "image/webp") {
        return "WebP";
    }

    return mimeType;
}

function mimeToExtension(mimeType) {
    if (mimeType === "image/png") {
        return "png";
    }

    if (mimeType === "image/jpeg") {
        return "jpg";
    }

    if (mimeType === "image/webp") {
        return "webp";
    }

    return "img";
}

function safeBaseName(filename) {
    if (!filename || typeof filename !== "string") {
        return "image";
    }

    const trimmed = filename.trim();
    if (!trimmed) {
        return "image";
    }

    const dotIndex = trimmed.lastIndexOf(".");
    if (dotIndex <= 0) {
        return trimmed;
    }

    return trimmed.slice(0, dotIndex);
}

function initImageConverterTool() {
    const fileInput = document.getElementById("sourceFile");
    const targetFormatSelect = document.getElementById("targetFormat");
    const qualityRange = document.getElementById("qualityRange");
    const qualityValue = document.getElementById("qualityValue");
    const qualityField = document.getElementById("qualityField");

    const convertButton = document.getElementById("convertBtn");
    const downloadButton = document.getElementById("downloadBtn");
    const clearButton = document.getElementById("clearBtn");

    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const metaList = document.getElementById("metaList");
    const statusElement = document.getElementById("toolStatus");

    if (
        !fileInput ||
        !targetFormatSelect ||
        !qualityRange ||
        !convertButton ||
        !downloadButton ||
        !previewImage ||
        !previewPlaceholder ||
        !metaList
    ) {
        return;
    }

    let sourceFile = null;
    let sourceImageBitmap = null;
    let sourceObjectUrl = "";

    let convertedBlob = null;
    let convertedObjectUrl = "";

    function revokeObjectUrl(url) {
        if (url) {
            URL.revokeObjectURL(url);
        }
    }

    function clearConvertedOutput() {
        convertedBlob = null;
        revokeObjectUrl(convertedObjectUrl);
        convertedObjectUrl = "";
        downloadButton.disabled = true;
    }

    function updateQualityVisibility() {
        const format = targetFormatSelect.value;
        const lossy = format === "image/jpeg" || format === "image/webp";

        if (qualityField) {
            qualityField.hidden = !lossy;
        }
    }

    function updateQualityText() {
        const quality = Number.parseInt(qualityRange.value, 10);
        if (qualityValue) {
            qualityValue.textContent = `${quality}%`;
        }
    }

    function renderMetaLines(lines) {
        metaList.innerHTML = "";

        lines.forEach((line) => {
            const item = document.createElement("li");
            item.textContent = line;
            metaList.appendChild(item);
        });
    }

    function setPreview(url) {
        previewImage.src = url;
        previewImage.hidden = false;
        previewPlaceholder.hidden = true;
    }

    async function loadSourceFile(file) {
        sourceFile = file;
        clearConvertedOutput();

        if (sourceImageBitmap?.close) {
            sourceImageBitmap.close();
        }

        revokeObjectUrl(sourceObjectUrl);
        sourceObjectUrl = URL.createObjectURL(file);

        try {
            sourceImageBitmap = await createImageBitmap(file);
        } catch {
            sourceImageBitmap = null;
            setStatus(statusElement, "Could not decode this image file.");
            convertButton.disabled = true;
            return;
        }

        setPreview(sourceObjectUrl);

        convertButton.disabled = false;

        renderMetaLines([
            `Source name: ${file.name}`,
            `Source format: ${mimeToLabel(file.type || "unknown")}`,
            `Source size: ${formatBytes(file.size)}`,
            `Resolution: ${sourceImageBitmap.width} x ${sourceImageBitmap.height}`
        ]);

        setStatus(statusElement, "Image loaded. Click Convert when ready.", true);
    }

    function blobToObjectUrl(blob) {
        revokeObjectUrl(convertedObjectUrl);
        convertedObjectUrl = URL.createObjectURL(blob);
        return convertedObjectUrl;
    }

    async function convertImage() {
        if (!sourceImageBitmap || !sourceFile) {
            setStatus(statusElement, "Select an image file first.");
            return;
        }

        setStatus(statusElement, "Converting...");
        clearConvertedOutput();

        const mimeType = targetFormatSelect.value;
        const quality = Number.parseInt(qualityRange.value, 10) / 100;

        const canvas = document.createElement("canvas");
        canvas.width = sourceImageBitmap.width;
        canvas.height = sourceImageBitmap.height;

        const context = canvas.getContext("2d");
        if (!context) {
            setStatus(statusElement, "Canvas is not available in this browser.");
            return;
        }

        // Fill white background first so transparent images convert predictably to JPEG.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sourceImageBitmap, 0, 0);

        const blob = await new Promise((resolve) => {
            if (mimeType === "image/jpeg" || mimeType === "image/webp") {
                canvas.toBlob(resolve, mimeType, quality);
            } else {
                canvas.toBlob(resolve, mimeType);
            }
        });

        if (!blob) {
            setStatus(statusElement, "Conversion failed for this format.");
            return;
        }

        convertedBlob = blob;
        const previewUrl = blobToObjectUrl(blob);
        setPreview(previewUrl);
        downloadButton.disabled = false;

        const savings = sourceFile.size > 0
            ? ((1 - blob.size / sourceFile.size) * 100).toFixed(1)
            : "0.0";

        renderMetaLines([
            `Source name: ${sourceFile.name}`,
            `Target format: ${mimeToLabel(mimeType)}`,
            `Source size: ${formatBytes(sourceFile.size)}`,
            `Converted size: ${formatBytes(blob.size)}`,
            `Size change: ${savings}%`,
            `Resolution: ${canvas.width} x ${canvas.height}`
        ]);

        setStatus(statusElement, "Conversion complete. You can now download the file.", true);
    }

    function downloadConverted() {
        if (!convertedBlob || !sourceFile) {
            setStatus(statusElement, "Convert an image before downloading.");
            return;
        }

        const extension = mimeToExtension(targetFormatSelect.value);
        const baseName = safeBaseName(sourceFile.name);
        const filename = `${baseName}-converted.${extension}`;

        const link = document.createElement("a");
        link.href = convertedObjectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setStatus(statusElement, `Downloaded ${filename}.`, true);
    }

    function clearAll() {
        fileInput.value = "";
        sourceFile = null;

        if (sourceImageBitmap?.close) {
            sourceImageBitmap.close();
        }
        sourceImageBitmap = null;

        revokeObjectUrl(sourceObjectUrl);
        sourceObjectUrl = "";

        clearConvertedOutput();

        previewImage.hidden = true;
        previewImage.removeAttribute("src");
        previewPlaceholder.hidden = false;

        metaList.innerHTML = "";
        convertButton.disabled = true;

        setStatus(statusElement, "Cleared.");
    }

    fileInput.addEventListener("change", (event) => {
        const selectedFile = event.target.files?.[0] ?? null;

        if (!selectedFile) {
            return;
        }

        loadSourceFile(selectedFile);
    });

    targetFormatSelect.addEventListener("change", () => {
        updateQualityVisibility();
        clearConvertedOutput();

        if (sourceFile && sourceObjectUrl) {
            setPreview(sourceObjectUrl);
        }
    });

    qualityRange.addEventListener("input", () => {
        updateQualityText();
    });

    convertButton.addEventListener("click", () => {
        convertImage().catch(() => {
            setStatus(statusElement, "Unexpected error during conversion.");
        });
    });

    downloadButton.addEventListener("click", downloadConverted);
    clearButton?.addEventListener("click", clearAll);

    updateQualityText();
    updateQualityVisibility();
}

document.addEventListener("DOMContentLoaded", initImageConverterTool);
