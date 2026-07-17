/**
 * War Roguelike — content data (units, artifacts, abilities, events, worlds).
 */
(function (global) {
    "use strict";

    const ARENA = { width: 800, height: 450, softWarn: 70 };
    const DEFAULT_MOVE = { melee: 32, ranged: 24 };
    const DEFAULT_RANGE = { melee: 28, ranged: 110 };

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

    const UNITS = {
        shieldbearer: {
            id: "shieldbearer", name: "盾衛", role: "tank", icon: "🛡", rarity: "common",
            tags: ["tank", "melee", "human", "guard"],
            hp: 180, atk: 12, def: 18, spd: 0.8, range: "melee", cost: 0,
            skill: { id: "taunt", name: "挑釁", cd: 8, desc: "短時間吸引敵方攻擊" }
        },
        knight: {
            id: "knight", name: "騎士", role: "warrior", icon: "⚔", rarity: "common",
            tags: ["warrior", "melee", "human", "cavalry"],
            hp: 140, atk: 22, def: 12, spd: 1.0, range: "melee", cost: 0,
            skill: { id: "cleave", name: "橫掃", cd: 6, desc: "對前排敵人造成額外傷害並施加流血", status: { type: "bleed", duration: 4, dps: 5 } }
        },
        berserker: {
            id: "berserker", name: "狂戰士", role: "warrior", icon: "🪓", rarity: "uncommon",
            tags: ["warrior", "melee", "human", "frenzy"],
            hp: 110, atk: 32, def: 6, spd: 1.2, range: "melee", cost: 0,
            onHit: { type: "bleed", chance: 0.35, duration: 3.5, dps: 4 },
            skill: { id: "rage", name: "狂怒", cd: 7, desc: "攻擊力大幅提升" }
        },
        archer: {
            id: "archer", name: "弓箭手", role: "ranger", icon: "🏹", rarity: "common",
            tags: ["ranger", "ranged", "human"],
            hp: 90, atk: 26, def: 5, spd: 1.1, range: "ranged", attackRange: 105, cost: 0,
            skill: { id: "snipe", name: "狙擊", cd: 7, desc: "對後排造成高傷害" }
        },
        crossbowman: {
            id: "crossbowman", name: "弩手", role: "ranger", icon: "🎯", rarity: "uncommon",
            tags: ["ranger", "ranged", "human"],
            hp: 85, atk: 24, def: 6, spd: 0.9, range: "ranged", attackRange: 135, cost: 0,
            skill: {
                id: "pierce", name: "穿甲", cd: 6, desc: "無視部分防禦並使目標易傷",
                status: { type: "vulnerable", duration: 3.5, takenMult: 1.3 }
            }
        },
        mage: {
            id: "mage", name: "法師", role: "caster", icon: "🔮", rarity: "common",
            tags: ["caster", "ranged", "arcane", "human"],
            hp: 75, atk: 30, def: 4, spd: 0.85, range: "ranged", attackRange: 95, cost: 0,
            skill: {
                id: "fireball", name: "火球", cd: 5, castTime: 1.25, desc: "施法後對目標周圍造成範圍法傷並燃燒",
                aoe: 48, status: { type: "burn", duration: 3.5, pct: 0.036 }
            }
        },
        priest: {
            id: "priest", name: "牧師", role: "support", icon: "✨", rarity: "common",
            tags: ["support", "ranged", "holy", "human"],
            hp: 95, atk: 14, def: 8, spd: 0.9, range: "ranged", attackRange: 88, cost: 0,
            skill: { id: "heal", name: "治療", cd: 5, desc: "治療血量最低的友軍" }
        },
        assassin: {
            id: "assassin", name: "刺客", role: "assassin", icon: "🗡", rarity: "rare",
            tags: ["assassin", "melee", "shadow", "human"],
            hp: 80, atk: 28, def: 4, spd: 1.4, range: "melee", cost: 0,
            onHit: { type: "poison", chance: 0.4, duration: 4.5, dps: 9 },
            skill: {
                id: "execute", name: "處決", cd: 8, desc: "對低血量敵人造成致命一擊並施加可疊層劇毒",
                status: { type: "poison", duration: 5.5, dps: 14 }
            }
        },
        engineer: {
            id: "engineer", name: "工程師", role: "support", icon: "⚙", rarity: "uncommon",
            tags: ["support", "ranged", "mechanical", "human", "summon"],
            hp: 100, atk: 16, def: 10, spd: 0.95, range: "ranged", attackRange: 100, cost: 0,
            skill: {
                id: "summon", name: "部署傀儡", cd: 11, castTime: 1.5, desc: "施法後召喚臨時戰鬥傀儡（最多 2 隻，戰後消失）",
                summon: { id: "summon_golem", count: 1, maxAlive: 2 }
            }
        },
        frost_mage: {
            id: "frost_mage", name: "冰法師", role: "caster", icon: "🧊", rarity: "uncommon",
            tags: ["caster", "ranged", "arcane", "human"],
            hp: 70, atk: 22, def: 4, spd: 0.9, range: "ranged", attackRange: 110, cost: 0,
            onHit: { type: "freeze", chance: 0.25, duration: 1.6, slow: 0.4 },
            skill: {
                id: "frostbolt", name: "冰箭", cd: 6, castTime: 1.1, desc: "施法後凍結目標並造成傷害",
                status: { type: "freeze", duration: 3, slow: 0.25 }
            }
        },
        necromancer: {
            id: "necromancer", name: "死靈法師", role: "caster", icon: "🦴", rarity: "rare",
            tags: ["caster", "ranged", "arcane", "shadow", "human", "summon"],
            hp: 80, atk: 20, def: 5, spd: 0.85, range: "ranged", attackRange: 100, cost: 0,
            skill: {
                id: "summon", name: "喚骨", cd: 9, castTime: 1.6, desc: "施法後召喚臨時骷髏兵（最多 3 隻，戰後消失）",
                summon: { id: "summon_skeleton", count: 2, maxAlive: 3 }
            }
        },
        beastmaster: {
            id: "beastmaster", name: "馴獸師", role: "support", icon: "🐺", rarity: "rare",
            tags: ["support", "ranged", "beast", "human", "summon"],
            hp: 110, atk: 18, def: 8, spd: 1.0, range: "ranged", attackRange: 95, cost: 0,
            skill: {
                id: "summon", name: "喚狼", cd: 10, castTime: 1.4, desc: "施法後召喚臨時戰狼（最多 2 隻，戰後消失）",
                summon: { id: "summon_wolf", count: 1, maxAlive: 2 }
            }
        },
        dragon_rider: {
            id: "dragon_rider", name: "龍騎士", role: "elite", icon: "🐉", rarity: "epic",
            tags: ["elite", "melee", "beast", "fire", "cavalry"],
            hp: 160, atk: 28, def: 14, spd: 1.0, range: "melee", cost: 0,
            skill: {
                id: "breath", name: "龍息", cd: 9, desc: "對面前扇形區域造成火焰傷害並燃燒",
                aoe: 95, cone: 0.7, status: { type: "burn", duration: 4, pct: 0.045 }
            }
        },
        paladin: {
            id: "paladin", name: "聖騎士", role: "tank", icon: "✝", rarity: "rare",
            tags: ["tank", "melee", "holy", "human", "cavalry"],
            hp: 200, atk: 18, def: 20, spd: 0.85, range: "melee", cost: 0,
            skill: { id: "smite", name: "制裁", cd: 7, desc: "重擊並短暫提升自身防禦" }
        },
        archmage: {
            id: "archmage", name: "大法師", role: "caster", icon: "☄️", rarity: "epic",
            tags: ["caster", "ranged", "arcane", "fire", "human"],
            hp: 90, atk: 38, def: 5, spd: 0.9, range: "ranged", attackRange: 125, cost: 0,
            skill: {
                id: "meteor", name: "隕石", cd: 8, castTime: 1.8, desc: "施法後對目標周圍造成強大範圍法傷並燃燒",
                aoe: 62, status: { type: "burn", duration: 4.5, pct: 0.055 }
            }
        },
        // Extra roster — ensure every synergy tag has multiple recruitable units
        sentinel: {
            id: "sentinel", name: "哨衛", role: "tank", icon: "🏯", rarity: "common",
            tags: ["tank", "melee", "human", "guard"],
            hp: 165, atk: 14, def: 16, spd: 0.85, range: "melee", cost: 0,
            skill: { id: "taunt", name: "固守", cd: 7, desc: "短時間吸引敵方攻擊" }
        },
        cavalier: {
            id: "cavalier", name: "槍騎兵", role: "warrior", icon: "🐴", rarity: "common",
            tags: ["warrior", "melee", "human", "cavalry"],
            hp: 125, atk: 24, def: 10, spd: 1.15, range: "melee", cost: 0,
            skill: { id: "cleave", name: "衝刺斬", cd: 6, desc: "對前排造成額外傷害並流血", status: { type: "bleed", duration: 3.5, dps: 4 } }
        },
        marksman: {
            id: "marksman", name: "神射手", role: "ranger", icon: "🦅", rarity: "uncommon",
            tags: ["ranger", "ranged", "human"],
            hp: 88, atk: 30, def: 4, spd: 1.05, range: "ranged", attackRange: 145, cost: 0,
            skill: { id: "snipe", name: "精準射殺", cd: 6.5, desc: "對後排造成高傷害" }
        },
        cleric: {
            id: "cleric", name: "祭司", role: "support", icon: "🙏", rarity: "uncommon",
            tags: ["support", "ranged", "holy", "human"],
            hp: 100, atk: 12, def: 9, spd: 0.95, range: "ranged", attackRange: 92, cost: 0,
            skill: { id: "heal", name: "祈癒", cd: 4.5, desc: "治療血量最低的友軍" }
        },
        warpriest: {
            id: "warpriest", name: "戰祭司", role: "support", icon: "🔨", rarity: "rare",
            tags: ["support", "melee", "holy", "human", "guard"],
            hp: 130, atk: 20, def: 14, spd: 0.95, range: "melee", cost: 0,
            skill: { id: "smite", name: "聖錘", cd: 6.5, desc: "重擊敵方並短暫提升自身防禦" }
        },
        shadowblade: {
            id: "shadowblade", name: "影刃", role: "assassin", icon: "🖤", rarity: "uncommon",
            tags: ["assassin", "melee", "shadow", "human"],
            hp: 78, atk: 26, def: 3, spd: 1.45, range: "melee", cost: 0,
            onHit: { type: "poison", chance: 0.35, duration: 4, dps: 7 },
            skill: {
                id: "execute", name: "暗襲", cd: 7.5, desc: "對低血量敵人造成致命一擊並施加中毒",
                status: { type: "poison", duration: 5, dps: 11 }
            }
        },
        huntress: {
            id: "huntress", name: "女獵手", role: "assassin", icon: "🦊", rarity: "rare",
            tags: ["assassin", "ranged", "beast", "human"],
            hp: 85, atk: 27, def: 5, spd: 1.25, range: "ranged", attackRange: 100, cost: 0,
            onHit: { type: "bleed", chance: 0.4, duration: 4, dps: 5 },
            skill: {
                id: "pierce", name: "獵殺標記", cd: 6, desc: "穿甲一擊並使目標易傷",
                status: { type: "vulnerable", duration: 3.5, takenMult: 1.28 }
            }
        },
        reaver: {
            id: "reaver", name: "掠奪者", role: "warrior", icon: "🗡", rarity: "rare",
            tags: ["warrior", "melee", "human", "frenzy"],
            hp: 105, atk: 34, def: 5, spd: 1.3, range: "melee", cost: 0,
            onHit: { type: "bleed", chance: 0.45, duration: 4, dps: 6 },
            skill: { id: "rage", name: "嗜血", cd: 6.5, desc: "攻擊力大幅提升" }
        },
        blood_reaver: {
            id: "blood_reaver", name: "血怒蠻兵", role: "warrior", icon: "👹", rarity: "uncommon",
            tags: ["warrior", "melee", "beast", "frenzy"],
            hp: 115, atk: 30, def: 6, spd: 1.25, range: "melee", cost: 0,
            onHit: { type: "weaken", chance: 0.3, duration: 3, atkMult: 0.8 },
            skill: { id: "cleave", name: "血刃橫掃", cd: 6, desc: "對前排造成額外傷害並流血", status: { type: "bleed", duration: 4, dps: 5 } }
        },
        siege_gunner: {
            id: "siege_gunner", name: "要塞炮手", role: "ranger", icon: "💣", rarity: "uncommon",
            tags: ["ranger", "ranged", "mechanical", "human"],
            hp: 92, atk: 25, def: 8, spd: 0.85, range: "ranged", attackRange: 140, cost: 0,
            onHit: { type: "shock", chance: 0.3, duration: 2.5, dps: 7 },
            skill: {
                id: "pierce", name: "破城彈", cd: 7, desc: "強力穿甲並使目標易傷",
                status: { type: "vulnerable", duration: 3, takenMult: 1.25 }
            }
        },
        automaton: {
            id: "automaton", name: "自動機兵", role: "tank", icon: "🔩", rarity: "rare",
            tags: ["tank", "melee", "mechanical", "guard"],
            hp: 190, atk: 16, def: 20, spd: 0.7, range: "melee", cost: 0,
            onHit: { type: "shock", chance: 0.35, duration: 2.8, dps: 8 },
            skill: { id: "taunt", name: "鎖定協議", cd: 8, desc: "短時間吸引敵方攻擊" }
        },
        flame_adept: {
            id: "flame_adept", name: "焰徒", role: "caster", icon: "🔥", rarity: "uncommon",
            tags: ["caster", "ranged", "fire", "human"],
            hp: 78, atk: 28, def: 4, spd: 0.9, range: "ranged", attackRange: 100, cost: 0,
            onHit: { type: "burn", chance: 0.3, duration: 3, pct: 0.025 },
            skill: {
                id: "fireball", name: "烈焰彈", cd: 5.5, castTime: 1.15, desc: "施法後對目標周圍造成範圍法傷並燃燒",
                aoe: 44, status: { type: "burn", duration: 3.5, pct: 0.038 }
            }
        },
        ash_witch: {
            id: "ash_witch", name: "灰燼女巫", role: "caster", icon: "🧹", rarity: "rare",
            tags: ["caster", "ranged", "fire", "shadow", "human"],
            hp: 82, atk: 32, def: 4, spd: 0.95, range: "ranged", attackRange: 108, cost: 0,
            onHit: { type: "burn", chance: 0.4, duration: 3.2, pct: 0.03 },
            skill: {
                id: "fireball", name: "灰燼風暴", cd: 6.5, castTime: 1.3, desc: "施法後對目標周圍造成範圍法傷並燃燒",
                aoe: 52, status: { type: "burn", duration: 4, pct: 0.045 }
            }
        },
        wolf_knight: {
            id: "wolf_knight", name: "狼騎士", role: "warrior", icon: "🦮", rarity: "uncommon",
            tags: ["warrior", "melee", "beast", "cavalry", "human"],
            hp: 135, atk: 26, def: 11, spd: 1.2, range: "melee", cost: 0,
            skill: { id: "cleave", name: "狼牙衝鋒", cd: 6, desc: "對前排造成額外傷害並流血", status: { type: "bleed", duration: 3.5, dps: 5 } }
        },
        occultist: {
            id: "occultist", name: "秘術師", role: "caster", icon: "🧿", rarity: "rare",
            tags: ["caster", "ranged", "shadow", "arcane", "human", "summon"],
            hp: 85, atk: 22, def: 5, spd: 0.9, range: "ranged", attackRange: 105, cost: 0,
            onHit: { type: "silence", chance: 0.25, duration: 2 },
            skill: {
                id: "summon", name: "喚魔", cd: 10, castTime: 1.45, desc: "施法後召喚臨時火魔（最多 2 隻，戰後消失）",
                summon: { id: "summon_imp", count: 1, maxAlive: 2 }
            }
        },
        iron_colossus: {
            id: "iron_colossus", name: "鐵巨像", role: "elite", icon: "🗿", rarity: "epic",
            tags: ["elite", "tank", "melee", "mechanical", "guard"],
            hp: 240, atk: 22, def: 26, spd: 0.65, range: "melee", cost: 0,
            onHit: { type: "root", chance: 0.3, duration: 1.6 },
            skill: { id: "taunt", name: "震地", cd: 8, desc: "強力嘲諷，吸引敵方攻擊" }
        },
        storm_rider: {
            id: "storm_rider", name: "風暴騎士", role: "elite", icon: "⚡", rarity: "epic",
            tags: ["elite", "melee", "cavalry", "arcane", "human"],
            hp: 150, atk: 32, def: 12, spd: 1.2, range: "melee", cost: 0,
            onHit: { type: "shock", chance: 0.4, duration: 3, dps: 10 },
            skill: {
                id: "cleave", name: "雷霆斬", cd: 7, desc: "對前排造成額外傷害並感電",
                status: { type: "shock", duration: 3, dps: 11 }
            }
        },
        // Unique units — never random; only legendary artifact / event
        eternal_warden: {
            id: "eternal_warden", name: "永恆守衛", role: "tank", icon: "🏛", rarity: "unique",
            tags: ["tank", "melee", "holy", "guard", "human"],
            hp: 260, atk: 20, def: 28, spd: 0.75, range: "melee", cost: 0,
            skill: { id: "taunt", name: "不滅壁壘", cd: 7, desc: "強力嘲諷並短時提升防禦" }
        },
        void_stalker: {
            id: "void_stalker", name: "虛空潛行者", role: "assassin", icon: "👁", rarity: "unique",
            tags: ["assassin", "melee", "shadow", "arcane"],
            hp: 95, atk: 36, def: 6, spd: 1.55, range: "melee", cost: 0,
            onHit: { type: "poison", chance: 0.55, duration: 5.5, dps: 16 },
            skill: {
                id: "execute", name: "虛空處刑", cd: 7, desc: "對低血量敵人造成毀滅一擊並附加可疊層劇毒",
                status: { type: "poison", duration: 6, dps: 18 }
            }
        },
        chronomancer: {
            id: "chronomancer", name: "時序法師", role: "caster", icon: "⏳", rarity: "unique",
            tags: ["caster", "ranged", "arcane", "human"],
            hp: 100, atk: 34, def: 8, spd: 1.0, range: "ranged", attackRange: 130, cost: 0,
            onHit: { type: "freeze", chance: 0.35, duration: 2, slow: 0.5 },
            skill: {
                id: "meteor", name: "時之裂縫", cd: 7, castTime: 1.4, desc: "施法後對範圍造成高傷害並凍結",
                aoe: 58, status: { type: "freeze", duration: 2.5, slow: 0.35 }
            }
        },
        // Enemies
        grunt: { id: "grunt", name: "步兵", role: "enemy", icon: "👤", tags: ["melee", "human"], hp: 72, atk: 14, def: 6, spd: 0.9, range: "melee", cost: 0, skill: null },
        shield: { id: "shield", name: "敵盾兵", role: "enemy", icon: "🛡", tags: ["tank", "melee", "guard"], hp: 110, atk: 11, def: 14, spd: 0.7, range: "melee", cost: 0, skill: null },
        skeleton: { id: "skeleton", name: "骷髏兵", role: "enemy", icon: "💀", tags: ["melee", "shadow"], hp: 70, atk: 15, def: 5, spd: 1.0, range: "melee", cost: 0, skill: null },
        dark_mage: {
            id: "dark_mage", name: "暗法師", role: "enemy", icon: "🌑",
            tags: ["caster", "ranged", "arcane", "shadow"],
            hp: 58, atk: 22, def: 3, spd: 0.85, range: "ranged", attackRange: 100, cost: 0,
            onHit: { type: "weaken", chance: 0.4, duration: 3.5, atkMult: 0.72 },
            skill: null
        },
        wraith: {
            id: "wraith", name: "幽靈", role: "enemy", icon: "👻",
            tags: ["ranged", "shadow"],
            hp: 52, atk: 18, def: 2, spd: 1.25, range: "ranged", attackRange: 118, cost: 0,
            onHit: { type: "silence", chance: 0.35, duration: 2.5 },
            skill: null
        },
        bone_knight: { id: "bone_knight", name: "骨騎士", role: "enemy", icon: "⚰", tags: ["warrior", "melee", "shadow", "cavalry"], hp: 115, atk: 18, def: 11, spd: 0.85, range: "melee", cost: 0, skill: null },
        plague_rat: {
            id: "plague_rat", name: "瘟疫鼠", role: "enemy", icon: "🐀",
            tags: ["melee", "beast"],
            hp: 48, atk: 15, def: 2, spd: 1.4, range: "melee", cost: 0,
            onHit: { type: "poison", chance: 0.75, duration: 4, dps: 9 },
            skill: null
        },
        warlord: {
            id: "warlord", name: "征戰領主", role: "boss", icon: "👑",
            tags: ["boss", "melee", "warrior", "human"],
            hp: 720, atk: 42, def: 24, spd: 0.9, range: "melee", cost: 0,
            skill: { id: "war_cry", name: "戰吼", cd: 8, desc: "大幅提升自身攻擊" },
            phase2: {
                name: "征戰領主·狂怒",
                icon: "👑",
                atkMult: 1.3,
                spdMult: 1.25,
                moveMult: 1.15,
                onHit: { type: "bleed", chance: 0.45, duration: 4, dps: 8 },
                skill: {
                    id: "cleave", name: "裂地斬", cd: 5, desc: "對附近敵人造成範圍傷害並流血",
                    status: { type: "bleed", duration: 4.5, dps: 10 }
                }
            }
        },
        lich_king: {
            id: "lich_king", name: "巫妖王", role: "boss", icon: "☠",
            tags: ["boss", "ranged", "arcane", "shadow", "summon"],
            hp: 860, atk: 48, def: 20, spd: 0.85, range: "ranged", attackRange: 145, cost: 0,
            skill: {
                id: "summon", name: "亡靈大軍", cd: 10, castTime: 1.7, desc: "施法後召喚骷髏，並對目標周圍造成暗影範圍傷害",
                summon: { id: "summon_skeleton", count: 2, maxAlive: 4 },
                also: "death_coil",
                aoe: 55,
                status: { type: "poison", duration: 5.5, dps: 16 }
            },
            phase2: {
                name: "巫妖王·不滅",
                atkMult: 1.2,
                spdMult: 1.15,
                onHit: { type: "silence", chance: 0.35, duration: 2.5 },
                skill: {
                    id: "death_coil", name: "死亡纏繞", cd: 5.5, castTime: 1.0, desc: "對目標周圍造成強大暗影傷害並劇毒",
                    aoe: 70, status: { type: "poison", duration: 6, dps: 18 }
                }
            }
        },
        // World 3 — frost
        frost_wolf: {
            id: "frost_wolf", name: "霜狼", role: "enemy", icon: "🐺",
            tags: ["melee", "beast"],
            hp: 78, atk: 18, def: 4, spd: 1.35, range: "melee", cost: 0,
            onHit: { type: "freeze", chance: 0.35, duration: 1.6, slow: 0.45 },
            skill: null
        },
        ice_golem: {
            id: "ice_golem", name: "冰魔像", role: "enemy", icon: "🧊",
            tags: ["tank", "melee", "arcane"],
            hp: 140, atk: 14, def: 16, spd: 0.65, range: "melee", cost: 0,
            onHit: { type: "root", chance: 0.4, duration: 1.8 },
            skill: null
        },
        frost_archer: {
            id: "frost_archer", name: "霜弓手", role: "enemy", icon: "🏹",
            tags: ["ranger", "ranged"],
            hp: 62, atk: 20, def: 3, spd: 1.05, range: "ranged", attackRange: 120, cost: 0,
            onHit: { type: "freeze", chance: 0.4, duration: 1.8, slow: 0.4 },
            skill: null
        },
        blizzard_mage: {
            id: "blizzard_mage", name: "暴風雪法師", role: "enemy", icon: "❄",
            tags: ["caster", "ranged", "arcane"],
            hp: 68, atk: 24, def: 3, spd: 0.85, range: "ranged", attackRange: 108, cost: 0,
            skill: {
                id: "frostbolt", name: "冰箭", cd: 7, castTime: 1.1, desc: "凍結目標並造成傷害",
                status: { type: "freeze", duration: 2.8, slow: 0.3 }
            }
        },
        frost_empress: {
            id: "frost_empress", name: "霜語女皇", role: "boss", icon: "👸",
            tags: ["boss", "ranged", "arcane", "summon"],
            hp: 980, atk: 52, def: 22, spd: 0.9, range: "ranged", attackRange: 150, cost: 0,
            onHit: { type: "freeze", chance: 0.45, duration: 2.2, slow: 0.35 },
            skill: {
                id: "summon", name: "極寒召喚", cd: 11, castTime: 1.6, desc: "施法後召喚霜狼，並對目標周圍造成冰霜範圍傷害",
                summon: { id: "summon_frost_wolf", count: 2, maxAlive: 4 },
                also: "death_coil",
                aoe: 58,
                status: { type: "freeze", duration: 3, slow: 0.3 }
            },
            phase2: {
                name: "霜語女皇·永冬",
                atkMult: 1.2,
                spdMult: 1.2,
                attackRange: 165,
                onHit: { type: "freeze", chance: 0.6, duration: 2.5, slow: 0.28 },
                skill: {
                    id: "meteor", name: "暴風雪", cd: 6, castTime: 1.2, desc: "對目標周圍降下極寒暴風雪並強凍",
                    aoe: 72, status: { type: "freeze", duration: 3.2, slow: 0.22 }
                }
            }
        },
        // World 4 — forge / fire
        ember_brute: {
            id: "ember_brute", name: "餘燼蠻兵", role: "enemy", icon: "🔥",
            tags: ["warrior", "melee", "fire"],
            hp: 95, atk: 22, def: 7, spd: 1.05, range: "melee", cost: 0,
            onHit: { type: "burn", chance: 0.45, duration: 3, pct: 0.032 },
            skill: null
        },
        cinder_archer: {
            id: "cinder_archer", name: "燼矢手", role: "enemy", icon: "🎯",
            tags: ["ranger", "ranged", "fire"],
            hp: 70, atk: 22, def: 4, spd: 1.0, range: "ranged", attackRange: 125, cost: 0,
            onHit: { type: "burn", chance: 0.4, duration: 2.8, pct: 0.027 },
            skill: null
        },
        lava_guard: {
            id: "lava_guard", name: "熔岩衛士", role: "enemy", icon: "🛡",
            tags: ["tank", "melee", "fire", "guard"],
            hp: 160, atk: 16, def: 18, spd: 0.7, range: "melee", cost: 0,
            skill: null
        },
        pyromancer: {
            id: "pyromancer", name: "焰術師", role: "enemy", icon: "☄️",
            tags: ["caster", "ranged", "fire", "arcane"],
            hp: 72, atk: 26, def: 3, spd: 0.85, range: "ranged", attackRange: 105, cost: 0,
            skill: {
                id: "fireball", name: "火球", cd: 6, castTime: 1.2, desc: "對目標周圍造成範圍法傷並燃燒",
                aoe: 46, status: { type: "burn", duration: 3.5, pct: 0.041 }
            }
        },
        clockwork_soldier: {
            id: "clockwork_soldier", name: "發條士兵", role: "enemy", icon: "⚙",
            tags: ["melee", "mechanical"],
            hp: 100, atk: 20, def: 12, spd: 0.95, range: "melee", cost: 0,
            onHit: { type: "shock", chance: 0.4, duration: 3, dps: 9 },
            skill: null
        },
        forge_titan: {
            id: "forge_titan", name: "熔爐泰坦", role: "boss", icon: "🏔",
            tags: ["boss", "melee", "fire", "mechanical"],
            hp: 1120, atk: 58, def: 28, spd: 0.85, range: "melee", cost: 0,
            onHit: { type: "burn", chance: 0.5, duration: 3.5, pct: 0.045 },
            skill: {
                id: "breath", name: "熔爐吐息", cd: 9, castTime: 1.5, desc: "前方錐形範圍造成強大火焰傷害並燃燒",
                aoe: 100, cone: 0.75, status: { type: "burn", duration: 4, pct: 0.055 }
            },
            phase2: {
                name: "熔爐泰坦·過載",
                atkMult: 1.25,
                spdMult: 1.15,
                moveMult: 1.1,
                // 二階段改為遠程炮擊模式
                rangeType: "ranged",
                attackRange: 130,
                onHit: { type: "burn", chance: 0.55, duration: 4, pct: 0.055 },
                skill: {
                    id: "meteor", name: "熔核墜擊", cd: 6.5, castTime: 1.25, desc: "對目標周圍降下熔核並強燃",
                    aoe: 68, status: { type: "burn", duration: 4.5, pct: 0.065 }
                }
            }
        },
        // Temporary summons (battle-only, never kept in roster)
        summon_golem: {
            id: "summon_golem", name: "戰鬥傀儡", role: "summon", icon: "🤖",
            tags: ["summon", "melee", "mechanical", "tank"],
            hp: 90, atk: 14, def: 12, spd: 0.75, range: "melee", cost: 0, skill: null, temporary: true
        },
        summon_skeleton: {
            id: "summon_skeleton", name: "召喚骷髏", role: "summon", icon: "💀",
            tags: ["summon", "melee", "shadow"],
            hp: 55, atk: 13, def: 4, spd: 1.0, range: "melee", cost: 0, skill: null, temporary: true
        },
        summon_wolf: {
            id: "summon_wolf", name: "戰狼", role: "summon", icon: "🐺",
            tags: ["summon", "melee", "beast"],
            hp: 70, atk: 18, def: 5, spd: 1.35, range: "melee", cost: 0, skill: null, temporary: true
        },
        summon_imp: {
            id: "summon_imp", name: "火魔", role: "summon", icon: "😈",
            tags: ["summon", "ranged", "fire", "arcane"],
            hp: 40, atk: 16, def: 2, spd: 1.1, range: "ranged", attackRange: 90, cost: 0,
            onHit: { type: "burn", chance: 0.4, duration: 2.5, pct: 0.023 },
            skill: null, temporary: true
        },
        summon_frost_wolf: {
            id: "summon_frost_wolf", name: "霜狼靈", role: "summon", icon: "🐺",
            tags: ["summon", "melee", "beast"],
            hp: 65, atk: 16, def: 4, spd: 1.3, range: "melee", cost: 0,
            onHit: { type: "freeze", chance: 0.35, duration: 1.5, slow: 0.4 },
            skill: null, temporary: true
        }
    };

    Object.values(UNITS).forEach((unit) => {
        const isRanged = unit.range === "ranged";
        if (unit.moveSpeed == null) unit.moveSpeed = isRanged ? DEFAULT_MOVE.ranged : DEFAULT_MOVE.melee;
        if (unit.attackRange == null) unit.attackRange = isRanged ? DEFAULT_RANGE.ranged : DEFAULT_RANGE.melee;
        if (unit.radius == null) unit.radius = unit.role === "boss" ? 22 : 14;
        // Melee bosses are larger — reach must clear body collision or they never attack
        if (unit.role === "boss" && !isRanged) {
            unit.attackRange = Math.max(unit.attackRange, (unit.radius || 22) + 20);
            if (unit.moveSpeed < DEFAULT_MOVE.melee * 1.15) {
                unit.moveSpeed = Math.round(DEFAULT_MOVE.melee * 1.15);
            }
        }
        if (!Array.isArray(unit.tags)) unit.tags = [];
        // Cavalry: noticeably faster on the field
        if (unit.tags.includes("cavalry")) {
            unit.moveSpeed = Math.round(unit.moveSpeed * 1.4);
        }
    });

    const STARTER_UNITS = ["shieldbearer", "knight", "archer", "mage", "priest"];
    /** Fixed starting army instances (not unlimited clones). */
    const STARTER_ARMY = ["shieldbearer", "knight", "archer", "mage"];

    const RARITY = {
        common: { label: "普通", weight: 50, order: 1 },
        uncommon: { label: "優秀", weight: 28, order: 2 },
        rare: { label: "稀有", weight: 14, order: 3 },
        epic: { label: "史詩", weight: 6, order: 4 },
        legendary: { label: "傳說", weight: 2, order: 5 },
        /** Never appears in random rewards/shops; only via legendary artifact grant or event. */
        unique: { label: "唯一", weight: 0, order: 6 }
    };

    const ARTIFACTS = [
        { id: "iron_shield", name: "鐵盾", rarity: "common", desc: "全隊防禦 +6", effect: {"defAll":6} },
        { id: "sharp_blade", name: "鋒利之刃", rarity: "common", desc: "全隊攻擊 +8", effect: {"atkAll":8} },
        { id: "swift_boots", name: "疾風靴", rarity: "common", desc: "攻速 +19%", effect: {"spdMult":1.185} },
        { id: "healing_herb", name: "療傷草", rarity: "common", desc: "戰後額外 +30 金幣", effect: {"healAfter":30} },
        { id: "lucky_coin", name: "幸運幣", rarity: "common", desc: "金幣獎勵 +37%", effect: {"goldMult":1.37} },
        { id: "thick_armor", name: "厚甲", rarity: "common", desc: "[坦克] HP +80", effect: {"tag":"tank","hp":80} },
        { id: "hunter_bow", name: "獵人弓", rarity: "common", desc: "[射手] 攻擊 +16", effect: {"tag":"ranger","atk":16} },
        { id: "mana_crystal", name: "魔力水晶", rarity: "common", desc: "[法師] 攻擊 +20", effect: {"tag":"caster","atk":20} },
        { id: "iron_glaive", name: "鐵刃戟", rarity: "common", desc: "[近戰] 攻擊 +12", effect: {"tag":"melee","atk":12} },
        { id: "war_banner", name: "戰旗", rarity: "uncommon", desc: "全隊攻擊 +16", effect: {"atkAll":16} },
        { id: "fortress_wall", name: "堡壘之牆", rarity: "uncommon", desc: "全隊 HP +70", effect: {"hpAll":70} },
        { id: "vampire_fang", name: "吸血獠牙", rarity: "uncommon", desc: "吸血 17%", effect: {"lifesteal":0.17} },
        { id: "thorns_mail", name: "荊棘甲", rarity: "uncommon", desc: "反傷 31%", effect: {"thorns":0.306} },
        { id: "scout_lens", name: "偵察鏡", rarity: "uncommon", desc: "地圖顯示下一層房間類型", effect: {"revealNext":true} },
        { id: "merchants_ring", name: "商人戒指", rarity: "uncommon", desc: "商店價格 -43%", effect: {"shopDiscount":0.425} },
        { id: "scholar_tome", name: "學識寶典", rarity: "rare", desc: "戰鬥經驗 ×2.388，並額外 +2 經驗", effect: {"expMult":2.388,"expBonus":2} },
        { id: "eagle_eye", name: "鷹眼", rarity: "uncommon", desc: "[射手] 暴擊 +31%", effect: {"tag":"ranger","critChance":0.306} },
        { id: "longshot_lens", name: "遠射鏡", rarity: "uncommon", desc: "[遠程] 攻擊 +12；技能冷卻 -19%；射程 +40", effect: {"tag":"ranged","atk":12,"attackRange":40,"skillCdMult":0.815} },
        { id: "wind_string", name: "風弦", rarity: "common", desc: "[射手] 射程 +36", effect: {"tag":"ranger","attackRange":36} },
        { id: "focusing_crystal", name: "聚能晶體", rarity: "common", desc: "[奧術] 射程 +30", effect: {"tag":"arcane","attackRange":30} },
        { id: "phoenix_feather", name: "鳳凰羽毛", rarity: "rare", desc: "戰鬥中首次陣亡時復活 60% HP", effect: {"revive":0.595} },
        { id: "revenant_lantern", name: "復生提燈", rarity: "epic", desc: "每場戰鬥結束後，自動復活 2 名本場陣亡單位", effect: {"postBattleRevive":2} },
        { id: "dragon_scale", name: "龍鱗", rarity: "rare", desc: "全隊防禦 +24", effect: {"defAll":24} },
        { id: "storm_hammer", name: "風暴之錘", rarity: "rare", desc: "[戰士] 攻擊 +44", effect: {"tag":"warrior","atk":44} },
        { id: "shadow_cloak", name: "暗影斗篷", rarity: "rare", desc: "[暗影] 攻速 +46%；技能冷卻 -28%", effect: {"tag":"shadow","spdMult":1.463,"skillCdMult":0.722} },
        { id: "holy_relic", name: "聖物", rarity: "rare", desc: "[神聖] 攻擊 +12；治療量 +111%", effect: {"tag":"holy","healBoost":2.11,"atk":12} },
        { id: "gold_magnet", name: "吸金磁石", rarity: "rare", desc: "金幣獎勵 +93%", effect: {"goldMult":1.925} },
        { id: "healing_spring", name: "治療之泉", rarity: "rare", desc: "戰後額外 +80 金幣", effect: {"healAfter":80} },
        { id: "iron_will", name: "鋼鐵意志", rarity: "rare", desc: "全隊 HP +60", effect: {"commanderHp":60} },
        { id: "sacred_seal", name: "聖印", rarity: "rare", desc: "[神聖] 防禦 +12；技能威力 +55%", effect: {"tag":"holy","skillPower":1.555,"def":12} },
        { id: "hawk_plume", name: "鷹羽", rarity: "rare", desc: "[遠程] 射程 +70", effect: {"tag":"ranged","attackRange":70} },
        { id: "sniper_crest", name: "狙擊徽記", rarity: "rare", desc: "[射手] 攻擊 +16；射程 +60", effect: {"tag":"ranger","attackRange":60,"atk":16} },
        { id: "crown_of_kings", name: "王者之冠", rarity: "epic", desc: "全隊攻擊 +28；全隊 HP +110", effect: {"atkAll":28,"hpAll":110} },
        { id: "time_sand", name: "時之沙", rarity: "epic", desc: "技能冷卻 -46%", effect: {"skillCdMult":0.538} },
        { id: "berserker_axe", name: "狂戰斧", rarity: "epic", desc: "HP 低於 50% 時攻擊 +68%", effect: {"lowHpAtk":0.68} },
        { id: "arcane_tome", name: "奧術典籍", rarity: "epic", desc: "[奧術] 技能威力 +102%", effect: {"tag":"arcane","skillPower":2.018} },
        { id: "titans_belt", name: "泰坦腰帶", rarity: "epic", desc: "[坦克] HP +220", effect: {"tag":"tank","hp":220} },
        { id: "war_horn", name: "戰爭號角", rarity: "epic", desc: "開場全隊獲得護盾 160", effect: {"startShield":160} },
        { id: "wild_totem", name: "野獸圖騰", rarity: "epic", desc: "[野獸] 攻擊 +28；HP +100；技能威力 +46%", effect: {"tag":"beast","hp":100,"atk":28,"skillPower":1.463} },
        { id: "flame_core", name: "焰心", rarity: "epic", desc: "[火焰] 攻擊 +20；技能威力 +74%", effect: {"tag":"fire","skillPower":1.74,"atk":20} },
        { id: "horizon_lens", name: "地平線鏡", rarity: "epic", desc: "[遠程] 攻擊 +12；射程 +100", effect: {"tag":"ranged","attackRange":100,"atk":12} },
        { id: "summon_charm", name: "喚靈符", rarity: "common", desc: "[召喚] 技能冷卻 -28%", effect: {"tag":"summon","skillCdMult":0.722} },
        { id: "binder_ring", name: "縛靈戒", rarity: "uncommon", desc: "[召喚] 召喚上限 +2", effect: {"tag":"summon","summonMax":2} },
        { id: "spirit_horn", name: "靈角", rarity: "rare", desc: "[召喚] 技能冷卻 -37%；召喚上限 +2", effect: {"tag":"summon","skillCdMult":0.63,"summonMax":2} },
        { id: "pack_totem", name: "群召圖騰", rarity: "rare", desc: "[召喚] 攻擊 +16；HP +70", effect: {"tag":"summon","hp":70,"atk":16} },
        { id: "legion_sigil", name: "軍團印記", rarity: "epic", desc: "[召喚] 技能冷卻 -46%；召喚上限 +4", effect: {"tag":"summon","summonMax":4,"skillCdMult":0.538} },
        { id: "void_orb", name: "虛空寶珠", rarity: "legendary", desc: "全隊攻擊 +40；全隊防禦 +28", effect: {"atkAll":40,"defAll":28} },
        { id: "seal_of_eternity", name: "永恆封印", rarity: "legendary", desc: "獲得唯一單位「永恆守衛」；全隊防禦 +12", effect: {"defAll":12}, grant: {"unit":"eternal_warden"} },
        { id: "void_whisper", name: "虛空低語", rarity: "legendary", desc: "獲得唯一單位「虛空潛行者」；[暗影] 攻速 +19%", effect: {"tag":"shadow","spdMult":1.185}, grant: {"unit":"void_stalker"} },
        { id: "chronos_eye", name: "時序之眼", rarity: "legendary", desc: "獲得唯一單位「時序法師」；技能冷卻 -19%", effect: {"skillCdMult":0.815}, grant: {"unit":"chronomancer"} },
        { id: "tablet_of_dominion", name: "霸權石板", rarity: "legendary", desc: "獲得唯一能力「霸權」；全隊攻擊 +16", effect: {"atkAll":16}, grant: {"ability":"dominion"} },
        { id: "soul_oath_scroll", name: "魂契卷軸", rarity: "legendary", desc: "獲得唯一能力「魂契」；全隊 HP +50", effect: {"hpAll":50}, grant: {"ability":"soul_bond"} },
        { id: "last_stand_banner", name: "背水旗", rarity: "legendary", desc: "獲得唯一能力「背水一戰」；HP 低於 50% 時攻擊 +26%", effect: {"lowHpAtk":0.255}, grant: {"ability":"last_stand"} },
        { id: "volley_pact", name: "連射誓約", rarity: "epic", cursed: true, desc: "【詛咒】僅[遠程]能戰鬥；[遠程] 攻擊 +56；射程 +40；普攻變為 8 連射", effect: {"onlyFightTag":"ranged","tag":"ranged","multishot":8,"atk":56,"attackRange":40} },
        { id: "iron_oath", name: "鐵血誓約", rarity: "epic", cursed: true, desc: "【詛咒】僅[近戰]能戰鬥；[近戰] 攻擊 +64；防禦 +36；HP +280", effect: {"onlyFightTag":"melee","tag":"melee","hp":280,"atk":64,"def":36} },
        { id: "mute_grimoire", name: "緘默魔典", rarity: "epic", cursed: true, desc: "【詛咒】全隊無法施放技能；全隊攻擊 +96、攻速 +74%、暴擊 +20%", effect: {"noSkills":true,"atkAll":96,"spdMult":1.74,"critChance":0.204} },
        { id: "glass_heart", name: "玻璃之心", rarity: "rare", cursed: true, desc: "【詛咒】全隊攻擊 ×3.035；HP ×0.168，受傷 +93%", effect: {"atkMult":3.035,"hpMult":0.168,"dmgTakenMult":1.925} },
        { id: "blood_ledger", name: "血帳", rarity: "rare", cursed: true, desc: "【詛咒】全隊攻擊 +56；吸血 68%；HP ×0.353", effect: {"lifesteal":0.68,"atkAll":56,"hpMult":0.353} },
        { id: "gilded_curse", name: "鍍金詛咒", rarity: "rare", cursed: true, desc: "【詛咒】金幣獎勵 +370%；戰後 +50 金；攻擊 ×0.445", effect: {"goldMult":4.7,"goldAfter":50,"atkMult":0.445} },
        { id: "shadow_bargain", name: "暗影交易", rarity: "legendary", cursed: true, desc: "【詛咒】僅[暗影]能戰鬥；[暗影] 攻擊 +70；攻速 +111%；技能冷卻 -74%；暴擊 +26%", effect: {"onlyFightTag":"shadow","tag":"shadow","spdMult":2.11,"skillCdMult":0.26,"atk":70,"critChance":0.255} },
        { id: "ember_oil", name: "燃焰油", rarity: "uncommon", desc: "普攻 31% 附加燃燒（最大生命 4.0%/秒）", effect: {"onHit":{"type":"burn","chance":0.308,"duration":3.5,"pct":0.0405}} },
        { id: "venom_vial", name: "劇毒瓶", rarity: "rare", desc: "普攻 39% 附加中毒（可疊層）", effect: {"onHit":{"type":"poison","chance":0.392,"duration":5.2,"dps":20}} },
        { id: "frost_brand", name: "霜印刃", rarity: "rare", desc: "普攻 35% 附加凍結", effect: {"onHit":{"type":"freeze","chance":0.35,"duration":2.1,"slow":0.22}} },
        { id: "plague_dagger", name: "瘟疫匕首", rarity: "epic", desc: "[刺客] 攻擊 +20；普攻 63% 附加中毒（可疊層）", effect: {"tag":"assassin","atk":20,"onHit":{"type":"poison","chance":0.63,"duration":5.8,"dps":24}} },
        { id: "cinder_arrows", name: "燼矢", rarity: "epic", desc: "[遠程] 攻擊 +16；普攻 49% 附加燃燒（最大生命 5.4%/秒）", effect: {"tag":"ranged","atk":16,"onHit":{"type":"burn","chance":0.49,"duration":3.7,"pct":0.054}} },
        { id: "blood_edge", name: "血刃", rarity: "rare", desc: "[近戰] 攻擊 +12；普攻 56% 附加流血（可疊層）", effect: {"tag":"melee","atk":12,"onHit":{"type":"bleed","chance":0.56,"duration":4.6,"dps":10}} },
        { id: "storm_capacitor", name: "雷霆電容", rarity: "epic", desc: "[機械] 攻擊 +20；普攻 49% 附加感電", effect: {"tag":"mechanical","atk":20,"onHit":{"type":"shock","chance":0.49,"duration":3.5,"dps":20}} },
        { id: "hex_charm", name: "虛弱咒符", rarity: "uncommon", desc: "普攻 42% 附加虛弱", effect: {"onHit":{"type":"weaken","chance":0.42,"duration":4,"atkMult":0.538}} },
        { id: "ruin_seal", name: "崩毀印記", rarity: "rare", desc: "普攻 35% 附加易傷", effect: {"onHit":{"type":"vulnerable","chance":0.35,"duration":4,"takenMult":1.518}} },
        { id: "aegis_crest", name: "盾衛紋章", rarity: "uncommon", desc: "【盾衛】專屬；防禦 +16；HP +110；招募／獎勵出現率大幅提升", effect: {"unit":"shieldbearer","hp":110,"def":16,"findWeight":3.5} },
        { id: "knight_oath", name: "騎士誓約", rarity: "uncommon", desc: "【騎士】專屬；攻擊 +24；HP +70；招募／獎勵出現率大幅提升", effect: {"unit":"knight","atk":24,"hp":70,"findWeight":3.5} },
        { id: "berserker_totem", name: "狂戰圖騰", rarity: "uncommon", desc: "【狂戰士】專屬；攻擊 +32；攻速 +22%；招募／獎勵出現率大幅提升", effect: {"unit":"berserker","atk":32,"spdMult":1.222,"findWeight":3.5} },
        { id: "hunter_mark", name: "獵手印記", rarity: "uncommon", desc: "【弓箭手】專屬；攻擊 +24；射程 +50；招募／獎勵出現率大幅提升", effect: {"unit":"archer","atk":24,"attackRange":50,"findWeight":3.5} },
        { id: "bolt_quiver", name: "穿甲箭袋", rarity: "uncommon", desc: "【弩手】專屬；攻擊 +20；射程 +60；招募／獎勵出現率大幅提升", effect: {"unit":"crossbowman","atk":20,"attackRange":60,"findWeight":3.5} },
        { id: "arcane_focus", name: "奧術焦點", rarity: "uncommon", desc: "【法師】專屬；攻擊 +28；技能威力 +46%；招募／獎勵出現率大幅提升", effect: {"unit":"mage","atk":28,"skillPower":1.463,"findWeight":3.5} },
        { id: "sacred_rosary", name: "聖光念珠", rarity: "uncommon", desc: "【牧師】專屬；HP +60；治療量 +74%；招募／獎勵出現率大幅提升", effect: {"unit":"priest","healBoost":1.74,"hp":60,"findWeight":3.5} },
        { id: "shadow_contract", name: "暗影契約", rarity: "rare", desc: "【刺客】專屬；攻擊 +28；暴擊 +20%；招募／獎勵出現率大幅提升", effect: {"unit":"assassin","atk":28,"critChance":0.204,"findWeight":3.7} },
        { id: "golem_blueprint", name: "傀儡藍圖", rarity: "rare", desc: "【工程師】專屬；技能冷卻 -28%；召喚上限 +2；招募／獎勵出現率大幅提升", effect: {"unit":"engineer","summonMax":2,"skillCdMult":0.722,"findWeight":3.7} },
        { id: "glacier_tome", name: "冰河魔典", rarity: "rare", desc: "【冰法師】專屬；攻擊 +24；技能威力 +55%；招募／獎勵出現率大幅提升", effect: {"unit":"frost_mage","atk":24,"skillPower":1.555,"findWeight":3.7} },
        { id: "bone_phylactery", name: "骨製命匣", rarity: "rare", desc: "【死靈法師】專屬；技能威力 +46%；召喚上限 +2；招募／獎勵出現率大幅提升", effect: {"unit":"necromancer","summonMax":2,"skillPower":1.463,"findWeight":3.7} },
        { id: "beast_whistle", name: "馴獸哨", rarity: "rare", desc: "【馴獸師】專屬；HP +80；召喚上限 +2；招募／獎勵出現率大幅提升", effect: {"unit":"beastmaster","summonMax":2,"hp":80,"findWeight":3.7} },
        { id: "dragon_saddle", name: "龍鞍", rarity: "epic", desc: "【龍騎士】專屬；攻擊 +36；HP +120；招募／獎勵出現率大幅提升", effect: {"unit":"dragon_rider","atk":36,"hp":120,"findWeight":4} },
        { id: "paladin_relic", name: "聖騎聖物", rarity: "rare", desc: "【聖騎士】專屬；攻擊 +24；防禦 +20；HP +90；招募／獎勵出現率大幅提升", effect: {"unit":"paladin","atk":24,"def":20,"hp":90,"findWeight":3.7} },
        { id: "archmage_staff", name: "大法師杖", rarity: "epic", desc: "【大法師】專屬；攻擊 +32；技能冷卻 -28%；技能威力 +74%；招募／獎勵出現率大幅提升", effect: {"unit":"archmage","atk":32,"skillPower":1.74,"skillCdMult":0.722,"findWeight":4} },
        { id: "sentinel_plaque", name: "哨衛銘牌", rarity: "uncommon", desc: "【哨衛】專屬；防禦 +14；HP +100；招募／獎勵出現率大幅提升", effect: {"unit":"sentinel","hp":100,"def":14,"findWeight":3.5} },
        { id: "cavalier_lance", name: "槍騎長矛", rarity: "uncommon", desc: "【槍騎兵】專屬；攻擊 +24；攻速 +19%；招募／獎勵出現率大幅提升", effect: {"unit":"cavalier","atk":24,"spdMult":1.185,"findWeight":3.5} },
        { id: "marksman_scope", name: "神射瞄準鏡", rarity: "uncommon", desc: "【神射手】專屬；攻擊 +24；射程 +60；招募／獎勵出現率大幅提升", effect: {"unit":"marksman","atk":24,"attackRange":60,"findWeight":3.5} },
        { id: "cleric_chalice", name: "祭司聖杯", rarity: "uncommon", desc: "【祭司】專屬；HP +50；治療量 +65%；招募／獎勵出現率大幅提升", effect: {"unit":"cleric","healBoost":1.648,"hp":50,"findWeight":3.5} },
        { id: "warpriest_hammer", name: "戰祭聖錘", rarity: "rare", desc: "【戰祭司】專屬；攻擊 +20；防禦 +16；HP +70；招募／獎勵出現率大幅提升", effect: {"unit":"warpriest","atk":20,"def":16,"hp":70,"findWeight":3.7} },
        { id: "shadowblade_veil", name: "影刃面紗", rarity: "uncommon", desc: "【影刃】專屬；攻擊 +24；暴擊 +17%；招募／獎勵出現率大幅提升", effect: {"unit":"shadowblade","atk":24,"critChance":0.17,"findWeight":3.5} },
        { id: "huntress_fang", name: "女獵手牙飾", rarity: "rare", desc: "【女獵手】專屬；攻擊 +28；射程 +30；招募／獎勵出現率大幅提升", effect: {"unit":"huntress","atk":28,"attackRange":30,"findWeight":3.7} },
        { id: "reaver_chain", name: "掠奪鎖鏈", rarity: "rare", desc: "【掠奪者】專屬；攻擊 +32；攻速 +22%；招募／獎勵出現率大幅提升", effect: {"unit":"reaver","atk":32,"spdMult":1.222,"findWeight":3.7} },
        { id: "blood_reaver_mask", name: "血怒面具", rarity: "uncommon", desc: "【血怒蠻兵】專屬；攻擊 +28；HP +60；招募／獎勵出現率大幅提升", effect: {"unit":"blood_reaver","atk":28,"hp":60,"findWeight":3.5} },
        { id: "siege_blueprints", name: "要塞炮圖", rarity: "uncommon", desc: "【要塞炮手】專屬；攻擊 +20；射程 +50；招募／獎勵出現率大幅提升", effect: {"unit":"siege_gunner","atk":20,"attackRange":50,"findWeight":3.5} },
        { id: "automaton_core", name: "機兵核心", rarity: "rare", desc: "【自動機兵】專屬；防禦 +20；HP +110；招募／獎勵出現率大幅提升", effect: {"unit":"automaton","hp":110,"def":20,"findWeight":3.7} },
        { id: "flame_adept_censer", name: "焰徒香爐", rarity: "uncommon", desc: "【焰徒】專屬；攻擊 +24；技能威力 +37%；招募／獎勵出現率大幅提升", effect: {"unit":"flame_adept","atk":24,"skillPower":1.37,"findWeight":3.5} },
        { id: "ash_witch_grimoire", name: "灰燼魔典", rarity: "rare", desc: "【灰燼女巫】專屬；攻擊 +28；技能威力 +55%；招募／獎勵出現率大幅提升", effect: {"unit":"ash_witch","atk":28,"skillPower":1.555,"findWeight":3.7} },
        { id: "wolf_knight_banner", name: "狼騎旗", rarity: "uncommon", desc: "【狼騎士】專屬；攻擊 +24；HP +70；招募／獎勵出現率大幅提升", effect: {"unit":"wolf_knight","atk":24,"hp":70,"findWeight":3.5} },
        { id: "occultist_sigil", name: "秘術符印", rarity: "rare", desc: "【秘術師】專屬；技能威力 +37%；召喚上限 +2；招募／獎勵出現率大幅提升", effect: {"unit":"occultist","summonMax":2,"skillPower":1.37,"findWeight":3.7} },
        { id: "colossus_plate", name: "巨像鎧片", rarity: "epic", desc: "【鐵巨像】專屬；防禦 +24；HP +160；招募／獎勵出現率大幅提升", effect: {"unit":"iron_colossus","hp":160,"def":24,"findWeight":4} },
        { id: "storm_rider_reins", name: "風暴韁繩", rarity: "epic", desc: "【風暴騎士】專屬；攻擊 +32；攻速 +28%；招募／獎勵出現率大幅提升", effect: {"unit":"storm_rider","atk":32,"spdMult":1.277,"findWeight":4} }
    ];

    const ABILITIES = [
        { id: "vitality", name: "體魄強化", rarity: "common", desc: "全隊 HP +5", effect: {"commanderHp":5} },
        { id: "sharpened_weapons", name: "武器打磨", rarity: "common", desc: "全隊攻擊 +1.5", effect: {"atkAll":2} },
        { id: "reinforced_armor", name: "強化護甲", rarity: "common", desc: "全隊防禦 +1.5", effect: {"defAll":2} },
        { id: "field_medic", name: "戰地醫療", rarity: "common", desc: "戰後額外 +7.5 金幣", effect: {"healAfter":8} },
        { id: "formation_mastery", name: "陣型精通", rarity: "common", desc: "攻速 +3%", effect: {"spdMult":1.028} },
        { id: "gold_rush", name: "淘金熱", rarity: "uncommon", desc: "金幣獎勵 +10%", effect: {"goldMult":1.105} },
        { id: "veteran_training", name: "老兵訓練", rarity: "uncommon", desc: "全隊 HP +11", effect: {"hpAll":11} },
        { id: "quick_strike", name: "迅捷打擊", rarity: "uncommon", desc: "攻速 +4%", effect: {"spdMult":1.042} },
        { id: "trap_sense", name: "陷阱感知", rarity: "uncommon", desc: "陷阱金幣損失 -23%", effect: {"trapReduce":0.225} },
        { id: "treasure_hunter", name: "寶藏獵人", rarity: "uncommon", desc: "寶藏金幣 +21%", effect: {"treasureMult":1.21} },
        { id: "arcane_study", name: "奧術研習", rarity: "rare", desc: "[奧術] 攻擊 +6", effect: {"tag":"arcane","atk":6} },
        { id: "ranger_focus", name: "射手專注", rarity: "rare", desc: "[射手] 攻擊 +6", effect: {"tag":"ranger","atk":6} },
        { id: "iron_fortress", name: "鋼鐵堡壘", rarity: "rare", desc: "[坦克] HP +26", effect: {"tag":"tank","hp":26} },
        { id: "melee_drill", name: "近戰操練", rarity: "rare", desc: "[近戰] 攻擊 +4.5；防禦 +1.5", effect: {"tag":"melee","atk":5,"def":2} },
        { id: "holy_discipline", name: "聖光戒律", rarity: "rare", desc: "[神聖] HP +21；治療量 +18%", effect: {"tag":"holy","hp":21,"healBoost":1.175} },
        { id: "shadow_arts", name: "影術", rarity: "rare", desc: "[暗影] 攻擊 +7.5；攻速 +8%", effect: {"tag":"shadow","atk":8,"spdMult":1.084} },
        { id: "beast_bond", name: "獸語連結", rarity: "rare", desc: "[野獸] 攻擊 +6；HP +23", effect: {"tag":"beast","hp":23,"atk":6} },
        { id: "fire_doctrine", name: "焰術教義", rarity: "rare", desc: "[火焰] 攻擊 +6；技能威力 +14%", effect: {"tag":"fire","atk":6,"skillPower":1.14} },
        { id: "summon_lore", name: "喚靈學", rarity: "rare", desc: "[召喚] 技能冷卻 -8%；召喚上限 +0.8", effect: {"tag":"summon","skillCdMult":0.916,"summonMax":1} },
        { id: "cavalry_charge", name: "騎兵衝鋒", rarity: "uncommon", desc: "[騎兵] 攻擊 +5.3；攻速 +6%；移速 +14%", effect: {"tag":"cavalry","atk":5,"moveMult":1.14,"spdMult":1.056} },
        { id: "ranged_volley", name: "齊射訓練", rarity: "uncommon", desc: "[遠程] 攻擊 +3.8；射程 +11", effect: {"tag":"ranged","atk":4,"attackRange":11} },
        { id: "assassin_edge", name: "刺客刃法", rarity: "epic", desc: "[刺客] 攻擊 +11；暴擊 +9%", effect: {"tag":"assassin","atk":11,"critChance":0.09} },
        { id: "guard_manual", name: "守衛手冊", rarity: "uncommon", desc: "[坦克] 防禦 +3.8；HP +14", effect: {"tag":"tank","def":4,"hp":14} },
        { id: "boss_slayer", name: "屠龍者", rarity: "rare", desc: "對 Boss 傷害 +10%", effect: {"bossDmg":1.105} },
        { id: "tactical_retreat", name: "戰術撤退", rarity: "epic", desc: "非 Boss 戰敗時可撤退：保留 30% 金幣並繼續遠征（該房視為通過，無戰利品）", effect: {"keepGold":0.3} },
        { id: "war_doctrine", name: "戰爭教義", rarity: "epic", desc: "全隊攻擊 +4.5；全隊 HP +14", effect: {"atkAll":5,"hpAll":14} },
        { id: "legend_march", name: "傳奇行軍", rarity: "legendary", desc: "全隊攻擊 +7.5；全隊防禦 +3；戰後額外 +11 金幣", effect: {"atkAll":8,"defAll":3,"healAfter":11} },
        { id: "dominion", name: "霸權", rarity: "unique", desc: "全隊攻擊 +14；全隊防禦 +7.5；全隊 HP +30", effect: {"atkAll":14,"defAll":8,"hpAll":30} },
        { id: "soul_bond", name: "魂契", rarity: "unique", desc: "全隊 HP +53；治療量 +35%；開場全隊獲得護盾 30", effect: {"hpAll":53,"healBoost":1.35,"startShield":30} },
        { id: "last_stand", name: "背水一戰", rarity: "unique", desc: "HP 低於 50% 時攻擊 +41%；戰敗可撤退並保留 41% 金幣（非 Boss）", effect: {"lowHpAtk":0.413,"keepGold":0.413} }
    ];

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

    /** Optional combat reward cards that upgrade manual tactics. */
    const TACTIC_UPGRADES = [
        { id: "focus_extend", name: "集火延長", rarity: "uncommon", desc: "集火持續時間 +1 秒", effect: { focusDuration: 1 } },
        { id: "focus_power", name: "集火強化", rarity: "rare", desc: "集火期間傷害額外 +15%", effect: { focusDmgBonus: 0.15 } },
        { id: "hold_cleanse", name: "守陣淨化", rarity: "rare", desc: "發動守陣時清除友軍負面狀態", effect: { holdCleanse: true } },
        { id: "hold_iron", name: "鐵壁守陣", rarity: "uncommon", desc: "守陣期間受傷再減 10%", effect: { holdTakenMult: 0.9 } },
        { id: "allout_crit", name: "總攻必暴", rarity: "rare", desc: "總攻期間首次攻擊必暴擊", effect: { allOutFirstCrit: true } },
        { id: "allout_fury", name: "總攻狂瀾", rarity: "uncommon", desc: "總攻期間攻擊額外 +10%", effect: { allOutDmgBonus: 0.1 } },
        { id: "tactic_reserve", name: "戰術預備", rarity: "epic", desc: "每場戰鬥額外 +1 次戰術指令", effect: { tacticsCharges: 1 } }
    ];

    const SYNERGIES = [
        { id: "holy2", tag: "holy", count: 2, name: "聖光庇護", desc: "[神聖]×2：治療量 +40%", effect: { tag: "holy", healBoost: 1.4 } },
        { id: "holy3", tag: "holy", count: 3, name: "聖裁", desc: "[神聖]×3：神聖單位防禦 +10、HP +40", effect: { tag: "holy", def: 10, hp: 40 } },
        { id: "summon2", tag: "summon", count: 2, name: "喚靈陣", desc: "[召喚]×2：召喚上限 +1、冷卻 -15%", effect: { tag: "summon", summonMax: 1, skillCdMult: 0.85 } },
        { id: "melee3", tag: "melee", count: 3, name: "鋒線", desc: "[近戰]×3：近戰攻擊 +12、HP +25", effect: { tag: "melee", atk: 12, hp: 25 } },
        { id: "ranged3", tag: "ranged", count: 3, name: "齊射", desc: "[遠程]×3：遠程攻擊 +10、射程 +20", effect: { tag: "ranged", atk: 10, attackRange: 20 } },
        { id: "arcane2", tag: "arcane", count: 2, name: "奧術共鳴", desc: "[奧術]×2：技能威力 +30%", effect: { tag: "arcane", skillPower: 1.3 } },
        { id: "fire2", tag: "fire", count: 2, name: "燃焰", desc: "[火焰]×2：攻擊 +8、技能威力 +20%", effect: { tag: "fire", atk: 8, skillPower: 1.2 } },
        { id: "tank2", tag: "tank", count: 2, name: "鐵壁", desc: "[坦克]×2：坦克 HP +50、防禦 +8", effect: { tag: "tank", hp: 50, def: 8 } },
        { id: "shadow2", tag: "shadow", count: 2, name: "影襲", desc: "[暗影]×2：攻速 +15%、暴擊 +10%", effect: { tag: "shadow", spdMult: 1.15, critChance: 0.1 } },
        { id: "beast2", tag: "beast", count: 2, name: "獸群", desc: "[野獸]×2：野獸攻擊 +14、移速感（攻速 +10%）", effect: { tag: "beast", atk: 14, spdMult: 1.1 } },
        { id: "mechanical2", tag: "mechanical", count: 2, name: "齒輪陣", desc: "[機械]×2：機械防禦 +8、HP +40", effect: { tag: "mechanical", def: 8, hp: 40 } },
        { id: "guard2", tag: "guard", count: 2, name: "衛隊", desc: "[護衛]×2：護衛 HP +45、防禦 +6", effect: { tag: "guard", hp: 45, def: 6 } },
        { id: "frenzy2", tag: "frenzy", count: 2, name: "狂潮", desc: "[狂戰]×2：狂戰攻擊 +16、攻速 +12%", effect: { tag: "frenzy", atk: 16, spdMult: 1.12 } },
        { id: "assassin2", tag: "assassin", count: 2, name: "暗殺網", desc: "[刺客]×2：刺客暴擊 +12%、攻速 +10%", effect: { tag: "assassin", critChance: 0.12, spdMult: 1.1 } },
        { id: "elite2", tag: "elite", count: 2, name: "菁英連", desc: "[精英]×2：精英攻擊 +12、HP +50", effect: { tag: "elite", atk: 12, hp: 50 } },
        { id: "cavalry2", tag: "cavalry", count: 2, name: "騎槍陣", desc: "[騎兵]×2：騎兵攻擊 +10、移速 +25%、攻速 +12%", effect: { tag: "cavalry", atk: 10, moveMult: 1.25, spdMult: 1.12 } },
        { id: "warrior3", tag: "warrior", count: 3, name: "戰團", desc: "[戰士]×3：戰士攻擊 +14、HP +30", effect: { tag: "warrior", atk: 14, hp: 30 } },
        { id: "ranger3", tag: "ranger", count: 3, name: "弓陣", desc: "[射手]×3：射手攻擊 +12、射程 +18", effect: { tag: "ranger", atk: 12, attackRange: 18 } },
        { id: "support2", tag: "support", count: 2, name: "援護網", desc: "[輔助]×2：治療量 +25%、輔助 HP +30", effect: { tag: "support", healBoost: 1.25, hp: 30 } }
    ];

    const TACTICS = [
        { id: "focus_fire", name: "集火", desc: "3 秒內友軍優先攻擊血量最低的敵人，傷害 +20%", duration: 3, charges: 1 },
        { id: "hold_line", name: "守陣", desc: "4 秒內友軍移速 -50%、防禦 +12、受傷 -15%", duration: 4, charges: 1 },
        { id: "all_out", name: "總攻", desc: "3 秒內友軍攻擊 +30%、移速 +25%", duration: 3, charges: 1 }
    ];

    const EVENTS = [
        { id: "mysterious_merchant", title: "神秘商人", text: "一位商人提供補給，或簽下一紙戰場契約。", choices: [
            { label: "付費補給 (-20 金, +50 金物資)", cost: { gold: 20 }, reward: { gold: 50 } },
            { label: "簽賞金契約（下 2 場戰鬥金幣 ×1.5）", reward: { contract: { id: "bounty_pact", name: "賞金契約", rooms: 2, desc: "戰鬥金幣獎勵 ×1.5", effect: { goldMult: 1.5 } } } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "ancient_shrine", title: "古老神殿", text: "神殿散發神秘之光。", choices: [
            { label: "祈禱 (+30 金)", reward: { gold: 30 } },
            { label: "獻金 (+1 隨機神器, -30 金)", cost: { gold: 30 }, reward: { artifact: true } },
            { label: "立聖光契約（下 2 場僅神聖單位可戰，開場護盾 50）", reward: { contract: { id: "holy_pact", name: "聖光契約", rooms: 2, desc: "僅 [神聖] 可出戰，開場護盾 50", effect: { onlyFightTag: "holy", startShield: 50 } } } }
        ]},
        { id: "training_ground", title: "訓練場", text: "士兵在此磨練技藝。", choices: [
            { label: "強化部隊 (+全隊攻擊 3)", reward: { tempAtk: 3 } },
            { label: "離開", reward: {} }
        ]},
        { id: "wandering_healer", title: "流浪醫者", text: "醫者願意提供物資援助。", choices: [
            { label: "接受援助 (+40 金)", reward: { gold: 40 } },
            { label: "婉拒", reward: {} }
        ]},
        { id: "gamble", title: "賭徒", text: "賭一把？50% 機率獲得神器，失敗則失去 20 金幣。", choices: [
            { label: "賭博", reward: { gamble: true } },
            { label: "不賭", reward: {} }
        ]},
        { id: "recruit", title: "志願兵", text: "新兵願意加入你的隊伍。", choices: [
            { label: "招募隨機單位", reward: { recruit: true } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "cursed_idol", title: "詛咒神像", text: "觸碰神像可獲得力量，但要付出金幣。", choices: [
            { label: "觸碰 (-20 金, +隨機能力)", cost: { gold: 20 }, reward: { ability: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "supply_cache", title: "補給箱", text: "發現軍用補給。", choices: [
            { label: "取得 (+35 金)", reward: { gold: 35 } },
            { label: "離開", reward: {} }
        ]},
        { id: "old_general", title: "老將", text: "退休將軍分享戰術。", choices: [
            { label: "學習 (+隨機能力)", reward: { ability: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "fog_maze", title: "迷霧迷宮", text: "迷霧中傳出契約低語：以險換利。", choices: [
            { label: "簽再生契約（下 2 場敵軍皆再生，但獎勵更稀有）", reward: { contract: { id: "regen_pact", name: "再生契約", rooms: 2, desc: "敵軍強制再生詞綴；獎勵稀有度提升", effect: { forceEnemyAffix: "regenerating", rewardRarityBoost: 1.75 } } } },
            { label: "繞路 (+10 金)", reward: { gold: 10 } }
        ]},
        { id: "bandit_camp", title: "盜賊營地", text: "盜賊提出交易——或一紙血戰契約。", choices: [
            { label: "交贖金 (-25 金)", cost: { gold: 25 }, reward: {} },
            { label: "簽狂暴契約（下 2 場敵軍狂暴，戰後 +35 金）", reward: { contract: { id: "rage_pact", name: "狂暴契約", rooms: 2, desc: "敵軍強制狂暴；每場戰鬥額外 +35 金", effect: { forceEnemyAffix: "enraged", goldAfter: 35 } } } },
            { label: "強行通過 (+15 金)", reward: { gold: 15 } }
        ]},
        { id: "magic_well", title: "魔法泉", text: "泉水閃爍著魔力。", choices: [
            { label: "飲用 (+25 金)", reward: { gold: 25 } },
            { label: "裝瓶 (+20 金)", reward: { gold: 20 } }
        ]},
        { id: "deserter", title: "逃兵", text: "一名逃兵請求加入。", choices: [
            { label: "接納 (+隨機單位)", reward: { recruit: true } },
            { label: "驅逐 (+10 金)", reward: { gold: 10 } }
        ]},
        { id: "battlefield_loot", title: "戰場遺跡", text: "散落著未收的戰利品。", choices: [
            { label: "搜刮 (+30 金)", reward: { gold: 30 } },
            { label: "警戒離開", reward: {} }
        ]},
        { id: "prophet", title: "預言者", text: "預言者窺見你的命運。", choices: [
            { label: "聆聽預言 (+隨機能力)", reward: { ability: true } },
            { label: "無視", reward: {} }
        ]},
        { id: "weapon_smith", title: "鐵匠", text: "鐵匠願意強化武器。", choices: [
            { label: "強化 (-20 金, +攻擊 4)", cost: { gold: 20 }, reward: { tempAtk: 4 } },
            { label: "離開", reward: {} }
        ]},
        { id: "haunted_ruins", title: "鬧鬼遺跡", text: "幽靈低語。", choices: [
            { label: "調查 (-20 金, +神器)", cost: { gold: 20 }, reward: { artifact: true } },
            { label: "快速離開", reward: {} }
        ]},
        { id: "royal_envoy", title: "王室使者", text: "使者帶來資助。", choices: [
            { label: "接受資助 (+40 金)", reward: { gold: 40 } },
            { label: "謝絕 (+30 金物資)", reward: { gold: 30 } }
        ]},
        { id: "sparring", title: "切磋", text: "友軍邀請切磋。", choices: [
            { label: "切磋 (-10 金, +攻擊 5)", cost: { gold: 10 }, reward: { tempAtk: 5 } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "mystic_orb", title: "神秘寶珠", text: "寶珠脈動著能量。", choices: [
            { label: "吸收 (-16 金, +能力)", cost: { gold: 16 }, reward: { ability: true } },
            { label: "封存 (+25 金)", reward: { gold: 25 } }
        ]},
        { id: "refugee", title: "難民", text: "難民尋求庇護，並帶來一份情報契約。", choices: [
            { label: "救助 (-15 金, +40 金情報)", cost: { gold: 15 }, reward: { gold: 40 } },
            { label: "簽護盾契約（下 3 場敵軍開場護盾，寶藏金幣 ×1.5）", reward: { contract: { id: "shield_pact", name: "護盾契約", rooms: 3, desc: "敵軍強制護盾詞綴；寶藏金幣 ×1.5", effect: { forceEnemyAffix: "shielded", treasureMult: 1.5 } } } },
            { label: "忽略", reward: {} }
        ]},
        { id: "ancient_armory", title: "古代軍械庫", text: "塵封的武器庫。", choices: [
            { label: "探索 (+神器, -24 金)", cost: { gold: 24 }, reward: { artifact: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "scout_report", title: "偵察報告", text: "偵察兵帶回情報與一份戰場契約。", choices: [
            { label: "獎賞 (+15 金)", reward: { gold: 15 } },
            { label: "簽暗影契約（下 2 場僅暗影單位可戰，攻速感提升）", reward: { contract: { id: "shadow_pact", name: "暗影契約", rooms: 2, desc: "僅 [暗影] 可出戰；全隊攻速 ×1.2", effect: { onlyFightTag: "shadow", spdMult: 1.2 } } } },
            { label: "整頓 (+20 金)", reward: { gold: 20 } }
        ]},
        { id: "drunken_soldier", title: "醉酒士兵", text: "士兵醉醺醺地訴說戰場祕聞。", choices: [
            { label: "請酒 (-10 金, +攻擊 3)", cost: { gold: 10 }, reward: { tempAtk: 3 } },
            { label: "趕走", reward: {} }
        ]},
        { id: "eclipse", title: "日蝕", text: "日蝕籠罩戰場。", choices: [
            { label: "祈禱 (+能力)", reward: { ability: true } },
            { label: "繼續行軍", reward: { gold: 10 } }
        ]},
        { id: "merchant_caravan", title: "商隊", text: "商隊願意打折出售。", choices: [
            { label: "購買補給 (-15 金, +40 金物資)", cost: { gold: 15 }, reward: { gold: 40 } },
            { label: "簽商人契約（下 3 房商店折扣 30%）", reward: { contract: { id: "merchant_pact", name: "商人契約", rooms: 3, desc: "商店價格 -30%", effect: { shopDiscount: 0.3 } } } },
            { label: "路過", reward: {} }
        ]},
        { id: "war_memorial", title: "戰爭紀念碑", text: "紀念碑上刻滿名字。", choices: [
            { label: "致敬 (+30 金)", reward: { gold: 30 } },
            { label: "默哀離開", reward: {} }
        ]},
        { id: "hidden_cache", title: "隱藏儲藏", text: "發現隱蔽的補給點。", choices: [
            { label: "取用 (+55 金)", reward: { gold: 55 } },
            { label: "標記後離開", reward: { gold: 15 } }
        ]},
        { id: "rival_commander", title: "對手指揮官", text: "敵方指揮官提出決鬥——或以契約定勝負。", choices: [
            { label: "決鬥 (-36 金, +50 金)", cost: { gold: 36 }, reward: { gold: 50 } },
            { label: "簽反傷契約（下 2 場敵軍反傷，獎勵稀有度大增）", reward: { contract: { id: "thorn_pact", name: "反傷契約", rooms: 2, desc: "敵軍強制反傷；獎勵稀有度大幅提升", effect: { forceEnemyAffix: "thorny", rewardRarityBoost: 2.2 } } } },
            { label: "拒絕決鬥", reward: {} }
        ]},
        { id: "war_pact_envoy", title: "戰場契約官", text: "契約官攤開數份羊皮紙：以風險換取未來優勢。", choices: [
            { label: "再生契約（下 2 場敵再生，獎勵更稀有）", reward: { contract: { id: "regen_pact", name: "再生契約", rooms: 2, desc: "敵軍強制再生詞綴；獎勵稀有度提升", effect: { forceEnemyAffix: "regenerating", rewardRarityBoost: 1.75 } } } },
            { label: "迅捷契約（下 2 場敵迅捷，開場護盾 60）", reward: { contract: { id: "swift_pact", name: "迅捷契約", rooms: 2, desc: "敵軍強制迅捷；開場護盾 60", effect: { forceEnemyAffix: "swift", startShield: 60 } } } },
            { label: "賞金契約（下 3 場金幣 ×1.6）", reward: { contract: { id: "bounty_pact", name: "賞金契約", rooms: 3, desc: "戰鬥金幣獎勵 ×1.6", effect: { goldMult: 1.6 } } } },
            { label: "拒絕簽約", reward: {} }
        ]},
        { id: "blood_oath", title: "血誓祭壇", text: "以血為墨，簽下限定兵種的戰場誓約。", choices: [
            { label: "近戰血誓（下 2 場僅近戰可戰，HP +40）", reward: { contract: { id: "melee_oath", name: "近戰血誓", rooms: 2, desc: "僅 [近戰] 可出戰；全隊 HP +40", effect: { onlyFightTag: "melee", hpAll: 40 } } } },
            { label: "遠程血誓（下 2 場僅遠程可戰，攻擊 +8）", reward: { contract: { id: "ranged_oath", name: "遠程血誓", rooms: 2, desc: "僅 [遠程] 可出戰；全隊攻擊 +8", effect: { onlyFightTag: "ranged", atkAll: 8 } } } },
            { label: "離開", reward: {} }
        ]},
        { id: "transmutation_altar", title: "轉化祭壇", text: "古老祭壇嗡鳴著魔力，能將一名部隊轉化為其他兵種。", choices: [
            { label: "隨意轉化", reward: { convert: true } },
            { label: "定向轉化 (-25 金, 偏向更高稀有)", cost: { gold: 25 }, reward: { convert: true, convertUpgrade: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "field_chapel", title: "戰地禮拜堂", text: "教士以優惠價格喚回陣亡將士（約四折）。", choices: [
            { label: "優惠復活最近一名（約四折）", reward: { reviveFallen: true, reviveCostMult: 0.4 } },
            { label: "捐獻 (+20 金祝福)", reward: { gold: 20 } },
            { label: "離開", reward: {} }
        ]},
        { id: "blood_pact", title: "血契祭壇", text: "以鮮血換取力量。", choices: [
            { label: "獻血換神器（-35 金）", cost: { gold: 35 }, reward: { artifact: true } },
            { label: "獻祭一名隨機單位換高稀有獎勵", reward: { sacrificeUnit: true, epicReward: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "devil_deal", title: "惡魔交易", text: "低語承諾力量與詛咒。", choices: [
            { label: "接受詛咒神器（-20 金）", cost: { gold: 20 }, reward: { cursedArtifact: true } },
            { label: "賣血換金幣（部隊臨時攻擊 -5，+55 金）", reward: { gold: 55, tempAtk: -5 } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "war_tax", title: "軍稅官", text: "官府索取軍費，或徵召一名士兵。", choices: [
            { label: "繳稅 (-40 金，+隨機能力)", cost: { gold: 40 }, reward: { ability: true } },
            { label: "交出一名隨機單位換 70 金", reward: { sacrificeUnit: true, gold: 70 } },
            { label: "抗命離開", reward: {} }
        ]},
        { id: "fusion_altar", title: "融合祭壇", text: "兩名同種同星級的部隊可在此合而為一，升至更高星級（最高 ★10）。", choices: [
            { label: "進行融合（消耗兩名同種同星）", reward: { mergeUnits: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "unique_legacy", title: "遺世遺產", text: "一座封印祭壇低語著唯一之名——隨機賜予一件尚未擁有的唯一單位或能力。", choices: [
            { label: "接受唯一賜福", reward: { uniqueGrant: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "eternal_trial", title: "永恆試煉", text: "試煉官提出契約：付出金幣，換取指定的唯一之力。", choices: [
            { label: "召喚永恆守衛 (-50 金)", cost: { gold: 50 }, reward: { grantUnit: "eternal_warden" } },
            { label: "學習霸權 (-50 金)", cost: { gold: 50 }, reward: { grantAbility: "dominion" } },
            { label: "拒絕", reward: {} }
        ]}
    ];

    const TRAPS = [
        { id: "spike_pit", title: "尖刺陷阱", text: "隊伍踩入陷阱，損失物資！", damage: 12 },
        { id: "poison_gas", title: "毒氣", text: "有毒氣體迫使部隊丟棄補給！", damage: 18 },
        { id: "ambush", title: "伏擊", text: "敵人突襲！", damage: 10, combat: true },
        { id: "rockfall", title: "落石", text: "落石砸毀部分輜重！", damage: 15 },
        { id: "quicksand", title: "流沙", text: "陷入流沙，丟失金幣！", damage: 8 },
        { id: "fire_trap", title: "火焰機關", text: "火焰燒毀補給！", damage: 20 },
        { id: "cursed_ground", title: "詛咒之地", text: "詛咒吸走財運。", damage: 14 },
        { id: "snare", title: "捕獸夾", text: "耽誤行軍，損失金幣！", damage: 6 },
        { id: "arrow_rain", title: "箭雨", text: "箭雨來襲，被迫交戰！", damage: 16, combat: true },
        { id: "swamp", title: "沼澤", text: "部隊陷入沼澤，丟棄物資！", damage: 11 },
        { id: "explosive", title: "爆炸陷阱", text: "爆炸引發敵軍注意！", damage: 22, combat: true },
        { id: "net_trap", title: "羅網", text: "羅網困住前鋒！", damage: 9 },
        { id: "frost_rune", title: "冰霜符文", text: "寒氣凍壞補給！", damage: 13 },
        { id: "pitfall", title: "陷坑", text: "地面塌陷，遭遇伏兵！", damage: 17, combat: true },
        { id: "shadow_blade", title: "暗影刀刃", text: "無形之刃劃過輜重車！", damage: 19 }
    ];

    const SHOP_ITEMS = [
        { type: "ability", name: "戰術卷軸", desc: "獲得一個隨機能力（本店限購 1）", price: 40, maxBuys: 1, effect: { ability: true } },
        { type: "artifact", name: "隨機神器", desc: "獲得一件神器（本店限購 1）", price: 60, maxBuys: 1, effect: { artifact: true } },
        { type: "unit", name: "招募單位", desc: "獲得一個單位加入部隊（本店限購 2）", price: 45, maxBuys: 2, effect: { recruit: true } },
        { type: "upgrade", name: "部隊強化", desc: "全隊攻擊 +3（本局，限購 1）", price: 35, maxBuys: 1, effect: { tempAtk: 3 } },
        { type: "exp", name: "訓練手冊", desc: "隨機一名未滿星單位獲得 5 點經驗（本店限購 2）", price: 28, maxBuys: 2, effect: { unitExp: 5 } }
    ];

    global.WarData = {
        ARENA,
        RARITY,
        TAGS,
        STATUS_EFFECTS,
        WORLDS,
        UNITS,
        STARTER_UNITS,
        STARTER_ARMY,
        ARTIFACTS,
        ABILITIES,
        ROOM_TYPES,
        STAR_STATS,
        STAR_EXP,
        MAX_STAR,
        TERRAINS,
        ELITE_AFFIXES,
        ENEMY_FORMATIONS,
        SYNERGIES,
        TACTICS,
        TACTIC_UPGRADES,
        EVENTS,
        TRAPS,
        SHOP_ITEMS
    };
})(typeof window !== "undefined" ? window : globalThis);
