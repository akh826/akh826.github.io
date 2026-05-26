function getWebGLInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      return { vendor: "N/A", renderer: "WebGL not supported" };
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    if (!debugInfo) {
      return { vendor: "N/A", renderer: "Unavailable (browser privacy restriction)" };
    }

    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    };
  } catch {
    return { vendor: "N/A", renderer: "Error reading WebGL" };
  }
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getConnectionInfo() {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  if (!connection) {
    return null;
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData
  };
}

async function getUserAgentHints() {
  if (!navigator.userAgentData) {
    return null;
  }

  try {
    return await navigator.userAgentData.getHighEntropyValues([
      "architecture",
      "bitness",
      "model",
      "platform",
      "platformVersion",
      "uaFullVersion",
      "fullVersionList"
    ]);
  } catch {
    return null;
  }
}

async function collectSystemInfo() {
  const webgl = getWebGLInfo();
  const connection = getConnectionInfo();
  const uaHints = await getUserAgentHints();

  const screenInfo = window.screen;

  return {
    collectedAt: new Date().toISOString(),
    browser: {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      language: navigator.language,
      languages: navigator.languages ? [...navigator.languages] : [],
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      pdfViewerEnabled: navigator.pdfViewerEnabled,
      userAgentClientHints: uaHints
    },
    system: {
      platform: navigator.platform,
      userAgentDataPlatform: navigator.userAgentData?.platform ?? null,
      cpuCores: navigator.hardwareConcurrency,
      deviceMemoryGB: navigator.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
      online: navigator.onLine
    },
    display: {
      screenWidth: screenInfo.width,
      screenHeight: screenInfo.height,
      availWidth: screenInfo.availWidth,
      availHeight: screenInfo.availHeight,
      colorDepth: screenInfo.colorDepth,
      pixelDepth: screenInfo.pixelDepth,
      devicePixelRatio: window.devicePixelRatio,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      orientation: screenInfo.orientation?.type ?? null
    },
    locale: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      locale: Intl.DateTimeFormat().resolvedOptions().locale
    },
    network: connection,
    graphics: webgl,
    preferences: {
      colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
    },
    storage: {
      localStorage: (() => {
        try {
          return typeof localStorage !== "undefined";
        } catch {
          return false;
        }
      })(),
      sessionStorage: (() => {
        try {
          return typeof sessionStorage !== "undefined";
        } catch {
          return false;
        }
      })()
    }
  };
}

function flattenInfo(data, prefix = "") {
  const rows = [];

  Object.entries(data).forEach(([key, value]) => {
    const label = prefix ? `${prefix} › ${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenInfo(value, label));
      return;
    }

    rows.push({ label, value: formatValue(value) });
  });

  return rows;
}

function renderSection(container, title, sectionData) {
  const card = document.createElement("article");
  card.className = "info-card";

  const heading = document.createElement("h2");
  heading.textContent = title;
  card.appendChild(heading);

  const table = document.createElement("table");
  table.className = "info-table";
  table.innerHTML = "<tbody></tbody>";

  const tbody = table.querySelector("tbody");

  flattenInfo(sectionData).forEach(({ label, value }) => {
    const row = document.createElement("tr");
    const shortLabel = label.includes("›")
      ? label.split("›").pop().trim()
      : label;

    row.innerHTML = `<th scope="row">${shortLabel}</th><td>${escapeHtml(value)}</td>`;
    tbody.appendChild(row);
  });

  card.appendChild(table);
  container.appendChild(card);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function infoToPlainText(info) {
  const lines = [`Collected: ${info.collectedAt}`, ""];

  Object.entries(info).forEach(([section, data]) => {
    if (section === "collectedAt") {
      return;
    }

    lines.push(`[${section.toUpperCase()}]`);

    flattenInfo(data).forEach(({ label, value }) => {
      lines.push(`${label}: ${value}`);
    });

    lines.push("");
  });

  return lines.join("\n").trim();
}

let latestInfo = null;
let resizeTimer = null;

async function initSystemInfoTool() {
  const grid = document.getElementById("infoGrid");
  const status = document.getElementById("toolStatus");
  const copyBtn = document.getElementById("copyInfo");
  const downloadBtn = document.getElementById("downloadJson");
  const refreshBtn = document.getElementById("refreshInfo");

  if (!grid) {
    return;
  }

  async function loadInfo() {
    status.textContent = "Loading…";
    status.classList.remove("success");

    latestInfo = await collectSystemInfo();
    grid.innerHTML = "";

    renderSection(grid, "Browser", latestInfo.browser);
    renderSection(grid, "System & platform", latestInfo.system);
    renderSection(grid, "Display", latestInfo.display);
    renderSection(grid, "Locale & time", latestInfo.locale);
    renderSection(grid, "Network", latestInfo.network ?? { note: "Not available in this browser" });
    renderSection(grid, "Graphics (WebGL)", latestInfo.graphics);
    renderSection(grid, "Preferences", latestInfo.preferences);
    renderSection(grid, "Storage", latestInfo.storage);

    status.textContent = `Updated at ${new Date().toLocaleString()}`;
    status.classList.add("success");
  }

  copyBtn?.addEventListener("click", async () => {
    if (!latestInfo) {
      return;
    }

    try {
      await navigator.clipboard.writeText(infoToPlainText(latestInfo));
      status.textContent = "Copied to clipboard.";
      status.classList.add("success");
    } catch {
      status.textContent = "Could not copy. Try Download JSON instead.";
      status.classList.remove("success");
    }
  });

  downloadBtn?.addEventListener("click", () => {
    if (!latestInfo) {
      return;
    }

    const blob = new Blob([JSON.stringify(latestInfo, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-info-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "JSON file downloaded.";
    status.classList.add("success");
  });

  refreshBtn?.addEventListener("click", loadInfo);

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(loadInfo, 200);
  });

  await loadInfo();
}

initSystemInfoTool();
