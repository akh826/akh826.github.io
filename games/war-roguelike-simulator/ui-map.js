/**
 * War Roguelike — map / room modal UI (renderMap, enterRoom remain in app.js for now).
 * Event & shop modals with contract preview and shop hints.
 */
(function (global) {
    "use strict";

    global.WarUIMap = {
        /** Reserved module boundary — map rendering lives in app.js until next refactor pass. */
        version: 1
    };
})(typeof window !== "undefined" ? window : globalThis);
