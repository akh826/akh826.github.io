/**
 * Tool catalog — add new tools here and create a matching folder under tools/.
 *
 * Example:
 * {
 *   slug: "my-tool",           // folder name: tools/my-tool/ (must contain index.html)
 *   title: "My Tool",
 *   description: "Short summary for the catalog.",
 *   tags: ["Utility"],
 *   hidden: true               // optional — omit from tools catalog (direct URL still works)
 * }
 */
window.TOOL_CATALOG = [
  {
    slug: "system-info",
    title: "PC & Browser Info",
    description:
      "View screen, browser, timezone, CPU cores, GPU hint, and network details available from this device.",
    tags: ["Browser", "Debug"]
  },
  {
    slug: "network-connectivity",
    title: "Network & Connectivity Performance",
    description:
      "Inspect effective network type, downlink, RTT, online/offline events, local IP candidates, and quick latency probes.",
    tags: ["Network", "Debug", "Performance"]
  },
  {
    slug: "media-permissions",
    title: "Media & Permissions Audit",
    description:
      "Audit browser permission states and enumerate connected microphones, cameras, and audio outputs for media app debugging.",
    tags: ["Media", "Debug", "Browser"]
  },
  {
    slug: "storage-quota",
    title: "Site Storage & Cache Inspector",
    description:
      "Inspect localStorage, sessionStorage, cookies, Cache Storage, IndexedDB, service workers, and quota for the current origin.",
    tags: ["Storage", "Cache", "Debug", "Browser"]
  },
  {
    slug: "performance-time",
    title: "Performance & Time Benchmarks",
    description:
      "Break down page load phases using Navigation Timing API and estimate client clock drift with rapid NTP-like checks.",
    tags: ["Performance", "Debug", "Browser", "Network"]
  },
  {
    slug: "api-tester",
    title: "API Tester",
    description:
      "Build and send HTTP requests with custom method, headers, auth, body, and attachments, then inspect responses.",
    tags: ["API", "Debug", "Network", "Developer"]
  },
  {
    slug: "jrxml-report-preview",
    title: "JRXML Parameter & PDF Preview",
    description:
      "Parse JRXML parameters and preview PDF with local Java compile, or optionally via JasperReports Server.",
    tags: ["JasperReports", "JRXML", "PDF", "Developer", "Debug"],
    hidden: true
  },
  {
    slug: "url-iframe-viewer",
    title: "URL Iframe Viewer",
    description:
      "Enter a URL and preview the page in an embedded iframe with adjustable height, reload, and new-tab fallback.",
    tags: ["Utility", "Browser", "Developer"]
  },
  {
    slug: "url-param-editor",
    title: "URL Parameter Editor",
    description:
      "Parse a URL, view and edit query parameters in a clear table, add new params, and copy the rebuilt URL.",
    tags: ["Utility", "Browser", "Developer", "Debug"]
  },
  {
    slug: "qrcode-generator",
    title: "QR Code Generator",
    description:
      "Generate QR codes from text or URLs with adjustable size, quiet zone, and error correction, then download as PNG.",
    tags: ["Utility", "Browser", "Developer"]
  },
  {
    slug: "image-format-converter",
    title: "Image File Format Converter",
    description:
      "Convert uploaded images to PNG, JPEG, or WebP in-browser and download the result.",
    tags: ["Utility", "Media", "Browser"]
  },
  {
    slug: "mock-server-setup",
    title: "Local Mock Server Setup",
    description:
      "Step-by-step guide to run mock-server.js locally so Postman can receive real mocked HTTP status codes.",
    tags: ["API", "Developer", "Node.js", "Setup"]
  },
  {
    slug: "webrtc-manual-chat",
    title: "WebRTC Manual Signaling Chat",
    description:
      "1-to-1 browser chat over WebRTC with copy-paste SDP exchange — no backend server required.",
    tags: ["WebRTC", "Network", "Debug", "Developer"]
  },
  {
    slug: "investment-calculator",
    title: "Investment Calculator",
    description:
      "Extensible investing math tool for compound growth, CAGR, real returns, position sizing, and withdrawal planning.",
    tags: ["Finance", "Utility", "Calculator"]
  }
];
