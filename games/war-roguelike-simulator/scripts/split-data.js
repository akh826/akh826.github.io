const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(root, "data.js"), "utf8").split(/\r?\n/);

function body(start, end) {
    return lines.slice(start - 1, end).join("\n");
}

const contentDir = path.join(root, "content");
fs.mkdirSync(contentDir, { recursive: true });

function writeModule(name, innerLines, exports) {
    const assigns = exports.map((e) => `    global.WarDataParts.${e} = ${e};`).join("\n");
    const text = `/**
 * War Roguelike — content: ${name}
 */
(function (global) {
    "use strict";
    global.WarDataParts = global.WarDataParts || {};
${innerLines}
${assigns}
})(typeof window !== "undefined" ? window : globalThis);
`;
    fs.writeFileSync(path.join(contentDir, `${name}.js`), text);
    console.log("wrote", name);
}

writeModule("core", [
    body(7, 9),
    body(50, 84),
    body(606, 614),
    body(753, 893).replace(/^    const /gm, "    const ")
].join("\n\n"), ["ARENA", "TAGS", "STATUS_EFFECTS", "RARITY", "ROOM_TYPES", "MAX_STAR", "STAR_STATS", "STAR_EXP", "TERRAINS", "ELITE_AFFIXES", "ENEMY_FORMATIONS"]);

writeModule("worlds", body(11, 48), ["WORLDS"]);
writeModule("units", body(86, 604), ["UNITS", "STARTER_UNITS", "STARTER_ARMY"]);
writeModule("items", body(616, 751) + "\n\n" + body(873, 899), ["ARTIFACTS", "ABILITIES", "SYNERGIES", "TACTIC_UPGRADES", "TACTICS"]);
writeModule("events", body(901, 1100), ["EVENTS", "TRAPS", "SHOP_ITEMS"]);

const agg = `/**
 * War Roguelike — content data (aggregator).
 */
(function (global) {
    "use strict";
    const p = global.WarDataParts || {};
    global.WarData = { ...p };
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(path.join(root, "data.js"), agg);
console.log("aggregator ready");
