/**
 * War Roguelike — UI controller (arena brawl).
 */
(function () {
    "use strict";

    const { WORLDS, UNITS, ARTIFACTS, ROOM_TYPES, ARENA, TAGS, TACTICS, ELITE_AFFIXES, TACTIC_UPGRADES } = WarData;
    const { getNode, getReachableNext, moveToNode } = WarMap;
    const { createBattle } = WarBattle;
    const C = WarCtx;

    function syncCtx() {
        C.state = state;
        C.battle = battle;
        C.battleRaf = battleRaf;
        C.lastFrame = lastFrame;
        C.logAccum = logAccum;
        C.battleSpeed = battleSpeed;
        C.pendingEncounter = pendingEncounter;
        C.pendingRewardType = pendingRewardType;
        C.pendingRewardSource = pendingRewardSource;
        C.rewardRefreshLeft = rewardRefreshLeft;
        C.currentRewardOffers = currentRewardOffers;
        C.currentEvent = currentEvent;
        C.battleEnded = battleEnded;
        C.prepDragIndex = prepDragIndex;
        C.prepPointerId = prepPointerId;
        C.contractTickedForNode = contractTickedForNode;
        C.combatContractPending = combatContractPending;
    }

    function pullCtx() {
        state = C.state;
        battle = C.battle;
        battleRaf = C.battleRaf;
        lastFrame = C.lastFrame;
        logAccum = C.logAccum;
        battleSpeed = C.battleSpeed;
        pendingEncounter = C.pendingEncounter;
        pendingRewardType = C.pendingRewardType;
        pendingRewardSource = C.pendingRewardSource;
        rewardRefreshLeft = C.rewardRefreshLeft;
        currentRewardOffers = C.currentRewardOffers;
        currentEvent = C.currentEvent;
        battleEnded = C.battleEnded;
        prepDragIndex = C.prepDragIndex;
        prepPointerId = C.prepPointerId;
        contractTickedForNode = C.contractTickedForNode;
        combatContractPending = C.combatContractPending;
    }

    let state = null;
    let battle = null;
    let battleRaf = null;
    let lastFrame = 0;
    let logAccum = 0;
    let battleSpeed = 1;
    let pendingEncounter = null;
    let pendingRewardType = "artifact";
    let pendingRewardSource = null; // "treasure" | "boss" | "combat" | null
    let rewardRefreshLeft = 0;
    let currentRewardOffers = [];
    let currentEvent = null;
    let battleEnded = false;
    let prepDragIndex = -1;
    let prepPointerId = null;
    let contractTickedForNode = null;
    let combatContractPending = false;
    let endlessAutoTimer = null;

    const $ = (id) => document.getElementById(id);

    function clearEndlessAutoTimer() {
        if (endlessAutoTimer != null) {
            clearTimeout(endlessAutoTimer);
            endlessAutoTimer = null;
        }
    }

    function scheduleEndlessAuto(fn, delay) {
        clearEndlessAutoTimer();
        endlessAutoTimer = setTimeout(() => {
            endlessAutoTimer = null;
            fn();
        }, delay);
    }

    function updateEndlessAutoUi() {
        const show = !!(state && state.endless);
        const on = !!(state && state.endless && state.endlessAutoRun);
        ["endlessAutoBtn", "formationAutoBtn", "battleAutoBtn"].forEach((id) => {
            const el = $(id);
            if (!el) return;
            el.hidden = !show;
            el.classList.toggle("is-active", on);
            el.textContent = on ? "自動連戰：開" : "自動連戰：關";
            el.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }

    function setEndlessAutoRun(on) {
        if (!state || !state.endless) return;
        state.endlessAutoRun = !!on;
        updateEndlessAutoUi();
        WarState.saveGame(state);
        if (state.endlessAutoRun) {
            if (state.phase === "map" && screens.map.hidden === false) {
                scheduleEndlessAuto(() => tryEndlessAutoRun(), 150);
            } else if (state.phase === "formation" && screens.formation.hidden === false) {
                scheduleEndlessAuto(() => startBattle(), 150);
            }
        } else {
            clearEndlessAutoTimer();
        }
    }

    function toggleEndlessAutoRun() {
        if (!state || !state.endless) return;
        setEndlessAutoRun(!state.endlessAutoRun);
    }

    function deployAllEligible(opts) {
        ensureArmyNormalized();
        const mods = WarState.aggregateModifiers(state);
        if (!Array.isArray(state.army)) state.army = [];

        const deployed = new Set(
            (state.army || []).map((e) => WarState.armyUnitUid(e)).filter(Boolean)
        );
        const toAdd = [];
        WarState.normalizeOwnedList(state.ownedUnits || [], state).forEach((entry) => {
            if (!WarState.unitMayFight(entry.id, mods)) return;
            if (deployed.has(entry.uid)) return;
            toAdd.push(entry);
        });

        if (toAdd.length) {
            toAdd.forEach((e) => {
                WarState.appendArmyUnit(state.army, e.id, e.star, e.uid);
            });
        }

        if (opts?.silent) return;

        const restrictLabel = WarState.fightRestrictionLabel(mods);
        if (restrictLabel) {
            $("formationHint").textContent = `已補上符合 [${restrictLabel}] 的未出戰單位`;
        } else if (toAdd.length) {
            $("formationHint").textContent = `已派出 ${toAdd.length} 隻未出戰單位`;
        } else {
            $("formationHint").textContent = "所有可出戰單位已在場上";
        }
    }

    function prepareEndlessFormation() {
        ensureArmyNormalized({ restoreIfEmpty: true });
        if (!state.army || !state.army.length) deployAllEligible({ silent: true });
    }

    function setEndlessFormationHints(node) {
        if (!node) return;
        if (node.type === "boss") {
            $("formationHint").textContent = state.endless
                ? `無盡 Boss（第 ${(state.endlessStages || 0) + 1} 關）· 無獎勵`
                : `準備迎戰 ${WarState.getActiveWorld(state).bossName}！Boss 有二階段（首條命歸零會回血覺醒）`;
        } else if (node.type === "epic_combat") {
            $("formationHint").textContent = state.endless
                ? `無盡史詩戰（第 ${(state.endlessStages || 0) + 1} 關）· 無獎勵`
                : "史詩戰鬥：敵軍更強更多 · 勝利可獲高稀有獎勵";
        } else {
            $("formationHint").textContent = "先選出戰單位，再拖曳左側站位";
        }
    }

    function endlessAutoAdvanceToFight() {
        if (!state || !state.endless || !state.endlessAutoRun) return;
        if (state.phase !== "map") return;

        const reachable = getReachableNext(state.map);
        if (!reachable.length) return;

        const next = reachable.find((n) => n.type === "epic_combat" || n.type === "boss") || reachable[0];
        if (!next || (next.type !== "epic_combat" && next.type !== "boss")) return;

        if (!moveToNode(state.map, next.id)) return;
        WarState.saveGame(state);
        contractTickedForNode = null;
        pendingEncounter = WarState.getCombatEncounter(state, next);
        state.phase = "formation";
        setEndlessFormationHints(next);
        showScreen("formation");
        prepareEndlessFormation();
        renderArmyPrep();
        updateEndlessAutoUi();
        scheduleEndlessAuto(() => startBattle(), 150);
    }

    function tryEndlessAutoRun() {
        if (!state || !state.endless || !state.endlessAutoRun) return;
        if (state.phase !== "map" || screens.map.hidden !== false) return;
        endlessAutoAdvanceToFight();
    }

    function resumeEndlessAfterBossRing() {
        state.phase = "map";
        showScreen("map");
        renderMap();
        updateHud();
        WarState.saveGame(state);
        if (state.endlessAutoRun) scheduleEndlessAuto(() => endlessAutoAdvanceToFight(), 200);
    }

    function proceedEndlessAfterBattle(isBoss) {
        if (!battleEnded || !battle || !battle.finished) return;
        if (isBoss) {
            notifyContractTick(true);
            finishRoom();
            return;
        }
        const n = getNode(state.map, state.map.currentNodeId);
        if (n) n.cleared = true;
        notifyContractTick(true);
        state.phase = "map";
        showScreen("map");
        renderMap();
        updateHud();
        WarState.saveGame(state);
        if (state.endlessAutoRun) scheduleEndlessAuto(() => endlessAutoAdvanceToFight(), 200);
    }

    function notifyContractTick(isCombat) {
        if (!isCombat || !state || !combatContractPending) return;
        const nid = state.map?.currentNodeId;
        if (nid != null && contractTickedForNode === nid) {
            combatContractPending = false;
            return;
        }
        if (nid != null) contractTickedForNode = nid;
        combatContractPending = false;
        const tick = WarState.tickContracts(state, { isCombat: true });
        if (tick.expired && tick.expired.length) {
            const names = tick.expired.map((c) => c.name).join("、");
            if ($("battleLog") && state.phase === "battle") {
                $("battleLog").innerHTML += `<p class="war-log-status">📜 契約結束：${names}</p>`;
            }
        }
        renderArtifactBar();
        updateHud();
    }

    const screens = {
        title: $("screenTitle"),
        map: $("screenMap"),
        formation: $("screenFormation"),
        battle: $("screenBattle"),
        settlement: $("screenSettlement"),
        reward: $("screenReward"),
        victory: $("screenVictory"),
        defeat: $("screenDefeat")
    };

    function showScreen(name) {
        Object.entries(screens).forEach(([key, el]) => {
            if (el) el.hidden = key !== name;
        });
        $("warHud").hidden = name === "title" || name === "victory" || name === "defeat";
    }

    function updateHud() {
        if (!state) return;
        const world = WarState.getActiveWorld(state);
        if (state.endless) {
            const best = WarState.getEndlessBest();
            $("hudWorld").textContent = `無盡 ${state.endlessStages || 0}關 · 環${state.endlessLoop || 1} · ${world.name}${best ? ` · 最佳${best}` : ""}`;
        } else {
            $("hudWorld").textContent = `${world.name} (${state.worldIndex + 1}/${WORLDS.length})`;
        }
        $("hudGold").textContent = state.gold;
    }

    function renderArtifactBar() {
        const bar = $("artifactBar");
        bar.innerHTML = "";
        state.artifacts.forEach((id) => {
            const art = ARTIFACTS.find((a) => a.id === id);
            if (!art) return;
            const chip = document.createElement("span");
            chip.className = art.cursed ? "war-artifact-chip war-artifact-chip--cursed" : "war-artifact-chip";
            chip.textContent = art.cursed ? `☠${art.name}` : art.name;
            chip.title = art.desc;
            bar.appendChild(chip);
        });
        state.abilities.forEach((id) => {
            const ab = WarData.ABILITIES.find((a) => a.id === id);
            if (!ab) return;
            const chip = document.createElement("span");
            chip.className = "war-artifact-chip";
            chip.textContent = `★${ab.name}`;
            chip.title = ab.desc;
            bar.appendChild(chip);
        });
        (state.tacticUpgrades || []).forEach((id) => {
            const up = (TACTIC_UPGRADES || []).find((t) => t.id === id);
            if (!up) return;
            const chip = document.createElement("span");
            chip.className = "war-artifact-chip";
            chip.textContent = `⚔${up.name}`;
            chip.title = up.desc;
            bar.appendChild(chip);
        });
        (state.activeContracts || []).forEach((c) => {
            const chip = document.createElement("span");
            chip.className = "war-artifact-chip war-artifact-chip--cursed";
            chip.textContent = `📜${c.name}(${c.roomsLeft})`;
            chip.title = c.desc || `剩餘 ${c.roomsLeft} 場戰鬥`;
            bar.appendChild(chip);
        });
        renderItemCodex();
    }

    function renderItemCodex() {
        const list = $("itemCodexList");
        if (!list) return;
        list.innerHTML = "";
        const profile = WarBuildHints.getBuildProfile(state, WarData, WarState);
        const buildBlock = document.createElement("section");
        buildBlock.className = "war-codex-build";
        buildBlock.innerHTML = `<h3 class="war-codex-subtitle">Build 標籤</h3>${WarBuildHints.buildTagsHtml(profile, TAGS)}`;
        list.appendChild(buildBlock);

        const artifacts = state.artifacts
            .map((id) => ARTIFACTS.find((a) => a.id === id))
            .filter(Boolean)
            .map((art) => ({ label: `神器｜${art.name}`, desc: `[${(WarData.RARITY[art.rarity] || {}).label || art.rarity}] ${art.desc}` }));
        const abilities = state.abilities
            .map((id) => WarData.ABILITIES.find((a) => a.id === id))
            .filter(Boolean)
            .map((ab) => ({ label: `能力｜${ab.name}`, desc: `[${(WarData.RARITY[ab.rarity] || {}).label || ab.rarity || "普通"}] ${ab.desc}` }));
        const tactics = (state.tacticUpgrades || [])
            .map((id) => (TACTIC_UPGRADES || []).find((t) => t.id === id))
            .filter(Boolean)
            .map((t) => ({ label: `戰術｜${t.name}`, desc: `[${(WarData.RARITY[t.rarity] || {}).label || t.rarity}] ${t.desc}` }));
        const contracts = (state.activeContracts || []).map((c) => ({
            label: `契約｜${c.name}`,
            desc: `${c.desc || ""}（剩餘 ${c.roomsLeft} 場）`
        }));
        const all = [...artifacts, ...abilities, ...tactics, ...contracts];
        if (!all.length) {
            const empty = document.createElement("p");
            empty.className = "war-hint";
            empty.textContent = "目前尚未獲得神器或能力。";
            list.appendChild(empty);
            return;
        }
        all.forEach((item) => {
            const row = document.createElement("article");
            row.className = "war-codex-item";
            row.innerHTML = `<strong>${item.label}</strong><span>${item.desc}</span>`;
            list.appendChild(row);
        });
    }

    function roleLabel(role) {
        const map = {
            tank: "坦克", warrior: "戰士", ranger: "射手", caster: "法師",
            support: "輔助", assassin: "刺客", elite: "精英", summon: "召喚物",
            enemy: "敵軍", boss: "Boss"
        };
        return map[role] || role;
    }

    function unitTagHtml(def) {
        const tags = (def && def.tags) || [];
        if (!tags.length) return `<span class="war-unit-tag">無標籤</span>`;
        return tags.map((t) => {
            const label = (TAGS[t] && TAGS[t].label) || t;
            return `<span class="war-unit-tag">${label}</span>`;
        }).join("");
    }

    function rosterModifiers() {
        if (!state) return {};
        const mods = WarState.aggregateModifiers(state);
        // Include active synergies from current deploy (same as battle prep)
        const synergies = WarState.computeSynergies(state.army || []);
        const tagEffects = [...(mods.tagEffects || [])];
        synergies.forEach((syn) => {
            if (syn.effect) tagEffects.push({ ...syn.effect });
        });
        return { ...mods, tagEffects, terrainEffect: {} };
    }

    function unitStatsLine(def, star, modifiers) {
        if (!def) return "";
        const preview = getUnitPreview(def, star, modifiers);
        const rangeText = def.range === "ranged" ? "遠程" : "近戰";
        const parts = [
            `${roleLabel(def.role)} · ${rangeText}`,
            `HP ${preview.hp}`,
            `攻擊 ${preview.atk}`,
            `防禦 ${preview.def}`,
            `攻速 ${preview.spd}`
        ];
        if (preview.moveSpeed != null) parts.push(`移速 ${preview.moveSpeed}`);
        if (preview.attackRange != null) parts.push(`射程 ${preview.attackRange}`);
        if (preview.shield > 0) parts.push(`護盾 ${preview.shield}`);
        if (preview.critChance > 0) {
            parts.push(`暴擊 ${Math.round(preview.critChance * 100)}%`);
        }
        if ((star || 1) > 1) parts.push(`★${star}`);
        return parts.join(" · ");
    }

    function getUnitPreview(def, star, modifiers) {
        const s = Math.max(1, Math.min((WarData.MAX_STAR || 10), star || 1));
        const mods = modifiers || {};
        const preview = def && def.id ? WarBattle.previewPlayerStats(def.id, s, mods) : null;
        return {
            hp: preview ? preview.hp : (def?.hp || 0),
            atk: preview ? preview.atk : (def?.atk || 0),
            def: preview ? preview.def : (def?.def || 0),
            spd: preview ? preview.spd : (def?.spd || 0),
            moveSpeed: preview ? preview.moveSpeed : def?.moveSpeed,
            attackRange: preview ? preview.attackRange : def?.attackRange,
            shield: preview ? preview.shield : 0,
            critChance: preview ? preview.critChance : 0,
            skillCdMult: preview ? preview.skillCdMult : 1,
            skillPower: preview ? preview.skillPower : 1,
            healBoost: preview ? preview.healBoost : 1,
            summonMaxBonus: preview ? preview.summonMaxBonus : 0,
            onHit: preview ? preview.onHit : (def?.onHit || null)
        };
    }

    function unitStatGridHtml(def, star, modifiers) {
        const p = getUnitPreview(def, star, modifiers);
        const cells = [
            { label: "生命", value: p.hp },
            { label: "攻擊", value: p.atk },
            { label: "防禦", value: p.def },
            { label: "攻速", value: p.spd }
        ];
        if (p.moveSpeed != null) cells.push({ label: "移速", value: p.moveSpeed });
        if (def.range === "ranged" && p.attackRange != null) {
            cells.push({ label: "射程", value: p.attackRange });
        }
        if (p.shield > 0) cells.push({ label: "護盾", value: p.shield });
        if (p.critChance > 0) {
            cells.push({ label: "暴擊", value: `${Math.round(p.critChance * 100)}%` });
        }
        return `<div class="war-unit-stat-grid">${cells.map((c) => `
            <div class="war-unit-stat">
                <span class="war-unit-stat-label">${c.label}</span>
                <span class="war-unit-stat-value">${c.value}</span>
            </div>`).join("")}</div>`;
    }

    function rarityBadgeHtml(rarity) {
        const r = rarity || "common";
        const label = (WarData.RARITY[r] && WarData.RARITY[r].label) || r;
        return `<span class="war-rarity-badge war-rarity-badge--${r}">${label}</span>`;
    }

    function expBarHtml(entry) {
        const star = WarState.ownedUnitStar(entry);
        const exp = WarState.ownedUnitExp(entry);
        if (star >= (WarData.MAX_STAR || 10)) {
            return `<div class="war-unit-exp"><span class="war-unit-exp-label">★${WarData.MAX_STAR || 10} 滿級</span>
                <div class="war-unit-exp-track"><i style="width:100%"></i></div></div>`;
        }
        const need = WarState.expNeededForStar(star);
        const pct = need > 0 ? Math.min(100, Math.round((exp / need) * 100)) : 0;
        return `<div class="war-unit-exp">
            <span class="war-unit-exp-label">EXP ${exp}/${need}</span>
            <div class="war-unit-exp-track" aria-hidden="true"><i style="width:${pct}%"></i></div>
        </div>`;
    }

    function unitSkillMeta(def, modifiers) {
        if (!def || !def.skill) {
            return { name: "無", cdLabel: "", castLabel: "", desc: "", extras: [] };
        }
        const mods = modifiers || {};
        const preview = getUnitPreview(def, 1, mods);
        const unitCdMult = preview.skillCdMult;
        const globalCd = mods.skillCdMult || 1;
        const effCd = Math.round(def.skill.cd * unitCdMult * globalCd * 10) / 10;
        const castLabel = def.skill.castTime != null ? ` · 施法 ${def.skill.castTime}s` : "";
        const cdLabel = effCd !== def.skill.cd
            ? `CD ${effCd}s（基礎 ${def.skill.cd}s）`
            : `CD ${def.skill.cd}s`;
        const extras = [];
        if (preview.skillPower > 1) {
            extras.push(`技能威力 ×${Math.round(preview.skillPower * 100) / 100}`);
        }
        if (preview.healBoost > 1) {
            extras.push(`治療 ×${Math.round(preview.healBoost * 100) / 100}`);
        }
        if (preview.summonMaxBonus > 0) {
            extras.push(`召喚上限 +${preview.summonMaxBonus}`);
        }
        return {
            name: def.skill.name,
            cdLabel,
            castLabel,
            desc: def.skill.desc || "",
            extras
        };
    }

    function unitSkillHtml(def, modifiers) {
        const meta = unitSkillMeta(def, modifiers);
        if (!def.skill) return `<p class="war-unit-card-skill">技能：無</p>`;
        const extraHtml = meta.extras.length
            ? `<br><span class="war-unit-card-bonus">${meta.extras.join(" · ")}</span>`
            : "";
        return `<p class="war-unit-card-skill"><strong>技能：${meta.name}</strong>（${meta.cdLabel}${meta.castLabel}）— ${meta.desc}${extraHtml}</p>`;
    }

    function unitRosterSkillHtml(def, modifiers) {
        const meta = unitSkillMeta(def, modifiers);
        if (!def.skill) {
            return `<div class="war-unit-skill-block"><span class="war-unit-skill-name">無技能</span></div>`;
        }
        const extras = meta.extras.length
            ? `<div class="war-unit-card-bonus">${meta.extras.join(" · ")}</div>`
            : "";
        return `<div class="war-unit-skill-block">
            <div class="war-unit-skill-head">
                <span class="war-unit-skill-name">${meta.name}</span>
                <span class="war-unit-skill-cd">${meta.cdLabel}${meta.castLabel}</span>
            </div>
            <p class="war-unit-skill-desc">${meta.desc}</p>
            ${extras}
        </div>`;
    }

    function unitOnHitHtml(def, modifiers, star, opts) {
        let onHits = [];
        if (def && def.id && modifiers) {
            const preview = WarBattle.previewPlayerStats(def.id, star || 1, modifiers);
            if (preview && preview.onHit) {
                onHits = Array.isArray(preview.onHit) ? preview.onHit : [preview.onHit];
            }
        }
        if (!onHits.length && def && def.onHit) {
            onHits = Array.isArray(def.onHit) ? def.onHit : [def.onHit];
        }
        onHits = onHits.filter((oh) => oh && oh.type);
        if (!onHits.length) return "";
        const se = (WarData.STATUS_EFFECTS) || {};
        const parts = onHits.map((oh) => {
            const chance = oh.chance != null ? `${Math.round(oh.chance * 100)}%` : "";
            const label = (se[oh.type] && se[oh.type].label) || oh.type;
            return `${chance} ${label}`.trim();
        });
        if (opts && opts.roster) {
            return `<div class="war-unit-card-onhit war-unit-card-onhit--chips">${parts.map((p) => `<span>${p}</span>`).join("")}</div>`;
        }
        return `<p class="war-unit-card-onhit">普攻附加：${parts.join("、")}</p>`;
    }

    function unitRewardBodyHtml(def) {
        if (!def) return "";
        const mods = state ? rosterModifiers() : {};
        return `
            <div class="war-unit-tags">${unitTagHtml(def)}</div>
            <p class="war-reward-unit-stats">${unitStatsLine(def, 1, mods)}</p>
            ${unitSkillHtml(def, mods)}
            ${unitOnHitHtml(def, mods, 1)}
        `;
    }

    function unitCompactStatsHtml(def, star, modifiers) {
        const p = getUnitPreview(def, star, modifiers);
        const bits = [`HP ${p.hp}`, `攻 ${p.atk}`, `防 ${p.def}`];
        if (p.shield > 0) bits.push(`盾 ${p.shield}`);
        return `<p class="war-unit-card-compact-stats">${bits.join(" · ")}</p>`;
    }

    function buildRosterCard(entry, opts) {
        const mods = opts.mods;
        const def = opts.def || UNITS[entry.id];
        const star = entry.star || 1;
        const rarity = (def && def.rarity) || "common";
        const card = document.createElement("article");
        card.className = `war-unit-card war-unit-card--roster war-unit-card--compact war-unit-card--${rarity}`;
        if (opts.fallen) card.classList.add("war-unit-card--fallen");
        if (opts.banned) card.classList.add("war-unit-card--banned");

        const name = opts.name || (def && def.name) || entry.id;
        const icon = opts.icon || (def && def.icon) || "⚔";
        const rangeText = def && def.range === "ranged" ? "遠程" : "近戰";
        const roleText = def ? `${roleLabel(def.role)} · ${rangeText}` : (opts.sub || "");
        const headRight = opts.fallen
            ? ""
            : (opts.headRight || rarityBadgeHtml(rarity));
        const reviveHtml = opts.fallen
            ? (opts.headRight || "")
            : "";
        const expOrSub = opts.fallen
            ? `<p class="war-unit-card-sub">${opts.sub || "陣亡"}</p>`
            : expBarHtml(entry);

        card.innerHTML = `
            <div class="war-unit-card-row">
                <button type="button" class="war-unit-card-summary" aria-expanded="false">
                    <div class="war-unit-card-icon" aria-hidden="true">${icon}</div>
                    <div class="war-unit-card-identity">
                        <div class="war-unit-card-head">
                            <h3 class="war-unit-card-title">${name}${star > 1 ? ` <span class="war-unit-star">★${star}</span>` : ""}</h3>
                            ${headRight}
                        </div>
                        <p class="war-unit-card-sub">${roleText}</p>
                        ${expOrSub}
                        ${def && !opts.fallen ? unitCompactStatsHtml(def, star, mods) : ""}
                    </div>
                    <span class="war-unit-card-chevron" aria-hidden="true">▾</span>
                </button>
                ${reviveHtml ? `<div class="war-unit-card-actions">${reviveHtml}</div>` : ""}
            </div>
            <div class="war-unit-card-detail" hidden>
                ${def ? `<div class="war-unit-tags">${unitTagHtml(def)}</div>` : ""}
                ${def ? unitStatGridHtml(def, star, mods) : ""}
                ${def ? unitRosterSkillHtml(def, mods) : ""}
                ${def ? unitOnHitHtml(def, mods, star, { roster: true }) : ""}
                ${opts.banned ? `<p class="war-unit-card-warn">受詛咒限制，目前無法出戰</p>` : ""}
                ${opts.detailExtra || ""}
            </div>
        `;

        const summaryBtn = card.querySelector(".war-unit-card-summary");
        const detail = card.querySelector(".war-unit-card-detail");
        summaryBtn.addEventListener("click", () => {
            const open = detail.hasAttribute("hidden");
            if (open) detail.removeAttribute("hidden");
            else detail.setAttribute("hidden", "");
            summaryBtn.setAttribute("aria-expanded", open ? "true" : "false");
            card.classList.toggle("is-open", open);
        });
        return card;
    }

    function openUnitModal() {
        if (!state) return;
        const owned = WarState.normalizeOwnedList(state.ownedUnits || [], state);
        const fallen = state.fallenUnits || [];
        const mods = rosterModifiers();
        const summary = $("unitModalSummary");
        const chips = [
            `<span class="war-roster-chip">擁有 <strong>${owned.length}</strong></span>`,
            `<span class="war-roster-chip war-roster-chip--gold">金 <strong>${state.gold}</strong></span>`
        ];
        if (fallen.length) {
            chips.splice(1, 0, `<span class="war-roster-chip war-roster-chip--fallen">陣亡 <strong>${fallen.length}</strong></span>`);
        }
        chips.push(`<span class="war-roster-chip war-roster-chip--muted">點選展開詳情</span>`);
        summary.innerHTML = chips.join("");

        const list = $("unitModalList");
        list.innerHTML = "";
        if (!owned.length && !fallen.length) {
            list.innerHTML = `<p class="war-hint">尚未擁有任何單位</p>`;
        } else {
            owned.forEach((entry) => {
                const def = UNITS[entry.id];
                if (!def) return;
                const banned = !WarState.unitMayFight(entry.id, mods);
                list.appendChild(buildRosterCard(entry, { def, mods, banned }));
            });

            if (fallen.length) {
                const heading = document.createElement("h3");
                heading.className = "war-fallen-title";
                heading.textContent = "陣亡單位（付費復活）";
                list.appendChild(heading);
                fallen.forEach((entry, index) => {
                    const def = UNITS[entry.id];
                    const cost = WarState.reviveCostForUnit(entry.id);
                    const name = (def && def.name) || entry.id;
                    const icon = (def && def.icon) || "💀";
                    const card = buildRosterCard(entry, {
                        def,
                        mods,
                        fallen: true,
                        name,
                        icon,
                        sub: "陣亡 · 可付費復活",
                        headRight: `<button type="button" class="war-btn war-btn-sm war-btn-primary war-revive-btn">${cost} 金 復活</button>`
                    });
                    const reviveBtn = card.querySelector(".war-revive-btn");
                    if (reviveBtn) {
                        reviveBtn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const res = WarState.recoverFallenUnit(state, index);
                            updateHud();
                            if (res.ok) {
                                WarState.saveGame(state);
                                openUnitModal();
                            } else {
                                summary.innerHTML = `<span class="war-roster-chip war-roster-chip--fallen">${res.message}</span>`;
                            }
                        });
                    }
                    list.appendChild(card);
                });
            }
        }
        $("unitModal").hidden = false;
    }

    function expLabel(entry) {
        const star = WarState.ownedUnitStar(entry);
        const exp = WarState.ownedUnitExp(entry);
        if (star >= (WarData.MAX_STAR || 10)) return `★${WarData.MAX_STAR || 10} 滿級`;
        const need = WarState.expNeededForStar(star);
        return `EXP ${exp}/${need}`;
    }

    function closeUnitModal() {
        $("unitModal").hidden = true;
    }

    function renderMap() {
        const map = state.map;
        const world = WarState.getActiveWorld(state);
        $("mapWorldTitle").textContent = state.endless
            ? `無盡挑戰 · 已過 ${state.endlessStages || 0} 關 · 第${state.endlessLoop || 1}環`
            : world.name;
        const container = $("mapNodes");
        const svg = $("mapSvg");
        container.innerHTML = "";
        svg.innerHTML = "";

        const wrap = container.parentElement;
        const w = wrap.clientWidth || 320;
        const h = wrap.clientHeight || 300;
        const layerH = h / (map.layers + 2);

        const positions = new Map();
        map.nodes.forEach((node) => {
            const x = 0.12 * w + node.x * 0.76 * w;
            const y = layerH * (node.layer + 1);
            positions.set(node.id, { x, y });
        });

        map.nodes.forEach((node) => {
            node.edges.forEach((targetId) => {
                const a = positions.get(node.id);
                const b = positions.get(targetId);
                if (!a || !b) return;
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", a.x);
                line.setAttribute("y1", a.y);
                line.setAttribute("x2", b.x);
                line.setAttribute("y2", b.y);
                line.setAttribute("stroke", "color-mix(in srgb, var(--muted) 50%, transparent)");
                line.setAttribute("stroke-width", "2");
                svg.appendChild(line);
            });
        });

        const currentId = map.currentNodeId;
        const reachable = getReachableNext(map).map((n) => n.id);
        const current = getNode(map, currentId);
        const mods = WarState.aggregateModifiers(state);
        const revealNext = !!mods.revealNext;

        map.nodes.forEach((node) => {
            const pos = positions.get(node.id);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "war-map-node";
            const displayType = (node.type === "trap") ? "event" : node.type;
            const known = isMapNodeRevealed(node, current, reachable, revealNext);
            if (displayType === "boss") btn.classList.add("war-map-node--boss");
            if (displayType === "epic" && known) btn.classList.add("war-map-node--epic");
            if (displayType === "epic_combat" && known) btn.classList.add("war-map-node--epic-combat");
            if (node.id === currentId) btn.classList.add("war-map-node--current");
            if (reachable.includes(node.id)) btn.classList.add("war-map-node--reachable");
            if (node.cleared) btn.classList.add("war-map-node--cleared");
            if (!known) btn.classList.add("war-map-node--fog");
            btn.style.left = `${pos.x}px`;
            btn.style.top = `${pos.y}px`;
            if (known) {
                btn.textContent = ROOM_TYPES[displayType]?.icon || "?";
                btn.title = WarMap.nodeLabel(displayType);
            } else {
                btn.textContent = "？";
                btn.title = "未知房間";
            }
            btn.disabled = !reachable.includes(node.id);
            btn.addEventListener("click", () => onMapNodeClick(node.id));
            container.appendChild(btn);
        });

        $("mapHint").textContent = reachable.length
            ? (revealNext
                ? "偵察鏡：下一層已顯示 · 選擇路線前進"
                : "規劃路線：點選可達房間前進")
            : current?.type === "boss" && current.cleared
                ? "Boss 已擊敗！"
                : "正在此房間";
        renderArtifactBar();
        updateHud();
        updateEndlessAutoUi();
    }

    /** Known rooms: path history, reachable choices, boss; scout reveals whole next layer. */
    function isMapNodeRevealed(node, current, reachableIds, revealNext) {
        if (!node) return false;
        if (node.type === "boss" || node.type === "start") return true;
        if (node.cleared) return true;
        if (current && node.id === current.id) return true;
        if (reachableIds.includes(node.id)) return true;
        if (revealNext && current && node.layer === current.layer + 1) return true;
        return false;
    }

    function onMapNodeClick(nodeId) {
        if (!moveToNode(state.map, nodeId)) return;
        WarState.saveGame(state);
        enterRoom(getNode(state.map, nodeId));
    }

    function enterRoom(node) {
        state.phase = "room";
        switch (node.type) {
            case "start":
                showRoomMessage("營地", "整頓部隊，準備出發。", () => finishRoom());
                break;
            case "combat":
            case "epic_combat":
            case "boss":
                contractTickedForNode = null;
                pendingEncounter = WarState.getCombatEncounter(state, node);
                state.phase = "formation";
                showScreen("formation");
                if (node.type === "boss") {
                    $("formationHint").textContent = state.endless
                        ? `無盡 Boss（第 ${(state.endlessStages || 0) + 1} 關）· 無獎勵`
                        : `準備迎戰 ${WarState.getActiveWorld(state).bossName}！Boss 有二階段（首條命歸零會回血覺醒）`;
                } else if (node.type === "epic_combat") {
                    $("formationHint").textContent = state.endless
                        ? `無盡史詩戰（第 ${(state.endlessStages || 0) + 1} 關）· 無獎勵`
                        : "史詩戰鬥：敵軍更強更多 · 勝利可獲高稀有獎勵";
                } else {
                    $("formationHint").textContent = "先選出戰單位，再拖曳左側站位";
                }
                ensureArmyNormalized({ restoreIfEmpty: true });
                renderArmyPrep();
                updateEndlessAutoUi();
                if (state.endlessAutoRun) scheduleEndlessAuto(() => startBattle(), 150);
                break;
            case "treasure": {
                pendingRewardType = "artifact";
                pendingRewardSource = "treasure";
                const offers = WarState.offerRewards(state, "artifact");
                if (!offers.length) {
                    pendingRewardSource = null;
                    const result = WarState.resolveTreasure(state);
                    showRoomMessage("寶藏房", result.text, () => finishRoom());
                } else {
                    showRewardScreen();
                }
                break;
            }
            case "epic": {
                pendingRewardType = "epic";
                pendingRewardSource = "epic";
                showRewardScreen();
                break;
            }
            case "trap":
            case "event": {
                // Map always shows these as events; reveal trap or event only after enter
                const outcome = node.secretOutcome
                    || (node.type === "trap" ? "trap" : "event");
                if (outcome === "trap") {
                    const result = WarState.resolveTrap(state);
                    if (result.combat) {
                        showRoomMessage(
                            "突發事件！",
                            `${result.trap.title}：${result.trap.text}（失去 ${result.goldLost} 金，並遭遇戰鬥！）`,
                            () => {
                                contractTickedForNode = null;
                                pendingEncounter = WarState.getCombatEncounter(state, node);
                                state.phase = "formation";
                                showScreen("formation");
                                ensureArmyNormalized({ restoreIfEmpty: true });
                                renderArmyPrep();
                            }
                        );
                    } else {
                        showRoomMessage(
                            "突發事件！",
                            `${result.trap.title}：${result.trap.text} 失去 ${result.goldLost} 金。`,
                            () => finishRoom()
                        );
                    }
                } else {
                    currentEvent = WarState.resolveEvent(state);
                    showEventModal(currentEvent);
                }
                break;
            }
            case "shop":
                WarState.beginShopSession(state);
                showShopModal();
                break;
            default:
                finishRoom();
        }
        updateHud();
    }

    function finishRoom() {
        const node = getNode(state.map, state.map.currentNodeId);
        if (node) node.cleared = true;
        notifyContractTick(true);

        if (node?.type === "boss" && state.phase !== "defeat") {
            if (state.endless) {
                const adv = WarState.advanceWorld(state);
                if (state.endlessAutoRun) {
                    resumeEndlessAfterBossRing();
                    return;
                }
                showRoomMessage(
                    `通過第 ${state.endlessStages || 0} 關`,
                    `進入第 ${adv.loop} 環（僅史詩戰與 Boss，無獎勵）。目前最佳：${WarState.getEndlessBest()} 關`,
                    resumeEndlessAfterBossRing
                );
                return;
            }
            if (state.worldIndex >= WORLDS.length - 1) {
                state.runWon = true;
                state.phase = "victory";
                WarState.saveGame(state);
                showScreen("victory");
                return;
            }
            pendingRewardType = "artifact";
            pendingRewardSource = "boss";
            showRewardScreen();
            return;
        }

        state.phase = "map";
        showScreen("map");
        renderMap();
        WarState.saveGame(state);
    }

    function hideRoomModalShop() {
        const shop = $("roomModalShop");
        shop.hidden = true;
        shop.innerHTML = "";
    }

    function showRoomMessage(title, text, onClose) {
        $("roomModalTitle").textContent = title;
        $("roomModalText").textContent = text;
        $("roomModalChoices").innerHTML = "";
        hideRoomModalShop();
        $("roomModalClose").hidden = false;
        $("roomModal").hidden = false;
        $("roomModalClose").onclick = () => {
            $("roomModal").hidden = true;
            onClose();
        };
    }

    function showEventModal(event) {
        currentEvent = event;
        $("roomModalTitle").textContent = event.title;
        $("roomModalText").textContent = event.text;
        hideRoomModalShop();
        $("roomModalClose").hidden = true;
        const choices = $("roomModalChoices");
        choices.innerHTML = "";
        event.choices.forEach((choice, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "war-btn war-btn-outline war-event-choice";
            const preview = WarBuildHints.choiceContractPreview(choice, WarData);
            const previewHtml = preview ? WarBuildHints.contractPreviewHtml(preview) : "";
            btn.innerHTML = `<span class="war-event-choice-label">${choice.label}</span>${previewHtml}`;
            btn.addEventListener("click", () => {
                const result = WarState.applyEventChoice(state, event, i);
                $("roomModalText").textContent = result.messages.length ? result.messages.join("；") : "你離開了。";
                choices.innerHTML = "";
                hideRoomModalShop();
                $("roomModalClose").hidden = false;
                $("roomModalClose").onclick = () => {
                    $("roomModal").hidden = true;
                    updateHud();
                    finishRoom();
                };
            });
            choices.appendChild(btn);
        });
        $("roomModal").hidden = false;
    }

    function showShopModal(statusText) {
        if (!state.shopSession) WarState.beginShopSession(state);
        const catalog = WarState.getShopCatalog(state);
        const fallen = state.fallenUnits || [];
        $("roomModalTitle").textContent = "商店";
        $("roomModalText").textContent = statusText
            || `金幣：${state.gold} · 各商品限購（售完即止）${fallen.length ? ` · 可復活 ${fallen.length} 隻` : ""}`;
        $("roomModalChoices").innerHTML = "";
        const shop = $("roomModalShop");
        shop.hidden = false;
        shop.innerHTML = "";
        catalog.forEach((item) => {
            const row = document.createElement("div");
            row.className = "war-shop-item" + (item.soldOut ? " war-shop-item--soldout" : "");
            const stock = item.soldOut
                ? `<span class="war-shop-markup">已售完</span>`
                : `<span class="war-shop-markup">剩 ${item.remaining}/${item.maxBuys}</span>`;
            const btnLabel = item.soldOut ? "售完" : `${item.price} 金`;
            const shopHints = WarBuildHints.shopItemHints(item, state, WarData, WarState);
            row.innerHTML = `
                <div class="war-shop-item-info">
                    <h4>${item.name} ${stock}</h4>
                    <p>${item.desc}</p>
                    ${WarBuildHints.hintsHtml(shopHints)}
                </div>
                <button type="button" class="war-btn war-btn-sm war-btn-primary" ${item.soldOut ? "disabled" : ""}>${btnLabel}</button>
            `;
            const btn = row.querySelector("button");
            if (!item.soldOut) {
                btn.addEventListener("click", () => {
                    const res = WarState.buyShopItem(state, item);
                    updateHud();
                    if (res.ok) {
                        showShopModal(`${res.message} · 金幣：${state.gold}`);
                    } else {
                        $("roomModalText").textContent = res.message;
                        showShopModal(res.message + ` · 金幣：${state.gold}`);
                    }
                });
            }
            shop.appendChild(row);
        });
        fallen.forEach((entry, index) => {
            const def = UNITS[entry.id];
            const cost = WarState.reviveCostForUnit(entry.id);
            const name = entry.name || (def && def.name) || entry.id;
            const icon = (def && def.icon) || "💀";
            const row = document.createElement("div");
            row.className = "war-shop-item war-shop-item--revive";
            row.innerHTML = `
                <div class="war-shop-item-info">
                    <h4>復活 ${icon} ${name}</h4>
                    <p>召回陣亡單位加入部隊</p>
                </div>
                <button type="button" class="war-btn war-btn-sm war-btn-primary">${cost} 金</button>
            `;
            row.querySelector("button").addEventListener("click", () => {
                const res = WarState.recoverFallenUnit(state, index);
                updateHud();
                if (res.ok) {
                    showShopModal(`${res.message} · 金幣：${state.gold}`);
                } else {
                    $("roomModalText").textContent = res.message;
                }
            });
            shop.appendChild(row);
        });
        $("roomModalClose").hidden = false;
        $("roomModalClose").onclick = () => {
            WarState.endShopSession(state);
            hideRoomModalShop();
            $("roomModal").hidden = true;
            finishRoom();
        };
        $("roomModal").hidden = false;
    }

    function isDeployedUid(uid) {
        return (state.army || []).some((entry) => WarState.armyUnitUid(entry) === uid);
    }

    function toggleOwnedUnitByUid(uid) {
        ensureArmyNormalized();
        const mods = WarState.aggregateModifiers(state);
        const owned = WarState.normalizeOwnedList(state.ownedUnits || [], state);
        const unit = owned.find((o) => o.uid === uid);
        if (!unit) return;
        if (isDeployedUid(uid)) {
            state.army = (state.army || []).filter((s) => WarState.armyUnitUid(s) !== uid);
        } else {
            if (!WarState.unitMayFight(unit.id, mods)) {
                const label = WarState.fightRestrictionLabel(mods);
                $("formationHint").textContent = label
                    ? `詛咒限制：僅能派出 [${label}] 單位`
                    : "此單位受詛咒限制，無法出戰";
                return;
            }
            WarState.appendArmyUnit(state.army, unit.id, unit.star, unit.uid);
        }
        state.army = WarState.clampArmyToOwned(state.ownedUnits, state.army);
        state.army = WarState.filterArmyByFightRules(state.army, mods);
        WarState.separateArmySlots(state.army);
        renderArmyPrep();
    }

    function ensureArmyNormalized(opts) {
        if (!state.ownedUnits) state.ownedUnits = WarState.defaultOwnedUnits(state);
        state.ownedUnits = WarState.normalizeOwnedList(state.ownedUnits, state);
        // Prefer current army; optionally restore last battle setup when empty
        if (Array.isArray(state.army) && state.army.length) {
            state.army = WarState.normalizeArmy(state.army, state.ownedUnits);
        } else if (opts?.restoreIfEmpty) {
            state.army = WarState.restoreLastBattleSetup(state);
        } else {
            state.army = WarState.normalizeArmy(state.army || [], state.ownedUnits);
        }
        // Cursed onlyFightTag: strip units that cannot fight from the board
        const mods = WarState.aggregateModifiers(state);
        state.army = WarState.filterArmyByFightRules(state.army, mods);
        // Only fix invalid coords from old arena sizes — keep intentional layout
        let needsClamp = false;
        (state.army || []).forEach((slot) => {
            if (!Number.isFinite(slot.x) || !Number.isFinite(slot.y)
                || slot.x < 0 || slot.y < 0
                || slot.x > ARENA.width || slot.y > ARENA.height) {
                needsClamp = true;
            }
        });
        if (needsClamp) {
            state.army.forEach((slot, i) => {
                const pos = WarState.defaultSlotPos(i, state.army.length);
                const c = clampPrepPos(
                    Number.isFinite(slot.x) ? slot.x : pos.x,
                    Number.isFinite(slot.y) ? slot.y : pos.y
                );
                slot.x = c.x;
                slot.y = c.y;
            });
            if (armySeverelyOverlapped(state.army)) {
                state.army = WarState.layoutArmySlots(state.army);
            }
        }
    }

    function armySeverelyOverlapped(army) {
        const list = army || [];
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const dx = list[i].x - list[j].x;
                const dy = list[i].y - list[j].y;
                if (dx * dx + dy * dy < 16 * 16) return true;
            }
        }
        return false;
    }

    function clampPrepPos(x, y) {
        const pad = 22;
        return {
            x: Math.max(pad, Math.min(ARENA.width * 0.46, x)),
            y: Math.max(pad, Math.min(ARENA.height - pad, y))
        };
    }

    function separatePrepUnits() {
        WarState.separateArmySlots(state.army || []);
    }

    function enemyPreviewSlots() {
        const army = pendingEncounter?.enemyArmy || [];
        if (!army.length) return [];
        return WarBattle.layoutEnemySlots(army, ARENA.width, ARENA.height);
    }

    function affixIcon(affixId) {
        if (!affixId || !ELITE_AFFIXES) return "";
        const a = ELITE_AFFIXES.find((x) => x.id === affixId);
        return a ? (a.icon || "") : "";
    }

    function renderFormationMeta() {
        const meta = $("formationMeta");
        if (!meta) return;
        meta.innerHTML = "";
        const terrain = pendingEncounter?.terrain;
        if (terrain) {
            const chip = document.createElement("span");
            chip.className = "war-meta-chip war-meta-chip--terrain";
            chip.title = terrain.desc || "";
            chip.textContent = `${terrain.icon || ""} ${terrain.name}：${terrain.desc || ""}`;
            meta.appendChild(chip);
        }
        if (pendingEncounter?.formationName) {
            const chip = document.createElement("span");
            chip.className = "war-meta-chip war-meta-chip--formation";
            chip.textContent = `編隊：${pendingEncounter.formationName}`;
            meta.appendChild(chip);
        }
        (state.activeContracts || []).forEach((c) => {
            const chip = document.createElement("span");
            chip.className = "war-meta-chip war-meta-chip--contract";
            chip.title = c.desc || "";
            chip.textContent = `契約 ${c.name}（剩 ${c.roomsLeft}）`;
            meta.appendChild(chip);
        });
        const synergies = WarState.computeSynergies(state.army || []);
        synergies.forEach((syn) => {
            const chip = document.createElement("span");
            chip.className = "war-meta-chip war-meta-chip--synergy";
            chip.title = syn.desc || "";
            chip.textContent = `✦ ${syn.name}`;
            meta.appendChild(chip);
        });
        if (!meta.children.length) {
            const chip = document.createElement("span");
            chip.className = "war-meta-chip";
            chip.textContent = "尚無地形／羈絆加成";
            meta.appendChild(chip);
        }
        renderEnemyIntel();
    }

    function renderEnemyIntel() {
        const panel = $("enemyIntel");
        if (!panel) return;
        const army = pendingEncounter?.enemyArmy || [];
        if (!army.length) {
            panel.hidden = true;
            panel.innerHTML = "";
            return;
        }
        panel.hidden = false;
        const counts = {};
        const affixCounts = {};
        army.forEach((e) => {
            const id = typeof e === "string" ? e : e.id;
            const affix = typeof e === "string" ? null : e.affix;
            const def = UNITS[id];
            const name = def ? `${def.icon || ""} ${def.name}`.trim() : id;
            counts[name] = (counts[name] || 0) + 1;
            if (affix) affixCounts[affix] = (affixCounts[affix] || 0) + 1;
        });
        const unitLines = Object.keys(counts)
            .map((name) => `<div class="war-enemy-intel-row">${name} ×${counts[name]}</div>`)
            .join("");
        const affixLines = Object.keys(affixCounts).map((aid) => {
            const a = (ELITE_AFFIXES || []).find((x) => x.id === aid);
            if (!a) return "";
            return `<div class="war-enemy-intel-row">${a.icon || ""} <strong>${a.name}</strong>×${affixCounts[aid]}：${a.desc}`
                + (a.tip ? `<div class="war-enemy-intel-tip">剋制：${a.tip}</div>` : "")
                + `</div>`;
        }).join("");
        panel.innerHTML = `
            <p class="war-enemy-intel-title">敵軍情報（${army.length}）</p>
            ${unitLines}
            ${affixLines
                ? `<p class="war-enemy-intel-title" style="margin-top:0.45rem">精英詞綴</p>${affixLines}`
                : "<p class='war-enemy-intel-row'>本場無精英詞綴</p>"}
        `;
    }

    function fitArenaCanvas(canvas) {
        if (!canvas) return;
        const wrap = canvas.parentElement;
        const maxW = wrap?.clientWidth || ARENA.width;
        const isBattle = canvas.id === "battleCanvas";
        const wrapH = wrap?.clientHeight || 0;
        const maxH = isBattle
            ? Math.max(wrapH || 0, Math.min(window.innerHeight * 0.68, 720))
            : Math.min(window.innerHeight * 0.5, 520);
        const aspect = ARENA.width / ARENA.height;
        let cssW = maxW;
        let cssH = cssW / aspect;
        if (cssH > maxH) {
            cssH = maxH;
            cssW = cssH * aspect;
        }
        canvas.width = ARENA.width;
        canvas.height = ARENA.height;
        canvas.style.width = `${Math.round(cssW)}px`;
        canvas.style.height = `${Math.round(cssH)}px`;
    }

    function resizePrepCanvas() {
        fitArenaCanvas($("prepCanvas"));
    }

    function resizeCanvas() {
        fitArenaCanvas($("battleCanvas"));
    }

    function canvasLocalPos(canvas, clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((clientX - rect.left) / rect.width) * canvas.width,
            y: ((clientY - rect.top) / rect.height) * canvas.height
        };
    }

    function hitPrepUnit(x, y) {
        const army = state.army || [];
        for (let i = army.length - 1; i >= 0; i--) {
            const u = army[i];
            const def = UNITS[u.id];
            const r = (def && def.radius) || 14;
            const dx = u.x - x;
            const dy = u.y - y;
            if (dx * dx + dy * dy <= (r + 10) * (r + 10)) return i;
        }
        return -1;
    }

    function drawPrepBoard() {
        const canvas = $("prepCanvas");
        if (!canvas || !state) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(34,197,94,0.12)";
        ctx.fillRect(0, 0, w * 0.48, h);
        ctx.strokeStyle = "rgba(74,222,128,0.45)";
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(6, 6, w * 0.48 - 12, h - 12);
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(248,113,113,0.1)";
        ctx.fillRect(w * 0.52, 0, w * 0.48, h);

        ctx.fillStyle = "rgba(148,163,184,0.75)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("我方部署區（可拖曳）", 12, 22);
        ctx.fillText("敵方預覽", w * 0.56, 22);

        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.beginPath();
        ctx.moveTo(w / 2, 10);
        ctx.lineTo(w / 2, h - 10);
        ctx.stroke();

        enemyPreviewSlots().forEach((slot) => {
            const def = UNITS[slot.id];
            if (!def) return;
            const isBoss = def.role === "boss";
            const r = isBoss ? (def.radius || 22) : (def.radius || 14);
            ctx.globalAlpha = isBoss ? 0.9 : 0.55;
            ctx.beginPath();
            ctx.fillStyle = isBoss ? "#991b1b" : "#7f1d1d";
            ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = slot.affix ? "#fbbf24" : (isBoss ? "#fbbf24" : "#fca5a5");
            ctx.lineWidth = isBoss || slot.affix ? 3 : 2;
            ctx.stroke();
            ctx.font = `${Math.max(12, r)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(def.icon || "?", slot.x, slot.y);
            if (slot.affix) {
                ctx.globalAlpha = 1;
                ctx.font = "11px sans-serif";
                ctx.fillStyle = "#fde68a";
                ctx.fillText(affixIcon(slot.affix) || "✦", slot.x, slot.y + r + 11);
            } else if (isBoss) {
                ctx.globalAlpha = 1;
                ctx.font = "10px sans-serif";
                ctx.fillStyle = "#fbbf24";
                ctx.fillText("Boss", slot.x, slot.y + r + 12);
            }
            ctx.globalAlpha = 1;
        });

        (state.army || []).forEach((slot, i) => {
            const def = UNITS[slot.id];
            if (!def) return;
            const selected = i === prepDragIndex;
            const star = WarState.armyUnitStar(slot);
            ctx.beginPath();
            ctx.fillStyle = selected ? "#86efac" : "#166534";
            ctx.arc(slot.x, slot.y, def.radius || 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = selected ? "#fbbf24" : "#4ade80";
            ctx.lineWidth = selected ? 3 : 2;
            ctx.stroke();
            ctx.font = `${Math.max(12, (def.radius || 14))}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(def.icon || "?", slot.x, slot.y);
            if (star > 1) {
                ctx.font = "10px sans-serif";
                ctx.fillStyle = "#fbbf24";
                ctx.fillText(`★${star}`, slot.x, slot.y + (def.radius || 14) + 10);
            }
        });
    }

    function bindPrepCanvas() {
        const canvas = $("prepCanvas");
        if (!canvas || canvas.dataset.bound) return;
        canvas.dataset.bound = "1";

        const onDown = (e) => {
            if (!state || screens.formation.hidden) return;
            const pt = e.touches ? e.touches[0] : e;
            const pos = canvasLocalPos(canvas, pt.clientX, pt.clientY);
            prepDragIndex = hitPrepUnit(pos.x, pos.y);
            prepPointerId = e.pointerId;
            if (prepDragIndex >= 0) {
                if (canvas.setPointerCapture && e.pointerId != null) {
                    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                }
                e.preventDefault();
                drawPrepBoard();
            }
        };
        const onMove = (e) => {
            if (prepDragIndex < 0 || !state) return;
            if (e.pointerId != null && prepPointerId != null && e.pointerId !== prepPointerId) return;
            const pt = e.touches ? e.touches[0] : e;
            const pos = canvasLocalPos(canvas, pt.clientX, pt.clientY);
            const clamped = clampPrepPos(pos.x, pos.y);
            state.army[prepDragIndex].x = clamped.x;
            state.army[prepDragIndex].y = clamped.y;
            e.preventDefault();
            drawPrepBoard();
        };
        const onUp = () => {
            if (prepDragIndex >= 0) {
                separatePrepUnits();
                state.lastBattleSetup = WarState.snapshotArmySetup(state.army);
                WarState.saveGame(state);
            }
            prepDragIndex = -1;
            prepPointerId = null;
            drawPrepBoard();
        };

        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("pointerleave", onUp);
    }

    function renderArmyPrep() {
        ensureArmyNormalized();
        const mods = WarState.aggregateModifiers(state);
        const restrictLabel = WarState.fightRestrictionLabel(mods);
        $("formationHint").textContent = restrictLabel
            ? `詛咒：僅 [${restrictLabel}] 可出戰並放置於戰場；點單位切換出戰，拖曳調整站位。`
            : "點單位切換出戰；拖曳左側棋子調整站位。存活單位戰後獲得經驗，滿則升星（合星僅限事件）。";
        const ownedList = WarState.normalizeOwnedList(state.ownedUnits || [], state);
        const ownedN = ownedList.length;
        const deployN = state.army.length;
        $("armyCountLabel").textContent =
            `擁有 ${ownedN} · 出戰 ${deployN}（敵方約 ${pendingEncounter?.enemyArmy?.length || "?"}）`;
        $("armyPerfWarn").hidden = deployN < (ARENA.softWarn || 40);
        renderFormationMeta();

        const list = $("ownedUnitList");
        list.innerHTML = "";
        ownedList.forEach((entry) => {
            const def = UNITS[entry.id];
            if (!def) return;
            const deployed = isDeployedUid(entry.uid);
            const allowed = WarState.unitMayFight(entry.id, mods);
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "war-army-chip "
                + (allowed
                    ? (deployed ? "war-army-chip--deployed" : "war-army-chip--benched")
                    : "war-army-chip--banned");
            const star = entry.star || 1;
            const starHtml = star > 1 ? `<span class="war-army-chip-star">★${star}</span> ` : "";
            chip.innerHTML =
                `${def.icon} ${starHtml}${def.name} <span class="war-army-chip-count">${expLabel(entry)}</span>`;
            chip.title = !allowed
                ? (restrictLabel ? `詛咒限制：僅 [${restrictLabel}] 可出戰` : "受詛咒限制，無法出戰")
                : (deployed ? "點擊撤下" : "點擊出戰");
            chip.disabled = !allowed && !deployed;
            chip.addEventListener("click", () => toggleOwnedUnitByUid(entry.uid));
            list.appendChild(chip);
        });
        if (!ownedList.length) {
            const empty = document.createElement("p");
            empty.className = "war-hint";
            empty.textContent = "你沒有任何單位";
            list.appendChild(empty);
        }
        resizePrepCanvas();
        bindPrepCanvas();
        drawPrepBoard();
        updateHud();
    }

    function drawBattle() {
        const canvas = $("battleCanvas");
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // ground
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(148,163,184,0.2)";
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(w / 2, 12);
        ctx.lineTo(w / 2, h - 12);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!battle) return;

        const many = battle.units.filter((u) => u.alive).length > (ARENA.softWarn || 40);

        // Ground FX (behind units)
        (battle.fx || []).forEach((f) => {
            const life = f.life != null ? f.life : (f.t > 0 ? f.t : 0.3);
            const prog = life > 0 ? 1 - Math.max(0, f.t) / life : 1;
            if (f.type === "bolt") {
                const a = Math.max(0, Math.min(1, f.t * 5));
                const col = f.color || "#93c5fd";
                ctx.strokeStyle = col;
                ctx.globalAlpha = a;
                ctx.lineWidth = f.w != null ? f.w : 3;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(f.x0, f.y0);
                ctx.lineTo(f.x1, f.y1);
                ctx.stroke();
                ctx.globalAlpha = a * 0.45;
                ctx.lineWidth = (f.w != null ? f.w : 3) + 3;
                ctx.beginPath();
                ctx.moveTo(f.x0, f.y0);
                ctx.lineTo(f.x1, f.y1);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineCap = "butt";
            } else if (f.type === "slash") {
                const life = f.life != null ? f.life : 0.22;
                const a = Math.max(0, f.t / life);
                const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
                const reach = Math.min(42, Math.hypot(f.x1 - f.x0, f.y1 - f.y0) * 0.55 + 18);
                const sweep = (f.crit ? 1.05 : 0.85) * (0.35 + a * 0.65);
                ctx.save();
                ctx.translate(f.x0, f.y0);
                ctx.rotate(ang);
                ctx.strokeStyle = f.color || "#f8fafc";
                ctx.lineCap = "round";
                ctx.globalAlpha = a * 0.95;
                ctx.lineWidth = f.crit ? 5 : 3.5;
                ctx.beginPath();
                ctx.arc(0, 0, reach, -sweep, sweep * (1.1 - prog * 0.4));
                ctx.stroke();
                ctx.globalAlpha = a * 0.35;
                ctx.lineWidth = f.crit ? 9 : 7;
                ctx.beginPath();
                ctx.arc(0, 0, reach * 0.92, -sweep * 0.85, sweep * 0.7);
                ctx.stroke();
                ctx.restore();
                ctx.globalAlpha = 1;
            } else if (f.type === "proj") {
                const x = f.x0 + (f.x1 - f.x0) * prog;
                const y = f.y0 + (f.y1 - f.y0) * prog;
                const col = f.color || "#93c5fd";
                const pr = f.r != null ? f.r : (many ? 2.5 : 3.5);
                ctx.fillStyle = col;
                ctx.globalAlpha = Math.max(0.35, f.t / life);
                ctx.beginPath();
                ctx.arc(x, y, many ? Math.max(3, pr * 0.7) : pr, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = Math.max(0.2, f.t / life * 0.7);
                ctx.stroke();
                if (!many) {
                    ctx.strokeStyle = col;
                    ctx.lineWidth = 3;
                    ctx.lineCap = "round";
                    ctx.globalAlpha = Math.max(0.2, f.t / life * 0.75);
                    ctx.beginPath();
                    ctx.moveTo(f.x0 + (f.x1 - f.x0) * Math.max(0, prog - 0.22), f.y0 + (f.y1 - f.y0) * Math.max(0, prog - 0.22));
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.lineCap = "butt";
                }
                ctx.globalAlpha = 1;
            } else if (f.type === "ring") {
                const a = Math.max(0, f.t * 2.5);
                const baseR = f.r != null ? f.r : 36;
                const grow = (0.45 - Math.min(0.45, f.t)) / 0.45;
                ctx.strokeStyle = f.color || "#fff";
                ctx.globalAlpha = a;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(f.x, f.y, Math.max(8, baseR * (0.55 + grow * 0.45)), 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (f.type === "death") {
                const a = Math.max(0, f.t / life);
                const baseR = f.r != null ? f.r : 14;
                ctx.strokeStyle = f.color || "#f87171";
                ctx.globalAlpha = a * 0.9;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(f.x, f.y, baseR * (0.6 + prog * 1.4), 0, Math.PI * 2);
                ctx.stroke();
                if (!many) {
                    ctx.globalAlpha = a * 0.5;
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, baseR * (0.3 + prog * 2.1), 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            } else if (f.type === "cast") {
                const a = Math.max(0, (f.t / life) * 0.7);
                const pulse = 1 + Math.sin(prog * Math.PI * 4) * 0.08;
                ctx.strokeStyle = "#c4b5fd";
                ctx.globalAlpha = a;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(f.x, f.y, (f.r || 14) * pulse + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (f.type === "hit") {
                const hr = f.r != null ? f.r : 6;
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, f.t * 4)})`;
                ctx.beginPath();
                ctx.arc(f.x, f.y, hr * (0.7 + (1 - Math.min(1, f.t * 4)) * 0.8), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(254,240,138,${Math.max(0, f.t * 3)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(f.x, f.y, hr * 1.35, 0, Math.PI * 2);
                ctx.stroke();
            } else if (f.type === "spark" && !many) {
                const a = Math.max(0, f.t / life);
                const seeds = f.seeds || [0.1, 0.3, 0.5, 0.7, 0.9];
                seeds.forEach((s, i) => {
                    const ang = s * Math.PI * 2 + i;
                    const dist = 5 + prog * (14 + i * 2.5);
                    ctx.fillStyle = f.color || "#fef08a";
                    ctx.globalAlpha = a * (1 - prog * 0.65);
                    ctx.beginPath();
                    ctx.arc(f.x + Math.cos(ang) * dist, f.y + Math.sin(ang) * dist, 2.6, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
            }
        });

        // units sorted by y for depth
        const sorted = [...battle.units].sort((a, b) => a.y - b.y);
        sorted.forEach((u) => {
            if (u.alpha <= 0.01 && !u.alive) return;
            ctx.save();
            ctx.globalAlpha = u.alpha;
            const bob = u.state === "move" ? Math.sin(u.anim * 10) * 2 : 0;
            const lunge = u.attackFlash > 0 ? u.facing * (6 + u.attackFlash * 18) : 0;
            const hurtT = Math.max(0, Math.min(1, (u.hurtFlash || 0) / 0.22));
            const hurtSquash = 1 + hurtT * 0.18;
            const deathScale = !u.alive ? 1 + Math.min(0.55, (u.deathPulse || 1) - 1) * 0.35 : 1;
            const x = u.x + lunge;
            const y = u.y + bob;
            const r = u.radius * hurtSquash * deathScale;

            ctx.beginPath();
            ctx.fillStyle = u.side === "player" ? "#166534" : "#7f1d1d";
            if (u.temporary) ctx.fillStyle = u.side === "player" ? "#0e7490" : "#6b21a8";
            if (u.hurtFlash > 0) ctx.fillStyle = "#f8fafc";
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = u.temporary
                ? (u.side === "player" ? "#67e8f9" : "#e9d5ff")
                : (u.side === "player" ? "#4ade80" : "#fca5a5");
            ctx.lineWidth = u.temporary ? 2.5 : 2;
            if (u.temporary) ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Casting aura (always visible while channeling)
            if (u.alive && u.casting) {
                const pulse = 1 + Math.sin((u.anim || 0) * 10) * 0.06;
                ctx.strokeStyle = "rgba(196,181,253,0.85)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, r * pulse + 5, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.font = `${Math.max(12, r)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(u.icon || "?", x, y);

            if (u.alive && u.star > 1) {
                ctx.font = "9px sans-serif";
                ctx.fillStyle = "#fbbf24";
                ctx.fillText(`★${u.star}`, x, y + r + 10);
            }
            if (u.alive && u.affixId) {
                ctx.font = "10px sans-serif";
                ctx.fillStyle = "#fde68a";
                ctx.fillText(affixIcon(u.affixId) || "✦", x + r * 0.7, y - r * 0.7);
            }

            if (u.alive) {
                const barW = u.role === "boss" ? r * 2.6 : r * 2;
                const barY = y - r - 8;
                const pct = Math.max(0, u.hp / u.maxHp);
                // Boss: dual-phase pip (I / II) + color shift in phase 2
                if (u.role === "boss") {
                    const pipY = barY - 5;
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                    ctx.fillRect(x - barW / 2, pipY, barW, 3);
                    ctx.fillStyle = "#94a3b8";
                    ctx.fillRect(x - barW / 2, pipY, barW * 0.5, 3);
                    ctx.fillStyle = u.bossPhase >= 2 ? "#fbbf24" : "#475569";
                    ctx.fillRect(x, pipY, barW * 0.5, 3);
                    if (u.bossPhase >= 2) {
                        ctx.font = "bold 9px sans-serif";
                        ctx.fillStyle = "#fbbf24";
                        ctx.fillText("Ⅱ", x + barW / 2 + 8, barY + 2);
                    }
                    if (u.phaseIframes > 0) {
                        const pulse = 0.45 + Math.sin((u.anim || 0) * 18) * 0.25;
                        ctx.strokeStyle = `rgba(251,191,36,${pulse})`;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
                ctx.fillStyle = "rgba(0,0,0,0.45)";
                ctx.fillRect(x - barW / 2, barY, barW, 4);
                ctx.fillStyle = u.side === "player"
                    ? "#22c55e"
                    : (u.role === "boss" && u.bossPhase >= 2 ? "#f97316" : "#ef4444");
                ctx.fillRect(x - barW / 2, barY, barW * pct, 4);

                // Cast bar
                if (u.casting && u.casting.duration > 0) {
                    const castPct = Math.min(1, u.casting.timer / u.casting.duration);
                    ctx.fillStyle = "rgba(0,0,0,0.5)";
                    ctx.fillRect(x - barW / 2, barY - 6, barW, 3);
                    ctx.fillStyle = "#c4b5fd";
                    ctx.fillRect(x - barW / 2, barY - 6, barW * castPct, 3);
                }

                // Status effect markers above HP bar
                if (u.effects && u.effects.length) {
                    const se = WarData.STATUS_EFFECTS || {};
                    const statusY = u.casting ? barY - 12 : (u.role === "boss" ? barY - 10 : barY - 6);
                    u.effects.forEach((e, i) => {
                        const meta = se[e.type] || {};
                        const icon = meta.icon || "•";
                        ctx.font = "10px sans-serif";
                        const label = e.stacks > 1 ? `${icon}${e.stacks}` : icon;
                        ctx.fillText(label, x - 14 + i * 14, statusY);
                    });
                    const ringOrder = ["freeze", "root", "burn", "shock", "poison", "bleed", "silence", "weaken", "vulnerable"];
                    const ring = ringOrder.find((t) => u.effects.some((e) => e.type === t));
                    if (ring && se[ring]) {
                        const hex = se[ring].color || "#fff";
                        const rcol = hex.length === 7
                            ? `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},0.75)`
                            : "rgba(255,255,255,0.6)";
                        ctx.strokeStyle = rcol;
                        ctx.lineWidth = ring === "freeze" || ring === "root" ? 2.5 : 2;
                        ctx.beginPath();
                        ctx.arc(x, y, r + (ring === "freeze" || ring === "root" ? 3 : 2), 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        });

        // Floating damage / heal text (draw on top)
        (battle.fx || []).forEach((f) => {
            if (f.type !== "dmg") return;
            if (many && f.heal) return;
            const life = f.life != null ? f.life : 0.75;
            const prog = 1 - Math.max(0, f.t) / life;
            const a = Math.max(0, 1 - prog);
            const y = f.y - prog * (f.crit ? 28 : 20);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (f.heal) {
                ctx.fillStyle = "#86efac";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText(`+${f.amount}`, f.x, y);
            } else if (f.crit) {
                ctx.fillStyle = "#fde68a";
                ctx.font = "bold 15px sans-serif";
                ctx.strokeStyle = "rgba(0,0,0,0.45)";
                ctx.lineWidth = 3;
                ctx.strokeText(`${f.amount}!`, f.x, y);
                ctx.fillText(`${f.amount}!`, f.x, y);
            } else {
                ctx.fillStyle = "#fecaca";
                ctx.font = many ? "bold 12px sans-serif" : "bold 14px sans-serif";
                ctx.strokeStyle = "rgba(0,0,0,0.4)";
                ctx.lineWidth = 2.5;
                ctx.strokeText(String(f.amount), f.x, y);
                ctx.fillText(String(f.amount), f.x, y);
            }
            ctx.restore();
        });
    }

    function formatLogEntry(e) {
        const crit = e.crit ? "暴擊 " : "";
        const hp = (e.hp != null && e.maxHp != null) ? `(${e.hp}/${e.maxHp})` : "";
        if (e.type === "death") return `<p class="war-log-death">💀 ${e.target}${hp} 陣亡</p>`;
        if (e.type === "attack") {
            return `<p class="war-log-attack">⚔ ${e.source} → ${e.target}${hp}　${crit}${e.amount}</p>`;
        }
        if (e.type === "skill_hit") {
            return `<p class="war-log-skill">✨ ${e.source} ${e.skill} → ${e.target}${hp}　${crit}${e.amount}</p>`;
        }
        if (e.type === "cast") {
            return `<p class="war-log-cast">🔮 ${e.source} 施法 ${e.skill}（${e.duration.toFixed(1)}s）</p>`;
        }
        if (e.type === "skill") {
            const detail = e.detail ? `（${e.detail}）` : "";
            return `<p class="war-log-skill">✨ ${e.source}：${e.skill}${detail}</p>`;
        }
        if (e.type === "heal") {
            const who = e.source ? `${e.source} ${e.skill || "治療"} → ` : "";
            return `<p class="war-log-heal">💚 ${who}${e.target}${hp}　+${e.amount}</p>`;
        }
        if (e.type === "revive") return `<p class="war-log-revive">🔥 ${e.target}${hp} 復活！</p>`;
        if (e.type === "thorns") {
            return `<p class="war-log-attack">🌵 ${e.source} 反傷 → ${e.target}${hp}　${e.amount}</p>`;
        }
        if (e.type === "lifesteal") {
            return `<p class="war-log-heal">🩸 ${e.source}${hp} 吸血　+${e.amount}</p>`;
        }
        if (e.type === "status") {
            const from = e.source ? `${e.source} → ` : "";
            return `<p class="war-log-status">⏱ ${from}${e.target}${hp}　${e.statusLabel || e.status}</p>`;
        }
        if (e.type === "dot") {
            return `<p class="war-log-dot">☢ ${e.target}${hp} ${e.statusLabel || e.status}　${e.amount}</p>`;
        }
        if (e.type === "summon") {
            return `<p class="war-log-summon">🕯 ${e.source} 召喚 ${e.target}</p>`;
        }
        if (e.type === "tactic") {
            return `<p class="war-log-skill">⚔ 戰術：${e.skill}${e.detail ? ` — ${e.detail}` : ""}</p>`;
        }
        return "";
    }

    function refreshTacticButtons() {
        const wrap = $("tacticButtons");
        const hint = $("tacticHint");
        if (!wrap) return;
        wrap.innerHTML = "";
        (TACTICS || []).forEach((t) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "war-btn war-btn-sm war-tactic-btn";
            btn.dataset.tactic = t.id;
            btn.textContent = t.name;
            btn.title = t.desc;
            const used = battle && (battle.usedTactics || []).includes(t.id);
            const busy = battle && battle.activeTactic;
            const left = battle ? (battle.tacticsLeft || 0) : 0;
            btn.disabled = !battle || battleEnded || battle.finished || used || !!busy || left <= 0;
            if (battle && battle.activeTactic === t.id) btn.classList.add("is-active");
            btn.addEventListener("click", () => {
                if (!battle || battleEnded) return;
                if (battle.activateTactic(t.id)) {
                    refreshTacticButtons();
                    const recent = battle.log.slice(-10);
                    $("battleLog").innerHTML = recent.map(formatLogEntry).join("");
                }
            });
            wrap.appendChild(btn);
        });
        if (hint) {
            const left = battle ? (battle.tacticsLeft || 0) : 0;
            const active = battle && battle.activeTactic
                ? (TACTICS.find((x) => x.id === battle.activeTactic)?.name || battle.activeTactic)
                : null;
            hint.textContent = active
                ? `進行中：${active}（剩餘 ${left}）`
                : `戰術剩餘 ${left}`;
        }
    }

    function setBattleSpeed(speed) {
        battleSpeed = Math.max(1, Math.min(3, Number(speed) || 1));
        document.querySelectorAll(".war-speed-btn").forEach((btn) => {
            btn.classList.toggle("is-active", Number(btn.dataset.speed) === battleSpeed);
        });
    }

    function battleLoop(ts) {
        if (!battle || battleEnded) return;
        if (!lastFrame) lastFrame = ts;
        let dt = (ts - lastFrame) / 1000;
        lastFrame = ts;
        dt = Math.min(0.05, Math.max(0.001, dt));

        battle.tick(dt * battleSpeed);
        drawBattle();
        if (battle.activeTactic || (battle.tacticsLeft != null)) {
            // Keep tactic hint in sync while a command is active
            const hint = $("tacticHint");
            if (hint && battle.activeTactic) {
                const name = TACTICS.find((x) => x.id === battle.activeTactic)?.name || battle.activeTactic;
                hint.textContent = `進行中：${name}（剩餘 ${battle.tacticsLeft || 0}）`;
            } else if (hint && !battle.activeTactic) {
                hint.textContent = `戰術剩餘 ${battle.tacticsLeft || 0}`;
                document.querySelectorAll(".war-tactic-btn").forEach((btn) => {
                    const used = (battle.usedTactics || []).includes(btn.dataset.tactic);
                    const left = battle.tacticsLeft || 0;
                    btn.disabled = battleEnded || battle.finished || used || left <= 0;
                    btn.classList.remove("is-active");
                });
            }
        }

        logAccum += dt;
        const interval = battle.units.filter((u) => u.alive).length > (ARENA.softWarn || 40) ? 0.28 : 0.12;
        if (logAccum >= interval) {
            logAccum = 0;
            const recent = battle.log.slice(-10);
            $("battleLog").innerHTML = recent.map(formatLogEntry).join("");
            $("battleLog").scrollTop = $("battleLog").scrollHeight;
        }

        if (battle.finished) {
            endBattle();
            return;
        }
        battleRaf = requestAnimationFrame(battleLoop);
    }

    function startBattle() {
        ensureArmyNormalized();
        const modsBase = WarState.aggregateModifiers(state);
        state.army = WarState.filterArmyByFightRules(state.army, modsBase);
        if (!state.army || !state.army.length) {
            const label = WarState.fightRestrictionLabel(modsBase);
            $("formationHint").textContent = label
                ? `至少派出一個 [${label}] 單位！`
                : "至少派出一個單位！";
            return;
        }
        state.lastBattleSetup = WarState.snapshotArmySetup(state.army);

        const synergies = WarState.computeSynergies(state.army);
        const tagEffects = [...(modsBase.tagEffects || [])];
        synergies.forEach((syn) => {
            if (syn.effect) tagEffects.push({ ...syn.effect });
        });
        const terrain = pendingEncounter?.terrain;
        const mods = {
            ...modsBase,
            tagEffects,
            terrainEffect: (terrain && terrain.effect) || {},
            enemyHpMult: pendingEncounter?.enemyScale?.hp,
            enemyAtkMult: pendingEncounter?.enemyScale?.atk,
            enemyDefMult: pendingEncounter?.enemyScale?.def,
            addHpMult: pendingEncounter?.enemyScale?.addHp,
            addAtkMult: pendingEncounter?.enemyScale?.addAtk,
            addDefMult: pendingEncounter?.enemyScale?.addDef
        };
        const enemyArmy = pendingEncounter.enemyArmy || [];
        resizeCanvas();
        battle = createBattle(state.army, enemyArmy, mods, ARENA);
        battleEnded = false;
        combatContractPending = true;
        state.phase = "battle";
        showScreen("battle");
        const terrainLabel = terrain ? `${terrain.icon || ""} ${terrain.name}` : "";
        $("battleTitle").textContent = [pendingEncounter.label || "戰場混戰", terrainLabel].filter(Boolean).join(" · ");
        $("battleActions").hidden = true;
        const continueBtn = $("battleContinueBtn");
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.onclick = null;
        }
        $("battleToolbar").hidden = false;
        $("battleLog").innerHTML = "<p>戰鬥開始！</p>";
        const statsEl = $("battleStats");
        if (statsEl) {
            statsEl.hidden = true;
            statsEl.innerHTML = "";
        }
        setBattleSpeed(battleSpeed);
        refreshTacticButtons();
        lastFrame = 0;
        logAccum = 0;
        if (battleRaf) cancelAnimationFrame(battleRaf);
        battleRaf = requestAnimationFrame(battleLoop);
        WarState.saveGame(state);
    }

    function stopBattleLoop() {
        if (battleRaf) cancelAnimationFrame(battleRaf);
        battleRaf = null;
        lastFrame = 0;
    }

    function renderBattleStatsPanel(targetId) {
        const panel = $(targetId || "settlementStats") || $("battleStats");
        if (!panel || !battle) return;
        const rows = WarBattle.summarizeBattleStats
            ? WarBattle.summarizeBattleStats(battle.units)
            : [];
        if (!rows.length) {
            panel.innerHTML = "<p class=\"war-hint\">無統計資料</p>";
            return;
        }

        const maxDealt = Math.max(1, ...rows.map((r) => r.dealt || 0));
        const maxTaken = Math.max(1, ...rows.map((r) => r.taken || 0));
        const maxHealed = Math.max(1, ...rows.map((r) => r.healed || 0));

        const bar = (value, max, kind) => {
            const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
            return `<div class="war-stat-bar" title="${value}">
                <div class="war-stat-bar-track">
                    <div class="war-stat-bar-fill war-stat-bar-fill--${kind}" style="width:${pct}%"></div>
                </div>
                <span class="war-stat-bar-val">${value}</span>
            </div>`;
        };

        const body = rows.map((r) => {
            const deadClass = r.alive ? "" : " war-settlement-unit--dead";
            const kill = !r.alive && r.killedBy
                ? `<div class="war-battle-stats-killed">陣亡於：${r.killedBy}</div>`
                : "";
            return `<div class="war-settlement-unit${deadClass}">
                <div class="war-settlement-unit-head">
                    <span class="war-settlement-unit-name">${r.icon || ""} ${r.name}${r.alive ? "" : "（陣亡）"}</span>
                </div>
                <div class="war-settlement-unit-metrics">
                    <div class="war-settlement-metric">
                        <span class="war-settlement-metric-label war-settlement-metric-label--dealt">輸出</span>
                        ${bar(r.dealt || 0, maxDealt, "dealt")}
                    </div>
                    <div class="war-settlement-metric">
                        <span class="war-settlement-metric-label war-settlement-metric-label--taken">承傷</span>
                        ${bar(r.taken || 0, maxTaken, "taken")}
                    </div>
                    <div class="war-settlement-metric">
                        <span class="war-settlement-metric-label war-settlement-metric-label--healed">治療</span>
                        ${bar(r.healed || 0, maxHealed, "healed")}
                    </div>
                </div>
                ${kill}
            </div>`;
        }).join("");

        panel.innerHTML = `
            <p class="war-battle-stats-title">戰後統計</p>
            <div class="war-settlement-legend" aria-hidden="true">
                <span><i class="war-settlement-swatch war-settlement-swatch--dealt"></i>輸出</span>
                <span><i class="war-settlement-swatch war-settlement-swatch--taken"></i>承傷</span>
                <span><i class="war-settlement-swatch war-settlement-swatch--healed"></i>治療</span>
            </div>
            <div class="war-settlement-chart">${body}</div>
        `;
    }

    function showSettlement(opts) {
        const o = opts || {};
        stopBattleLoop();
        state.phase = "settlement";
        showScreen("settlement");

        const titleEl = $("settlementTitle");
        const subEl = $("settlementSubtitle");
        const notesEl = $("settlementNotes");
        const actionsEl = $("settlementActions");
        const btn = $("settlementContinueBtn");

        if (titleEl) {
            titleEl.textContent = o.title || "戰鬥結算";
            titleEl.classList.toggle("war-settlement-title--win", o.outcome === "win");
            titleEl.classList.toggle("war-settlement-title--lose", o.outcome === "lose");
        }
        if (subEl) subEl.textContent = o.subtitle || "";
        if (notesEl) {
            notesEl.innerHTML = (o.notes || []).join("");
        }
        renderBattleStatsPanel("settlementStats");

        if (actionsEl) actionsEl.hidden = !!o.hideActions;
        if (btn) {
            btn.textContent = o.continueLabel || "繼續";
            btn.disabled = !!o.hideActions;
            btn.onclick = () => {
                if (typeof o.onContinue === "function") o.onContinue();
            };
        }

        if (o.autoContinueMs != null && typeof o.onContinue === "function") {
            scheduleEndlessAuto(() => o.onContinue(), o.autoContinueMs);
        }

        WarState.saveGame(state);
        updateHud();
    }

    function endBattle() {
        if (battleEnded) return;
        battleEnded = true;
        stopBattleLoop();
        if ($("battleActions")) $("battleActions").hidden = true;
        if ($("battleToolbar")) $("battleToolbar").hidden = true;
        const sideStats = $("battleStats");
        if (sideStats) {
            sideStats.hidden = true;
            sideStats.innerHTML = "";
        }

        const won = battle.winner === "player";
        const node = getNode(state.map, state.map.currentNodeId);
        const isBoss = node?.type === "boss";
        const isEpicCombat = node?.type === "epic_combat";

        let expMessages = [];
        if (won && !state.endless) {
            const expAmt = isBoss ? 2 : (isEpicCombat ? 2 : 1);
            expMessages = WarState.grantBattleExp(state, battle.units, { amount: expAmt });
        }

        const casualty = WarState.applyBattleCasualties(state, battle.units);
        const lost = casualty.lost || [];
        const autoRevived = casualty.revived || [];
        const combatResult = WarState.afterCombat(state, won);
        if (won && isEpicCombat && !state.endless) WarState.addGold(state, 25);
        updateHud();

        const notes = [];
        if (expMessages.length) {
            notes.push(`<p class="war-settlement-note--win">⬆ ${expMessages.join(" · ")}</p>`);
        } else if (won && !state.endless) {
            notes.push(`<p class="war-settlement-note--win">⬆ 存活單位獲得經驗</p>`);
        }
        if (autoRevived.length) {
            const names = autoRevived.map((u) => u.name).join("、");
            notes.push(`<p class="war-settlement-note--warn">🪔 復生提燈召回：${names}</p>`);
        }
        if (lost.length) {
            const names = lost.map((u) => u.name).join("、");
            notes.push(`<p class="war-settlement-note--bad">永久陣亡：${names}（可於「部隊」或商店付費復活）</p>`);
        }

        // Final campaign boss → free revive all fallen before endless
        const isFinalBossClear = won && isBoss && !state.endless
            && state.worldIndex >= WORLDS.length - 1;
        if (isFinalBossClear) {
            const revivedAll = WarState.reviveAllFallenFree(state);
            // Remove permanent-death note — everyone comes back for endless
            for (let i = notes.length - 1; i >= 0; i--) {
                if (notes[i].includes("永久陣亡")) notes.splice(i, 1);
            }
            if (revivedAll.count) {
                notes.push(
                    `<p class="war-settlement-note--win">✨ 通關復活：${revivedAll.names.join("、")}（進入無盡前全體歸隊）</p>`
                );
            } else {
                notes.push(`<p class="war-settlement-note--win">✨ 通關！部隊全員待命，可挑戰無盡模式</p>`);
            }
            if (Array.isArray(state.lastBattleSetup) && state.lastBattleSetup.length) {
                state.army = WarState.restoreLastBattleSetup(state);
            }
            updateHud();
        }

        if (!won) {
            const canRetreat = !state.endless
                && !!(combatResult && combatResult.retreated)
                && !isBoss
                && (state.ownedUnits || []).length > 0;
            if (canRetreat) {
                const kept = combatResult.goldKept != null ? combatResult.goldKept : state.gold;
                notes.push(
                    `<p class="war-settlement-note--warn">戰術撤退成功！保留 ${kept} 金幣，該房無戰利品，遠征繼續。</p>`
                );
                showSettlement({
                    outcome: "retreat",
                    title: "戰術撤退",
                    subtitle: "部隊已撤離戰場",
                    notes,
                    continueLabel: "撤回地圖",
                    onContinue: () => {
                        const n = getNode(state.map, state.map.currentNodeId);
                        if (n) n.cleared = true;
                        notifyContractTick(true);
                        state.phase = "map";
                        showScreen("map");
                        renderMap();
                        updateHud();
                        WarState.saveGame(state);
                    }
                });
                return;
            }
            notifyContractTick(true);
            if (state.endless) {
                WarState.recordEndlessBest(state.endlessStages || 0);
                notes.push(
                    `<p><strong>無盡挑戰結束！通過 ${state.endlessStages || 0} 關（最佳 ${WarState.getEndlessBest()}）</strong></p>`
                );
            } else {
                notes.push(`<p class="war-settlement-note--bad"><strong>戰敗！遠征結束。</strong></p>`);
            }
            showSettlement({
                outcome: "lose",
                title: "戰敗",
                subtitle: state.endless
                    ? `通過 ${state.endlessStages || 0} 關`
                    : "遠征在此結束",
                notes,
                continueLabel: "確認",
                onContinue: () => gameOver()
            });
            return;
        }

        if (state.endless) {
            state.endlessStages = (state.endlessStages || 0) + 1;
            WarState.recordEndlessBest(state.endlessStages);
            updateHud();
            notes.push(
                `<p class="war-settlement-note--win"><strong>第 ${state.endlessStages} 關通過！</strong>（無獎勵 · 最佳 ${WarState.getEndlessBest()}）</p>`
            );
            showSettlement({
                outcome: "win",
                title: "勝利",
                subtitle: `無盡挑戰 · 第 ${state.endlessStages} 關`,
                notes,
                continueLabel: "下一關",
                hideActions: !!state.endlessAutoRun,
                autoContinueMs: state.endlessAutoRun ? 500 : null,
                onContinue: () => proceedEndlessAfterBattle(isBoss)
            });
            return;
        }

        notes.push(
            isEpicCombat
                ? `<p class="war-settlement-note--win"><strong>史詩戰鬥勝利！+25 金</strong></p>`
                : `<p class="war-settlement-note--win"><strong>勝利！</strong></p>`
        );
        showSettlement({
            outcome: "win",
            title: "勝利",
            subtitle: isBoss
                ? "Boss 已擊敗"
                : (isEpicCombat ? "史詩戰鬥結束" : "戰鬥結束"),
            notes,
            continueLabel: "繼續",
            onContinue: () => {
                if (!battleEnded || !battle || !battle.finished) return;
                if (isBoss) {
                    if (state.worldIndex >= WORLDS.length - 1) {
                        state.runWon = true;
                        state.phase = "victory";
                        WarState.saveGame(state);
                        showScreen("victory");
                    } else {
                        pendingRewardType = "artifact";
                        pendingRewardSource = "boss";
                        showRewardScreen();
                    }
                } else if (isEpicCombat) {
                    pendingRewardType = "epic";
                    pendingRewardSource = "epic_combat";
                    showRewardScreen();
                } else {
                    pendingRewardType = Math.random() < 0.3 ? "ability" : "artifact";
                    pendingRewardSource = "combat";
                    showRewardScreen();
                }
            }
        });
    }

    function showUnitRecruitScreen() {
        syncCtx();
        WarUIReward.showUnitRecruitScreen();
        pullCtx();
    }

    function resolveRewardPick(source) {
        syncCtx();
        WarUIReward.resolveRewardPick(source);
        pullCtx();
    }

    function showRewardScreen(opts) {
        syncCtx();
        WarUIReward.showRewardScreen(opts);
        pullCtx();
    }

    function gameOver() {
        stopBattleLoop();
        clearEndlessAutoTimer();
        if (state && state.endless) state.endlessAutoRun = false;
        if (state.endless) WarState.recordEndlessBest(state.endlessStages || 0);
        state.runLost = true;
        state.phase = "defeat";
        WarState.clearSave();
        $("defeatText").textContent = state.endless
            ? `無盡挑戰通過 ${state.endlessStages || 0} 關（歷史最佳 ${WarState.getEndlessBest()} 關）`
            : "戰鬥失敗，遠征結束。";
        showScreen("defeat");
    }

    function enterEndlessFromVictory() {
        if (!state) return;
        const result = WarState.enterEndlessMode(state);
        updateHud();
        updateEndlessAutoUi();
        showScreen("map");
        renderMap();
        WarState.saveGame(state);
        const best = WarState.getEndlessBest();
        const reviveNote = result?.revived?.count
            ? `已再確認復活 ${result.revived.count} 名單位。`
            : "部隊已全員就緒。";
        showRoomMessage(
            "無盡模式",
            `${reviveNote}直線關卡：史詩戰 → Boss。無金幣／神器獎勵。看你能過幾關。${best ? ` 目前最佳：${best} 關。` : ""}`,
            () => {}
        );
    }

    function newRun() {
        stopBattleLoop();
        clearEndlessAutoTimer();
        state = WarState.createNewRun();
        WarState.aggregateModifiers(state);
        pendingEncounter = null;
        showScreen("map");
        renderMap();
        WarState.saveGame(state);
    }

    function continueRun() {
        const saved = WarState.loadGame();
        if (!saved) return;
        state = saved;
        WarState.aggregateModifiers(state);
        if (state.runWon && !state.endless) showScreen("victory");
        else if (state.runLost) showScreen("defeat");
        else if (state.phase === "formation") {
            const node = getNode(state.map, state.map.currentNodeId);
            if (node && (node.type === "combat" || node.type === "epic_combat" || node.type === "boss" || node.type === "trap")) {
                pendingEncounter = WarState.getCombatEncounter(state, node);
            }
            ensureArmyNormalized({ restoreIfEmpty: true });
            showScreen("formation");
            renderArmyPrep();
            updateEndlessAutoUi();
            if (state.endless && state.endlessAutoRun) scheduleEndlessAuto(() => startBattle(), 200);
        } else if (state.phase === "settlement" || state.phase === "battle") {
            // In-memory battle is gone after reload; return to map
            state.phase = "map";
            showScreen("map");
            renderMap();
            if (state.endless && state.endlessAutoRun) scheduleEndlessAuto(() => tryEndlessAutoRun(), 300);
        } else {
            showScreen("map");
            renderMap();
            if (state.endless && state.endlessAutoRun) scheduleEndlessAuto(() => tryEndlessAutoRun(), 300);
        }
    }

    function rarityRank(r) {
        const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, unique: 5 };
        return order[r] != null ? order[r] : 0;
    }

    function galleryUnitEntries(kind) {
        return Object.values(UNITS || {})
            .filter((u) => {
                if (!u) return false;
                if (kind === "bosses") return u.role === "boss";
                if (kind === "units") {
                    return u.role !== "enemy" && u.role !== "boss" && u.role !== "summon" && !u.temporary;
                }
                return false;
            })
            .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || (a.name || "").localeCompare(b.name || "", "zh-Hant"));
    }

    function galleryItemCardHtml(item, kind) {
        const rarity = item.rarity || "common";
        const badge = rarityBadgeHtml(rarity);
        if (kind === "unit" || kind === "boss") {
            const rangeText = item.range === "ranged" ? "遠程" : "近戰";
            const skill = item.skill
                ? `<p class="war-gallery-card-desc"><strong>${item.skill.name}</strong> — ${item.skill.desc || ""}</p>`
                : `<p class="war-gallery-card-desc war-gallery-card-desc--muted">無主動技能</p>`;
            const stats = `HP ${item.hp} · 攻 ${item.atk} · 防 ${item.def} · 攻速 ${item.spd}`;
            return `<article class="war-gallery-card war-gallery-card--${rarity}">
                <div class="war-gallery-card-head">
                    <span class="war-gallery-card-icon">${item.icon || "?"}</span>
                    <div>
                        <h3 class="war-gallery-card-title">${item.name}</h3>
                        <p class="war-gallery-card-sub">${roleLabel(item.role)} · ${rangeText}</p>
                    </div>
                    ${badge}
                </div>
                <div class="war-unit-tags">${unitTagHtml(item)}</div>
                <p class="war-gallery-card-stats">${stats}</p>
                ${skill}
            </article>`;
        }
        return `<article class="war-gallery-card war-gallery-card--${rarity}">
            <div class="war-gallery-card-head">
                <div>
                    <h3 class="war-gallery-card-title">${item.name}</h3>
                    <p class="war-gallery-card-sub">${kind === "artifact" ? "神器" : kind === "ability" ? "能力" : "羈絆"}</p>
                </div>
                ${badge}
            </div>
            <p class="war-gallery-card-desc">${item.desc || ""}</p>
        </article>`;
    }

    let galleryTab = "units";

    function renderGallery(tab) {
        galleryTab = tab || galleryTab || "units";
        const list = $("galleryList");
        const hint = $("galleryHint");
        if (!list) return;

        document.querySelectorAll(".war-gallery-tab").forEach((btn) => {
            const on = btn.dataset.tab === galleryTab;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        });

        let html = "";
        if (galleryTab === "units") {
            const units = galleryUnitEntries("units");
            if (hint) hint.textContent = `可招募單位 ${units.length} 種（不含召喚物）`;
            html = units.map((u) => galleryItemCardHtml(u, "unit")).join("");
        } else if (galleryTab === "bosses") {
            const bosses = galleryUnitEntries("bosses");
            if (hint) hint.textContent = `世界 Boss ${bosses.length} 種`;
            html = bosses.map((u) => galleryItemCardHtml(u, "boss")).join("");
        } else if (galleryTab === "artifacts") {
            const arts = [...(ARTIFACTS || [])].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
            if (hint) hint.textContent = `神器 ${arts.length} 件`;
            html = arts.map((a) => galleryItemCardHtml(a, "artifact")).join("");
        } else if (galleryTab === "abilities") {
            const abs = [...(WarData.ABILITIES || [])].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
            if (hint) hint.textContent = `能力 ${abs.length} 項`;
            html = abs.map((a) => galleryItemCardHtml(a, "ability")).join("");
        } else if (galleryTab === "synergies") {
            const syns = WarData.SYNERGIES || [];
            if (hint) hint.textContent = `出戰羈絆 ${syns.length} 種（依標籤數量觸發）`;
            html = syns.map((s) => {
                const tagLabel = (TAGS[s.tag] && TAGS[s.tag].label) || s.tag;
                return `<article class="war-gallery-card">
                    <div class="war-gallery-card-head">
                        <div>
                            <h3 class="war-gallery-card-title">${s.name}</h3>
                            <p class="war-gallery-card-sub">[${tagLabel}] × ${s.count}</p>
                        </div>
                    </div>
                    <p class="war-gallery-card-desc">${s.desc || ""}</p>
                </article>`;
            }).join("");
        }

        list.innerHTML = html || `<p class="war-hint">尚無資料</p>`;
    }

    function openGallery(tab) {
        renderGallery(tab || "units");
        $("galleryModal").hidden = false;
    }

    function closeGallery() {
        $("galleryModal").hidden = true;
    }

    function toggleFullscreen() {
        const el = $("warShell");
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        }
    }

    function init() {
        window.WarAppBridge = {
            WarState,
            WarData,
            WarBuildHints,
            UNITS,
            getNode,
            showScreen,
            renderMap,
            finishRoom,
            showRoomMessage,
            unitRewardBodyHtml
        };

        const saved = WarState.loadGame();
        $("continueBtn").hidden = !saved;

        $("newRunBtn").addEventListener("click", newRun);
        $("continueBtn").addEventListener("click", continueRun);
        $("galleryBtn").addEventListener("click", () => openGallery("units"));
        $("galleryModalClose").addEventListener("click", closeGallery);
        $("galleryModalBackdrop").addEventListener("click", closeGallery);
        document.querySelectorAll(".war-gallery-tab").forEach((btn) => {
            btn.addEventListener("click", () => renderGallery(btn.dataset.tab));
        });
        $("clearFormationBtn").addEventListener("click", () => {
            state.army = [];
            renderArmyPrep();
        });
        const formationLayout = { arrange: "frontBack", vAlign: "middle", hAlign: "middle" };
        const arrangeLabel = { frontBack: "近前遠後", spread: "均勻分佈" };
        const valignLabel = { top: "靠上", middle: "置中", bottom: "靠下" };
        const halignLabel = { front: "靠前", middle: "置中", back: "靠後" };

        function syncFormationLayoutUi() {
            document.querySelectorAll(".war-layout-arrange").forEach((btn) => {
                btn.classList.toggle("is-active", btn.dataset.arrange === formationLayout.arrange);
            });
            document.querySelectorAll(".war-layout-valign").forEach((btn) => {
                btn.classList.toggle("is-active", btn.dataset.valign === formationLayout.vAlign);
            });
            document.querySelectorAll(".war-layout-halign").forEach((btn) => {
                btn.classList.toggle("is-active", btn.dataset.halign === formationLayout.hAlign);
            });
        }

        function applyCombinedFormationLayout() {
            if (!state || !Array.isArray(state.army) || !state.army.length) {
                $("formationHint").textContent = "請先派出單位";
                return;
            }
            WarState.layoutArmyFormation(state.army, formationLayout);
            renderArmyPrep();
            $("formationHint").textContent =
                `站位：${arrangeLabel[formationLayout.arrange]} · ${valignLabel[formationLayout.vAlign]} · ${halignLabel[formationLayout.hAlign]}`;
            WarState.saveGame(state);
        }

        document.querySelectorAll(".war-layout-arrange").forEach((btn) => {
            btn.addEventListener("click", () => {
                formationLayout.arrange = btn.dataset.arrange;
                syncFormationLayoutUi();
                applyCombinedFormationLayout();
            });
        });
        document.querySelectorAll(".war-layout-valign").forEach((btn) => {
            btn.addEventListener("click", () => {
                formationLayout.vAlign = btn.dataset.valign;
                syncFormationLayoutUi();
                applyCombinedFormationLayout();
            });
        });
        document.querySelectorAll(".war-layout-halign").forEach((btn) => {
            btn.addEventListener("click", () => {
                formationLayout.hAlign = btn.dataset.halign;
                syncFormationLayoutUi();
                applyCombinedFormationLayout();
            });
        });
        $("deployAllBtn").addEventListener("click", () => {
            deployAllEligible();
            renderArmyPrep();
        });
        ["endlessAutoBtn", "formationAutoBtn", "battleAutoBtn"].forEach((id) => {
            const el = $(id);
            if (el) el.addEventListener("click", toggleEndlessAutoRun);
        });
        $("startBattleBtn").addEventListener("click", startBattle);
        document.querySelectorAll(".war-speed-btn").forEach((btn) => {
            btn.addEventListener("click", () => setBattleSpeed(btn.dataset.speed));
        });
        $("fullscreenBtn").addEventListener("click", toggleFullscreen);
        $("saveBtn").addEventListener("click", () => {
            if (state) {
                WarState.saveGame(state);
                $("saveBtn").textContent = "已儲存";
                setTimeout(() => { $("saveBtn").textContent = "儲存"; }, 1200);
            }
        });
        $("victoryRestartBtn").addEventListener("click", newRun);
        const endlessBtn = $("endlessModeBtn");
        if (endlessBtn) endlessBtn.addEventListener("click", enterEndlessFromVictory);
        $("defeatRestartBtn").addEventListener("click", newRun);
        $("roomModalBackdrop").addEventListener("click", () => {
            if (!$("roomModalClose").hidden) $("roomModalClose").click();
        });
        $("itemCodexToggle").addEventListener("click", () => {
            const codex = $("itemCodex");
            const show = codex.hidden;
            codex.hidden = !show;
            $("itemCodexToggle").textContent = show ? "隱藏神器/能力效果" : "查看神器/能力效果";
        });
        $("unitRosterBtn").addEventListener("click", openUnitModal);
        $("prepUnitInfoBtn").addEventListener("click", openUnitModal);
        $("unitModalClose").addEventListener("click", closeUnitModal);
        $("unitModalBackdrop").addEventListener("click", closeUnitModal);

        window.addEventListener("resize", () => {
            if (state && screens.map.hidden === false) renderMap();
            if (state && screens.formation.hidden === false) {
                resizePrepCanvas();
                drawPrepBoard();
            }
            if (state && screens.battle.hidden === false) {
                resizeCanvas();
                drawBattle();
            }
        });

        showScreen("title");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
