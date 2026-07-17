/**
 * War Roguelike — content: units
 */
(function (global) {
    "use strict";
    global.WarDataParts = global.WarDataParts || {};
    const DEFAULT_MOVE = global.WarDataParts.DEFAULT_MOVE || { melee: 32, ranged: 24 };
    const DEFAULT_RANGE = global.WarDataParts.DEFAULT_RANGE || { melee: 28, ranged: 110 };
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
    global.WarDataParts.UNITS = UNITS;
    global.WarDataParts.STARTER_UNITS = STARTER_UNITS;
    global.WarDataParts.STARTER_ARMY = STARTER_ARMY;
})(typeof window !== "undefined" ? window : globalThis);
