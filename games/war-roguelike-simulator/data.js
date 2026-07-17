/**
 * War Roguelike — content data (aggregator).
 */
(function (global) {
    "use strict";
    const p = global.WarDataParts || {};
    global.WarData = { ...p };
})(typeof window !== "undefined" ? window : globalThis);
