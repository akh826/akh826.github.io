/**
 * War Roguelike — battle / formation UI module boundary.
 * Battle loop, canvas draw, and formation prep remain in app.js (shared canvas helpers).
 */
(function (global) {
    "use strict";

    global.WarUIBattle = {
        version: 1
    };
})(typeof window !== "undefined" ? window : globalThis);
