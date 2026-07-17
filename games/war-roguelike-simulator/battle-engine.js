/**
 * War Roguelike — 2D arena brawl battle engine.
 */
(function (global) {
    "use strict";

    const { UNITS, ARENA, STATUS_EFFECTS, STAR_STATS, MAX_STAR, ELITE_AFFIXES, TACTICS } = global.WarData;
    const AI = global.WarBattleAI;
    const {
        dist,
        living,
        nearestEnemy,
        nearestEnemies,
        farthestEnemy,
        lowestHpAlly,
        pickExecuteTarget,
        shouldUseSkillNow,
        tryRangedKite,
        clampToArena
    } = AI;
    const HEAL_HP_THRESHOLD = AI.HEAL_HP_THRESHOLD;
    const EXECUTE_HP_THRESHOLD = AI.EXECUTE_HP_THRESHOLD;
    const STAR_CAP = MAX_STAR || 10;
    let uidSeq = 0;

    function hasUnitTag(def, tag) {
        if (!def || !tag) return false;
        if (def.role === tag || def.range === tag) return true;
        return Array.isArray(def.tags) && def.tags.includes(tag);
    }

    function applyBonusToBag(te, bag) {
        if (!te || !bag) return;
        if (te.hp) bag.hp += te.hp;
        if (te.atk) bag.atk += te.atk;
        if (te.def) bag.def += te.def;
        if (te.spdMult) {
            bag.spd *= te.spdMult;
            bag.moveSpeed *= te.spdMult;
        }
        if (te.moveMult) bag.moveSpeed *= te.moveMult;
        if (te.skillCdMult) bag.skillCdMult *= te.skillCdMult;
        if (te.skillPower) bag.skillPower *= te.skillPower;
        if (te.healBoost) bag.healBoost *= te.healBoost;
        if (te.critChance) bag.critChance = Math.max(bag.critChance, te.critChance);
        if (te.multishot) bag.multishot = Math.max(bag.multishot || 1, te.multishot);
        if (te.attackRange) bag.attackRange += te.attackRange;
        if (te.rangeMult) bag.attackRange *= te.rangeMult;
        if (te.summonMax) bag.summonMaxBonus += te.summonMax;
        if (te.onHit) bag.onHit = mergeOnHits(bag.onHit, te.onHit);
    }

    function applyTagEffects(def, modifiers, bag) {
        const list = (modifiers && modifiers.tagEffects) || [];
        list.forEach((te) => {
            const need = te.tags || (te.tag ? [te.tag] : []);
            if (!need.some((t) => hasUnitTag(def, t))) return;
            applyBonusToBag(te, bag);
        });
    }

    function applyUnitEffects(unitId, modifiers, bag) {
        const list = (modifiers && modifiers.unitEffects) || [];
        list.forEach((ue) => {
            const ids = ue.units || (ue.unit ? [ue.unit] : []);
            if (!ids.includes(unitId)) return;
            applyBonusToBag(ue, bag);
        });
    }

    function cloneOnHit(oh) {
        if (!oh || !oh.type) return null;
        return {
            type: oh.type,
            chance: Math.min(1, oh.chance != null ? oh.chance : 1),
            duration: oh.duration,
            dps: oh.dps,
            stackDps: oh.stackDps,
            pct: oh.pct,
            slow: oh.slow,
            atkMult: oh.atkMult,
            takenMult: oh.takenMult
        };
    }

    /** Normalize single object or array into a list of on-hit specs. */
    function asOnHitList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(cloneOnHit).filter(Boolean);
        const one = cloneOnHit(value);
        return one ? [one] : [];
    }

    /**
     * Merge on-hit sources. Same type stacks chance; different types stay independent
     * so one attack can proc multiple status effects.
     */
    function mergeOnHits(existing, add) {
        const list = asOnHitList(existing);
        asOnHitList(add).forEach((a) => {
            const idx = list.findIndex((e) => e.type === a.type);
            if (idx < 0) {
                list.push(a);
                return;
            }
            const e = list[idx];
            list[idx] = {
                type: e.type,
                chance: Math.min(1, (e.chance || 0) + (a.chance != null ? a.chance : 0)),
                duration: a.duration != null ? a.duration : e.duration,
                dps: a.dps != null ? Math.max(e.dps || 0, a.dps) : e.dps,
                stackDps: a.stackDps != null ? Math.max(e.stackDps || 0, a.stackDps) : e.stackDps,
                pct: a.pct != null ? Math.max(e.pct || 0, a.pct) : e.pct,
                slow: a.slow != null ? Math.max(e.slow || 0, a.slow) : e.slow,
                atkMult: a.atkMult != null ? Math.min(e.atkMult != null ? e.atkMult : 1, a.atkMult) : e.atkMult,
                takenMult: a.takenMult != null ? Math.max(e.takenMult || 1, a.takenMult) : e.takenMult
            };
        });
        return list.length ? list : null;
    }

    function unitMayFight(def, modifiers) {
        const m = modifiers || {};
        const only = m.onlyFightTags || (m.onlyFightTag ? [m.onlyFightTag] : null);
        if (!only || !only.length) return true;
        return only.some((t) => hasUnitTag(def, t));
    }

    function resolveSpawnEntry(entry) {
        if (typeof entry === "string") return { id: entry, star: 1, affix: null, uid: null };
        if (!entry || !entry.id) return null;
        return {
            id: entry.id,
            star: Math.max(1, Math.min(STAR_CAP, entry.star || 1)),
            affix: entry.affix || null,
            uid: entry.uid || null,
            x: entry.x,
            y: entry.y
        };
    }

    function tacticAdjust(state, unit) {
        const base = { move: 1, dmg: 1, defBonus: 0, taken: 1 };
        if (!state || !state.activeTactic || unit.side !== "player") return base;
        const tm = (state.modifiers && state.modifiers.tacticMods) || {};
        if (state.activeTactic === "focus_fire") {
            return { move: 1, dmg: 1.2 + (tm.focusDmgBonus || 0), defBonus: 0, taken: 1 };
        }
        if (state.activeTactic === "hold_line") {
            return {
                move: 0.5,
                dmg: 1,
                defBonus: 12,
                taken: 0.85 * (tm.holdTakenMult != null ? tm.holdTakenMult : 1)
            };
        }
        if (state.activeTactic === "all_out") {
            return { move: 1.25, dmg: 1.3 + (tm.allOutDmgBonus || 0), defBonus: 0, taken: 1 };
        }
        return base;
    }

    function cloneUnit(unitId, side, x, y, modifiers, opts) {
        const def = UNITS[unitId];
        if (!def) return null;
        const m = modifiers || {};
        const star = Math.max(1, Math.min(STAR_CAP, (opts && opts.star) || 1));
        const ownedUid = opts && opts.ownedUid ? opts.ownedUid : null;
        const affixId = opts && opts.affix;
        const starMult = (STAR_STATS && STAR_STATS[star]) || { hp: 1, atk: 1, def: 1 };
        const bag = {
            hp: def.hp + (m.hpAll || 0),
            atk: def.atk + (m.atkAll || 0),
            def: def.def + (m.defAll || 0),
            spd: def.spd * (m.spdMult || 1),
            moveSpeed: def.moveSpeed * (m.moveSpeedMult || 1),
            attackRange: def.attackRange + (m.rangeAll || 0),
            skillCdMult: 1,
            skillPower: 1,
            healBoost: 1,
            critChance: 0,
            multishot: 1,
            summonMaxBonus: 0,
            onHit: null
        };

        if (side === "player") {
            applyTagEffects(def, m, bag);
            applyUnitEffects(unitId, m, bag);
        }

        let hp = Math.max(1, Math.floor(bag.hp * starMult.hp));
        let atk = Math.max(1, Math.floor(bag.atk * starMult.atk));
        let defVal = Math.max(0, Math.floor(bag.def * starMult.def));
        let spd = bag.spd;
        let moveSpeed = bag.moveSpeed;
        let attackRange = Math.max(12, Math.floor(bag.attackRange));

        if (side === "player") {
            if (m.hpMult && m.hpMult !== 1) hp = Math.max(1, Math.floor(hp * m.hpMult));
            if (m.atkMult && m.atkMult !== 1) atk = Math.max(1, Math.floor(atk * m.atkMult));
        }

        // Terrain personal modifiers
        const te = m.terrainEffect || {};
        if (def.range === "melee") {
            if (te.meleeAtkMult) atk = Math.max(1, Math.floor(atk * te.meleeAtkMult));
            if (te.meleeMoveMult) moveSpeed *= te.meleeMoveMult;
        }
        if (def.range === "ranged") {
            if (te.rangedAtkMult) atk = Math.max(1, Math.floor(atk * te.rangedAtkMult));
            if (te.rangedRangeAdd) attackRange = Math.max(12, attackRange + te.rangedRangeAdd);
        }
        if (te.moveMult) moveSpeed *= te.moveMult;
        if (te.atkMult) atk = Math.max(1, Math.floor(atk * te.atkMult));
        if (te.skillCdMult) bag.skillCdMult *= te.skillCdMult;
        if (te.skillPower) bag.skillPower *= te.skillPower;

        // Scale enemies by map progress
        if (side === "enemy") {
            const isBoss = def.role === "boss";
            let hpM;
            let atkM;
            let defM;
            if (isBoss) {
                hpM = m.enemyHpMult != null ? m.enemyHpMult : 1.4;
                atkM = m.enemyAtkMult != null ? m.enemyAtkMult : 1.3;
                defM = m.enemyDefMult != null ? m.enemyDefMult : 1.25;
            } else if (m.addHpMult != null) {
                hpM = m.addHpMult;
                atkM = m.addAtkMult != null ? m.addAtkMult : 0.9;
                defM = m.addDefMult != null ? m.addDefMult : 0.9;
            } else {
                hpM = m.enemyHpMult != null ? m.enemyHpMult : 0.95;
                atkM = m.enemyAtkMult != null ? m.enemyAtkMult : 0.92;
                defM = m.enemyDefMult != null ? m.enemyDefMult : 0.9;
            }
            hp = Math.max(1, Math.floor(hp * hpM));
            atk = Math.max(1, Math.floor(atk * atkM));
            defVal = Math.max(0, Math.floor(defVal * defM));
        }

        // Elite affix
        let affix = null;
        let regen = 0;
        let unitThorns = 0;
        let unitLifesteal = 0;
        let startShieldExtra = 0;
        if (affixId && ELITE_AFFIXES) {
            affix = ELITE_AFFIXES.find((a) => a.id === affixId) || null;
            if (affix && affix.effect) {
                const ae = affix.effect;
                if (ae.atkMult) atk = Math.max(1, Math.floor(atk * ae.atkMult));
                if (ae.defMult) defVal = Math.max(0, Math.floor(defVal * ae.defMult));
                if (ae.moveMult) moveSpeed *= ae.moveMult;
                if (ae.spdMult) spd *= ae.spdMult;
                if (ae.regen) regen = ae.regen;
                if (ae.thorns) unitThorns = ae.thorns;
                if (ae.lifesteal) unitLifesteal = ae.lifesteal;
                if (ae.startShieldPct) startShieldExtra = Math.floor(hp * ae.startShieldPct);
            }
        }

        const canFight = side !== "player" || unitMayFight(def, m);
        const displayName = affix
            ? `${affix.icon || ""}${def.name}`
            : (star > 1 ? `${def.name}★${star}` : def.name);

        // On-hit: unit base → tag/artifact → global artifact → terrain (multi-type independent)
        let onHit = asOnHitList(def.onHit);
        if (side === "player") {
            onHit = mergeOnHits(onHit, bag.onHit) || [];
            onHit = mergeOnHits(onHit, m.onHit) || [];
        }
        if (te.onHitChance && te.onHitStatus) {
            onHit = mergeOnHits(onHit, {
                type: te.onHitStatus.type,
                chance: te.onHitChance,
                duration: te.onHitStatus.duration,
                dps: te.onHitStatus.dps,
                slow: te.onHitStatus.slow
            }) || [];
        }
        onHit = onHit.length ? onHit : null;

        const baseShield = m.startShield && side === "player" && !def.temporary && def.role !== "summon" ? m.startShield : 0;

        return {
            uid: `${side}-${++uidSeq}-${unitId}`,
            ownedUid,
            unitId,
            star,
            name: displayName,
            icon: def.icon,
            role: def.role,
            tags: [...(def.tags || [])],
            affixId: affix ? affix.id : null,
            affixLabel: affix ? affix.name : null,
            side,
            rangeType: def.range,
            x,
            y,
            vx: 0,
            vy: 0,
            radius: def.radius,
            attackRange,
            moveSpeed,
            maxHp: hp,
            hp,
            atk,
            def: defVal,
            spd,
            skill: def.skill ? { ...def.skill, timer: def.skill.cd || 6 } : null,
            skillCdMult: bag.skillCdMult,
            skillPower: bag.skillPower,
            healBoost: bag.healBoost,
            critChance: bag.critChance,
            multishot: bag.multishot,
            summonMaxBonus: bag.summonMaxBonus || 0,
            casting: null,
            canFight,
            attackTimer: Math.random() * 0.4,
            alive: true,
            state: "idle",
            anim: 0,
            hurtFlash: 0,
            attackFlash: 0,
            kbX: 0,
            kbY: 0,
            deathPulse: 0,
            alpha: 1,
            facing: side === "player" ? 1 : -1,
            buffs: { atkMult: 1, taunt: false, tauntTimer: 0, defBonus: 0, dmgTakenMult: 1 },
            effects: [],
            onHit,
            temporary: !!def.temporary || def.role === "summon",
            summonerUid: null,
            shield: baseShield + startShieldExtra,
            revived: false,
            targetUid: null,
            effectMoveMult: 1,
            effectSpdMult: 1,
            effectAtkMult: 1,
            effectTakenMult: 1,
            silenced: false,
            regen,
            unitThorns,
            unitLifesteal,
            bossPhase: def.role === "boss" ? 1 : 0,
            phase2: def.phase2 || null,
            phaseIframes: 0,
            canDash: def.role === "assassin" || hasUnitTag(def, "assassin"),
            dashCd: 0.4,
            stats: { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null }
        };
    }

    function summonUnits(caster, allUnits, modifiers, log, fx) {
        const cfg = (caster.skill && caster.skill.summon) || null;
        if (!cfg || !cfg.id) return 0;
        const maxAlive = (cfg.maxAlive != null ? cfg.maxAlive : 2) + (caster.summonMaxBonus || 0);
        const count = cfg.count != null ? cfg.count : 1;
        const mine = allUnits.filter((u) => u.alive && u.temporary && u.summonerUid === caster.uid);
        const slots = Math.max(0, maxAlive - mine.length);
        const n = Math.min(count, slots);
        const summonDef = UNITS[cfg.id];
        const isMeleeSummon = !summonDef || summonDef.range !== "ranged";
        const arenaW = ARENA.width || 800;
        const arenaH = ARENA.height || 450;
        const enemies = (allUnits || []).filter((u) => u.alive && u.side !== caster.side);
        const pad = 18;
        let spawned = 0;
        for (let i = 0; i < n; i++) {
            let x;
            let y;
            if (isMeleeSummon) {
                // Melee summons deploy on the enemy side (near living foes when possible)
                let baseX;
                let baseY;
                if (enemies.length) {
                    let sx = 0;
                    let sy = 0;
                    enemies.forEach((e) => {
                        sx += e.x;
                        sy += e.y;
                    });
                    baseX = sx / enemies.length;
                    baseY = sy / enemies.length;
                    if (caster.side === "player") {
                        baseX = Math.max(baseX, arenaW * 0.62);
                        baseX = Math.min(baseX, arenaW * 0.88);
                    } else {
                        baseX = Math.min(baseX, arenaW * 0.38);
                        baseX = Math.max(baseX, arenaW * 0.12);
                    }
                } else if (caster.side === "player") {
                    baseX = arenaW * 0.78;
                    baseY = arenaH * 0.5;
                } else {
                    baseX = arenaW * 0.22;
                    baseY = arenaH * 0.5;
                }
                const spread = (i - (n - 1) / 2) * 38;
                const towardEnemy = caster.side === "player" ? 10 : -10;
                x = Math.max(pad, Math.min(arenaW - pad, baseX + towardEnemy + (Math.random() - 0.5) * 24));
                y = Math.max(pad, Math.min(arenaH - pad, baseY + spread + (Math.random() - 0.5) * 18));
            } else {
                // Ranged summons appear beside the caster
                const ang = (Math.PI * 2 * i) / Math.max(1, n) + Math.random() * 0.4;
                const rad = 28 + Math.random() * 12;
                x = Math.max(pad, Math.min(arenaW - pad, caster.x + Math.cos(ang) * rad));
                y = Math.max(pad, Math.min(arenaH - pad, caster.y + Math.sin(ang) * rad));
            }
            const star = Math.max(1, Math.min(STAR_CAP, caster.star || 1));
            const s = cloneUnit(cfg.id, caster.side, x, y, modifiers, { star });
            if (!s) continue;
            s.temporary = true;
            s.summonerUid = caster.uid;
            s.shield = 0;
            // Summons are a bit fragile / don't inherit start shield
            if (caster.side === "player") {
                s.maxHp = Math.max(1, Math.floor(s.maxHp * 0.9));
                s.hp = s.maxHp;
            }
            allUnits.push(s);
            spawned += 1;
            if (log) {
                log.push({
                    type: "summon",
                    source: caster.name,
                    target: s.name,
                    skill: caster.skill?.name || "召喚"
                });
            }
            if (fx) {
                fx.push({ type: "ring", x: s.x, y: s.y, color: "#67e8f9", t: 0.4 });
            }
        }
        if (spawned > 0) {
            if (!caster.stats) caster.stats = { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null };
            caster.stats.summons = (caster.stats.summons || 0) + spawned;
        }
        return spawned;
    }

    function statusLabel(type) {
        return (STATUS_EFFECTS && STATUS_EFFECTS[type] && STATUS_EFFECTS[type].label) || type;
    }

    function hpSnap(unit) {
        if (!unit) return null;
        return {
            hp: Math.max(0, Math.ceil(unit.hp)),
            maxHp: Math.max(1, Math.ceil(unit.maxHp || 1))
        };
    }

    function applyStatus(target, status, source, log) {
        if (!target || !target.alive || !status || !status.type) return;
        if (!target.effects) target.effects = [];
        if (source && source.stats) source.stats.statuses = (source.stats.statuses || 0) + 1;
        const type = status.type;
        const meta = (STATUS_EFFECTS && STATUS_EFFECTS[type]) || {};
        const stackable = !!meta.stackable;
        const maxStacks = meta.maxStacks || 5;
        const duration = status.duration != null ? status.duration : 3;
        const stackDps = status.stackDps != null ? status.stackDps : (status.dps || 0);
        let pct = status.pct != null ? status.pct : 0;
        // Legacy burn used flat dps — convert roughly to % max HP / sec
        if (type === "burn" && !pct && status.dps) {
            pct = Math.max(0.02, Math.min(0.06, status.dps / 220));
        }
        const next = {
            type,
            duration,
            stacks: 1,
            stackDps,
            dps: stackDps,
            pct,
            slow: status.slow != null ? status.slow : (type === "freeze" ? 0.35 : 1),
            atkMult: status.atkMult != null ? status.atkMult : 1,
            takenMult: status.takenMult != null ? status.takenMult : 1,
            tick: 0,
            source: source?.name || null
        };
        const existing = target.effects.find((e) => e.type === type);
        if (existing) {
            existing.duration = Math.max(existing.duration, next.duration);
            if (stackable) {
                existing.stacks = Math.min(maxStacks, (existing.stacks || 1) + 1);
                existing.stackDps = Math.max(existing.stackDps || 0, next.stackDps || 0);
                existing.dps = existing.stackDps;
            } else {
                // Non-stackable: refresh and keep stronger values
                existing.pct = Math.max(existing.pct || 0, next.pct || 0);
                existing.stackDps = Math.max(existing.stackDps || 0, next.stackDps || 0);
                existing.dps = Math.max(existing.dps || 0, next.dps || 0);
                if (next.slow < (existing.slow != null ? existing.slow : 1)) existing.slow = next.slow;
                if (next.atkMult < (existing.atkMult != null ? existing.atkMult : 1)) existing.atkMult = next.atkMult;
                if (next.takenMult > (existing.takenMult != null ? existing.takenMult : 1)) existing.takenMult = next.takenMult;
            }
            if (log && stackable) {
                log.push({
                    type: "status",
                    target: target.name,
                    status: type,
                    statusLabel: `${statusLabel(type)}×${existing.stacks}`,
                    source: source?.name || null,
                    ...hpSnap(target)
                });
            }
        } else {
            target.effects.push(next);
            if (log) {
                log.push({
                    type: "status",
                    target: target.name,
                    status: type,
                    statusLabel: statusLabel(type),
                    source: source?.name || null,
                    ...hpSnap(target)
                });
            }
        }
    }

    function tryApplyOnHit(attacker, target, log) {
        if (!attacker || !target || !target.alive) return;
        const list = asOnHitList(attacker.onHit);
        list.forEach((oh) => {
            if (!target.alive) return;
            const chance = oh.chance != null ? oh.chance : 1;
            if (Math.random() > chance) return;
            applyStatus(target, oh, attacker, log);
        });
    }

    function dealDot(u, amount, e, modifiers, log, fx, units) {
        const dmg = Math.max(1, Math.floor(amount));
        if (dmg <= 0) return;
        if (u.phaseIframes > 0) return;
        u.hp -= dmg;
        u.hurtFlash = 0.15;
        pushDmgFx(fx, u.x, u.y, dmg, { lite: true });
        if (log) {
            log.push({
                type: "dot",
                status: e.type,
                statusLabel: statusLabel(e.type) + (e.stacks > 1 ? `×${e.stacks}` : ""),
                target: u.name,
                amount: dmg,
                ...hpSnap(u)
            });
        }
        if (u.hp <= 0) {
            if (!u.stats) u.stats = {};
            if (!u.stats.killedBy) u.stats.killedBy = statusLabel(e.type) || "持續傷害";
            if (!tryEnterBossPhase2(u, units, modifiers, log, fx)) {
                killUnit(u, modifiers, log, fx);
            }
        }
    }

    function tickUnitEffects(u, dt, modifiers, log, fx, units) {
        u.effectMoveMult = 1;
        u.effectSpdMult = 1;
        u.effectAtkMult = 1;
        u.effectTakenMult = 1;
        u.silenced = false;
        if (u.regen > 0 && u.alive && u.hp < u.maxHp) {
            const heal = Math.max(0, Math.floor(u.maxHp * u.regen * dt));
            if (heal > 0) {
                u.hp = Math.min(u.maxHp, u.hp + heal);
            }
        }
        if (!u.effects || !u.effects.length) return;
        for (let i = u.effects.length - 1; i >= 0; i--) {
            // Boss phase-2 (and similar) may replace/clear effects mid-loop
            if (!u.effects || i >= u.effects.length) break;
            const e = u.effects[i];
            if (!e) continue;
            e.duration -= dt;
            if (e.type === "freeze") {
                const slow = e.slow != null ? e.slow : 0.35;
                u.effectMoveMult *= slow;
                u.effectSpdMult *= slow;
            }
            if (e.type === "root") {
                u.effectMoveMult = 0;
            }
            if (e.type === "weaken") {
                u.effectAtkMult *= e.atkMult != null ? e.atkMult : 0.75;
            }
            if (e.type === "vulnerable") {
                u.effectTakenMult *= e.takenMult != null ? e.takenMult : 1.25;
            }
            if (e.type === "silence") {
                u.silenced = true;
                if (u.casting) u.casting = null;
            }

            const isStackDot = e.type === "poison" || e.type === "bleed";
            const isBurn = e.type === "burn";
            const isShock = e.type === "shock";
            if (isStackDot || isBurn || isShock) {
                e.tick = (e.tick || 0) + dt;
                const interval = isShock ? 0.75 : 0.5;
                if (e.tick >= interval) {
                    const ticks = Math.floor(e.tick / interval);
                    e.tick -= ticks * interval;
                    let dmg = 0;
                    if (isBurn) {
                        const pct = e.pct || 0;
                        dmg = u.maxHp * pct * interval * ticks;
                    } else if (isStackDot) {
                        const stacks = Math.max(1, e.stacks || 1);
                        const per = e.stackDps != null ? e.stackDps : (e.dps || 0);
                        dmg = per * stacks * interval * ticks;
                    } else if (isShock) {
                        dmg = (e.dps || 8) * interval * ticks;
                        if (u.casting) u.casting = null;
                    }
                    if (dmg > 0) {
                        dealDot(u, dmg, e, modifiers, log, fx, units);
                        if (!u.alive) return;
                        // Phase 2 clears effects — stop iterating the old list
                        if (!u.effects || u.effects[i] !== e) return;
                    }
                }
            }
            if (e.duration <= 0 && u.effects && u.effects[i] === e) {
                u.effects.splice(i, 1);
            }
        }
    }

    function bossRepelNearby(boss, units, fx, log, cfg) {
        const radius = (cfg && cfg.repelRadius != null) ? cfg.repelRadius : ((boss.radius || 22) + 100);
        const forceBase = (cfg && cfg.repelForce != null) ? cfg.repelForce : 34;
        const list = units || [];
        list.forEach((u) => {
            if (!u.alive || u.uid === boss.uid || u.side === boss.side) return;
            const d = dist(boss, u);
            if (d > radius || d < 0.01) return;
            const nx = (u.x - boss.x) / d;
            const ny = (u.y - boss.y) / d;
            const force = forceBase + (1 - d / radius) * 18;
            u.kbX = (u.kbX || 0) + nx * force;
            u.kbY = (u.kbY || 0) + ny * force;
            u.hurtFlash = Math.max(u.hurtFlash || 0, 0.18);
            // Interrupt enemy casts when blasted away
            if (u.casting) u.casting = null;
        });
        if (fx) {
            fx.push({ type: "ring", x: boss.x, y: boss.y, r: radius, color: "#fbbf24", t: 0.55 });
            fx.push({ type: "ring", x: boss.x, y: boss.y, r: radius * 0.55, color: "#fef3c7", t: 0.35 });
            fx.push({ type: "cast", x: boss.x, y: boss.y, r: boss.radius, t: 0.6, life: 0.6 });
        }
        if (log) {
            log.push({
                type: "skill",
                source: boss.name,
                skill: "二階段覺醒",
                detail: "擊退附近單位並回滿生命"
            });
        }
    }

    /**
     * Boss first death → phase 2: full heal, knockback, new skill/pattern.
     * @returns {boolean} true if death was prevented
     */
    function tryEnterBossPhase2(unit, units, modifiers, log, fx) {
        if (!unit || !unit.alive) return false;
        if (unit.role !== "boss" || unit.bossPhase >= 2) return false;
        const p2 = unit.phase2;
        if (!p2) return false;

        unit.bossPhase = 2;
        unit.hp = unit.maxHp;
        unit.shield = Math.max(unit.shield || 0, Math.floor(unit.maxHp * 0.12));
        unit.casting = null;
        unit.effects = [];
        unit.phaseIframes = 1.0;
        unit.hurtFlash = 0.35;
        unit.attackFlash = 0.25;
        unit.state = "idle";
        unit.attackTimer = 0;

        if (p2.name) unit.name = p2.name;
        if (p2.icon) unit.icon = p2.icon;
        if (p2.atkMult) unit.atk = Math.max(1, Math.floor(unit.atk * p2.atkMult));
        if (p2.spdMult) unit.spd = unit.spd * p2.spdMult;
        if (p2.defMult) unit.def = Math.max(0, Math.floor(unit.def * p2.defMult));
        if (p2.moveMult) unit.moveSpeed = unit.moveSpeed * p2.moveMult;
        if (p2.rangeType) unit.rangeType = p2.rangeType;
        if (p2.attackRange != null) unit.attackRange = p2.attackRange;
        if (p2.onHit) unit.onHit = mergeOnHits(unit.onHit, p2.onHit);
        if (p2.skill) {
            unit.skill = { ...p2.skill, timer: (p2.skill.cd || 6) * 0.65 };
        }

        bossRepelNearby(unit, units, fx, log, p2);
        if (log) {
            log.push({
                type: "status",
                target: unit.name,
                status: "phase2",
                statusLabel: "二階段",
                source: null,
                ...hpSnap(unit)
            });
        }
        return true;
    }

    /** Shared enemy standings for prep preview and real battle. */
    function layoutEnemySlots(armyEntries, arenaW, arenaH) {
        const w = arenaW || ARENA.width;
        const h = arenaH || ARENA.height;
        const entries = (armyEntries || []).map(resolveSpawnEntry).filter(Boolean);
        if (!entries.length) return [];

        const bosses = entries.filter((e) => UNITS[e.id]?.role === "boss");
        const adds = entries.filter((e) => UNITS[e.id]?.role !== "boss");

        if (bosses.length) {
            const slots = [];
            bosses.forEach((e, bi) => {
                slots.push({
                    id: e.id,
                    affix: e.affix,
                    x: w * (0.84 + bi * 0.05),
                    y: h * 0.5
                });
            });
            const n = adds.length;
            adds.forEach((e, i) => {
                const cols = n <= 5 ? 1 : 2;
                const rows = Math.ceil(n / cols);
                const col = cols === 1 ? 0 : (i % cols);
                const row = cols === 1 ? i : Math.floor(i / cols);
                const x = cols === 1 ? w * 0.68 : (col === 0 ? w * 0.64 : w * 0.76);
                const yPad = h * 0.12;
                const ySpan = h - yPad * 2;
                const y = rows === 1
                    ? h * 0.28
                    : yPad + (row / (rows - 1)) * ySpan;
                slots.push({
                    id: e.id,
                    affix: e.affix,
                    x,
                    y
                });
            });
            return slots;
        }

        const n = entries.length;
        const cols = n <= 5 ? 1 : (n <= 12 ? 2 : 3);
        const rows = Math.ceil(n / cols);
        return entries.map((e, i) => {
            const col = cols === 1 ? 0 : (i % cols);
            const row = cols === 1 ? i : Math.floor(i / cols);
            const xBand = [w * 0.66, w * 0.78, w * 0.88];
            const x = cols === 1 ? w * 0.78 : xBand[Math.min(col, xBand.length - 1)];
            const yPad = h * 0.1;
            const ySpan = h - yPad * 2;
            const y = rows === 1 ? h * 0.5 : yPad + (row / (rows - 1)) * ySpan;
            return { id: e.id, affix: e.affix, x, y };
        });
    }

    function spawnColumn(armyEntries, side, modifiers, arenaW, arenaH) {
        if (side === "enemy") {
            return layoutEnemySlots(armyEntries, arenaW, arenaH)
                .map((s) => cloneUnit(s.id, side, s.x, s.y, modifiers, { affix: s.affix }))
                .filter(Boolean);
        }
        const units = [];
        const entries = (armyEntries || []).map(resolveSpawnEntry).filter(Boolean);
        const n = entries.length;
        const xBase = arenaW * 0.18;
        entries.forEach((e, i) => {
            const col = Math.floor(i / Math.max(1, Math.ceil(n / 4)));
            const row = i % Math.max(1, Math.ceil(n / 4));
            const rows = Math.max(1, Math.ceil(n / 4));
            const ySpread = arenaH * 0.72;
            const yStart = arenaH * 0.14;
            const y = yStart + (rows <= 1 ? ySpread / 2 : (row / (rows - 1)) * ySpread);
            const xOff = -col * 22 + (Math.random() - 0.5) * 8;
            const u = cloneUnit(e.id, side, xBase + xOff, y + (Math.random() - 0.5) * 6, modifiers, {
                star: e.star,
                affix: e.affix,
                ownedUid: e.uid || null
            });
            if (u) units.push(u);
        });
        return units;
    }

    /**
     * Assassin blink — teleport beside the target when out of melee reach.
     * @returns {boolean}
     */
    function tryAssassinDash(u, target, arenaW, arenaH, fx, log) {
        if (!u || !target || !u.canDash || !u.alive || !target.alive) return false;
        if ((u.dashCd || 0) > 0) return false;
        const d = dist(u, target);
        const reach = (u.attackRange || 28) + (u.rangeType === "ranged" ? 8 : 10);
        if (d <= reach) return false;
        if (d < 36) return false;
        const ang = Math.atan2(target.y - u.y, target.x - u.x);
        let nx;
        let ny;
        if (u.rangeType === "ranged") {
            // Blink into comfortable shooting distance
            const landDist = Math.max(40, (u.attackRange || 100) * 0.55);
            nx = target.x - Math.cos(ang) * landDist;
            ny = target.y - Math.sin(ang) * landDist;
        } else {
            const landDist = (target.radius || 14) + (u.radius || 14) + 4;
            const side = (Math.random() < 0.5 ? 1 : -1) * 0.55;
            nx = target.x - Math.cos(ang) * landDist + Math.cos(ang + Math.PI / 2) * side * 12;
            ny = target.y - Math.sin(ang) * landDist + Math.sin(ang + Math.PI / 2) * side * 12;
        }
        if (fx) {
            fx.push({ type: "bolt", x0: u.x, y0: u.y, x1: nx, y1: ny, t: 0.1 });
            fx.push({ type: "ring", x: u.x, y: u.y, color: "#6b21a8", t: 0.2 });
            fx.push({ type: "ring", x: nx, y: ny, color: "#c4b5fd", t: 0.28 });
        }
        u.x = nx;
        u.y = ny;
        clampToArena(u, arenaW, arenaH);
        u.dashCd = 4.2;
        u.attackFlash = 0.22;
        u.facing = target.x >= u.x ? 1 : -1;
        if (log) {
            log.push({
                type: "skill",
                source: u.name,
                skill: "影閃",
                detail: `閃現至 ${target.name}`
            });
        }
        return true;
    }

    function calcDamage(attacker, target, modifiers, opts, battleState) {
        const tacAtk = tacticAdjust(battleState, attacker);
        const tacDef = tacticAdjust(battleState, target);
        let raw = attacker.atk * (attacker.buffs.atkMult || 1) * (attacker.effectAtkMult || 1) + (opts?.bonus || 0);
        if (target.role === "boss" && modifiers.bossDmg) raw *= modifiers.bossDmg;
        let dmg = Math.max(1, Math.floor(raw - (target.def + (target.buffs.defBonus || 0) + tacDef.defBonus) * 0.5));
        let crit = false;
        const tm = (battleState && battleState.modifiers && battleState.modifiers.tacticMods) || {};
        const forceCrit = battleState
            && battleState.activeTactic === "all_out"
            && attacker.side === "player"
            && tm.allOutFirstCrit
            && !battleState.allOutCritUsed;
        const critChance = Math.max(modifiers.critChance || 0, attacker.critChance || 0);
        if (forceCrit || (critChance && Math.random() < critChance)) {
            dmg = Math.floor(dmg * 1.5);
            crit = true;
            if (forceCrit) battleState.allOutCritUsed = true;
        }
        if (attacker.hp / attacker.maxHp < 0.5 && modifiers.lowHpAtk) {
            dmg = Math.floor(dmg * (1 + modifiers.lowHpAtk));
        }
        if (attacker.buffs.dmgMult && attacker.buffs.dmgMult !== 1) {
            dmg = Math.max(1, Math.floor(dmg * attacker.buffs.dmgMult));
        }
        if (tacAtk.dmg && tacAtk.dmg !== 1) {
            dmg = Math.max(1, Math.floor(dmg * tacAtk.dmg));
        }
        return { amount: dmg, crit };
    }

    function pushDmgFx(fx, x, y, amount, opts) {
        if (!fx || !(amount > 0)) return;
        const o = opts || {};
        fx.push({
            type: "dmg",
            x: x + (Math.random() - 0.5) * 10,
            y: y - 10,
            amount: Math.max(1, Math.floor(amount)),
            crit: !!o.crit,
            heal: !!o.heal,
            t: o.lite ? 0.45 : 0.75,
            life: o.lite ? 0.45 : 0.75
        });
    }

    function pushSparkFx(fx, x, y, lite) {
        if (!fx) return;
        if (lite) {
            fx.push({ type: "hit", x, y, t: 0.18 });
            return;
        }
        fx.push({
            type: "spark",
            x,
            y,
            t: 0.32,
            life: 0.32,
            color: "#fef3c7",
            seeds: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]
        });
    }

    function applyDamage(target, dmg, attacker, modifiers, log, fx, meta, battleState) {
        if (target.phaseIframes > 0) return 0;
        let remaining = dmg;
        if (target.side === "player" && modifiers.dmgTakenMult && modifiers.dmgTakenMult !== 1) {
            remaining = Math.max(1, Math.floor(remaining * modifiers.dmgTakenMult));
        }
        if (target.buffs && target.buffs.dmgTakenMult && target.buffs.dmgTakenMult !== 1) {
            remaining = Math.max(1, Math.floor(remaining * target.buffs.dmgTakenMult));
        }
        if (target.effectTakenMult && target.effectTakenMult !== 1) {
            remaining = Math.max(1, Math.floor(remaining * target.effectTakenMult));
        }
        const tac = tacticAdjust(battleState, target);
        if (tac.taken && tac.taken !== 1) {
            remaining = Math.max(1, Math.floor(remaining * tac.taken));
        }
        let absorbed = 0;
        if (target.shield > 0) {
            absorbed = Math.min(target.shield, remaining);
            target.shield -= absorbed;
            remaining -= absorbed;
        }
        if (remaining <= 0 && absorbed <= 0) return 0;

        const lite = !!(meta && meta.lite);
        const shown = remaining > 0 ? remaining : absorbed;
        if (fx && shown > 0) {
            pushDmgFx(fx, target.x, target.y, shown, { crit: !!meta?.crit, lite });
        }

        if (remaining > 0) {
            target.hp -= remaining;
            target.hurtFlash = 0.22;
            target.state = target.alive ? "hurt" : target.state;
            if (!target.stats) target.stats = { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null };
            target.stats.taken = (target.stats.taken || 0) + remaining;
            if (attacker) {
                if (!attacker.stats) attacker.stats = { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null };
                attacker.stats.dealt = (attacker.stats.dealt || 0) + remaining;
            }
            pushSparkFx(fx, target.x, target.y, lite);
            if (attacker && attacker.alive) {
                const dx = target.x - attacker.x;
                const dy = target.y - attacker.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = lite ? 4 : 7;
                target.kbX = (dx / d) * force;
                target.kbY = (dy / d) * force;
            }
        }

        if (log && attacker) {
            log.push({
                type: meta?.skill ? "skill_hit" : "attack",
                source: attacker.name,
                target: target.name,
                amount: remaining,
                shielded: absorbed,
                crit: !!meta?.crit,
                skill: meta?.skill || null,
                ...hpSnap(target)
            });
        }

        if (remaining <= 0) return 0;

        const units = battleState && battleState.units;
        const thornsPct = Math.max(modifiers.thorns || 0, target.unitThorns || 0);
        if (thornsPct && attacker && attacker.alive) {
            const reflect = Math.floor(remaining * thornsPct);
            if (reflect > 0) {
                if (!(attacker.phaseIframes > 0)) {
                    attacker.hp -= reflect;
                    attacker.hurtFlash = 0.15;
                    pushDmgFx(fx, attacker.x, attacker.y, reflect, { lite: true });
                    if (log) {
                        log.push({
                            type: "thorns",
                            source: target.name,
                            target: attacker.name,
                            amount: reflect,
                            ...hpSnap(attacker)
                        });
                    }
                    if (attacker.hp <= 0) {
                        if (!attacker.stats) attacker.stats = {};
                        attacker.stats.killedBy = `${target.name}（反傷）`;
                        if (!tryEnterBossPhase2(attacker, units, modifiers, log, fx)) {
                            killUnit(attacker, modifiers, log, fx);
                        }
                    }
                }
            }
        }
        const stealPct = Math.max(modifiers.lifesteal || 0, attacker?.unitLifesteal || 0);
        if (stealPct && attacker && attacker.alive) {
            const heal = Math.floor(remaining * stealPct);
            if (heal > 0) {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                if (!attacker.stats) attacker.stats = { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null };
                attacker.stats.healed = (attacker.stats.healed || 0) + heal;
                pushDmgFx(fx, attacker.x, attacker.y, heal, { heal: true, lite });
                if (log) {
                    log.push({
                        type: "lifesteal",
                        source: attacker.name,
                        amount: heal,
                        ...hpSnap(attacker)
                    });
                }
            }
        }
        if (target.hp <= 0) {
            if (!target.stats) target.stats = {};
            if (!target.stats.killedBy) {
                target.stats.killedBy = attacker
                    ? (meta?.skill ? `${attacker.name}（${meta.skill}）` : attacker.name)
                    : "未知";
            }
            if (!tryEnterBossPhase2(target, units, modifiers, log, fx)) {
                killUnit(target, modifiers, log, fx);
            }
        }
        return remaining;
    }

    function killUnit(unit, modifiers, log, fx) {
        if (modifiers.revive && !unit.revived && unit.side === "player" && !unit.temporary && unit.hp <= 0) {
            unit.revived = true;
            unit.hp = Math.floor(unit.maxHp * modifiers.revive);
            unit.alive = true;
            unit.alpha = 1;
            unit.deathPulse = 0;
            unit.state = "idle";
            if (fx) {
                fx.push({ type: "ring", x: unit.x, y: unit.y, r: unit.radius + 14, color: "#86efac", t: 0.45 });
                pushDmgFx(fx, unit.x, unit.y, Math.floor(unit.hp), { heal: true });
            }
            if (log) log.push({ type: "revive", target: unit.name, ...hpSnap(unit) });
            return;
        }
        unit.hp = 0;
        unit.alive = false;
        unit.state = "dead";
        unit.casting = null;
        unit.deathPulse = 1;
        if (fx) {
            fx.push({
                type: "death",
                x: unit.x,
                y: unit.y,
                r: unit.radius,
                color: unit.side === "player" ? "#4ade80" : "#f87171",
                t: 0.55,
                life: 0.55
            });
        }
        if (log) log.push({ type: "death", target: unit.name, ...hpSnap(unit) });
    }

    function skillNeedsCast(unit) {
        if (!unit.skill) return false;
        if (unit.skill.castTime != null && unit.skill.castTime > 0) return true;
        // Fallback: caster / summon roles cast by default
        return unit.role === "caster"
            || (Array.isArray(unit.tags) && (unit.tags.includes("caster") || unit.tags.includes("summon")));
    }

    function defaultCastTime(unit) {
        if (unit.skill && unit.skill.castTime != null) return unit.skill.castTime;
        if (unit.skill && unit.skill.id === "summon") return 1.5;
        if (unit.role === "caster" || (unit.tags && unit.tags.includes("caster"))) return 1.2;
        return 1.0;
    }

    function beginCast(unit, log, fx) {
        const duration = defaultCastTime(unit);
        unit.casting = { timer: 0, duration };
        unit.state = "cast";
        if (log) {
            log.push({
                type: "cast",
                source: unit.name,
                skill: unit.skill.name,
                duration
            });
        }
        if (fx) {
            fx.push({ type: "ring", x: unit.x, y: unit.y, r: unit.radius + 10, color: "#c4b5fd", t: 0.35 });
            fx.push({ type: "cast", x: unit.x, y: unit.y, r: unit.radius, t: 0.5, life: 0.5, uid: unit.uid });
        }
    }

    function angleDiff(a, b) {
        let d = Math.abs(a - b) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        return d;
    }

    function enemiesInArea(caster, enemies, opts) {
        const o = opts || {};
        const radius = o.radius != null ? o.radius : 50;
        const cx = o.x != null ? o.x : caster.x;
        const cy = o.y != null ? o.y : caster.y;
        const cone = o.cone;
        return enemies.filter((e) => {
            if (dist({ x: cx, y: cy }, e) > radius) return false;
            if (cone == null) return true;
            const face = caster.facing >= 0 ? 0 : Math.PI;
            const ang = Math.atan2(e.y - caster.y, e.x - caster.x);
            return angleDiff(ang, face) <= cone;
        });
    }

    function pickAoeFocus(unit, enemies) {
        if (!enemies.length) return null;
        const inRange = enemies.filter((e) => dist(unit, e) <= (unit.attackRange || 40) + 8);
        const pool = inRange.length ? inRange : enemies;
        return pool.reduce((a, b) => (dist(unit, a) <= dist(unit, b) ? a : b));
    }

    function useSkill(unit, allUnits, modifiers, log, fx, battleState) {
        if (!unit.skill) return;
        const enemies = living(allUnits).filter((u) => u.side !== unit.side);
        const allies = living(allUnits).filter((u) => u.side === unit.side);
        const skillPower = unit.skillPower || 1;
        const spBonus = (base) => Math.floor(base * skillPower);
        const skillName = unit.skill.name;
        const skillStatus = unit.skill.status || null;
        const lite = living(allUnits).length > (ARENA.softWarn || 40);
        const hit = (t, bonus) => {
            const rolled = calcDamage(unit, t, modifiers, { bonus: bonus || 0 }, battleState);
            applyDamage(t, rolled.amount, unit, modifiers, log, fx, {
                skill: skillName,
                crit: rolled.crit,
                lite
            }, battleState);
            if (skillStatus) applyStatus(t, skillStatus, unit, log);
            return rolled.amount;
        };
        const shoot = (t, color) => {
            if (!fx || !t) return;
            if (lite) {
                fx.push({ type: "bolt", x0: unit.x, y0: unit.y, x1: t.x, y1: t.y, t: 0.12 });
            } else {
                fx.push({
                    type: "proj",
                    x0: unit.x,
                    y0: unit.y,
                    x1: t.x,
                    y1: t.y,
                    t: 0.22,
                    life: 0.22,
                    color: color || "#93c5fd"
                });
            }
        };

        switch (unit.skill.id) {
            case "taunt":
                unit.buffs.taunt = true;
                unit.buffs.tauntTimer = 3;
                log.push({ type: "skill", source: unit.name, skill: skillName, detail: "吸引敵方攻擊" });
                if (fx) fx.push({ type: "ring", x: unit.x, y: unit.y, color: "#fbbf24", t: 0.4 });
                break;
            case "cleave": {
                const near = enemies.filter((e) => dist(unit, e) <= unit.attackRange + 40);
                near.forEach((t) => hit(t, spBonus(8)));
                break;
            }
            case "rage":
                unit.buffs.atkMult = 1.5;
                log.push({ type: "skill", source: unit.name, skill: skillName, detail: "攻擊大幅提升" });
                break;
            case "snipe": {
                const t = farthestEnemy(unit, allUnits) || nearestEnemy(unit, allUnits, battleState);
                if (t) {
                    shoot(t, "#fde68a");
                    hit(t, spBonus(20));
                }
                break;
            }
            case "pierce":
            case "frostbolt": {
                const t = nearestEnemy(unit, allUnits, battleState);
                if (t) {
                    if (unit.skill.id === "pierce") {
                        shoot(t, "#e2e8f0");
                        const dmg = Math.max(1, Math.floor(
                            unit.atk * 1.8 * skillPower * (unit.effectAtkMult || 1) - t.def * 0.2
                        ));
                        applyDamage(t, dmg, unit, modifiers, log, fx, { skill: skillName, lite }, battleState);
                        if (skillStatus) applyStatus(t, skillStatus, unit, log);
                    } else {
                        shoot(t, "#7dd3fc");
                        hit(t, spBonus(16));
                    }
                }
                break;
            }
            case "fireball":
            case "breath":
            case "meteor":
            case "death_coil": {
                const aoeR = unit.skill.aoe != null ? unit.skill.aoe
                    : (unit.skill.id === "meteor" ? 62
                        : unit.skill.id === "breath" ? 95
                            : unit.skill.id === "death_coil" ? 55 : 48);
                const aoeBonus = unit.skill.id === "meteor" ? spBonus(22)
                    : unit.skill.id === "death_coil" ? spBonus(28)
                        : unit.skill.id === "fireball" ? spBonus(15)
                            : unit.skill.id === "breath" ? spBonus(18) : spBonus(12);
                let targets;
                let cx;
                let cy;
                if (unit.skill.id === "breath" || unit.skill.cone != null) {
                    const cone = unit.skill.cone != null ? unit.skill.cone : 0.7;
                    // Impact centered ahead of caster
                    cx = unit.x + unit.facing * Math.min(50, (unit.attackRange || 40) * 0.55);
                    cy = unit.y;
                    targets = enemiesInArea(unit, enemies, { x: cx, y: cy, radius: aoeR, cone });
                } else {
                    const focus = pickAoeFocus(unit, enemies);
                    cx = focus ? focus.x : unit.x;
                    cy = focus ? focus.y : unit.y;
                    targets = enemiesInArea(unit, enemies, { x: cx, y: cy, radius: aoeR });
                }
                targets.forEach((t) => hit(t, aoeBonus));
                if (fx) {
                    fx.push({
                        type: "ring",
                        x: cx,
                        y: cy,
                        r: aoeR,
                        color: unit.skill.id === "death_coil" ? "#a855f7" : "#f97316",
                        t: 0.4
                    });
                }
                break;
            }
            case "war_cry":
                unit.buffs.atkMult = Math.max(unit.buffs.atkMult || 1, 2.0);
                unit.buffs.defBonus = (unit.buffs.defBonus || 0) + 10;
                log.push({ type: "skill", source: unit.name, skill: skillName, detail: "攻擊與防禦提升" });
                if (fx) fx.push({ type: "ring", x: unit.x, y: unit.y, color: "#fbbf24", t: 0.45 });
                break;
            case "smite": {
                const t = nearestEnemy(unit, allUnits, battleState);
                if (t) {
                    hit(t, spBonus(18));
                    unit.buffs.defBonus = (unit.buffs.defBonus || 0) + 8;
                }
                break;
            }
            case "heal": {
                const lowest = lowestHpAlly(allies);
                if (!lowest || lowest.hp / Math.max(1, lowest.maxHp) >= HEAL_HP_THRESHOLD) {
                    return;
                }
                const healMult = (unit.healBoost || 1) * (modifiers.healBoost || 1);
                const amt = Math.floor(30 * healMult * skillPower);
                lowest.hp = Math.min(lowest.maxHp, lowest.hp + amt);
                if (!unit.stats) unit.stats = { dealt: 0, taken: 0, healed: 0, statuses: 0, summons: 0, killedBy: null };
                unit.stats.healed = (unit.stats.healed || 0) + amt;
                log.push({
                    type: "heal",
                    source: unit.name,
                    skill: skillName,
                    target: lowest.name,
                    amount: amt,
                    ...hpSnap(lowest)
                });
                if (fx) {
                    fx.push({ type: "ring", x: lowest.x, y: lowest.y, color: "#4ade80", t: 0.3 });
                    pushDmgFx(fx, lowest.x, lowest.y, amt, { heal: true, lite });
                }
                break;
            }
            case "execute": {
                const t = pickExecuteTarget(unit, allUnits, battleState);
                if (!t) return;
                hit(t, spBonus(40));
                break;
            }
            case "buff":
                allies.forEach((a) => { a.buffs.atkMult = Math.max(a.buffs.atkMult, 1.2); });
                log.push({ type: "skill", source: unit.name, skill: skillName, detail: "全隊攻擊提升" });
                break;
            case "summon": {
                const n = summonUnits(unit, allUnits, modifiers, log, fx);
                if (!n) {
                    log.push({ type: "skill", source: unit.name, skill: skillName, detail: "召喚數量已達上限" });
                }
                // Optional follow-up area nuke (e.g. Lich King)
                if (unit.skill.also === "death_coil") {
                    const aoeR = unit.skill.aoe != null ? unit.skill.aoe : 55;
                    const focus = pickAoeFocus(unit, enemies);
                    const cx = focus ? focus.x : unit.x;
                    const cy = focus ? focus.y : unit.y;
                    enemiesInArea(unit, enemies, { x: cx, y: cy, radius: aoeR })
                        .forEach((t) => hit(t, spBonus(22)));
                    if (fx) fx.push({ type: "ring", x: cx, y: cy, r: aoeR, color: "#a855f7", t: 0.4 });
                }
                break;
            }
            default:
                break;
        }
        unit.skill.timer = 0;
        unit.attackFlash = 0.2;
    }

    function separate(units) {
        for (let i = 0; i < units.length; i++) {
            const a = units[i];
            if (!a.alive) continue;
            for (let j = i + 1; j < units.length; j++) {
                const b = units[j];
                if (!b.alive) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const minD = a.radius + b.radius;
                if (d < minD) {
                    const push = (minD - d) * 0.5;
                    const nx = dx / d;
                    const ny = dy / d;
                    a.x -= nx * push;
                    a.y -= ny * push;
                    b.x += nx * push;
                    b.y += ny * push;
                }
            }
        }
    }

    function skillNeedsTarget(unit) {
        if (!unit || !unit.skill) return false;
        // Summon / self-buff style skills do not require an enemy in range
        const id = unit.skill.id;
        return !(id === "summon" || id === "heal" || id === "taunt" || id === "rage"
            || id === "war_cry" || id === "buff");
    }

    function tickBattle(state, dt) {
        const { units, modifiers, log, fx, arenaW, arenaH } = state;
        const players = living(units, "player");
        const enemies = living(units, "enemy");

        if (!players.length || !enemies.length) {
            state.finished = true;
            state.winner = players.length ? "player" : "enemy";
            return state;
        }

        if (state.activeTactic && state.tacticTimer > 0) {
            state.tacticTimer -= dt;
            if (state.tacticTimer <= 0) {
                const ended = state.activeTactic;
                state.activeTactic = null;
                state.tacticTimer = 0;
                const def = (TACTICS || []).find((t) => t.id === ended);
                if (log) {
                    log.push({
                        type: "tactic",
                        skill: def ? def.name : ended,
                        detail: "戰術結束"
                    });
                }
            }
        }

        const cdMult = modifiers.skillCdMult || 1;
        const many = units.filter((u) => u.alive).length > (ARENA.softWarn || 40);
        const skillsBlocked = (u) => u.silenced || (modifiers.noSkills && u.side === "player");

        units.forEach((u) => {
            if (!u.alive) {
                u.alpha = Math.max(0, u.alpha - dt * 2.2);
                u.deathPulse = (u.deathPulse || 1) + dt * 1.8;
                return;
            }
            if (u.buffs.tauntTimer > 0) {
                u.buffs.tauntTimer -= dt;
                if (u.buffs.tauntTimer <= 0) u.buffs.taunt = false;
            }
            if (u.hurtFlash > 0) u.hurtFlash -= dt;
            if (u.attackFlash > 0) u.attackFlash -= dt;
            if (u.phaseIframes > 0) u.phaseIframes -= dt;
            if (u.dashCd > 0) u.dashCd -= dt;
            if (u.kbX || u.kbY) {
                u.x += (u.kbX || 0) * dt * 10;
                u.y += (u.kbY || 0) * dt * 10;
                u.kbX *= Math.max(0, 1 - dt * 10);
                u.kbY *= Math.max(0, 1 - dt * 10);
                if (Math.abs(u.kbX) < 0.05) u.kbX = 0;
                if (Math.abs(u.kbY) < 0.05) u.kbY = 0;
            }
            u.anim += dt;

            tickUnitEffects(u, dt, modifiers, log, fx, units);
            if (!u.alive) return;

            if (u.canFight === false) {
                u.casting = null;
                u.state = "idle";
                clampToArena(u, arenaW, arenaH);
                return;
            }

            const target = nearestEnemy(u, units, state);
            const tac = tacticAdjust(state, u);
            const moveMult = (u.effectMoveMult || 1) * (tac.move || 1);
            const spdMult = u.effectSpdMult || 1;
            const canSkill = u.skill && !skillsBlocked(u);

            if (target) {
                u.targetUid = target.uid;
                u.facing = target.x >= u.x ? 1 : -1;
            }

            if (u.casting) {
                u.state = "cast";
                u.casting.timer += dt * spdMult;
                // Soft pulse while channeling
                if (fx && !many && Math.random() < dt * 2.5) {
                    fx.push({
                        type: "cast",
                        x: u.x,
                        y: u.y,
                        r: u.radius,
                        t: 0.35,
                        life: 0.35
                    });
                }
                if (u.casting.timer >= u.casting.duration) {
                    u.casting = null;
                    if (canSkill && shouldUseSkillNow(u, units, state)) {
                        useSkill(u, units, modifiers, log, fx, state);
                    }
                }
                clampToArena(u, arenaW, arenaH);
                return;
            }

            if (canSkill) {
                u.skill.timer += dt;
                const cd = (u.skill.cd || 6) * cdMult * (u.skillCdMult || 1);
                if (u.skill.timer >= cd) {
                    const needsEnemy = skillNeedsTarget(u);
                    if ((!needsEnemy || target) && shouldUseSkillNow(u, units, state)) {
                        if (skillNeedsCast(u)) {
                            beginCast(u, log, fx);
                            clampToArena(u, arenaW, arenaH);
                            return;
                        }
                        useSkill(u, units, modifiers, log, fx, state);
                    }
                }
            }

            if (!target) {
                u.state = "idle";
                clampToArena(u, arenaW, arenaH);
                return;
            }

            const d = dist(u, target);
            const meleeReach = (u.radius || 14) + (target.radius || 14) + 4;

            if (tryRangedKite(u, target, dt, moveMult, arenaW, arenaH)) {
                return;
            }

            if (d > u.attackRange && !(u.rangeType === "melee" && d <= meleeReach)) {
                if (u.canDash && tryAssassinDash(u, target, arenaW, arenaH, fx, log)) {
                    u.state = "attack";
                    clampToArena(u, arenaW, arenaH);
                    return;
                }
                const nx = (target.x - u.x) / d;
                const ny = (target.y - u.y) / d;
                u.x += nx * u.moveSpeed * moveMult * dt;
                u.y += ny * u.moveSpeed * moveMult * dt;
                u.state = "move";
            } else {
                u.state = "attack";
                u.attackTimer += dt * u.spd * spdMult;
                if (u.attackTimer >= 1) {
                    u.attackTimer = 0;
                    u.attackFlash = 0.18;
                    const shots = Math.max(1, u.multishot || 1);
                    const targets = nearestEnemies(u, units, shots, state);
                    targets.forEach((t, i) => {
                        const scale = i === 0 ? 1 : 0.85;
                        const rolled = calcDamage(u, t, modifiers, null, state);
                        const dmg = Math.max(1, Math.floor(rolled.amount * scale));
                        if (u.rangeType === "ranged" && fx) {
                            if (many) {
                                fx.push({ type: "bolt", x0: u.x, y0: u.y, x1: t.x, y1: t.y, t: 0.12 });
                            } else {
                                fx.push({
                                    type: "proj",
                                    x0: u.x,
                                    y0: u.y,
                                    x1: t.x,
                                    y1: t.y,
                                    t: 0.2,
                                    life: 0.2,
                                    color: "#93c5fd"
                                });
                            }
                        }
                        applyDamage(t, dmg, u, modifiers, log, fx, {
                            crit: rolled.crit && i === 0,
                            lite: many
                        }, state);
                        tryApplyOnHit(u, t, log);
                    });
                }
            }
            clampToArena(u, arenaW, arenaH);
        });

        separate(units);
        units.forEach((u) => { if (u.alive) clampToArena(u, arenaW, arenaH); });

        for (let i = fx.length - 1; i >= 0; i--) {
            fx[i].t -= dt;
            if (fx[i].t <= 0) fx.splice(i, 1);
        }
        const fxCap = many ? 60 : 140;
        if (fx.length > fxCap) fx.splice(0, fx.length - fxCap);
        if (log.length > 80) log.splice(0, log.length - 80);

        state.elapsed += dt;
        if (state.elapsed > 180) {
            state.finished = true;
            const pHp = players.reduce((s, u) => s + u.hp, 0);
            const eHp = enemies.reduce((s, u) => s + u.hp, 0);
            state.winner = pHp >= eHp ? "player" : "enemy";
        }
        return state;
    }

    function spawnFromPlacements(entries, side, modifiers, arenaW, arenaH) {
        if (!entries || !entries.length) return [];
        if (side === "player" && typeof entries[0] === "object" && entries[0] && Number.isFinite(entries[0].x)) {
            return entries.map((e) => {
                const pad = 16;
                const x = Math.max(pad, Math.min(arenaW * 0.48, e.x));
                const y = Math.max(pad, Math.min(arenaH - pad, e.y));
                return cloneUnit(e.id, side, x, y, modifiers, {
                    star: e.star || 1,
                    affix: e.affix || null,
                    ownedUid: e.uid || null
                });
            }).filter(Boolean);
        }
        return spawnColumn(entries, side, modifiers, arenaW, arenaH);
    }

    function activateTactic(state, tacticId) {
        if (!state || state.finished) return false;
        if ((state.tacticsLeft || 0) <= 0) return false;
        if (state.activeTactic) return false;
        if ((state.usedTactics || []).includes(tacticId)) return false;
        const def = (TACTICS || []).find((t) => t.id === tacticId);
        if (!def) return false;
        const tm = (state.modifiers && state.modifiers.tacticMods) || {};
        let duration = def.duration || 3;
        if (tacticId === "focus_fire" && tm.focusDuration) duration += tm.focusDuration;
        state.activeTactic = tacticId;
        state.tacticTimer = duration;
        state.tacticsLeft -= 1;
        state.usedTactics = state.usedTactics || [];
        state.usedTactics.push(tacticId);
        if (tacticId === "all_out") state.allOutCritUsed = false;
        if (tacticId === "hold_line" && tm.holdCleanse) {
            (state.units || []).forEach((u) => {
                if (u.side === "player" && u.alive && u.effects) {
                    u.effects = u.effects.filter((e) => {
                        const t = e.type;
                        return t !== "poison" && t !== "bleed" && t !== "burn" && t !== "freeze"
                            && t !== "shock" && t !== "weaken" && t !== "vulnerable" && t !== "root" && t !== "silence";
                    });
                }
            });
        }
        state.log.push({
            type: "tactic",
            skill: def.name,
            detail: def.desc + (tacticId === "hold_line" && tm.holdCleanse ? "（已淨化）" : "")
        });
        return true;
    }

    function createBattle(playerArmy, enemyArmy, modifiers, arena) {
        uidSeq = 0;
        const arenaW = arena?.width || ARENA.width;
        const arenaH = arena?.height || ARENA.height;
        const mods = modifiers || {};
        const units = [
            ...spawnFromPlacements(playerArmy, "player", mods, arenaW, arenaH),
            ...spawnFromPlacements(enemyArmy, "enemy", mods, arenaW, arenaH)
        ];
        const chargeBonus = (mods.tacticMods && mods.tacticMods.tacticsCharges) || 0;
        return {
            units,
            modifiers: mods,
            log: [],
            fx: [],
            arenaW,
            arenaH,
            elapsed: 0,
            finished: false,
            winner: null,
            tacticsLeft: 2 + chargeBonus,
            usedTactics: [],
            activeTactic: null,
            tacticTimer: 0,
            allOutCritUsed: false,
            tick(dt) { return tickBattle(this, dt); },
            activateTactic(id) { return activateTactic(this, id); }
        };
    }

    function summarizeBattleStats(units) {
        return (units || [])
            .filter((u) => u && u.side === "player" && !u.temporary)
            .map((u) => ({
                name: u.name,
                icon: u.icon || "",
                dealt: Math.floor(u.stats?.dealt || 0),
                taken: Math.floor(u.stats?.taken || 0),
                healed: Math.floor(u.stats?.healed || 0),
                statuses: u.stats?.statuses || 0,
                summons: u.stats?.summons || 0,
                alive: !!u.alive,
                killedBy: u.stats?.killedBy || null
            }))
            .sort((a, b) => b.dealt - a.dealt || b.healed - a.healed);
    }

    function generateEnemyArmy(pool, count, rng, bossId) {
        if (bossId) {
            // Adds first, boss last — layoutEnemySlots still centers the boss by role
            // `count` = number of adds when provided; default scales lightly for legacy calls
            const army = [];
            const adds = count > 0 ? count : (3 + Math.floor(rng() * 2));
            for (let i = 0; i < adds; i++) {
                army.push(pool[Math.floor(rng() * pool.length)]);
            }
            army.push(bossId);
            return army;
        }
        const army = [];
        const n = Math.max(1, count);
        for (let i = 0; i < n; i++) {
            army.push(pool[Math.floor(rng() * pool.length)]);
        }
        return army;
    }

    /** Preview final player stats (star + artifacts/abilities/tag bonuses). No terrain. */
    function previewPlayerStats(unitId, star, modifiers) {
        const u = cloneUnit(unitId, "player", 0, 0, modifiers || {}, { star: star || 1 });
        if (!u) return null;
        return {
            hp: u.maxHp,
            atk: u.atk,
            def: u.def,
            spd: Math.round(u.spd * 100) / 100,
            moveSpeed: Math.round(u.moveSpeed * 10) / 10,
            attackRange: u.attackRange,
            skillCdMult: u.skillCdMult || 1,
            skillPower: u.skillPower || 1,
            healBoost: u.healBoost || 1,
            critChance: u.critChance || 0,
            summonMaxBonus: u.summonMaxBonus || 0,
            shield: u.shield || 0,
            onHit: u.onHit ? asOnHitList(u.onHit) : null,
            role: u.role,
            rangeType: u.rangeType,
            canFight: u.canFight !== false
        };
    }

    /** @deprecated use generateEnemyArmy */
    function generateEnemyFormation(pool, count, rng, bossId) {
        return generateEnemyArmy(pool, count, rng, bossId);
    }

    global.WarBattle = {
        createBattle,
        activateTactic,
        previewPlayerStats,
        summarizeBattleStats,
        generateEnemyArmy,
        generateEnemyFormation,
        layoutEnemySlots,
        living,
        ARENA
    };
})(typeof window !== "undefined" ? window : globalThis);
