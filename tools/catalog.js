/**
 * Tool catalog — add new tools here and create a matching folder under tools/.
 *
 * Example:
 * {
 *   slug: "my-tool",           // folder name: tools/my-tool/ (must contain index.html)
 *   title: "My Tool",
 *   description: "Short summary for the catalog.",
 *   tags: ["Utility"]
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
    title: "Client Storage & Quota Analytics",
    description:
      "Inspect origin storage quota, usage, and byte-size breakdown across localStorage, sessionStorage, and cookies.",
    tags: ["Storage", "Debug", "Browser", "Performance"]
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
  }
];
