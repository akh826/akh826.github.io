/**
 * War Roguelike — content: worlds
 */
(function (global) {
    "use strict";
    global.WarDataParts = global.WarDataParts || {};
    const WORLDS = [
        {
            id: "verdant",
            name: "翠綠平原",
            theme: "verdant",
            layers: 10,
            bossId: "warlord",
            bossName: "征戰領主",
            enemyPool: ["grunt", "shield", "plague_rat", "dark_mage"]
        },
        {
            id: "ashen",
            name: "灰燼荒原",
            theme: "ashen",
            layers: 10,
            bossId: "lich_king",
            bossName: "巫妖王",
            enemyPool: ["skeleton", "wraith", "plague_rat", "bone_knight", "dark_mage"]
        },
        {
            id: "frostpeak",
            name: "永霜裂谷",
            theme: "frost",
            layers: 10,
            bossId: "frost_empress",
            bossName: "霜語女皇",
            enemyPool: ["frost_wolf", "ice_golem", "frost_archer", "blizzard_mage", "wraith"]
        },
        {
            id: "forgefire",
            name: "熔火要塞",
            theme: "forge",
            layers: 10,
            bossId: "forge_titan",
            bossName: "熔爐泰坦",
            enemyPool: ["ember_brute", "cinder_archer", "lava_guard", "pyromancer", "clockwork_soldier"]
        }
    ];
    global.WarDataParts.WORLDS = WORLDS;
})(typeof window !== "undefined" ? window : globalThis);
