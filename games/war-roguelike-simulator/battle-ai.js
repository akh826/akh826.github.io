/**
 * War Roguelike — battle AI (targeting, kiting, skill thresholds).
 */
(function (global) {
    "use strict";

    const HEAL_HP_THRESHOLD = 0.85;
    const EXECUTE_HP_THRESHOLD = 0.3;
    const RANGED_KITE_RATIO = 0.55;

    function dist(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function living(units, side) {
        return units.filter((u) => u.alive && (!side || u.side === side));
    }

    function unitThreat(u) {
        if (!u) return 1;
        let threat = 1;
        const tags = u.tags || [];
        const isTank = u.role === "tank" || tags.includes("tank") || tags.includes("guard");
        const isSummon = !!u.temporary || u.role === "summon" || tags.includes("summon");
        const isAssassin = u.role === "assassin" || tags.includes("assassin");
        if (isTank) threat = Math.max(threat, 3.4);
        if (isSummon) threat = Math.max(threat, 2.9);
        if (isAssassin) threat = Math.min(threat, 0.28);
        if (u.buffs && u.buffs.taunt) threat *= 4.5;
        return Math.max(0.12, threat);
    }

    function targetScore(from, to) {
        return dist(from, to) / unitThreat(to);
    }

    function clampToArena(u, w, h) {
        const pad = u.radius + 2;
        u.x = Math.max(pad, Math.min(w - pad, u.x));
        u.y = Math.max(pad, Math.min(h - pad, u.y));
    }

    function lowestHpEnemy(unit, units) {
        let best = null;
        let bestRatio = Infinity;
        living(units).filter((e) => e.side !== unit.side).forEach((e) => {
            const ratio = e.hp / Math.max(1, e.maxHp);
            if (ratio < bestRatio) {
                bestRatio = ratio;
                best = e;
            }
        });
        return best;
    }

    function nearestEnemy(unit, units, battleState) {
        if (battleState && battleState.activeTactic === "focus_fire" && unit.side === "player") {
            const focus = lowestHpEnemy(unit, units);
            if (focus) return focus;
        }
        let best = null;
        let bestScore = Infinity;
        const preferTaunt = living(units).filter((e) => e.side !== unit.side && e.buffs.taunt);
        const pool = preferTaunt.length ? preferTaunt : living(units).filter((e) => e.side !== unit.side);
        for (const e of pool) {
            const score = targetScore(unit, e);
            if (score < bestScore) {
                bestScore = score;
                best = e;
            }
        }
        return best;
    }

    function nearestEnemies(unit, allUnits, count, battleState) {
        let pool = living(allUnits).filter((u) => u.side !== unit.side);
        if (battleState && battleState.activeTactic === "focus_fire" && unit.side === "player") {
            pool = [...pool].sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)));
        } else {
            pool = [...pool].sort((a, b) => targetScore(unit, a) - targetScore(unit, b));
        }
        return pool.slice(0, Math.max(1, count || 1));
    }

    function farthestEnemy(unit, units) {
        let best = null;
        let bestD = -1;
        living(units).filter((e) => e.side !== unit.side).forEach((e) => {
            const d = dist(unit, e);
            if (d > bestD) {
                bestD = d;
                best = e;
            }
        });
        return best;
    }

    function lowestHpAlly(allies) {
        if (!allies || !allies.length) return null;
        return allies.reduce((a, b) => (a.hp / Math.max(1, a.maxHp) < b.hp / Math.max(1, b.maxHp) ? a : b));
    }

    function allyNeedsHeal(allUnits, side) {
        const lowest = lowestHpAlly(living(allUnits, side));
        if (!lowest) return false;
        return lowest.hp / Math.max(1, lowest.maxHp) < HEAL_HP_THRESHOLD;
    }

    function enemyInAttackReach(unit, enemy) {
        const d = dist(unit, enemy);
        if (unit.rangeType === "melee") {
            return d <= unit.attackRange || d <= (unit.radius || 14) + (enemy.radius || 14) + 4;
        }
        return d <= unit.attackRange;
    }

    function pickExecuteTarget(unit, allUnits, battleState) {
        const enemies = living(allUnits).filter((e) => e.side !== unit.side);
        const low = enemies.filter((e) => {
            return e.hp / Math.max(1, e.maxHp) < EXECUTE_HP_THRESHOLD && enemyInAttackReach(unit, e);
        });
        if (!low.length) return null;
        if (battleState && battleState.activeTactic === "focus_fire" && unit.side === "player") {
            return low.reduce((a, b) => (a.hp / Math.max(1, a.maxHp) < b.hp / Math.max(1, b.maxHp) ? a : b));
        }
        return low.reduce((a, b) => (targetScore(unit, a) < targetScore(unit, b) ? a : b));
    }

    function shouldUseSkillNow(unit, allUnits, battleState) {
        if (!unit || !unit.skill) return false;
        const id = unit.skill.id;
        if (id === "heal") return allyNeedsHeal(allUnits, unit.side);
        if (id === "execute") return !!pickExecuteTarget(unit, allUnits, battleState);
        return true;
    }

    function tryRangedKite(u, target, dt, moveMult, arenaW, arenaH) {
        if (!u || !target || u.rangeType !== "ranged") return false;
        if (u.effectMoveMult <= 0 || moveMult <= 0) return false;
        const d = dist(u, target);
        const range = u.attackRange || 28;
        if (d >= range * RANGED_KITE_RATIO || d < 0.01) return false;
        const nx = (u.x - target.x) / d;
        const ny = (u.y - target.y) / d;
        u.x += nx * u.moveSpeed * moveMult * dt;
        u.y += ny * u.moveSpeed * moveMult * dt;
        u.state = "move";
        clampToArena(u, arenaW, arenaH);
        return true;
    }

    global.WarBattleAI = {
        HEAL_HP_THRESHOLD,
        EXECUTE_HP_THRESHOLD,
        RANGED_KITE_RATIO,
        dist,
        living,
        unitThreat,
        targetScore,
        clampToArena,
        lowestHpEnemy,
        nearestEnemy,
        nearestEnemies,
        farthestEnemy,
        lowestHpAlly,
        allyNeedsHeal,
        enemyInAttackReach,
        pickExecuteTarget,
        shouldUseSkillNow,
        tryRangedKite
    };
})(typeof window !== "undefined" ? window : globalThis);
