/**
 * War Roguelike — game state, modifiers, save/load.
 */
(function (global) {
    "use strict";

    const {
        WORLDS, UNITS, STARTER_UNITS, STARTER_ARMY, ARTIFACTS, ABILITIES,
        EVENTS, TRAPS, SHOP_ITEMS, RARITY, ARENA,
        STAR_STATS, STAR_EXP, MAX_STAR, TERRAINS, ELITE_AFFIXES, SYNERGIES, TACTICS,
        ENEMY_FORMATIONS, TACTIC_UPGRADES
    } = global.WarData;

    const SAVE_KEY = "war-roguelike-save-v4";
    const SAVE_KEY_LEGACY = ["war-roguelike-save-v3", "war-roguelike-save-v2", "war-roguelike-save-v1"];
    const STAR_CAP = MAX_STAR || 10;

    let uidSeq = 1;

    function nextOwnedUid(state) {
        if (state && Number.isFinite(state.unitUidSeq)) {
            state.unitUidSeq += 1;
            return `u${state.unitUidSeq}`;
        }
        uidSeq += 1;
        return `u${Date.now().toString(36)}-${uidSeq}`;
    }

    function clampStar(star) {
        return Math.max(1, Math.min(STAR_CAP, star || 1));
    }

    function expNeededForStar(star) {
        const s = clampStar(star);
        if (s >= STAR_CAP) return null;
        return (STAR_EXP && STAR_EXP[s]) != null ? STAR_EXP[s] : Math.max(3, s * 4);
    }

    function defaultOwnedUnits(state) {
        const bag = state || { unitUidSeq: 0 };
        if (!Number.isFinite(bag.unitUidSeq)) bag.unitUidSeq = 0;
        return STARTER_ARMY.map((id) => makeOwnedUnit(bag, id, 1, 0));
    }

    function makeOwnedUnit(state, unitId, star, exp) {
        return {
            uid: nextOwnedUid(state),
            id: unitId,
            star: clampStar(star),
            exp: Math.max(0, exp || 0)
        };
    }

    function ownedUnitId(entry) {
        if (!entry) return null;
        if (typeof entry === "string") return entry;
        return entry.id || null;
    }

    function ownedUnitUid(entry) {
        if (!entry || typeof entry === "string") return null;
        return entry.uid || null;
    }

    function ownedUnitStar(entry) {
        if (!entry || typeof entry === "string") return 1;
        return clampStar(entry.star);
    }

    function ownedUnitExp(entry) {
        if (!entry || typeof entry === "string") return 0;
        return Math.max(0, entry.exp || 0);
    }

    function normalizeOwnedEntry(entry, state) {
        const id = ownedUnitId(entry);
        if (!id) return null;
        const uid = ownedUnitUid(entry) || nextOwnedUid(state || { unitUidSeq: 0 });
        return {
            uid,
            id,
            star: ownedUnitStar(entry),
            exp: ownedUnitExp(entry)
        };
    }

    function normalizeOwnedList(list, state) {
        const bag = state || { unitUidSeq: 0 };
        if (!Number.isFinite(bag.unitUidSeq)) bag.unitUidSeq = 0;
        const seen = new Set();
        return (list || []).map((e) => {
            const n = normalizeOwnedEntry(e, bag);
            if (!n) return null;
            // Ensure unique uids after migration
            if (seen.has(n.uid)) n.uid = nextOwnedUid(bag);
            seen.add(n.uid);
            return n;
        }).filter(Boolean);
    }

    function defaultSlotPos(index, total, arenaW, arenaH) {
        const w = arenaW || ARENA.width;
        const h = arenaH || ARENA.height;
        const n = Math.max(1, total);
        // More columns as army grows so the wider arena packs denser
        const cols = n <= 4 ? 1 : (n <= 12 ? 2 : 3);
        const rows = Math.ceil(n / cols);
        const col = index % cols;
        const row = Math.floor(index / cols);
        const xBand = [w * 0.12, w * 0.26, w * 0.38];
        const x = cols === 1
            ? w * 0.22
            : xBand[Math.min(col, xBand.length - 1)];
        const yPad = h * 0.1;
        const ySpan = h - yPad * 2;
        const y = rows === 1
            ? h * 0.5
            : yPad + (row / (rows - 1)) * ySpan;
        return { x, y };
    }

    function layoutArmySlots(army) {
        const list = Array.isArray(army) ? army : [];
        return list.map((entry, i) => {
            const id = armyUnitId(entry);
            const pos = defaultSlotPos(i, list.length);
            return {
                uid: ownedUnitUid(entry) || null,
                id,
                star: armyUnitStar(entry),
                x: pos.x,
                y: pos.y
            };
        }).filter((s) => s.id);
    }

    function makeArmySlot(unitId, index, total, star, uid) {
        const pos = defaultSlotPos(index, total);
        return {
            uid: uid || null,
            id: unitId,
            star: star || 1,
            x: pos.x,
            y: pos.y
        };
    }

    function clampArmyPos(x, y, arenaW, arenaH) {
        const w = arenaW || ARENA.width;
        const h = arenaH || ARENA.height;
        const pad = 22;
        return {
            x: Math.max(pad, Math.min(w * 0.46, x)),
            y: Math.max(pad, Math.min(h - pad, y))
        };
    }

    function armySlotRadius(unitId) {
        return (UNITS[unitId]?.radius || 14) + 8;
    }

    /** Find a non-overlapping spot in the player deploy zone. */
    function findOpenArmyPos(army, unitId, arenaW, arenaH) {
        const w = arenaW || ARENA.width;
        const h = arenaH || ARENA.height;
        const list = army || [];
        const rNew = armySlotRadius(unitId);
        const candidates = [];
        const n = list.length + 1;
        for (let i = 0; i < n; i++) candidates.push(defaultSlotPos(i, n, w, h));
        const gridCols = 7;
        const gridRows = 12;
        const xMax = w * 0.42;
        for (let gy = 0; gy < gridRows; gy++) {
            for (let gx = 0; gx < gridCols; gx++) {
                candidates.push({
                    x: 28 + (gx / Math.max(1, gridCols - 1)) * (xMax - 28),
                    y: 28 + (gy / Math.max(1, gridRows - 1)) * (h - 56)
                });
            }
        }

        function isClear(x, y) {
            for (let i = 0; i < list.length; i++) {
                const other = list[i];
                const dx = other.x - x;
                const dy = other.y - y;
                const minD = rNew + armySlotRadius(other.id);
                if (Math.sqrt(dx * dx + dy * dy) < minD) return false;
            }
            return true;
        }

        for (let c = 0; c < candidates.length; c++) {
            const p = clampArmyPos(candidates[c].x, candidates[c].y, w, h);
            if (isClear(p.x, p.y)) return p;
        }
        const fallback = defaultSlotPos(list.length, Math.max(1, n), w, h);
        return clampArmyPos(fallback.x, fallback.y, w, h);
    }

    /**
     * Push overlapping units apart. Prefer moving later slots so earlier
     * placements keep their position when possible.
     */
    function separateArmySlots(army, arenaW, arenaH) {
        const list = army || [];
        for (let pass = 0; pass < 10; pass++) {
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i];
                    const b = list[j];
                    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) continue;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                    const minD = armySlotRadius(a.id) + armySlotRadius(b.id);
                    if (d >= minD) continue;
                    const nx = dx / d;
                    const ny = dy / d;
                    const overlap = minD - d;
                    // Move the newer unit most of the way
                    const bp = clampArmyPos(b.x + nx * overlap * 0.85, b.y + ny * overlap * 0.85, arenaW, arenaH);
                    const ap = clampArmyPos(a.x - nx * overlap * 0.15, a.y - ny * overlap * 0.15, arenaW, arenaH);
                    a.x = ap.x; a.y = ap.y;
                    b.x = bp.x; b.y = bp.y;
                }
            }
        }
        return list;
    }

    /** Append one unit without resetting existing positions. */
    function appendArmyUnit(army, unitId, star, uid) {
        const list = Array.isArray(army) ? army : [];
        const pos = findOpenArmyPos(list, unitId);
        list.push({
            uid: uid || null,
            id: unitId,
            star: star || 1,
            x: pos.x,
            y: pos.y
        });
        return separateArmySlots(list);
    }

    function armyUnitId(entry) {
        return typeof entry === "string" ? entry : entry?.id;
    }

    function armyUnitUid(entry) {
        if (!entry || typeof entry === "string") return null;
        return entry.uid || null;
    }

    function armyUnitStar(entry) {
        if (!entry || typeof entry === "string") return 1;
        return clampStar(entry.star);
    }

    function hasUnitTag(def, tag) {
        if (!def || !tag) return false;
        if (def.role === tag || def.range === tag) return true;
        return Array.isArray(def.tags) && def.tags.includes(tag);
    }

    /** Whether a unit may be deployed / fight under onlyFightTag(s) restrictions. */
    function unitMayFight(unitIdOrDef, modifiers) {
        const def = typeof unitIdOrDef === "string" ? UNITS[unitIdOrDef] : unitIdOrDef;
        if (!def) return false;
        const m = modifiers || {};
        const only = m.onlyFightTags || (m.onlyFightTag ? [m.onlyFightTag] : null);
        if (!only || !only.length) return true;
        return only.some((t) => hasUnitTag(def, t));
    }

    function fightRestrictionLabel(modifiers) {
        const m = modifiers || {};
        const only = m.onlyFightTags || (m.onlyFightTag ? [m.onlyFightTag] : null);
        if (!only || !only.length) return null;
        const tags = global.WarData.TAGS || {};
        return only.map((t) => (tags[t] && tags[t].label) || t).join("／");
    }

    function filterArmyByFightRules(army, modifiers) {
        return (army || []).filter((entry) => unitMayFight(armyUnitId(entry), modifiers));
    }

    function defaultArmy(state) {
        const owned = defaultOwnedUnits(state);
        return owned.map((e, i) => makeArmySlot(e.id, i, owned.length, e.star, e.uid));
    }

    function clampArmyToOwned(owned, army) {
        const pool = normalizeOwnedList(owned).slice();
        const result = [];
        (army || []).forEach((entry) => {
            const uid = armyUnitUid(entry);
            const id = armyUnitId(entry);
            if (!id && !uid) return;
            let idx = -1;
            if (uid) idx = pool.findIndex((o) => o.uid === uid);
            if (idx === -1 && id) {
                const wantStar = armyUnitStar(entry);
                idx = pool.findIndex((o) => o.id === id && o.star === wantStar);
            }
            if (idx === -1 && id) idx = pool.findIndex((o) => o.id === id);
            if (idx === -1) return;
            const matched = pool.splice(idx, 1)[0];
            result.push({
                uid: matched.uid,
                id: matched.id,
                star: matched.star,
                x: Number.isFinite(entry?.x) ? entry.x : defaultSlotPos(result.length, (army || []).length).x,
                y: Number.isFinite(entry?.y) ? entry.y : defaultSlotPos(result.length, (army || []).length).y
            });
        });
        return result;
    }

    function normalizeArmy(army, owned) {
        if (!Array.isArray(army)) return [];
        return clampArmyToOwned(owned || [], army);
    }

    function snapshotArmySetup(army) {
        return (army || []).map((entry) => ({
            uid: armyUnitUid(entry),
            id: armyUnitId(entry),
            star: armyUnitStar(entry),
            x: Number.isFinite(entry?.x) ? entry.x : 0,
            y: Number.isFinite(entry?.y) ? entry.y : 0
        })).filter((s) => s.id);
    }

    /** Restore last battle deploy list + positions, clamped to current owned units. */
    function restoreLastBattleSetup(state) {
        if (!state) return [];
        const owned = normalizeOwnedList(state.ownedUnits || [], state);
        if (Array.isArray(state.lastBattleSetup) && state.lastBattleSetup.length) {
            return clampArmyToOwned(owned, state.lastBattleSetup);
        }
        if (Array.isArray(state.army) && state.army.length) {
            return clampArmyToOwned(owned, state.army);
        }
        return owned.map((e, i) => makeArmySlot(e.id, i, owned.length, e.star, e.uid));
    }

    function playerUnitPool(opts) {
        const includeUnique = !!(opts && opts.includeUnique);
        return Object.keys(UNITS).filter((id) => {
            const u = UNITS[id];
            if (!u) return false;
            if (u.temporary || u.role === "summon" || u.role === "enemy" || u.role === "boss") return false;
            if (!includeUnique && u.rarity === "unique") return false;
            return true;
        });
    }

    function itemRarity(item) {
        if (!item) return "common";
        if (typeof item === "string") {
            if (UNITS[item]) return UNITS[item].rarity || "common";
            const art = ARTIFACTS.find((a) => a.id === item);
            if (art) return art.rarity || "common";
            const ab = ABILITIES.find((a) => a.id === item);
            if (ab) return ab.rarity || "common";
            return "common";
        }
        return item.rarity || "common";
    }

    /** Unique rarity never appears in random loot. */
    function isRandomEligible(item) {
        return itemRarity(item) !== "unique";
    }

    function filterRandomPool(pool) {
        return (pool || []).filter((x) => isRandomEligible(x));
    }

    /** Random artifact loot excludes cursed (cursed only via cursedArtifact events). */
    function randomArtifactPool() {
        return filterRandomPool(ARTIFACTS).filter((a) => !a.cursed);
    }

    function migrateState(raw) {
        if (!raw || typeof raw !== "object") return null;
        if (!Number.isFinite(raw.unitUidSeq)) raw.unitUidSeq = 0;
        if (!Array.isArray(raw.ownedUnits)) {
            if (Array.isArray(raw.army) && raw.army.length) {
                raw.ownedUnits = raw.army.map(armyUnitId).filter(Boolean);
            } else if (Array.isArray(raw.formation)) {
                raw.ownedUnits = raw.formation.filter(Boolean);
            } else {
                raw.ownedUnits = defaultOwnedUnits(raw);
            }
        }
        raw.ownedUnits = normalizeOwnedList(raw.ownedUnits, raw);
        raw.army = normalizeArmy(raw.army, raw.ownedUnits);
        // Scale placements saved for the old 480×270 arena onto the current size
        (function scaleLegacyArenaCoords(list) {
            if (!Array.isArray(list) || !list.length) return;
            const oldW = 480;
            const oldH = 270;
            if (ARENA.width === oldW && ARENA.height === oldH) return;
            const xs = list.map((s) => Number(s.x)).filter(Number.isFinite);
            if (!xs.length) return;
            const maxX = Math.max(...xs);
            // Old player zone capped near ~0.46*480 ≈ 220
            if (maxX > oldW * 0.52) return;
            const sx = ARENA.width / oldW;
            const sy = ARENA.height / oldH;
            list.forEach((s) => {
                if (Number.isFinite(s.x)) s.x = Math.round(s.x * sx * 10) / 10;
                if (Number.isFinite(s.y)) s.y = Math.round(s.y * sy * 10) / 10;
            });
        })(raw.army);
        if (!Array.isArray(raw.lastBattleSetup)) {
            raw.lastBattleSetup = raw.army.length ? snapshotArmySetup(raw.army) : null;
        } else {
            (function scaleLegacyArenaCoords(list) {
                if (!Array.isArray(list) || !list.length) return;
                const oldW = 480;
                const oldH = 270;
                if (ARENA.width === oldW && ARENA.height === oldH) return;
                const xs = list.map((s) => Number(s.x)).filter(Number.isFinite);
                if (!xs.length) return;
                const maxX = Math.max(...xs);
                if (maxX > oldW * 0.52) return;
                const sx = ARENA.width / oldW;
                const sy = ARENA.height / oldH;
                list.forEach((s) => {
                    if (Number.isFinite(s.x)) s.x = Math.round(s.x * sx * 10) / 10;
                    if (Number.isFinite(s.y)) s.y = Math.round(s.y * sy * 10) / 10;
                });
            })(raw.lastBattleSetup);
            raw.lastBattleSetup = snapshotArmySetup(raw.lastBattleSetup);
        }
        if (!Array.isArray(raw.roster)) {
            raw.roster = [...new Set([...STARTER_UNITS, ...raw.ownedUnits.map(ownedUnitId)])];
        }
        delete raw.formation;
        if (raw.map && Array.isArray(raw.map.nodes)) {
            raw.map.nodes.forEach((node) => {
                if (node.type === "trap") {
                    node.secretOutcome = node.secretOutcome || "trap";
                    node.type = "event";
                } else if (node.type === "event" && !node.secretOutcome) {
                    node.secretOutcome = "event";
                }
            });
        }
        raw.shopSession = null;
        if (!Array.isArray(raw.fallenUnits)) raw.fallenUnits = [];
        raw.fallenUnits = raw.fallenUnits.map((e) => ({
            uid: e.uid || null,
            id: e.id,
            star: e.star || 1,
            exp: e.exp || 0,
            name: e.name
        })).filter((e) => e.id);
        if (raw.endless == null) raw.endless = false;
        if (raw.endlessLoop == null) raw.endlessLoop = 0;
        if (raw.endlessStages == null) raw.endlessStages = 0;
        if (raw.endlessAutoRun == null) raw.endlessAutoRun = false;
        if (!Array.isArray(raw.activeContracts)) raw.activeContracts = [];
        if (!Array.isArray(raw.tacticUpgrades)) raw.tacticUpgrades = [];
        return raw;
    }

    function createNewRun(seed) {
        const s = seed ?? Date.now();
        const rng = global.WarMap.mulberry32(s);
        const run = {
            seed: s,
            phase: "map",
            worldIndex: 0,
            gold: 50,
            roster: [...STARTER_UNITS],
            unitUidSeq: 0,
            ownedUnits: [],
            fallenUnits: [],
            army: [],
            lastBattleSetup: null,
            artifacts: [],
            abilities: [],
            tacticUpgrades: [],
            activeContracts: [],
            tempBonuses: { atk: 0 },
            map: global.WarMap.generateMap(0, s),
            rngState: Math.floor(rng() * 1e9),
            runWon: false,
            runLost: false,
            endless: false,
            endlessLoop: 0,
            endlessStages: 0,
            endlessAutoRun: false
        };
        run.ownedUnits = defaultOwnedUnits(run);
        run.army = run.ownedUnits.map((e, i) => makeArmySlot(e.id, i, run.ownedUnits.length, e.star, e.uid));
        return run;
    }

    function getRng(state) {
        const rng = global.WarMap.mulberry32(state.rngState);
        state.rngState = Math.floor(rng() * 1e9);
        return rng;
    }

    function aggregateModifiers(state) {
        const m = {
            atkAll: state.tempBonuses.atk || 0,
            hpAll: 0,
            defAll: 0,
            spdMult: 1,
            moveSpeedMult: 1,
            goldMult: 1,
            healAfter: 0,
            lifesteal: 0,
            thorns: 0,
            bossDmg: 1,
            tankHp: 0,
            rangerAtk: 0,
            casterAtk: 0,
            warriorAtk: 0,
            assassinSpd: 1,
            healBoost: 1,
            skillCdMult: 1,
            lowHpAtk: 0,
            casterSkill: 1,
            critChance: 0,
            revive: 0,
            postBattleRevive: 0,
            startShield: 0,
            treasureMult: 1,
            trapReduce: 0,
            shopDiscount: 0,
            keepGold: 0,
            revealNext: false,
            goldAfter: 0,
            expMult: 1,
            expBonus: 0,
            forceEnemyAffix: null,
            rewardRarityBoost: 1,
            tacticMods: {
                focusDuration: 0,
                focusDmgBonus: 0,
                holdCleanse: false,
                holdTakenMult: 1,
                allOutFirstCrit: false,
                allOutDmgBonus: 0,
                tacticsCharges: 0
            },
            tagEffects: [],
            unitEffects: [],
            unitFindWeight: {},
            onlyFightTag: null,
            onlyFightTags: null,
            noSkills: false,
            atkMult: 1,
            hpMult: 1,
            dmgTakenMult: 1,
            rangeAll: 0,
            onHit: null
        };

        const SPECIAL_KEYS = new Set([
            "tag", "tags", "unit", "units", "findWeight",
            "onlyFightTag", "onlyFightTags", "multishot", "noSkills",
            "atkMult", "hpMult", "dmgTakenMult", "onHit",
            "forceEnemyAffix", "rewardRarityBoost"
        ]);

        function applyEffect(effect) {
            if (!effect) return;
            if (effect.onlyFightTag) m.onlyFightTag = effect.onlyFightTag;
            if (effect.onlyFightTags) {
                m.onlyFightTags = [...(m.onlyFightTags || []), ...effect.onlyFightTags];
            }
            if (effect.forceEnemyAffix) m.forceEnemyAffix = effect.forceEnemyAffix;
            if (effect.rewardRarityBoost) {
                m.rewardRarityBoost = (m.rewardRarityBoost || 1) * effect.rewardRarityBoost;
            }
            if (effect.noSkills) m.noSkills = true;
            if (effect.atkMult) m.atkMult *= effect.atkMult;
            if (effect.hpMult) m.hpMult *= effect.hpMult;
            if (effect.dmgTakenMult) m.dmgTakenMult *= effect.dmgTakenMult;
            if (effect.onHit && !(effect.tag || effect.tags || effect.unit || effect.units)) {
                // Keep different types as separate procs; same type stacks chance
                const adds = Array.isArray(effect.onHit) ? effect.onHit : [effect.onHit];
                if (!Array.isArray(m.onHit)) m.onHit = m.onHit ? [m.onHit] : [];
                adds.forEach((add) => {
                    if (!add || !add.type) return;
                    const idx = m.onHit.findIndex((e) => e.type === add.type);
                    if (idx < 0) {
                        m.onHit.push({ ...add });
                        return;
                    }
                    const cur = m.onHit[idx];
                    m.onHit[idx] = {
                        ...cur,
                        ...add,
                        chance: Math.min(1, (cur.chance || 0) + (add.chance || 0))
                    };
                });
                if (!m.onHit.length) m.onHit = null;
            }

            // Unit-specific bonuses (+ optional recruit weight)
            if (effect.unit || effect.units) {
                m.unitEffects.push({ ...effect });
                const ids = effect.units || [effect.unit];
                const fw = effect.findWeight != null ? effect.findWeight : 2.5;
                ids.forEach((uid) => {
                    if (!uid) return;
                    m.unitFindWeight[uid] = (m.unitFindWeight[uid] || 1) * fw;
                });
                return;
            }

            // Tag-targeted bonuses (apply only to units with matching tags)
            if (effect.tag || effect.tags) {
                m.tagEffects.push({ ...effect });
                return;
            }
            Object.keys(effect).forEach((key) => {
                if (SPECIAL_KEYS.has(key)) return;
                if (key === "revealNext") {
                    m.revealNext = m.revealNext || !!effect[key];
                } else if (key === "healAfter" || key === "goldAfter") {
                    m.goldAfter += effect[key];
                } else if (key === "commanderHp") {
                    m.hpAll += effect[key];
                } else if (key === "spdMult" || key === "goldMult" || key === "assassinSpd" ||
                    key === "healBoost" || key === "skillCdMult" || key === "casterSkill" ||
                    key === "bossDmg" || key === "treasureMult" || key === "moveSpeedMult" ||
                    key === "expMult") {
                    m[key] *= effect[key];
                } else if (key === "trapReduce" || key === "shopDiscount" || key === "keepGold" ||
                    key === "lifesteal" || key === "thorns" || key === "lowHpAtk" || key === "critChance" ||
                    key === "revive" || key === "startShield") {
                    m[key] = Math.max(m[key], effect[key]);
                } else if (key === "postBattleRevive" || key === "expBonus") {
                    m[key] += effect[key];
                } else if (typeof m[key] === "number") {
                    m[key] += effect[key];
                }
            });
        }

        state.artifacts.forEach((id) => {
            const art = ARTIFACTS.find((a) => a.id === id);
            if (art) applyEffect(art.effect);
        });
        state.abilities.forEach((id) => {
            const ab = ABILITIES.find((a) => a.id === id);
            if (ab) applyEffect(ab.effect);
        });
        (state.activeContracts || []).forEach((c) => {
            if (c && c.effect) applyEffect(c.effect);
        });
        (state.tacticUpgrades || []).forEach((id) => {
            const up = (TACTIC_UPGRADES || []).find((t) => t.id === id);
            if (!up || !up.effect) return;
            const e = up.effect;
            const tm = m.tacticMods;
            if (e.focusDuration) tm.focusDuration += e.focusDuration;
            if (e.focusDmgBonus) tm.focusDmgBonus += e.focusDmgBonus;
            if (e.holdCleanse) tm.holdCleanse = true;
            if (e.holdTakenMult) tm.holdTakenMult *= e.holdTakenMult;
            if (e.allOutFirstCrit) tm.allOutFirstCrit = true;
            if (e.allOutDmgBonus) tm.allOutDmgBonus += e.allOutDmgBonus;
            if (e.tacticsCharges) tm.tacticsCharges += e.tacticsCharges;
        });

        // Legacy role fields → tag effects (compat); clear globals so they are not double-applied
        if (m.tankHp) m.tagEffects.push({ tag: "tank", hp: m.tankHp });
        if (m.rangerAtk) m.tagEffects.push({ tag: "ranger", atk: m.rangerAtk });
        if (m.casterAtk) m.tagEffects.push({ tag: "caster", atk: m.casterAtk });
        if (m.warriorAtk) m.tagEffects.push({ tag: "warrior", atk: m.warriorAtk });
        if (m.assassinSpd && m.assassinSpd !== 1) m.tagEffects.push({ tag: "assassin", spdMult: m.assassinSpd });
        if (m.casterSkill && m.casterSkill !== 1) {
            m.tagEffects.push({ tag: "arcane", skillPower: m.casterSkill });
            m.casterSkill = 1;
        }

        return m;
    }

    function pickRandom(pool, count, rng, exclude) {
        const avail = pool.filter((x) => !(exclude || []).includes(x.id || x));
        const picks = [];
        for (let i = 0; i < count && avail.length; i++) {
            const idx = Math.floor(rng() * avail.length);
            picks.push(avail.splice(idx, 1)[0]);
        }
        return picks;
    }

    function rarityWeight(rarity, state, forBoss) {
        if (rarity === "unique") return 0;
        const base = (RARITY[rarity] && RARITY[rarity].weight) || 10;
        const worldBoost = difficultyWorldIndex(state) * 0.35;
        const bossBoost = forBoss ? 0.8 : 0;
        const order = (RARITY[rarity] && RARITY[rarity].order) || 1;
        let w = base * (1 + worldBoost * (order - 1) * 0.4 + bossBoost * (order - 1) * 0.35);
        if (order >= 3 && state) {
            const boost = aggregateModifiers(state).rewardRarityBoost || 1;
            if (boost > 1) w *= boost;
        }
        return w;
    }

    function pickWeightedByRarity(pool, count, rng, exclude, state, forBoss) {
        const avail = filterRandomPool(pool).filter((x) => !(exclude || []).includes(x.id));
        const findW = state ? (aggregateModifiers(state).unitFindWeight || {}) : {};
        const picks = [];
        for (let i = 0; i < count && avail.length; i++) {
            const weights = avail.map((item) => {
                let w = rarityWeight(item.rarity || "common", state, forBoss);
                if (findW[item.id]) w *= findW[item.id];
                return Math.max(0, w);
            });
            const total = weights.reduce((s, w) => s + w, 0);
            if (total <= 0) break;
            let roll = rng() * total;
            let idx = avail.length - 1;
            for (let j = 0; j < avail.length; j++) {
                roll -= weights[j];
                if (roll <= 0) {
                    idx = j;
                    break;
                }
            }
            picks.push(avail.splice(idx, 1)[0]);
        }
        return picks;
    }

    function pickWeightedUnitId(poolIds, rng, state) {
        const ids = filterRandomPool(poolIds || []).filter(Boolean);
        if (!ids.length) return null;
        const findW = state ? (aggregateModifiers(state).unitFindWeight || {}) : {};
        const weights = ids.map((id) => {
            const rarity = (UNITS[id] && UNITS[id].rarity) || "common";
            return Math.max(0, rarityWeight(rarity, state, false) * (findW[id] || 1));
        });
        const total = weights.reduce((s, w) => s + w, 0);
        if (total <= 0) return null;
        let roll = rng() * total;
        for (let i = 0; i < ids.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return ids[i];
        }
        return ids[ids.length - 1];
    }

    function toRewardOffer(item, kind) {
        const rarity = item.rarity || "common";
        if (kind === "unit") {
            const rangeText = item.range === "ranged" ? "遠程" : "近戰";
            const roleMap = {
                tank: "坦克", warrior: "戰士", ranger: "射手", caster: "法師",
                support: "輔助", assassin: "刺客", elite: "精英"
            };
            const roleText = roleMap[item.role] || item.role || "單位";
            const skillBit = item.skill
                ? `${item.skill.name}${item.skill.castTime != null ? `（施法 ${item.skill.castTime}s）` : ""}`
                : "無技能";
            return {
                kind: "unit",
                id: item.id,
                name: `${item.icon || ""} ${item.name}`.trim(),
                desc: `${roleText} · ${rangeText} · HP ${item.hp} / 攻 ${item.atk} / 防 ${item.def} / 攻速 ${item.spd} · ${skillBit}`,
                rarity,
                rarityLabel: (RARITY[rarity] && RARITY[rarity].label) || rarity
            };
        }
        return {
            kind,
            id: item.id,
            name: item.name,
            desc: item.desc,
            rarity,
            rarityLabel: (RARITY[rarity] && RARITY[rarity].label) || rarity,
            cursed: !!item.cursed
        };
    }

    function availableTacticUpgrades(state, excludeIds) {
        const owned = new Set(state.tacticUpgrades || []);
        const extra = new Set(excludeIds || []);
        return (TACTIC_UPGRADES || []).filter((t) => !owned.has(t.id) && !extra.has(t.id));
    }

    /** Chance to swap one reward slot for a tactic upgrade card. */
    function maybeMixTacticUpgrade(offers, state, rng, excludeIds) {
        const list = offers || [];
        if (!list.length) return list;
        const avail = availableTacticUpgrades(state, excludeIds);
        if (!avail.length) return list;
        if (rng() > 0.3) return list;
        const pick = avail[Math.floor(rng() * avail.length)];
        const idx = Math.floor(rng() * list.length);
        list[idx] = toRewardOffer(pick, "tactic");
        return list;
    }

    function offerRewards(state, type, excludeIds) {
        const rng = getRng(state);
        const extra = excludeIds || [];
        const node = state.map && global.WarMap
            ? global.WarMap.getNode(state.map, state.map.currentNodeId)
            : null;
        const forBoss = node?.type === "boss";
        if (type === "tactic") {
            const avail = availableTacticUpgrades(state, extra);
            return pickWeightedByRarity(avail, 3, rng, extra, state, forBoss)
                .map((t) => toRewardOffer(t, "tactic"));
        }
        if (type === "artifact") {
            return maybeMixTacticUpgrade(
                pickWeightedByRarity(randomArtifactPool(), 3, rng, [...state.artifacts, ...extra], state, forBoss)
                    .map((a) => toRewardOffer(a, "artifact")),
                state, rng, extra
            );
        }
        if (type === "ability") {
            return maybeMixTacticUpgrade(
                pickWeightedByRarity(ABILITIES, 3, rng, [...state.abilities, ...extra], state, forBoss)
                    .map((a) => toRewardOffer(a, "ability")),
                state, rng, extra
            );
        }
        if (type === "unit") {
            return offerUnitRewards(state, 3, { minOrder: 1, excludeIds: extra });
        }
        if (type === "epic") {
            return maybeMixTacticUpgrade(offerEpicRewards(state, extra), state, rng, extra);
        }
        return maybeMixTacticUpgrade(
            pickWeightedByRarity(ABILITIES, 3, rng, [...state.abilities, ...extra], state, forBoss)
                .map((a) => toRewardOffer(a, "ability")),
            state, rng, extra
        );
    }

    function unitPoolDefs(minOrder) {
        const min = minOrder || 1;
        return playerUnitPool()
            .map((id) => UNITS[id])
            .filter((u) => u && ((RARITY[u.rarity || "common"]?.order) || 1) >= min)
            .filter((u) => u.rarity !== "unique");
    }

    function offerUnitRewards(state, count, opts) {
        const rng = getRng(state);
        const pool = unitPoolDefs(opts?.minOrder || 1);
        return pickWeightedByRarity(pool, count || 3, rng, opts?.excludeIds || [], state, false)
            .map((u) => toRewardOffer(u, "unit"));
    }

    /** High-rarity mix: unit / artifact / ability (rare+). Unique excluded. */
    function offerEpicRewards(state, excludeIds) {
        const rng = getRng(state);
        const extra = excludeIds || [];
        const minOrder = 3; // rare+
        const combined = [];
        ARTIFACTS.forEach((a) => {
            if (a.rarity === "unique" || a.cursed) return;
            if (state.artifacts.includes(a.id) || extra.includes(a.id)) return;
            if (((RARITY[a.rarity]?.order) || 1) < minOrder) return;
            combined.push({ ...a, _kind: "artifact" });
        });
        ABILITIES.forEach((a) => {
            if (a.rarity === "unique") return;
            if (state.abilities.includes(a.id) || extra.includes(a.id)) return;
            if (((RARITY[a.rarity]?.order) || 1) < minOrder) return;
            combined.push({ ...a, _kind: "ability" });
        });
        unitPoolDefs(minOrder).forEach((u) => {
            if (extra.includes(u.id)) return;
            combined.push({ ...u, _kind: "unit" });
        });
        if (!combined.length) {
            return offerUnitRewards(state, 3, { minOrder: 1, excludeIds: extra });
        }
        return pickWeightedByRarity(combined, 3, rng, extra, state, true)
            .map((item) => toRewardOffer(item, item._kind || "artifact"));
    }

    function grantAbility(state, abilityId) {
        if (!abilityId) return { ok: false, message: "無效能力" };
        const ab = ABILITIES.find((a) => a.id === abilityId);
        if (!ab) return { ok: false, message: "找不到能力" };
        if (!state.abilities) state.abilities = [];
        if (state.abilities.includes(abilityId)) {
            return { ok: false, message: `已擁有能力：${ab.name}` };
        }
        state.abilities.push(abilityId);
        return { ok: true, message: `獲得能力：${ab.name}`, id: abilityId };
    }

    function grantUnitForced(state, unitId) {
        if (!unitId || !UNITS[unitId]) return { ok: false, message: "無效單位" };
        const res = recruitUnit(state, unitId);
        const name = UNITS[unitId].name;
        return { ok: !!res?.id, message: res?.id ? `獲得單位：${name}` : "無法獲得單位", id: unitId };
    }

    /** Apply artifact/ability grant payloads (unique unit/ability etc.). */
    function applyItemGrants(state, item) {
        const messages = [];
        if (!item || !item.grant) return messages;
        if (item.grant.unit) {
            const g = grantUnitForced(state, item.grant.unit);
            messages.push(g.message);
        }
        if (item.grant.ability) {
            const g = grantAbility(state, item.grant.ability);
            messages.push(g.message);
        }
        return messages;
    }

    /** Random unique unit or ability not yet owned. */
    function grantRandomUnique(state) {
        const rng = getRng(state);
        const unitOpts = playerUnitPool({ includeUnique: true })
            .filter((id) => UNITS[id]?.rarity === "unique");
        const abOpts = ABILITIES.filter((a) => a.rarity === "unique" && !(state.abilities || []).includes(a.id));
        const ownedUnitIds = new Set(normalizeOwnedList(state.ownedUnits, state).map((o) => o.id));
        const freshUnits = unitOpts.filter((id) => !ownedUnitIds.has(id));
        const choices = [];
        freshUnits.forEach((id) => choices.push({ kind: "unit", id }));
        abOpts.forEach((a) => choices.push({ kind: "ability", id: a.id }));
        if (!choices.length) return { ok: false, message: "已集齊所有唯一單位與能力" };
        const pick = choices[Math.floor(rng() * choices.length)];
        if (pick.kind === "unit") return grantUnitForced(state, pick.id);
        return grantAbility(state, pick.id);
    }

    function applyReward(state, reward) {
        let merged = [];
        const grantMsgs = [];
        if (reward.kind === "unit") {
            const res = recruitUnit(state, reward.id);
            if (res && res.merged) merged = res.merged;
        } else if (reward.kind === "artifact" && !state.artifacts.includes(reward.id)) {
            state.artifacts.push(reward.id);
            const art = ARTIFACTS.find((a) => a.id === reward.id);
            grantMsgs.push(...applyItemGrants(state, art));
        } else if (reward.kind === "ability" && !state.abilities.includes(reward.id)) {
            state.abilities.push(reward.id);
        } else if (reward.kind === "tactic") {
            if (!Array.isArray(state.tacticUpgrades)) state.tacticUpgrades = [];
            if (!state.tacticUpgrades.includes(reward.id)) {
                state.tacticUpgrades.push(reward.id);
                grantMsgs.push(`學會戰術升級：${reward.name}`);
            }
        }
        aggregateModifiers(state);
        return { merged, grantMessages: grantMsgs };
    }

    function addGold(state, amount) {
        const mods = aggregateModifiers(state);
        state.gold += Math.floor(amount * mods.goldMult);
    }

    function spendGold(state, amount) {
        const mods = aggregateModifiers(state);
        const price = Math.floor(amount * (1 - mods.shopDiscount));
        if (state.gold < price) return false;
        state.gold -= price;
        return true;
    }

    function recruitUnit(state, forcedId) {
        const rng = getRng(state);
        const pool = playerUnitPool();
        const allPool = playerUnitPool({ includeUnique: true });
        let id = forcedId && allPool.includes(forcedId) ? forcedId : null;
        if (!id) {
            const ownedIds = new Set(normalizeOwnedList(state.ownedUnits, state).map((o) => o.id));
            const fresh = pool.filter((uid) => !ownedIds.has(uid));
            const pickFrom = fresh.length ? fresh : pool;
            id = pickWeightedUnitId(pickFrom, rng, state) || pickFrom[Math.floor(rng() * pickFrom.length)];
        }
        if (!id) return { id: null, merged: [] };
        if (!state.ownedUnits) state.ownedUnits = [];
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const unit = makeOwnedUnit(state, id, 1, 0);
        state.ownedUnits.push(unit);
        if (!state.roster.includes(id)) state.roster.push(id);
        if (!Array.isArray(state.army)) state.army = [];
        appendArmyUnit(state.army, id, 1, unit.uid);
        return { id, uid: unit.uid, merged: [] };
    }

    function unitHasTagId(unitId, tag) {
        const def = UNITS[unitId];
        if (!def || !tag) return false;
        if (def.role === tag || def.range === tag) return true;
        return Array.isArray(def.tags) && def.tags.includes(tag);
    }

    function recruitUnitByTag(state, tag) {
        const rng = getRng(state);
        const pool = playerUnitPool().filter((id) => unitHasTagId(id, tag));
        if (!pool.length) return { id: null, merged: [] };
        const id = pickWeightedUnitId(pool, rng, state) || pool[Math.floor(rng() * pool.length)];
        return recruitUnit(state, id);
    }

    /** Event-only: fuse two same-id same-star units into one higher star. */
    function mergeUnits(state) {
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const owned = state.ownedUnits;
        const buckets = {};
        owned.forEach((u, i) => {
            if (u.star >= STAR_CAP) return;
            const key = `${u.id}@@${u.star}`;
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(i);
        });
        let pickKey = null;
        for (const key of Object.keys(buckets)) {
            if (buckets[key].length >= 2) {
                pickKey = key;
                break;
            }
        }
        if (!pickKey) return { ok: false, message: "需要兩名同種、同星級的單位才能融合" };

        const idxs = buckets[pickKey];
        const i1 = idxs[0];
        const i2 = idxs[1];
        const a = owned[i1];
        const b = owned[i2];
        const hi = Math.max(i1, i2);
        const lo = Math.min(i1, i2);
        owned.splice(hi, 1);
        owned.splice(lo, 1);

        const nextStar = clampStar((a.star || 1) + 1);
        const kept = makeOwnedUnit(state, a.id, nextStar, 0);
        owned.push(kept);

        const dropUids = new Set([a.uid, b.uid]);
        state.army = (state.army || []).filter((s) => !dropUids.has(armyUnitUid(s)));
        appendArmyUnit(state.army, kept.id, kept.star, kept.uid);
        state.army = clampArmyToOwned(state.ownedUnits, state.army);
        if (Array.isArray(state.lastBattleSetup)) {
            state.lastBattleSetup = clampArmyToOwned(state.ownedUnits, state.lastBattleSetup);
        }

        const name = UNITS[kept.id]?.name || kept.id;
        return {
            ok: true,
            message: `融合成功：${name} 升至 ★${nextStar}`,
            id: kept.id,
            star: nextStar,
            uid: kept.uid
        };
    }

    /** Auto-merge removed — kept as no-op for save compat. */
    function autoMergeStars() {
        return [];
    }

    /**
     * Add EXP to one owned unit and apply level-ups.
     * @returns {{ messages: string[], leveled: boolean, name: string|null }}
     */
    function applyExpToOwnedEntry(state, ownedEntry, amount) {
        const messages = [];
        if (!ownedEntry || !(amount > 0) || ownedEntry.star >= STAR_CAP) {
            return { messages, leveled: false, name: null };
        }
        const name = UNITS[ownedEntry.id]?.name || ownedEntry.id;
        ownedEntry.exp = (ownedEntry.exp || 0) + amount;
        let leveled = false;
        let guard = 0;
        while (ownedEntry.star < STAR_CAP && guard++ < STAR_CAP) {
            const need = expNeededForStar(ownedEntry.star);
            if (need == null || ownedEntry.exp < need) break;
            ownedEntry.exp -= need;
            ownedEntry.star = clampStar(ownedEntry.star + 1);
            leveled = true;
            messages.push(`${name} 經驗滿溢，升至 ★${ownedEntry.star}`);
            (state.army || []).forEach((slot) => {
                if (armyUnitUid(slot) === ownedEntry.uid) slot.star = ownedEntry.star;
            });
            if (Array.isArray(state.lastBattleSetup)) {
                state.lastBattleSetup.forEach((slot) => {
                    if (armyUnitUid(slot) === ownedEntry.uid) slot.star = ownedEntry.star;
                });
            }
        }
        return { messages, leveled, name };
    }

    /**
     * Grant EXP to surviving deployed units after a won battle.
     * Levels up when EXP is full (does not consume other units).
     */
    function grantBattleExp(state, battleUnits, opts) {
        const base = (opts && opts.amount) != null ? opts.amount : 1;
        const mods = aggregateModifiers(state);
        const amount = Math.max(0, Math.round(base * (mods.expMult || 1)) + (mods.expBonus || 0));
        const messages = [];
        if (!amount) return messages;
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const survivors = new Set();
        (battleUnits || []).forEach((u) => {
            if (!u || u.side !== "player" || !u.alive || u.temporary) return;
            if (u.ownedUid) survivors.add(u.ownedUid);
        });
        const byUid = {};
        state.ownedUnits.forEach((o) => { byUid[o.uid] = o; });

        survivors.forEach((uid) => {
            const o = byUid[uid];
            if (!o) return;
            const res = applyExpToOwnedEntry(state, o, amount);
            messages.push(...res.messages);
        });
        return messages;
    }

    /** Shop / event: give EXP to one random non-max-star owned unit. */
    function grantShopExp(state, amount) {
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const pool = state.ownedUnits.filter((o) => o.star < STAR_CAP);
        if (!pool.length) return { ok: false, message: "所有單位已滿星" };
        const rng = getRng(state);
        const target = pool[Math.floor(rng() * pool.length)];
        const res = applyExpToOwnedEntry(state, target, amount);
        const name = res.name || UNITS[target.id]?.name || target.id;
        let message = `${name} 獲得 ${amount} 點經驗`;
        if (res.messages.length) message += `（${res.messages.join("；")}）`;
        return { ok: true, message, name, amount };
    }

    const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3 };

    function replaceOneArmySlot(list, fromUid, fromId, toId, toUid) {
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) {
            const matchUid = fromUid && armyUnitUid(list[i]) === fromUid;
            const matchId = !fromUid && armyUnitId(list[i]) === fromId;
            if (!matchUid && !matchId) continue;
            if (typeof list[i] === "string") {
                list[i] = { id: toId, star: 1, uid: toUid || null };
            } else {
                list[i].id = toId;
                if (toUid) list[i].uid = toUid;
            }
            return;
        }
    }

    /** Convert one owned unit into a different player unit. */
    function convertUnit(state, opts) {
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const owned = state.ownedUnits;
        if (!owned.length) return null;
        const rng = getRng(state);
        const idx = Math.floor(rng() * owned.length);
        const from = owned[idx];
        const fromId = from.id;
        const pool = playerUnitPool().filter((id) => id !== fromId);
        if (!pool.length) return null;

        let candidates = pool;
        if (opts && opts.upgrade) {
            const fromRank = RARITY_RANK[UNITS[fromId]?.rarity] || 0;
            const better = pool.filter((id) => (RARITY_RANK[UNITS[id]?.rarity] || 0) > fromRank);
            const sameOrBetter = pool.filter((id) => (RARITY_RANK[UNITS[id]?.rarity] || 0) >= fromRank);
            candidates = better.length ? better : (sameOrBetter.length ? sameOrBetter : pool);
        }
        const toId = candidates[Math.floor(rng() * candidates.length)];
        owned[idx] = {
            uid: from.uid,
            id: toId,
            star: from.star || 1,
            exp: from.exp || 0
        };
        if (!state.roster) state.roster = [];
        if (!state.roster.includes(toId)) state.roster.push(toId);
        replaceOneArmySlot(state.army, from.uid, fromId, toId, from.uid);
        replaceOneArmySlot(state.lastBattleSetup, from.uid, fromId, toId, from.uid);
        return { fromId, toId };
    }

    function sacrificeRandomUnit(state) {
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        if (!state.ownedUnits.length) return null;
        const rng = getRng(state);
        const idx = Math.floor(rng() * state.ownedUnits.length);
        const removed = state.ownedUnits.splice(idx, 1)[0];
        if (Array.isArray(state.army)) {
            const ai = state.army.findIndex((s) => armyUnitUid(s) === removed.uid);
            const ai2 = ai !== -1 ? ai : state.army.findIndex((s) =>
                armyUnitId(s) === removed.id && armyUnitStar(s) === removed.star
            );
            if (ai2 !== -1) state.army.splice(ai2, 1);
        }
        state.army = clampArmyToOwned(state.ownedUnits, state.army || []);
        return removed;
    }

    function computeSynergies(army) {
        const counts = {};
        (army || []).forEach((entry) => {
            const def = UNITS[armyUnitId(entry)];
            if (!def) return;
            const tags = new Set([...(def.tags || []), def.role, def.range].filter(Boolean));
            tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
        });
        const active = [];
        (SYNERGIES || []).forEach((syn) => {
            if ((counts[syn.tag] || 0) >= syn.count) active.push(syn);
        });
        // Keep highest count per tag only
        const best = {};
        active.forEach((s) => {
            if (!best[s.tag] || s.count > best[s.tag].count) best[s.tag] = s;
        });
        return Object.values(best);
    }

    function pickTerrain(state) {
        const rng = getRng(state);
        const list = TERRAINS || [];
        if (!list.length) return null;
        return list[Math.floor(rng() * list.length)];
    }

    function rollEliteAffix(rng, worldIndex) {
        const list = ELITE_AFFIXES || [];
        if (!list.length) return null;
        const chance = 0.18 + Math.min(0.25, (worldIndex || 0) * 0.08);
        if (rng() > chance) return null;
        return list[Math.floor(rng() * list.length)].id;
    }

    function treasureBonusGold(state) {
        const rng = getRng(state);
        const mods = aggregateModifiers(state);
        return Math.floor((8 + rng() * 12) * mods.treasureMult);
    }

    /** Fallback when every artifact is already owned. */
    function resolveTreasure(state) {
        const rng = getRng(state);
        const mods = aggregateModifiers(state);
        const gold = Math.floor((40 + rng() * 35) * mods.treasureMult);
        addGold(state, gold);
        return { type: "gold", amount: gold, text: `神器已集齊，改為獲得 ${gold} 金幣！` };
    }

    function resolveTrap(state) {
        const rng = getRng(state);
        const trap = TRAPS[Math.floor(rng() * TRAPS.length)];
        const mods = aggregateModifiers(state);
        const raw = Math.floor(trap.damage * 1.5 * (1 - (mods.trapReduce || 0)));
        const goldLost = Math.min(state.gold, Math.max(0, raw));
        state.gold -= goldLost;
        return { trap, goldLost, combat: !!trap.combat };
    }

    function resolveEvent(state, eventId) {
        return EVENTS.find((e) => e.id === eventId) || EVENTS[Math.floor(getRng(state)() * EVENTS.length)];
    }

    function applyEventChoice(state, event, choiceIndex) {
        const choice = event.choices[choiceIndex];
        const result = { messages: [] };
        if (!choice) return result;

        let goldCost = choice.cost?.gold || 0;
        if (choice.cost?.hp) goldCost += choice.cost.hp * 2;
        if (goldCost && !spendGold(state, goldCost)) {
            result.messages.push("金幣不足！");
            return result;
        }

        const r = choice.reward || {};
        if (r.hp) {
            const g = r.hp * 2;
            addGold(state, g);
            result.messages.push(`獲得 ${g} 金幣`);
        }
        if (r.gold) { addGold(state, r.gold); result.messages.push(`獲得 ${r.gold} 金幣`); }
        if (r.tempAtk) { state.tempBonuses.atk += r.tempAtk; result.messages.push("部隊攻擊提升"); }
        if (r.artifact) {
            const rng = getRng(state);
            const arts = pickWeightedByRarity(randomArtifactPool(), 1, rng, state.artifacts, state, false);
            if (arts.length) {
                state.artifacts.push(arts[0].id);
                result.messages.push(`獲得神器：${arts[0].name}`);
                applyItemGrants(state, arts[0]).forEach((m) => result.messages.push(m));
            }
        }
        if (r.ability) {
            const rng = getRng(state);
            const abs = pickRandom(filterRandomPool(ABILITIES), 1, rng, state.abilities);
            if (abs.length) {
                state.abilities.push(abs[0].id);
                result.messages.push(`獲得能力：${abs[0].name}`);
            }
        }
        if (r.recruit) {
            const res = recruitUnit(state);
            const id = res && res.id;
            result.messages.push(id ? `招募 ${UNITS[id].name}` : "沒有可招募單位");
        }
        if (r.recruitTag) {
            const res = recruitUnitByTag(state, r.recruitTag);
            const id = res && res.id;
            const tagLabel = (TAGS[r.recruitTag] && TAGS[r.recruitTag].label) || r.recruitTag;
            result.messages.push(id
                ? `招募 [${tagLabel}] 單位：${UNITS[id].name}`
                : `沒有可招募的 [${tagLabel}] 單位`);
        }
        if (r.mergeUnits) {
            const res = mergeUnits(state);
            result.messages.push(res.message || (res.ok ? "融合完成" : "融合失敗"));
        }
        if (r.uniqueGrant) {
            const g = grantRandomUnique(state);
            result.messages.push(g.message);
        }
        if (r.grantUnit) {
            const g = grantUnitForced(state, r.grantUnit);
            result.messages.push(g.message);
        }
        if (r.grantAbility) {
            const g = grantAbility(state, r.grantAbility);
            result.messages.push(g.message);
        }
        if (r.sacrificeUnit) {
            const removed = sacrificeRandomUnit(state);
            if (removed) {
                const name = UNITS[removed.id]?.name || removed.id;
                result.messages.push(`獻祭了 ★${removed.star || 1} ${name}`);
            } else {
                result.messages.push("沒有可獻祭的單位");
            }
        }
        if (r.cursedArtifact) {
            const rng = getRng(state);
            const cursed = ARTIFACTS.filter((a) => a.cursed && !state.artifacts.includes(a.id));
            const pool = cursed.length ? cursed : ARTIFACTS.filter((a) => !state.artifacts.includes(a.id));
            const arts = pickWeightedByRarity(pool, 1, rng, state.artifacts, state, false);
            if (arts.length) {
                state.artifacts.push(arts[0].id);
                result.messages.push(`獲得詛咒神器：${arts[0].name}`);
                applyItemGrants(state, arts[0]).forEach((m) => result.messages.push(m));
            } else {
                result.messages.push("沒有可獲得的詛咒神器");
            }
        }
        if (r.epicReward) {
            const offers = offerEpicRewards(state);
            if (offers.length) {
                applyReward(state, offers[0]);
                result.messages.push(`獲得 ${offers[0].name}`);
            }
        }
        if (r.convert) {
            const converted = convertUnit(state, { upgrade: !!r.convertUpgrade });
            if (converted) {
                const fromName = UNITS[converted.fromId]?.name || converted.fromId;
                const toName = UNITS[converted.toId]?.name || converted.toId;
                result.messages.push(`${fromName} 轉化為 ${toName}`);
            } else {
                result.messages.push("沒有可轉化的單位");
            }
        }
        if (r.reviveFallen) {
            const fallen = state.fallenUnits || [];
            if (!fallen.length) {
                result.messages.push("沒有陣亡單位可復活");
            } else {
                const costMult = r.reviveCostMult != null ? r.reviveCostMult : 0.4;
                const res = recoverFallenUnit(state, fallen.length - 1, { costMult });
                result.messages.push(res.message);
            }
        }
        if (r.gamble) {
            const rng = getRng(state);
            if (rng() < 0.5) {
                const arts = pickWeightedByRarity(randomArtifactPool(), 1, rng, state.artifacts, state, false);
                if (arts.length) {
                    state.artifacts.push(arts[0].id);
                    result.messages.push(`賭贏了！獲得 ${arts[0].name}`);
                    applyItemGrants(state, arts[0]).forEach((m) => result.messages.push(m));
                }
            } else {
                const lost = Math.min(state.gold, 20);
                state.gold -= lost;
                result.messages.push(`賭輸了，失去 ${lost} 金幣`);
            }
        }
        if (r.contract) {
            const added = addContract(state, r.contract);
            result.messages.push(added.message);
        }
        aggregateModifiers(state);
        return result;
    }

    function addContract(state, contract) {
        if (!contract || !contract.id) return { ok: false, message: "無效契約" };
        if (!Array.isArray(state.activeContracts)) state.activeContracts = [];
        // Replace same id if already active
        state.activeContracts = state.activeContracts.filter((c) => c.id !== contract.id);
        const entry = {
            id: contract.id,
            name: contract.name || contract.id,
            desc: contract.desc || "",
            roomsLeft: Math.max(1, contract.rooms || 2),
            effect: { ...(contract.effect || {}) }
        };
        state.activeContracts.push(entry);
        return {
            ok: true,
            message: `簽訂「${entry.name}」（剩餘 ${entry.roomsLeft} 場戰鬥）`
        };
    }

    /** Decrement contracts after a combat room is cleared. */
    function tickContracts(state, opts) {
        if (!state || !Array.isArray(state.activeContracts) || !state.activeContracts.length) {
            return { expired: [] };
        }
        const combatOnly = !(opts && opts.anyRoom);
        // Always tick on combat clears (default); callers pass combat flag
        if (combatOnly && opts && opts.isCombat === false) return { expired: [] };
        const expired = [];
        state.activeContracts = state.activeContracts.filter((c) => {
            c.roomsLeft = (c.roomsLeft || 1) - 1;
            if (c.roomsLeft > 0) return true;
            expired.push(c);
            return false;
        });
        aggregateModifiers(state);
        return { expired };
    }

    function afterCombat(state, won) {
        if (state && state.endless) {
            // Endless: no gold / retreat payout — pure stage climb
            return { won: !!won, retreated: false };
        }
        const mods = aggregateModifiers(state);
        if (won) {
            const rng = getRng(state);
            addGold(state, 20 + Math.floor(rng() * 15));
            if (mods.goldAfter) addGold(state, mods.goldAfter);
            return { won: true, retreated: false };
        }
        const keep = mods.keepGold || 0;
        if (keep > 0) {
            const before = state.gold;
            state.gold = Math.floor(state.gold * keep);
            return { won: false, retreated: true, goldKept: state.gold, goldLost: before - state.gold };
        }
        return { won: false, retreated: false };
    }

    /** Remove permanently dead deployed units from owned roster (one instance each). */
    function applyBattleCasualties(state, battleUnits) {
        const lost = [];
        const revived = [];
        if (!Array.isArray(state.fallenUnits)) state.fallenUnits = [];
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        (battleUnits || []).forEach((u) => {
            if (!u || u.side !== "player" || u.alive || u.temporary) return;
            const id = u.unitId;
            if (!id) return;
            let idx = -1;
            if (u.ownedUid) idx = state.ownedUnits.findIndex((o) => o.uid === u.ownedUid);
            if (idx === -1) idx = state.ownedUnits.findIndex((o) => o.id === id && o.star === (u.star || 1));
            if (idx === -1) idx = state.ownedUnits.findIndex((o) => o.id === id);
            if (idx === -1) return;
            const removed = state.ownedUnits.splice(idx, 1)[0];
            const entry = {
                uid: removed.uid,
                id,
                star: removed.star || 1,
                exp: removed.exp || 0,
                name: u.name || (UNITS[id] && UNITS[id].name) || id
            };
            lost.push(entry);
            state.fallenUnits.push(entry);
        });

        const mods = aggregateModifiers(state);
        const reviveSlots = Math.max(0, Math.floor(mods.postBattleRevive || 0));
        for (let i = 0; i < reviveSlots && lost.length; i++) {
            const entry = lost.pop();
            let removeAt = -1;
            for (let j = state.fallenUnits.length - 1; j >= 0; j--) {
                if ((entry.uid && state.fallenUnits[j].uid === entry.uid)
                    || state.fallenUnits[j].id === entry.id) {
                    removeAt = j;
                    break;
                }
            }
            if (removeAt !== -1) state.fallenUnits.splice(removeAt, 1);
            if (!state.ownedUnits) state.ownedUnits = [];
            state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
            const restored = {
                uid: entry.uid || nextOwnedUid(state),
                id: entry.id,
                star: entry.star || 1,
                exp: entry.exp || 0
            };
            state.ownedUnits.push(restored);
            if (!state.roster) state.roster = [];
            if (!state.roster.includes(entry.id)) state.roster.push(entry.id);
            if (!Array.isArray(state.army)) state.army = [];
            appendArmyUnit(state.army, restored.id, restored.star, restored.uid);
            revived.push(entry);
        }

        state.army = clampArmyToOwned(state.ownedUnits || [], state.army || []);
        if (Array.isArray(state.lastBattleSetup)) {
            state.lastBattleSetup = clampArmyToOwned(state.ownedUnits || [], state.lastBattleSetup);
        }
        return { lost, revived };
    }

    function reviveCostForUnit(unitId, costMult) {
        const def = UNITS[unitId];
        const rarity = (def && def.rarity) || "common";
        const base = { common: 28, uncommon: 42, rare: 65, epic: 95, legendary: 120, unique: 140 };
        const raw = base[rarity] != null ? base[rarity] : 40;
        const mult = costMult != null ? costMult : 1;
        return Math.max(1, Math.floor(raw * mult));
    }

    /** Pay gold to restore one fallen unit by index in state.fallenUnits. */
    function recoverFallenUnit(state, fallenIndex, opts) {
        if (!state || !Array.isArray(state.fallenUnits)) {
            return { ok: false, message: "沒有可復活的單位" };
        }
        const entry = state.fallenUnits[fallenIndex];
        if (!entry || !entry.id) return { ok: false, message: "沒有可復活的單位" };
        const cost = reviveCostForUnit(entry.id, opts && opts.costMult);
        if (!spendGold(state, cost)) {
            return { ok: false, message: `金幣不足（需要 ${cost}）` };
        }
        state.fallenUnits.splice(fallenIndex, 1);
        if (!state.ownedUnits) state.ownedUnits = [];
        state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
        const restored = {
            uid: entry.uid || nextOwnedUid(state),
            id: entry.id,
            star: entry.star || 1,
            exp: entry.exp || 0
        };
        state.ownedUnits.push(restored);
        if (!state.roster) state.roster = [];
        if (!state.roster.includes(entry.id)) state.roster.push(entry.id);
        const name = entry.name || (UNITS[entry.id] && UNITS[entry.id].name) || entry.id;
        return { ok: true, message: `花費 ${cost} 金，復活 ${name}`, id: entry.id, cost, name };
    }

    function advanceWorld(state) {
        if (state.endless) {
            state.endlessLoop = (state.endlessLoop || 1) + 1;
            state.worldIndex = ((state.worldIndex || 0) + 1) % WORLDS.length;
            state.map = global.WarMap.generateEndlessMap(
                state.endlessLoop,
                state.seed + 70000 + state.endlessLoop * 997,
                state.worldIndex
            );
            state.phase = "map";
            state.runWon = false;
            return { endless: true, loop: state.endlessLoop };
        }
        if (state.worldIndex >= WORLDS.length - 1) {
            state.runWon = true;
            state.phase = "victory";
            return { endless: false, victory: true };
        }
        state.worldIndex += 1;
        state.map = global.WarMap.generateMap(state.worldIndex, state.seed + state.worldIndex * 997);
        state.phase = "map";
        addGold(state, 40);
        return { endless: false, victory: false };
    }

    const ENDLESS_BEST_KEY = "war-roguelike-endless-best";

    function getEndlessBest() {
        try {
            const n = parseInt(localStorage.getItem(ENDLESS_BEST_KEY) || "0", 10);
            return Number.isFinite(n) ? Math.max(0, n) : 0;
        } catch {
            return 0;
        }
    }

    function recordEndlessBest(stages) {
        const n = Math.max(0, Math.floor(stages || 0));
        const best = getEndlessBest();
        if (n > best) {
            try {
                localStorage.setItem(ENDLESS_BEST_KEY, String(n));
            } catch { /* ignore */ }
            return n;
        }
        return best;
    }

    /** After campaign clear — gauntlet of epic fights + boss, no loot. */
    function enterEndlessMode(state) {
        if (!state) return { ok: false };
        state.endless = true;
        state.endlessLoop = 1;
        state.endlessStages = 0;
        state.runWon = false;
        state.runLost = false;
        state.worldIndex = 0;
        state.map = global.WarMap.generateEndlessMap(1, state.seed + 70000, 0);
        state.phase = "map";
        return { ok: true, loop: 1 };
    }

    function saveGame(state) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(state));
            return true;
        } catch {
            return false;
        }
    }

    function loadGame() {
        try {
            let raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                for (const key of SAVE_KEY_LEGACY) {
                    raw = localStorage.getItem(key);
                    if (raw) break;
                }
            }
            if (!raw) return null;
            return migrateState(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    function clearSave() {
        localStorage.removeItem(SAVE_KEY);
        SAVE_KEY_LEGACY.forEach((key) => localStorage.removeItem(key));
    }

    function getActiveWorld(state) {
        const idx = ((state && state.worldIndex) || 0) % WORLDS.length;
        return WORLDS[idx] || WORLDS[0];
    }

    /** Scaling index: endless loops stack on top of the final campaign world. */
    function difficultyWorldIndex(state) {
        if (state && state.endless) {
            return (WORLDS.length - 1) + Math.max(1, state.endlessLoop || 1);
        }
        return (state && state.worldIndex) || 0;
    }

    function getMapProgress(state, node) {
        const world = getActiveWorld(state);
        const maxLayer = (state.map && state.map.layers) || world.layers || 8;
        const layer = (node && Number.isFinite(node.layer)) ? node.layer : 1;
        const t = Math.max(0, Math.min(1, layer / Math.max(1, maxLayer)));
        return { layer, maxLayer, t, worldIndex: difficultyWorldIndex(state) };
    }

    function enemyScaleForProgress(progress, isBoss) {
        const { t, worldIndex } = progress;
        const w = worldIndex || 0;
        // Late layers ramp harder than early (quadratic-ish)
        const late = t * t;
        if (isBoss) {
            // Softer early/mid; late worlds still spike
            return {
                hp: 1.38 + t * 0.32 + late * 0.42 + w * 0.58,
                atk: 1.25 + t * 0.28 + late * 0.36 + w * 0.5,
                def: 1.2 + t * 0.22 + late * 0.3 + w * 0.42,
                addHp: 0.92 + t * 0.26 + late * 0.4 + w * 0.34,
                addAtk: 0.88 + t * 0.24 + late * 0.35 + w * 0.3,
                addDef: 0.85 + t * 0.2 + late * 0.28 + w * 0.26
            };
        }
        // Normal: gentler early/mid, catch up late via `late` + world
        return {
            hp: 0.82 + t * 0.38 + late * 0.42 + w * 0.34,
            atk: 0.8 + t * 0.35 + late * 0.38 + w * 0.32,
            def: 0.78 + t * 0.32 + late * 0.34 + w * 0.28
        };
    }

    function epicCombatScale(progress) {
        const { t, worldIndex } = progress;
        const w = worldIndex || 0;
        const late = t * t;
        // Epic: less oppressive early; still a step up from normal late-game
        return {
            hp: 1.12 + t * 0.55 + late * 0.65 + w * 0.5,
            atk: 1.08 + t * 0.5 + late * 0.58 + w * 0.47,
            def: 1.02 + t * 0.42 + late * 0.5 + w * 0.4
        };
    }

    function decorateEnemyArmy(ids, rng, worldIndex, eliteChanceBoost, forceAffix) {
        return (ids || []).map((entry) => {
            const id = typeof entry === "string" ? entry : entry?.id;
            if (!id) return null;
            const def = UNITS[id];
            if (def && def.role === "boss") return { id, affix: null };
            let affix = null;
            if (forceAffix && (ELITE_AFFIXES || []).some((a) => a.id === forceAffix)) {
                affix = forceAffix;
            } else {
                const boost = eliteChanceBoost || 0;
                // Lower base elite rate early; worlds still add pressure
                const chance = 0.1 + Math.min(0.28, (worldIndex || 0) * 0.08) + boost;
                if ((ELITE_AFFIXES || []).length && rng() < Math.min(0.82, chance)) {
                    affix = ELITE_AFFIXES[Math.floor(rng() * ELITE_AFFIXES.length)].id;
                }
            }
            return { id, affix };
        }).filter(Boolean);
    }

    function unitMatchesFormationTags(def, tags) {
        if (!def || !tags || !tags.length) return false;
        if (tags.includes("any")) return true;
        const unitTags = def.tags || [];
        return tags.some((t) => def.role === t || def.range === t || unitTags.includes(t));
    }

    function pickPoolIdByTags(pool, tags, rng) {
        const matches = (pool || []).filter((id) => unitMatchesFormationTags(UNITS[id], tags));
        const use = matches.length ? matches : pool;
        if (!use || !use.length) return null;
        return use[Math.floor(rng() * use.length)];
    }

    function buildArmyFromFormation(pool, count, formation, rng) {
        const n = Math.max(1, count || 1);
        const army = [];
        if (!formation) {
            for (let i = 0; i < n; i++) army.push(pool[Math.floor(rng() * pool.length)]);
            return army;
        }
        if (formation.preferIds && formation.preferIds.length) {
            const preferred = formation.preferIds.filter((id) => pool.includes(id));
            if (preferred.length) {
                for (let i = 0; i < n; i++) {
                    if (rng() < 0.72) army.push(preferred[Math.floor(rng() * preferred.length)]);
                    else army.push(pool[Math.floor(rng() * pool.length)]);
                }
                return army;
            }
        }
        let remaining = n;
        const slots = formation.slots || [{ tags: ["any"], n: -1 }];
        slots.forEach((slot) => {
            if (slot.n == null || slot.n < 0 || remaining <= 0) return;
            const take = Math.min(slot.n, remaining);
            for (let i = 0; i < take; i++) {
                army.push(pickPoolIdByTags(pool, slot.tags, rng) || pool[Math.floor(rng() * pool.length)]);
            }
            remaining -= take;
        });
        const fill = slots.find((s) => s.n < 0) || { tags: ["any"] };
        while (remaining-- > 0) {
            army.push(pickPoolIdByTags(pool, fill.tags, rng) || pool[Math.floor(rng() * pool.length)]);
        }
        return army;
    }

    function pickEnemyFormation(rng, kind) {
        const list = ENEMY_FORMATIONS || [];
        if (!list.length) return null;
        const chance = kind === "epic" ? 0.55 : kind === "boss" ? 0.35 : 0.4;
        if (rng() > chance) return null;
        return list[Math.floor(rng() * list.length)];
    }

    /** Enemy wave size by map progress (t 0–1) and world index. */
    function enemyCountForProgress(progress, kind, rng) {
        const t = progress?.t || 0;
        const w = progress?.worldIndex || 0;
        const late = t * t;
        const roll = () => Math.floor((rng || Math.random)() * 3); // 0–2
        if (kind === "boss") {
            // w0 early ~4–6 · late w0 ~9–11 · late w3 / endless ~18–22
            return Math.max(4, Math.min(22,
                4 + w * 3 + Math.floor(t * 5) + Math.floor(late * 5) + Math.floor((rng || Math.random)() * 3)
            ));
        }
        if (kind === "epic") {
            // w0 early ~5–7 · late w0 ~11–13 · late w3 / endless ~20–26
            return Math.max(5, Math.min(26,
                5 + Math.floor(t * 8) + Math.floor(late * 7) + w * 4 + roll()
            ));
        }
        // normal: early w0 ~2–3 · late w0 ~8–10 · late w3 / endless ~16–20
        return Math.max(2, Math.min(20,
            2 + Math.floor(t * 6) + Math.floor(late * 6) + w * 3 + Math.floor((rng || Math.random)() * 3)
        ));
    }

    function getCombatEncounter(state, node) {
        const world = getActiveWorld(state);
        const rng = getRng(state);
        const progress = getMapProgress(state, node);
        const terrain = pickTerrain(state);
        const t = progress.t || 0;
        const w = progress.worldIndex || 0;
        const mods = aggregateModifiers(state);
        const forceAffix = mods.forceEnemyAffix || null;
        const pool = world.enemyPool || [];

        if (node.type === "boss") {
            const scale = enemyScaleForProgress(progress, true);
            const addCount = enemyCountForProgress(progress, "boss", rng);
            const formation = pickEnemyFormation(rng, "boss");
            const adds = formation
                ? buildArmyFromFormation(pool, addCount, formation, rng)
                : global.WarBattle.generateEnemyArmy(pool, addCount, rng, null);
            const raw = [...adds, world.bossId];
            const eliteBoost = 0.14 + t * 0.18 + w * 0.05;
            const formLabel = formation ? ` · ${formation.name}` : "";
            return {
                enemyArmy: decorateEnemyArmy(raw, rng, progress.worldIndex, eliteBoost, forceAffix),
                isBoss: true,
                isEpicCombat: false,
                label: `${world.bossName}${formLabel}`,
                formationName: formation ? formation.name : null,
                enemyScale: scale,
                terrain
            };
        }

        if (node.type === "epic_combat") {
            const count = enemyCountForProgress(progress, "epic", rng);
            const formation = pickEnemyFormation(rng, "epic");
            let army;
            if (formation) {
                army = buildArmyFromFormation(pool, count, formation, rng);
            } else {
                army = [];
                const preferHardChance = Math.min(0.9, 0.55 + t * 0.28 + w * 0.06);
                for (let i = 0; i < count; i++) {
                    const preferHard = rng() < preferHardChance && pool.length > 1;
                    const id = preferHard
                        ? pool[Math.floor(pool.length / 2) + Math.floor(rng() * Math.ceil(pool.length / 2))]
                        : pool[Math.floor(rng() * pool.length)];
                    army.push(id);
                }
            }
            const eliteBoost = 0.28 + t * 0.22 + w * 0.06;
            const formLabel = formation ? formation.name : "史詩敵軍";
            return {
                enemyArmy: decorateEnemyArmy(army, rng, progress.worldIndex, eliteBoost, forceAffix),
                isBoss: false,
                isEpicCombat: true,
                label: formLabel,
                formationName: formation ? formation.name : null,
                enemyScale: epicCombatScale(progress),
                terrain
            };
        }

        const count = enemyCountForProgress(progress, "normal", rng);
        const scale = enemyScaleForProgress(progress, false);
        const formation = pickEnemyFormation(rng, "normal");
        const raw = formation
            ? buildArmyFromFormation(pool, count, formation, rng)
            : global.WarBattle.generateEnemyArmy(pool, count, rng, null);
        const formLabel = formation ? formation.name : "敵軍部隊";
        return {
            enemyArmy: decorateEnemyArmy(raw, rng, progress.worldIndex, t * 0.05, forceAffix),
            isBoss: false,
            isEpicCombat: false,
            label: formLabel,
            formationName: formation ? formation.name : null,
            enemyScale: scale,
            terrain
        };
    }

    function beginShopSession(state) {
        state.shopSession = { buys: {} };
    }

    function endShopSession(state) {
        if (state) state.shopSession = null;
    }

    function getShopCatalog(state) {
        const mods = aggregateModifiers(state);
        const buys = (state.shopSession && state.shopSession.buys) || {};
        return SHOP_ITEMS.map((item) => {
            const bought = buys[item.type] || 0;
            const maxBuys = item.maxBuys != null ? item.maxBuys : 1;
            const base = Math.floor(item.price * (1 - mods.shopDiscount));
            // Same item costs more each repurchase in this shop visit (+50% of base each time)
            const price = Math.max(1, Math.floor(base * (1 + bought * 0.5)));
            const soldOut = bought >= maxBuys;
            return {
                ...item,
                maxBuys,
                basePrice: base,
                price,
                buyCount: bought,
                remaining: Math.max(0, maxBuys - bought),
                soldOut
            };
        });
    }

    function buyShopItem(state, item) {
        if (!state.shopSession) beginShopSession(state);
        const live = getShopCatalog(state).find((i) => i.type === item.type) || item;

        if (live.soldOut) {
            return { ok: false, message: `${live.name} 已售完（限購 ${live.maxBuys}）` };
        }

        // Pre-check exp purchase so we don't charge when everyone is max star
        if (live.effect && live.effect.unitExp) {
            state.ownedUnits = normalizeOwnedList(state.ownedUnits, state);
            const canTrain = state.ownedUnits.some((o) => o.star < STAR_CAP);
            if (!canTrain) return { ok: false, message: "所有單位已滿星，無法購買經驗" };
        }

        if (!spendGold(state, live.price)) return { ok: false, message: "金幣不足" };

        const key = live.type;
        state.shopSession.buys[key] = (state.shopSession.buys[key] || 0) + 1;

        const result = { ok: true, message: "" };
        if (live.effect.gold) {
            addGold(state, live.effect.gold);
            result.message = `花費 ${live.price} 金，獲得 ${live.effect.gold} 金幣`;
        } else if (live.effect.hp) {
            const g = live.effect.hp * 2;
            addGold(state, g);
            result.message = `花費 ${live.price} 金，獲得 ${g} 金幣`;
        } else if (live.effect.artifact) {
            const rng = getRng(state);
            const arts = pickWeightedByRarity(randomArtifactPool(), 1, rng, state.artifacts, state, false);
            if (arts.length) {
                state.artifacts.push(arts[0].id);
                const grants = applyItemGrants(state, arts[0]);
                let msg = `花費 ${live.price} 金，購買 ${arts[0].name}`;
                if (grants.length) msg += `（${grants.join("；")}）`;
                result.message = msg;
            } else {
                result.message = `花費 ${live.price} 金，但沒有新神器`;
            }
        } else if (live.effect.ability) {
            const rng = getRng(state);
            const abs = pickWeightedByRarity(ABILITIES, 1, rng, state.abilities, state, false);
            if (abs.length) {
                state.abilities.push(abs[0].id);
                result.message = `花費 ${live.price} 金，學會 ${abs[0].name}`;
            } else {
                result.message = `花費 ${live.price} 金，但沒有新能力`;
            }
        } else if (live.effect.recruit) {
            const res = recruitUnit(state);
            const id = res && res.id;
            result.message = id
                ? `花費 ${live.price} 金，招募 ${UNITS[id].name}`
                : `花費 ${live.price} 金，無新單位`;
        } else if (live.effect.tempAtk) {
            state.tempBonuses.atk += live.effect.tempAtk;
            result.message = `花費 ${live.price} 金，部隊攻擊提升`;
        } else if (live.effect.unitExp) {
            const expRes = grantShopExp(state, live.effect.unitExp);
            result.message = expRes.ok
                ? `花費 ${live.price} 金，${expRes.message}`
                : `花費 ${live.price} 金，${expRes.message || "無法獲得經驗"}`;
        }
        aggregateModifiers(state);
        return result;
    }

    global.WarState = {
        SAVE_KEY,
        createNewRun,
        getRng,
        aggregateModifiers,
        offerRewards,
        offerUnitRewards,
        offerEpicRewards,
        applyReward,
        addGold,
        spendGold,
        recruitUnit,
        mergeUnits,
        autoMergeStars,
        grantBattleExp,
        grantShopExp,
        expNeededForStar,
        convertUnit,
        sacrificeRandomUnit,
        computeSynergies,
        pickTerrain,
        ownedUnitId,
        ownedUnitUid,
        ownedUnitStar,
        ownedUnitExp,
        normalizeOwnedList,
        armyUnitStar,
        armyUnitUid,
        treasureBonusGold,
        resolveTreasure,
        resolveTrap,
        resolveEvent,
        applyEventChoice,
        addContract,
        tickContracts,
        afterCombat,
        applyBattleCasualties,
        reviveCostForUnit,
        recoverFallenUnit,
        advanceWorld,
        enterEndlessMode,
        getEndlessBest,
        recordEndlessBest,
        getActiveWorld,
        difficultyWorldIndex,
        saveGame,
        loadGame,
        clearSave,
        getCombatEncounter,
        getShopCatalog,
        beginShopSession,
        endShopSession,
        buyShopItem,
        defaultArmy,
        defaultOwnedUnits,
        defaultSlotPos,
        makeArmySlot,
        appendArmyUnit,
        findOpenArmyPos,
        separateArmySlots,
        normalizeArmy,
        snapshotArmySetup,
        restoreLastBattleSetup,
        layoutArmySlots,
        armyUnitId,
        clampArmyToOwned,
        unitMayFight,
        fightRestrictionLabel,
        filterArmyByFightRules,
        migrateState
    };
})(typeof window !== "undefined" ? window : globalThis);
