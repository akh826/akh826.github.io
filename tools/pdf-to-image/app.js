/* global pdfjsLib, JSZip */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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
        return "document";
    }

    const trimmed = filename.trim();
    if (!trimmed) {
        return "document";
    }

    const dotIndex = trimmed.lastIndexOf(".");
    if (dotIndex <= 0) {
        return trimmed;
    }

    return trimmed.slice(0, dotIndex);
}

function pageFilename(baseName, pageNumber, extension) {
    const padded = String(pageNumber).padStart(3, "0");
    return `${baseName}-page-${padded}.${extension}`;
}

function triggerDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
        if (mimeType === "image/jpeg" || mimeType === "image/webp") {
            canvas.toBlob(resolve, mimeType, quality);
            return;
        }

        canvas.toBlob(resolve, mimeType);
    });
}

function initPdfToImageTool() {
    const fileInput = document.getElementById("sourceFile");
    const pageNav = document.getElementById("pageNav");
    const pageNumberInput = document.getElementById("pageNumber");
    const pageTotal = document.getElementById("pageTotal");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");

    const scaleRange = document.getElementById("scaleRange");
    const scaleValue = document.getElementById("scaleValue");
    const targetFormatSelect = document.getElementById("targetFormat");
    const qualityRange = document.getElementById("qualityRange");
    const qualityValue = document.getElementById("qualityValue");
    const qualityField = document.getElementById("qualityField");

    const downloadPageBtn = document.getElementById("downloadPageBtn");
    const downloadAllBtn = document.getElementById("downloadAllBtn");
    const clearButton = document.getElementById("clearBtn");

    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const metaList = document.getElementById("metaList");
    const statusElement = document.getElementById("toolStatus");

    if (
        !fileInput ||
        !pageNav ||
        !pageNumberInput ||
        !pageTotal ||
        !scaleRange ||
        !targetFormatSelect ||
        !qualityRange ||
        !downloadPageBtn ||
        !downloadAllBtn ||
        !previewImage ||
        !previewPlaceholder ||
        !metaList
    ) {
        return;
    }

    let sourceFile = null;
    let pdfDocument = null;
    let currentPage = 1;
    let previewObjectUrl = "";
    let previewTimer = null;
    let isBusy = false;

    function revokePreviewUrl() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = "";
        }
    }

    function getScale() {
        return Number.parseInt(scaleRange.value, 10) / 100;
    }

    function getQuality() {
        return Number.parseInt(qualityRange.value, 10) / 100;
    }

    function getMimeType() {
        return targetFormatSelect.value;
    }

    function updateQualityVisibility() {
        const format = getMimeType();
        const lossy = format === "image/jpeg" || format === "image/webp";

        if (qualityField) {
            qualityField.hidden = !lossy;
        }
    }

    function updateScaleText() {
        const scale = Number.parseInt(scaleRange.value, 10);
        if (scaleValue) {
            scaleValue.textContent = `${scale}%`;
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

    function clearPreview() {
        revokePreviewUrl();
        previewImage.hidden = true;
        previewImage.removeAttribute("src");
        previewPlaceholder.hidden = false;
    }

    function updatePageControls() {
        const totalPages = pdfDocument?.numPages ?? 0;

        pageNumberInput.max = String(Math.max(totalPages, 1));
        pageNumberInput.value = String(currentPage);
        pageTotal.textContent = `/ ${totalPages || 1}`;

        const hasPdf = totalPages > 0;
        pageNav.hidden = !hasPdf;
        prevPageBtn.disabled = !hasPdf || currentPage <= 1 || isBusy;
        nextPageBtn.disabled = !hasPdf || currentPage >= totalPages || isBusy;
        pageNumberInput.disabled = !hasPdf || isBusy;

        downloadPageBtn.disabled = !hasPdf || isBusy;
        downloadAllBtn.disabled = !hasPdf || isBusy || totalPages < 1;
    }

    function setBusy(busy) {
        isBusy = busy;
        downloadPageBtn.disabled = busy || !pdfDocument;
        downloadAllBtn.disabled = busy || !pdfDocument;
        fileInput.disabled = busy;
        scaleRange.disabled = busy;
        targetFormatSelect.disabled = busy;
        qualityRange.disabled = busy;
        updatePageControls();
    }

    async function renderPageToCanvas(pageNumber, scale) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas is not available in this browser.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
            canvasContext: context,
            viewport
        }).promise;

        return { canvas, page };
    }

    async function renderCurrentPreview() {
        if (!pdfDocument || !sourceFile) {
            return;
        }

        setBusy(true);
        setStatus(statusElement, `Rendering page ${currentPage}...`);

        try {
            const mimeType = getMimeType();
            const { canvas } = await renderPageToCanvas(currentPage, getScale());
            const blob = await canvasToBlob(canvas, mimeType, getQuality());

            if (!blob) {
                setStatus(statusElement, "Preview rendering failed.");
                return;
            }

            revokePreviewUrl();
            previewObjectUrl = URL.createObjectURL(blob);
            setPreview(previewObjectUrl);

            renderMetaLines([
                `Source name: ${sourceFile.name}`,
                `Source size: ${formatBytes(sourceFile.size)}`,
                `Pages: ${pdfDocument.numPages}`,
                `Current page: ${currentPage}`,
                `Output format: ${mimeToLabel(mimeType)}`,
                `Scale: ${scaleRange.value}%`,
                `Resolution: ${canvas.width} x ${canvas.height}`
            ]);

            setStatus(statusElement, `Page ${currentPage} ready.`, true);
        } catch {
            clearPreview();
            setStatus(statusElement, "Could not render this PDF page.");
        } finally {
            setBusy(false);
        }
    }

    function schedulePreview() {
        if (!pdfDocument) {
            return;
        }

        if (previewTimer) {
            clearTimeout(previewTimer);
        }

        previewTimer = setTimeout(() => {
            previewTimer = null;
            renderCurrentPreview().catch(() => {
                setStatus(statusElement, "Unexpected error while rendering preview.");
                setBusy(false);
            });
        }, 250);
    }

    async function loadPdfFile(file) {
        sourceFile = file;
        currentPage = 1;

        if (pdfDocument?.destroy) {
            await pdfDocument.destroy();
        }
        pdfDocument = null;

        clearPreview();
        renderMetaLines([]);
        updatePageControls();

        setBusy(true);
        setStatus(statusElement, "Loading PDF...");

        try {
            const data = await file.arrayBuffer();
            pdfDocument = await pdfjsLib.getDocument({ data }).promise;
            currentPage = 1;
            updatePageControls();
            await renderCurrentPreview();
        } catch {
            sourceFile = null;
            pdfDocument = null;
            updatePageControls();
            setStatus(statusElement, "Could not load this PDF file.");
        } finally {
            setBusy(false);
        }
    }

    function goToPage(pageNumber) {
        if (!pdfDocument) {
            return;
        }

        const totalPages = pdfDocument.numPages;
        const nextPage = Math.min(Math.max(pageNumber, 1), totalPages);

        if (nextPage === currentPage) {
            updatePageControls();
            return;
        }

        currentPage = nextPage;
        updatePageControls();
        schedulePreview();
    }

    async function downloadCurrentPage() {
        if (!pdfDocument || !sourceFile) {
            setStatus(statusElement, "Load a PDF file first.");
            return;
        }

        setBusy(true);
        setStatus(statusElement, `Exporting page ${currentPage}...`);

        try {
            const mimeType = getMimeType();
            const extension = mimeToExtension(mimeType);
            const baseName = safeBaseName(sourceFile.name);
            const { canvas } = await renderPageToCanvas(currentPage, getScale());
            const blob = await canvasToBlob(canvas, mimeType, getQuality());

            if (!blob) {
                setStatus(statusElement, "Export failed for this format.");
                return;
            }

            const filename = pageFilename(baseName, currentPage, extension);
            const url = URL.createObjectURL(blob);
            triggerDownload(url, filename);
            URL.revokeObjectURL(url);

            setStatus(statusElement, `Downloaded ${filename}.`, true);
        } catch {
            setStatus(statusElement, "Download failed for this page.");
        } finally {
            setBusy(false);
        }
    }

    async function downloadAllPages() {
        if (!pdfDocument || !sourceFile) {
            setStatus(statusElement, "Load a PDF file first.");
            return;
        }

        if (typeof JSZip !== "function") {
            setStatus(statusElement, "ZIP library is not available.");
            return;
        }

        setBusy(true);
        setStatus(statusElement, "Exporting all pages...");

        try {
            const mimeType = getMimeType();
            const extension = mimeToExtension(mimeType);
            const baseName = safeBaseName(sourceFile.name);
            const scale = getScale();
            const quality = getQuality();
            const zip = new JSZip();

            for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
                setStatus(statusElement, `Exporting page ${pageNumber} of ${pdfDocument.numPages}...`);

                const { canvas } = await renderPageToCanvas(pageNumber, scale);
                const blob = await canvasToBlob(canvas, mimeType, quality);

                if (!blob) {
                    setStatus(statusElement, `Export failed on page ${pageNumber}.`);
                    return;
                }

                const arrayBuffer = await blob.arrayBuffer();
                zip.file(pageFilename(baseName, pageNumber, extension), arrayBuffer);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipName = `${baseName}-pages.zip`;
            const url = URL.createObjectURL(zipBlob);
            triggerDownload(url, zipName);
            URL.revokeObjectURL(url);

            setStatus(statusElement, `Downloaded ${zipName} (${pdfDocument.numPages} pages).`, true);
        } catch {
            setStatus(statusElement, "ZIP export failed.");
        } finally {
            setBusy(false);
        }
    }

    async function clearAll() {
        if (previewTimer) {
            clearTimeout(previewTimer);
            previewTimer = null;
        }

        fileInput.value = "";
        sourceFile = null;
        currentPage = 1;

        if (pdfDocument?.destroy) {
            await pdfDocument.destroy();
        }
        pdfDocument = null;

        clearPreview();
        renderMetaLines([]);
        updatePageControls();

        setStatus(statusElement, "Cleared.");
    }

    fileInput.addEventListener("change", (event) => {
        const selectedFile = event.target.files?.[0] ?? null;

        if (!selectedFile) {
            return;
        }

        loadPdfFile(selectedFile).catch(() => {
            setStatus(statusElement, "Unexpected error while loading PDF.");
            setBusy(false);
        });
    });

    prevPageBtn.addEventListener("click", () => {
        goToPage(currentPage - 1);
    });

    nextPageBtn.addEventListener("click", () => {
        goToPage(currentPage + 1);
    });

    pageNumberInput.addEventListener("change", () => {
        const value = Number.parseInt(pageNumberInput.value, 10);
        if (!Number.isFinite(value)) {
            pageNumberInput.value = String(currentPage);
            return;
        }

        goToPage(value);
    });

    scaleRange.addEventListener("input", () => {
        updateScaleText();
        schedulePreview();
    });

    targetFormatSelect.addEventListener("change", () => {
        updateQualityVisibility();
        schedulePreview();
    });

    qualityRange.addEventListener("input", () => {
        updateQualityText();
        schedulePreview();
    });

    downloadPageBtn.addEventListener("click", () => {
        downloadCurrentPage().catch(() => {
            setStatus(statusElement, "Unexpected error during download.");
            setBusy(false);
        });
    });

    downloadAllBtn.addEventListener("click", () => {
        downloadAllPages().catch(() => {
            setStatus(statusElement, "Unexpected error during ZIP export.");
            setBusy(false);
        });
    });

    clearButton?.addEventListener("click", () => {
        clearAll().catch(() => {
            setStatus(statusElement, "Unexpected error while clearing.");
        });
    });

    updateScaleText();
    updateQualityText();
    updateQualityVisibility();
    updatePageControls();
}

document.addEventListener("DOMContentLoaded", initPdfToImageTool);
