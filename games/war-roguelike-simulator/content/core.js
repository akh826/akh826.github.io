/**
 * War Roguelike — content: core
 */
(function (global) {
    "use strict";
    global.WarDataParts = global.WarDataParts || {};
    const ARENA = { width: 800, height: 450, softWarn: 70 };
    const DEFAULT_MOVE = { melee: 32, ranged: 24 };
    const DEFAULT_RANGE = { melee: 28, ranged: 110 };

    const TAGS = {
        tank: { label: "坦克" },
        warrior: { label: "戰士" },
        ranger: { label: "射手" },
        caster: { label: "法師" },
        support: { label: "輔助" },
        assassin: { label: "刺客" },
        elite: { label: "精英" },
        melee: { label: "近戰" },
        ranged: { label: "遠程" },
        holy: { label: "神聖" },
        arcane: { label: "奧術" },
        shadow: { label: "暗影" },
        fire: { label: "火焰" },
        beast: { label: "野獸" },
        human: { label: "人類" },
        mechanical: { label: "機械" },
        cavalry: { label: "騎兵" },
        guard: { label: "護衛" },
        frenzy: { label: "狂戰" },
        summon: { label: "召喚" },
        boss: { label: "Boss" }
    };

    const STATUS_EFFECTS = {
        poison: { label: "中毒", icon: "🤢", color: "#86efac", stackable: true, maxStacks: 8 },
        burn: { label: "燃燒", icon: "🔥", color: "#fb923c", stackable: false },
        freeze: { label: "冰凍", icon: "❄", color: "#7dd3fc", stackable: false },
        bleed: { label: "流血", icon: "🩸", color: "#f87171", stackable: true, maxStacks: 6 },
        shock: { label: "感電", icon: "⚡", color: "#fde047", stackable: false },
        weaken: { label: "虛弱", icon: "📉", color: "#a78bfa", stackable: false },
        vulnerable: { label: "易傷", icon: "💥", color: "#fb7185", stackable: false },
        root: { label: "定身", icon: "⛓", color: "#94a3b8", stackable: false },
        silence: { label: "沉默", icon: "🔇", color: "#c4b5fd", stackable: false }
    };

    const RARITY = {
        common: { label: "普通", weight: 50, order: 1 },
        uncommon: { label: "優秀", weight: 28, order: 2 },
        rare: { label: "稀有", weight: 14, order: 3 },
        epic: { label: "史詩", weight: 6, order: 4 },
        legendary: { label: "傳說", weight: 2, order: 5 },
        /** Never appears in random rewards/shops; only via legendary artifact grant or event. */
        unique: { label: "唯一", weight: 0, order: 6 }
    };

    const ROOM_TYPES = {
        combat: { icon: "⚔", label: "戰鬥", color: "#ef4444" },
        epic_combat: { icon: "💥", label: "史詩戰鬥", color: "#f97316" },
        treasure: { icon: "💎", label: "寶藏", color: "#eab308" },
        event: { icon: "❓", label: "事件", color: "#8b5cf6" },
        // trap no longer shown on map; secretOutcome on event rooms
        trap: { icon: "❓", label: "事件", color: "#8b5cf6" },
        shop: { icon: "🏪", label: "商店", color: "#22c55e" },
        epic: { icon: "🌟", label: "史詩秘庫", color: "#a855f7" },
        boss: { icon: "👑", label: "Boss", color: "#dc2626" },
        start: { icon: "🏕", label: "營地", color: "#64748b" }
    };

    /** Max unit star (EXP / fusion cap). */
    const MAX_STAR = 10;

    const STAR_STATS = {
        1: { hp: 1, atk: 1, def: 1 },
        2: { hp: 1.28, atk: 1.22, def: 1.15 },
        3: { hp: 1.55, atk: 1.45, def: 1.3 },
        4: { hp: 1.85, atk: 1.7, def: 1.48 },
        5: { hp: 2.2, atk: 2.0, def: 1.68 },
        6: { hp: 2.6, atk: 2.35, def: 1.92 },
        7: { hp: 3.05, atk: 2.75, def: 2.2 },
        8: { hp: 3.55, atk: 3.2, def: 2.5 },
        9: { hp: 4.1, atk: 3.7, def: 2.85 },
        10: { hp: 4.75, atk: 4.25, def: 3.25 }
    };

    /** EXP needed at current star to level up (★10 is max). */
    const STAR_EXP = {
        1: 3,
        2: 5,
        3: 8,
        4: 12,
        5: 16,
        6: 22,
        7: 28,
        8: 36,
        9: 45
    };

    const TERRAINS = [
        { id: "plains", name: "平原", desc: "無特殊效果", icon: "🌾", effect: {} },
        { id: "choke", name: "隘口", desc: "近戰攻擊 +15%、遠程射程 -20", icon: "⛰", effect: { meleeAtkMult: 1.15, rangedRangeAdd: -20 } },
        { id: "open", name: "開闊地", desc: "遠程攻擊 +12%、射程 +25、近戰移速 -10%", icon: "🛤", effect: { rangedAtkMult: 1.12, rangedRangeAdd: 25, meleeMoveMult: 0.9 } },
        { id: "frostfield", name: "冰原", desc: "全體移速 -12%；攻擊 18% 附加短暫冰凍", icon: "❄", effect: { moveMult: 0.88, onHitChance: 0.18, onHitStatus: { type: "freeze", duration: 1.2, slow: 0.45 } } },
        { id: "emberfield", name: "焦土", desc: "全體攻擊 +8%；攻擊 20% 附加燃燒（最大生命%）", icon: "🔥", effect: { atkMult: 1.08, onHitChance: 0.2, onHitStatus: { type: "burn", duration: 2.5, pct: 0.025 } } },
        { id: "mire", name: "毒沼", desc: "全體移速 -8%；攻擊 22% 附加可疊層中毒", icon: "🫧", effect: { moveMult: 0.92, onHitChance: 0.22, onHitStatus: { type: "poison", duration: 3.5, dps: 6 } } },
        { id: "stormflat", name: "雷原", desc: "技能冷卻 -8%；攻擊 18% 附加感電", icon: "🌩", effect: { skillCdMult: 0.92, onHitChance: 0.18, onHitStatus: { type: "shock", duration: 2.5, dps: 8 } } },
        { id: "ruins", name: "遺跡", desc: "技能冷卻 -12%、技能威力 +10%", icon: "🏛", effect: { skillCdMult: 0.88, skillPower: 1.1 } }
    ];

    const ELITE_AFFIXES = [
        { id: "regenerating", name: "再生", icon: "💚", desc: "每秒回復 2% 最大生命", tip: "爆發斬殺／易傷優先；拖時間會被磨死", effect: { regen: 0.02 } },
        { id: "enraged", name: "狂暴", icon: "💢", desc: "攻擊 +35%、防禦 -15%", tip: "防禦較低，集火或守陣都能壓制", effect: { atkMult: 1.35, defMult: 0.85 } },
        { id: "shielded", name: "護盾", icon: "🔷", desc: "開場護盾 = 40% 最大生命", tip: "先打掉護盾再輸出；多段攻擊較有效", effect: { startShieldPct: 0.4 } },
        { id: "thorny", name: "反傷", icon: "🌵", desc: "受擊反彈 25% 傷害", tip: "避免多段／吸血對撞；改用技能爆發", effect: { thorns: 0.25 } },
        { id: "swift", name: "迅捷", icon: "💨", desc: "移速與攻速 +30%", tip: "定身／冰凍／嘲諷拖住前排", effect: { moveMult: 1.3, spdMult: 1.3 } },
        { id: "vampiric", name: "吸血", icon: "🩸", desc: "造成傷害的 18% 轉為生命", tip: "降低其輸出或快速集火斬殺", effect: { lifesteal: 0.18 } }
    ];

    /** Enemy wave templates — filled from the active world's enemyPool. */
    const ENEMY_FORMATIONS = [
        {
            id: "shield_wall", name: "盾牆後排",
            slots: [
                { tags: ["tank", "guard"], n: 2 },
                { tags: ["ranged", "caster", "ranger", "arcane"], n: 2 },
                { tags: ["any"], n: -1 }
            ]
        },
        {
            id: "rat_swarm", name: "蟲鼠潮",
            preferIds: ["plague_rat", "grunt", "skeleton", "frost_wolf"],
            slots: [{ tags: ["any"], n: -1 }]
        },
        {
            id: "cavalry_rush", name: "騎兵突擊",
            slots: [
                { tags: ["cavalry", "assassin", "warrior", "melee"], n: 3 },
                { tags: ["any"], n: -1 }
            ]
        },
        {
            id: "mech_line", name: "機械重甲",
            slots: [
                { tags: ["mechanical", "tank", "guard"], n: 3 },
                { tags: ["any"], n: -1 }
            ]
        },
        {
            id: "mage_battery", name: "法師連",
            slots: [
                { tags: ["caster", "arcane", "fire"], n: 2 },
                { tags: ["tank", "guard", "melee"], n: 1 },
                { tags: ["any"], n: -1 }
            ]
        },
        {
            id: "archer_line", name: "弓矢陣",
            slots: [
                { tags: ["ranger", "ranged"], n: 3 },
                { tags: ["tank", "guard", "melee"], n: 1 },
                { tags: ["any"], n: -1 }
            ]
        }
    ];

    global.WarDataParts.ARENA = ARENA;
    global.WarDataParts.DEFAULT_MOVE = DEFAULT_MOVE;
    global.WarDataParts.DEFAULT_RANGE = DEFAULT_RANGE;
    global.WarDataParts.TAGS = TAGS;
    global.WarDataParts.STATUS_EFFECTS = STATUS_EFFECTS;
    global.WarDataParts.RARITY = RARITY;
    global.WarDataParts.ROOM_TYPES = ROOM_TYPES;
    global.WarDataParts.MAX_STAR = MAX_STAR;
    global.WarDataParts.STAR_STATS = STAR_STATS;
    global.WarDataParts.STAR_EXP = STAR_EXP;
    global.WarDataParts.TERRAINS = TERRAINS;
    global.WarDataParts.ELITE_AFFIXES = ELITE_AFFIXES;
    global.WarDataParts.ENEMY_FORMATIONS = ENEMY_FORMATIONS;
})(typeof window !== "undefined" ? window : globalThis);
