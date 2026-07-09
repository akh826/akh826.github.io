(() => {
    const { toBigInt, canAfford, buildingCost, maxAffordableQuantity, formatShort, formatRate, sqrtBigInt } =
        window.IdleNumbers;
    const { BASE_CLICK, BUILDINGS, UPGRADES, TASKS, ACTIVE_SKILLS, RANDOM_EVENTS, PRESTIGE, ARTIFACTS, ARTIFACT_SYSTEM } =
        window.IdleData;
    const { load, save, setupAutosave } = window.IdleSave;

    const TICK_MS = 100;
    const HOLD_CLICK_MS = 100;
    const MANUAL_SHOCKWAVE_FAST_WINDOW_MS = 400;
    const MANUAL_SHOCKWAVE_DECAY_PER_SEC = 0.35;
    const ARTIFACT_CHECK_MS = 1000;
    const AUTO_BUY_DEFAULT_MS = 5000;
    const AUTO_BUY_MIN_MS = 1000;
    const AUTO_BUY_MAX_MS = 60000;
    const AUTO_BUY_OPTIONS_MS = [1000, 2000, 5000, 10000, 15000, 30000, 60000];
    const BUY_MODES = [1, 10, 100, "max"];
    const AUTO_BUILD_ARTIFACT_ID = "auto_constructor";
    const AUTO_UPGRADE_ARTIFACT_ID = "auto_optimizer";
    const TASK_BOARD_SIZE = 3;

    let state = load();
    let buyMode = 1;
    let activeTab = "buildings";
    let productionAccumulator = 0;
    let autoClickAccumulator = 0;
    let tickTimer = null;
    let holdClickTimer = null;
    let clickFromPointer = false;
    let lastBurstAt = 0;
    let pendingAutoVisualGain = 0;
    let autoVisualTimer = null;
    let showDescriptions = false;
    let artifactRollAccumulator = 0;
    let autoBuildAccumulator = 0;
    let autoUpgradeAccumulator = 0;
    let randomEventAccumulator = 0;
    let lastManualShockwaveChargeAt = 0;
    let temporaryEffects = [];
    let recentSystemEvents = [];
    let lastArtifactRenderKey = "";
    let lastSystemRenderKey = "";
    let activeCodexPage = "upgrades";
    let lastStatsRender = {
        crystal: "",
        cps: "",
        click: "",
        shards: "",
        prestigeBonus: ""
    };

    const els = {
        crystalCount: document.getElementById("crystalCount"),
        cpsValue: document.getElementById("cpsValue"),
        clickPower: document.getElementById("clickPower"),
        shardCount: document.getElementById("shardCount"),
        prestigeBonus: document.getElementById("prestigeBonus"),
        clickBtn: document.getElementById("clickBtn"),
        clickIcon: document.querySelector(".idle-click-icon"),
        clickLabel: document.querySelector(".idle-click-label"),
        clickScene: document.getElementById("clickScene"),
        clickGlow: document.getElementById("clickGlow"),
        missionHud: document.getElementById("missionHud"),
        skillHud: document.getElementById("skillHud"),
        eventHud: document.getElementById("eventHud"),
        starLayer: document.getElementById("starLayer"),
        clickWrap: document.querySelector(".idle-click-wrap"),
        buyModeBar: document.getElementById("buyModeBar"),
        tabBar: document.getElementById("tabBar"),
        buildingList: document.getElementById("buildingList"),
        upgradeList: document.getElementById("upgradeList"),
        prestigePanel: document.getElementById("prestigePanel"),
        artifactPanel: document.getElementById("artifactPanel"),
        artifactAutomation: document.getElementById("artifactAutomation"),
        prestigePreview: document.getElementById("prestigePreview"),
        artifactPreview: document.getElementById("artifactPreview"),
        codexPreview: document.getElementById("codexPreview"),
        codexTabBar: document.getElementById("codexTabBar"),
        codexModal: document.getElementById("codexModal"),
        codexOpenBtn: document.getElementById("codexOpenBtn"),
        codexCloseBtn: document.getElementById("codexCloseBtn"),
        artifactToast: document.getElementById("artifactToast"),
        prestigeBtn: document.getElementById("prestigeBtn"),
        shopPanel: document.getElementById("shopPanel"),
        descToggleBtn: document.getElementById("descToggleBtn")
    };

    function normalizeArtifactState(targetState) {
        function normalizeIntervalMs(value) {
            if (!Number.isFinite(value)) {
                return AUTO_BUY_DEFAULT_MS;
            }
            const rounded = Math.round(value / 1000) * 1000;
            return Math.min(AUTO_BUY_MAX_MS, Math.max(AUTO_BUY_MIN_MS, rounded));
        }

        if (!Number.isFinite(targetState.artifactRarityLevel)) {
            targetState.artifactRarityLevel = 0;
        } else {
            targetState.artifactRarityLevel = Math.max(0, Math.floor(targetState.artifactRarityLevel));
        }
        if (!Number.isFinite(targetState.artifactDropLevel)) {
            targetState.artifactDropLevel = 0;
        } else {
            targetState.artifactDropLevel = Math.max(0, Math.floor(targetState.artifactDropLevel));
        }
        targetState.artifactAutoBuildEnabled = Boolean(targetState.artifactAutoBuildEnabled);
        targetState.artifactAutoUpgradeEnabled = Boolean(targetState.artifactAutoUpgradeEnabled);
        targetState.artifactAutoBuildIntervalMs = normalizeIntervalMs(targetState.artifactAutoBuildIntervalMs);
        targetState.artifactAutoUpgradeIntervalMs = normalizeIntervalMs(targetState.artifactAutoUpgradeIntervalMs);
        targetState.manualShockwaveChanceBonus = Number.isFinite(targetState.manualShockwaveChanceBonus)
            ? Math.max(0, Math.min(1, targetState.manualShockwaveChanceBonus))
            : 0;

        if (targetState.artifactRarityLevel === 0 && Array.isArray(targetState.upgrades)) {
            const legacyLevel = targetState.upgrades.reduce((max, id) => {
                const match = /^artifact_rarity_(\d+)$/.exec(id);
                if (!match) {
                    return max;
                }
                return Math.max(max, Number(match[1]));
            }, 0);
            targetState.artifactRarityLevel = Math.max(0, legacyLevel);
        }

        if (!targetState.artifacts || typeof targetState.artifacts !== "object") {
            targetState.artifacts = {};
        }

        ARTIFACTS.forEach((artifact) => {
            const prev = targetState.artifacts[artifact.id] || {};
            const legacyRarity =
                Number.isFinite(prev.rarity) ? prev.rarity : Number.isFinite(prev.highestRarity) ? prev.highestRarity : 0;
            targetState.artifacts[artifact.id] = {
                rarity: Math.max(0, Math.floor(legacyRarity)),
                replacements: Number.isFinite(prev.replacements) ? Math.max(0, Math.floor(prev.replacements)) : 0
            };
        });

        if (!Array.isArray(targetState.taskBoard)) {
            targetState.taskBoard = [];
        }

        if (!targetState.skillCooldowns || typeof targetState.skillCooldowns !== "object") {
            targetState.skillCooldowns = {};
        }

        if (!targetState.randomEventCooldowns || typeof targetState.randomEventCooldowns !== "object") {
            targetState.randomEventCooldowns = {};
        }

        targetState.taskBoard = targetState.taskBoard
            .map((entry) => {
                if (!entry || typeof entry !== "object") {
                    return null;
                }
                const taskId = typeof entry.taskId === "string" ? entry.taskId : "";
                const def = TASKS.find((task) => task.id === taskId);
                if (!def) {
                    return null;
                }
                const progress = Number.isFinite(entry.progress) ? Math.max(0, Math.floor(entry.progress)) : 0;
                const claimed = Boolean(entry.claimed);
                return {
                    taskId,
                    progress: Math.min(progress, def.target),
                    claimed
                };
            })
            .filter(Boolean);

        const nextSkillCooldowns = {};
        ACTIVE_SKILLS.forEach((skill) => {
            const at = Number(targetState.skillCooldowns[skill.id]);
            nextSkillCooldowns[skill.id] = Number.isFinite(at) ? Math.max(0, Math.floor(at)) : 0;
        });
        targetState.skillCooldowns = nextSkillCooldowns;

        const nextEventCooldowns = {};
        RANDOM_EVENTS.forEach((eventDef) => {
            const at = Number(targetState.randomEventCooldowns[eventDef.id]);
            nextEventCooldowns[eventDef.id] = Number.isFinite(at) ? Math.max(0, Math.floor(at)) : 0;
        });
        targetState.randomEventCooldowns = nextEventCooldowns;
    }

    normalizeArtifactState(state);

    function getTaskDef(taskId) {
        return TASKS.find((task) => task.id === taskId);
    }

    function ensureTaskBoard() {
        const inBoard = new Set(state.taskBoard.map((entry) => entry.taskId));
        for (const task of TASKS) {
            if (state.taskBoard.length >= TASK_BOARD_SIZE) {
                break;
            }
            if (inBoard.has(task.id)) {
                continue;
            }
            state.taskBoard.push({ taskId: task.id, progress: 0, claimed: false });
            inBoard.add(task.id);
        }
    }

    function getTaskProgressText(entry, def) {
        const current = Math.min(def.target, Math.max(0, entry.progress || 0));
        return `${current} / ${def.target}`;
    }

    function isTaskCompleted(entry, def) {
        return (entry.progress || 0) >= def.target;
    }

    function trackTaskProgress(kind, delta = 1) {
        if (!Number.isFinite(delta) || delta <= 0) {
            return;
        }
        let changed = false;
        for (const entry of state.taskBoard) {
            const def = getTaskDef(entry.taskId);
            if (!def || def.track !== kind || entry.claimed) {
                continue;
            }
            const next = Math.min(def.target, (entry.progress || 0) + delta);
            if (next !== entry.progress) {
                entry.progress = next;
                changed = true;
            }
        }
        if (changed) {
            renderSystems();
        }
    }

    function claimTask(taskId) {
        const entry = state.taskBoard.find((item) => item.taskId === taskId);
        const def = getTaskDef(taskId);
        if (!entry || !def || entry.claimed || !isTaskCompleted(entry, def)) {
            return;
        }
        applyTaskClaim(entry, def, { auto: false, persist: true, refresh: true });
    }

    function applyTaskClaim(entry, def, options = {}) {
        const auto = Boolean(options.auto);
        const persist = options.persist !== false;
        const refresh = options.refresh !== false;

        entry.claimed = true;
        addCrystals(def.rewardCrystals);
        if (auto) {
            pushSystemEvent(`自動領取任務：${def.name}（+${formatShort(def.rewardCrystals)}）`);
        } else {
            spawnBurst(`任務完成 +${formatShort(def.rewardCrystals)}`);
            pushSystemEvent(`完成任務：${def.name}（+${formatShort(def.rewardCrystals)}）`);
        }
        state.taskBoard = state.taskBoard.filter((item) => !item.claimed);
        ensureTaskBoard();
        if (persist) {
            save(state);
        }
        if (refresh) {
            refreshShop();
        }
    }

    function hasAutoMissionClaim() {
        return UPGRADES.some((upgrade) => hasUpgrade(upgrade.id) && upgrade.effect?.autoMissionClaim);
    }

    function tryAutoClaimCompletedTasks() {
        if (!hasAutoMissionClaim()) {
            return false;
        }

        let claimedAny = false;
        while (true) {
            const entry = state.taskBoard.find((item) => {
                const def = getTaskDef(item.taskId);
                return Boolean(def && !item.claimed && isTaskCompleted(item, def));
            });
            if (!entry) {
                break;
            }
            const def = getTaskDef(entry.taskId);
            if (!def) {
                break;
            }
            applyTaskClaim(entry, def, { auto: true, persist: false, refresh: false });
            claimedAny = true;
        }

        if (claimedAny) {
            save(state);
        }

        return claimedAny;
    }

    function getSkillDef(skillId) {
        return ACTIVE_SKILLS.find((skill) => skill.id === skillId);
    }

    function isSkillUnlocked(skill) {
        if (!skill || !skill.requiredUpgradeId) {
            return true;
        }
        return hasUpgrade(skill.requiredUpgradeId);
    }

    function nowMs() {
        return Date.now();
    }

    function getSkillCooldownRemainingMs(skillId) {
        const readyAt = Number(state.skillCooldowns[skillId] || 0);
        return Math.max(0, readyAt - nowMs());
    }

    function getSkillGlobalMultiplier() {
        return temporaryEffects.reduce((mult, effect) => mult * (effect.globalMult || 1), 1);
    }

    function getSkillClickMultiplier() {
        return temporaryEffects.reduce((mult, effect) => mult * (effect.clickMult || 1), 1);
    }

    function getSkillStarSpawnMultiplier() {
        return temporaryEffects.reduce((mult, effect) => mult * (effect.starSpawnMult || 1), 1);
    }

    function addTemporaryEffect(sourceId, effect, durationMs) {
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
            return;
        }
        temporaryEffects.push({
            sourceId,
            globalMult: Number(effect.globalMult) || 1,
            clickMult: Number(effect.clickMult) || 1,
            starSpawnMult: Number(effect.starSpawnMult) || 1,
            expiresAt: nowMs() + durationMs
        });
    }

    function cleanupExpiredTemporaryEffects() {
        const t = nowMs();
        temporaryEffects = temporaryEffects.filter((item) => item.expiresAt > t);
    }

    function getSkillIcon(skillId) {
        if (skillId === "skill_overdrive") return "⚡";
        if (skillId === "skill_meteor_call") return "☄";
        if (skillId === "skill_income_burst") return "✺";
        return "✦";
    }

    function getShockwaveHudState() {
        const status =
            window.IdleStars && typeof window.IdleStars.getShockwaveStatus === "function"
                ? window.IdleStars.getShockwaveStatus()
                : { enabled: false, checkSeconds: 10, secondsRemaining: 10 };
        const chargeUpgrade = getUpgradeDef("star_shockwave_charge_1");
        const hasChargeUpgrade = hasUpgrade("star_shockwave_charge_1");
        const chance = Math.max(0, Math.min(1, getArtifactShockwaveChancePerCheck()));
        const chancePct = Math.round(chance * 1000) / 10;
        const secondsRemaining = Math.max(0, Math.ceil(status.secondsRemaining || 0));
        const unlockUpgrade = UPGRADES.find((upgrade) => upgrade.effect?.starUnlock);
        const lockText = !status.enabled
            ? unlockUpgrade
                ? `（需升級：${unlockUpgrade.name}）`
                : ""
            : chargeUpgrade
                ? `（需升級：${chargeUpgrade.name}）`
                : "";
        const hudEnabled = Boolean(status.enabled && hasChargeUpgrade);
        return {
            enabled: hudEnabled,
            chancePct,
            secondsRemaining,
            checkSeconds: status.checkSeconds || 10,
            cdText: hudEnabled ? `${chancePct}% · ${secondsRemaining}s` : "未解鎖",
            title: hudEnabled
                ? `震波判定｜機率 ${chancePct}%｜下次判定 ${secondsRemaining}s`
                : `流星震波尚未解鎖${lockText}`
        };
    }

    function useActiveSkill(skillId) {
        const skill = getSkillDef(skillId);
        if (!skill) {
            return;
        }
        if (!isSkillUnlocked(skill)) {
            return;
        }
        if (getSkillCooldownRemainingMs(skillId) > 0) {
            return;
        }

        const effect = skill.effect || {};
        if (Number.isFinite(effect.instantCpsSeconds) && effect.instantCpsSeconds > 0) {
            const instant = Math.floor(getTotalCps() * effect.instantCpsSeconds);
            if (instant > 0) {
                addCrystals(instant);
                spawnBurst(`${skill.name} +${formatShort(BigInt(instant))}`);
            }
        }

        if (Number.isFinite(effect.spawnStars) && effect.spawnStars > 0) {
            window.IdleStars.forceSpawn(Math.floor(effect.spawnStars));
        }

        if (Number.isFinite(skill.durationMs) && skill.durationMs > 0) {
            addTemporaryEffect(skill.id, effect, skill.durationMs);
        }

        state.skillCooldowns[skill.id] = nowMs() + skill.cooldownMs;
        pushSystemEvent(`技能發動：${skill.name}`);
        save(state);
        refreshShop();
    }

    function pushSystemEvent(text, isActive = false) {
        recentSystemEvents.unshift({ text, at: nowMs(), isActive });
        if (recentSystemEvents.length > 10) {
            recentSystemEvents.length = 10;
        }
    }

    function triggerRandomEvent(eventDef) {
        const effect = eventDef.effect || {};

        if (Number.isFinite(effect.instantCpsSeconds) && effect.instantCpsSeconds > 0) {
            const instant = Math.floor(getTotalCps() * effect.instantCpsSeconds);
            if (instant > 0) {
                addCrystals(instant);
                spawnBurst(`事件：${eventDef.name} +${formatShort(BigInt(instant))}`);
            }
        }

        if (Number.isFinite(effect.spawnStars) && effect.spawnStars > 0) {
            window.IdleStars.forceSpawn(Math.floor(effect.spawnStars));
        }

        if (Number.isFinite(eventDef.durationMs) && eventDef.durationMs > 0) {
            addTemporaryEffect(eventDef.id, effect, eventDef.durationMs);
            pushSystemEvent(`事件觸發：${eventDef.name}（進行中）`, true);
        } else {
            pushSystemEvent(`事件觸發：${eventDef.name}`);
        }

        state.randomEventCooldowns[eventDef.id] = nowMs() + eventDef.cooldownMs;
        save(state);
    }

    function tryTriggerRandomEvents(deltaMs) {
        randomEventAccumulator += deltaMs;
        if (randomEventAccumulator < 1000) {
            return;
        }

        const checks = Math.floor(randomEventAccumulator / 1000);
        randomEventAccumulator -= checks * 1000;

        for (let i = 0; i < checks; i++) {
            for (const eventDef of RANDOM_EVENTS) {
                const readyAt = Number(state.randomEventCooldowns[eventDef.id] || 0);
                if (readyAt > nowMs()) {
                    continue;
                }
                if (Math.random() < eventDef.chancePerSec) {
                    triggerRandomEvent(eventDef);
                }
            }
        }
    }

    function renderSystems() {
        if (!els.missionHud || !els.skillHud || !els.eventHud) {
            return;
        }

        cleanupExpiredTemporaryEffects();
        ensureTaskBoard();

        const taskKey = state.taskBoard
            .map((entry) => `${entry.taskId}:${entry.progress}:${entry.claimed ? 1 : 0}`)
            .join("|");
        const skillKey = ACTIVE_SKILLS.map((skill) => `${skill.id}:${Math.ceil(getSkillCooldownRemainingMs(skill.id) / 1000)}`).join("|");
        const shockwaveHud = getShockwaveHudState();
        const shockwaveKey = `${shockwaveHud.enabled ? 1 : 0}:${Math.round(shockwaveHud.chancePct * 10)}:${shockwaveHud.secondsRemaining}`;
        const eventKey = recentSystemEvents.slice(0, 1).map((event) => `${event.text}:${event.at}`).join("|");
        const tempKey = temporaryEffects.map((effect) => `${effect.sourceId}:${effect.expiresAt}`).join("|");
        const renderKey = [taskKey, skillKey, shockwaveKey, eventKey, tempKey].join(";");

        if (renderKey === lastSystemRenderKey) {
            return;
        }
        lastSystemRenderKey = renderKey;

        const activeTaskEntry =
            state.taskBoard.find((entry) => {
                const def = getTaskDef(entry.taskId);
                return Boolean(def && isTaskCompleted(entry, def));
            }) || state.taskBoard[0];
        const activeTaskDef = activeTaskEntry ? getTaskDef(activeTaskEntry.taskId) : null;
        if (!activeTaskEntry || !activeTaskDef) {
            els.missionHud.innerHTML = '<p class="idle-empty-note">任務載入中…</p>';
        } else {
            const done = isTaskCompleted(activeTaskEntry, activeTaskDef);
            els.missionHud.innerHTML = `
                <article class="idle-mission-card${done ? " idle-task-card--done" : ""}">
                    <p class="idle-mission-title">任務</p>
                    <p class="idle-mission-task">${activeTaskDef.name}</p>
                    <div class="idle-mission-row">
                        <span class="idle-mission-progress">${getTaskProgressText(activeTaskEntry, activeTaskDef)}</span>
                        <button type="button" class="btn btn-primary idle-mission-claim" data-task-claim="${activeTaskDef.id}" ${done ? "" : "disabled"}>領取</button>
                    </div>
                </article>
            `;
        }

        els.missionHud.querySelectorAll("[data-task-claim]").forEach((button) => {
            button.addEventListener("click", () => claimTask(button.dataset.taskClaim));
        });

        const skillButtons = ACTIVE_SKILLS.map((skill) => {
            const unlocked = isSkillUnlocked(skill);
            const remainingMs = getSkillCooldownRemainingMs(skill.id);
            const inCooldown = unlocked && remainingMs > 0;
            const cdText = inCooldown ? `${Math.ceil(remainingMs / 1000)}s` : "";
            const lockTitle = unlocked ? "" : `（需升級：${getUpgradeDef(skill.requiredUpgradeId)?.name || skill.requiredUpgradeId}）`;
            return `
                <button
                    type="button"
                    class="idle-skill-icon-btn"
                    data-skill-use="${skill.id}"
                    data-cd="${cdText}"
                    title="${skill.name}｜${skill.description}${lockTitle}"
                    aria-label="${skill.name}${lockTitle}"
                    ${!unlocked || inCooldown ? "disabled" : ""}
                >${unlocked ? getSkillIcon(skill.id) : "🔒"}</button>
            `;
        }).join("");

        const shockwaveButton = `
            <button
                type="button"
                class="idle-skill-icon-btn idle-skill-icon-btn--status${shockwaveHud.enabled ? "" : " idle-skill-icon-btn--locked"}"
                data-cd="${shockwaveHud.cdText}"
                title="${shockwaveHud.title}"
                aria-label="${shockwaveHud.title}"
                tabindex="-1"
            >${shockwaveHud.enabled ? "💥" : "🌊"}</button>
        `;

        els.skillHud.innerHTML = `${skillButtons}${shockwaveButton}`;

        els.skillHud.querySelectorAll("[data-skill-use]").forEach((button) => {
            button.addEventListener("click", () => useActiveSkill(button.dataset.skillUse));
        });

        const latestEvent = recentSystemEvents[0];
        if (!latestEvent) {
            els.eventHud.innerHTML = `
                <article class="idle-event-card-compact">
                    <p class="idle-event-title-compact">隨機事件</p>
                    <p class="idle-event-text-compact">等待觸發中…</p>
                </article>
            `;
        } else {
            const ageSec = Math.max(0, Math.floor((nowMs() - latestEvent.at) / 1000));
            els.eventHud.innerHTML = `
                <article class="idle-event-card-compact${latestEvent.isActive ? " idle-event-card--active" : ""}">
                    <p class="idle-event-title-compact">隨機事件 · ${ageSec}s</p>
                    <p class="idle-event-text-compact">${latestEvent.text}</p>
                </article>
            `;
        }
    }

    ensureTaskBoard();

    function getBuildingDef(id) {
        return BUILDINGS.find((b) => b.id === id);
    }

    function getUpgradeDef(id) {
        return UPGRADES.find((u) => u.id === id);
    }

    function hasUpgrade(id) {
        if (id === "click_hold" && state.shards > 0) {
            return true;
        }
        if (id === "artifact_rarity_infinite") {
            return (state.artifactRarityLevel || 0) > 0;
        }
        if (id === "artifact_drop_infinite") {
            return (state.artifactDropLevel || 0) > 0;
        }
        return state.upgrades.includes(id);
    }

    function isRepeatableUpgrade(upgrade) {
        return Boolean(upgrade?.effect?.repeatable);
    }

    function getArtifactRarityUpgradeCost() {
        const level = state.artifactRarityLevel || 0;
        return getArtifactRarityUpgradeCostAtLevel(level);
    }

    function getArtifactRarityUpgradeCostAtLevel(level) {
        const baseCost = 90000n;
        let cost = baseCost;
        for (let i = 0; i < level; i++) {
            cost = (cost * 16n + 9n) / 10n;
        }
        return cost;
    }

    function getUpgradeCost(upgrade) {
        if (upgrade.id === "artifact_rarity_infinite") {
            return getArtifactRarityUpgradeCost();
        }
        if (upgrade.id === "artifact_drop_infinite") {
            return getArtifactDropUpgradeCost();
        }
        return upgrade.cost;
    }

    function getRepeatableRarityUpgradeMeta(upgrade) {
        if (upgrade.id !== "artifact_rarity_infinite") {
            return null;
        }
        const level = state.artifactRarityLevel || 0;
        const nextCap = ARTIFACT_SYSTEM.baseRarityCap + (level + 1) * 10;
        return { level, nextCap };
    }

    function getRepeatableDropUpgradeMeta(upgrade) {
        if (upgrade.id !== "artifact_drop_infinite") {
            return null;
        }
        const level = state.artifactDropLevel || 0;
        const nextRatePct = Math.round((getArtifactDropChancePerSec() + getArtifactDropUpgradePerLevel()) * 1000) / 10;
        return { level, nextRatePct };
    }

    function getArtifactDropUpgradePerLevel() {
        const def = getUpgradeDef("artifact_drop_infinite");
        return def?.effect?.artifactDropRateAdd || 0.05;
    }

    function getArtifactDropUpgradeCost() {
        return getArtifactDropUpgradeCostAtLevel(state.artifactDropLevel || 0);
    }

    function getArtifactDropUpgradeCostAtLevel(level) {
        const baseCost = 8000000n;
        let cost = baseCost;
        for (let i = 0; i < level; i++) {
            cost = (cost * 160n + 99n) / 100n;
        }
        return cost;
    }

    function getRepeatableUpgradePurchasePlan(upgrade, budget = state.crystals) {
        if (!isRepeatableUpgrade(upgrade)) {
            return { count: 0, totalCost: 0n };
        }

        if (upgrade.id !== "artifact_rarity_infinite" && upgrade.id !== "artifact_drop_infinite") {
            const cost = getUpgradeCost(upgrade);
            return canAfford(budget, cost) ? { count: 1, totalCost: cost } : { count: 0, totalCost: 0n };
        }

        const targetCount = buyMode === "max" ? Number.MAX_SAFE_INTEGER : buyMode;
        const hardLimit = buyMode === "max" ? 100000 : targetCount;
        let count = 0;
        let level = upgrade.id === "artifact_rarity_infinite" ? state.artifactRarityLevel || 0 : state.artifactDropLevel || 0;
        let totalCost = 0n;
        let remaining = budget;

        while (count < targetCount && count < hardLimit) {
            const cost =
                upgrade.id === "artifact_rarity_infinite"
                    ? getArtifactRarityUpgradeCostAtLevel(level)
                    : getArtifactDropUpgradeCostAtLevel(level);
            if (!canAfford(remaining, cost)) {
                break;
            }
            remaining -= cost;
            totalCost += cost;
            level += 1;
            count += 1;
        }

        return { count, totalCost };
    }

    function hasHoldClick() {
        return hasUpgrade("click_hold") || state.shards > 0;
    }

    function getPrestigeMultiplier() {
        return 1 + state.shards * PRESTIGE.bonusPerShard;
    }

    function getArtifactScaledUnits(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }
        // Nonlinear growth: high rarity gives disproportionately larger impact.
        return Math.pow(rarity, 1.55) / 6;
    }

    function getArtifactEffectValueByRarity(rarity, perRarity) {
        if (!perRarity || rarity <= 0) {
            return 0;
        }
        return getArtifactScaledUnits(rarity) * perRarity;
    }

    function getArtifactScaledBonus(effectKey) {
        return ARTIFACTS.reduce((sum, artifact) => {
            const perRarity = artifact.effect?.[effectKey];
            if (!perRarity) {
                return sum;
            }
            return sum + getArtifactEffectValueByRarity(getArtifactRarity(artifact.id), perRarity);
        }, 0);
    }

    function getGlobalMultiplier() {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id)) {
                return;
            }
            if (upgrade.effect.globalMult) {
                mult *= upgrade.effect.globalMult;
            }
        });

        const artifactGlobalBonus = getArtifactScaledBonus("globalMultPerRarity");
        if (artifactGlobalBonus > 0) {
            mult *= 1 + artifactGlobalBonus;
        }

        return mult * getPrestigeMultiplier() * getSkillGlobalMultiplier();
    }

    function getBuildingMultiplier(buildingId) {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id)) {
                return;
            }
            if (upgrade.effect.buildingMult && upgrade.buildingId === buildingId) {
                mult *= upgrade.effect.buildingMult || 1;
            }
        });
        return mult;
    }

    function getClickMultiplier() {
        let add = BASE_CLICK;
        let mult = 1;

        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id)) {
                return;
            }
            if (upgrade.effect.clickAdd) {
                add += upgrade.effect.clickAdd;
            }
            if (upgrade.effect.clickMult) {
                mult *= upgrade.effect.clickMult;
            }
        });

        add += getArtifactScaledBonus("clickAddPerRarity");

        return Math.max(1, Math.floor(add * mult * getSkillClickMultiplier() * getGlobalMultiplier()));
    }

    function getBuildingArtifactMultiplier() {
        const bonus = getArtifactScaledBonus("buildingMultPerRarity");
        return bonus > 0 ? 1 + bonus : 1;
    }

    function getAutoClickRate() {
        let rate = 0;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id)) {
                return;
            }
            if (upgrade.effect.autoClickRate) {
                rate += upgrade.effect.autoClickRate;
            }
        });
        return rate;
    }

    function getAutoClickCps() {
        const rate = getAutoClickRate();
        if (rate <= 0) {
            return 0;
        }
        return getClickMultiplier() * rate;
    }

    function getBuildingCps(building) {
        const owned = state.buildings[building.id] || 0;
        if (owned <= 0) {
            return 0;
        }
        return building.baseCps * owned * getBuildingMultiplier(building.id) * getGlobalMultiplier() * getBuildingArtifactMultiplier();
    }

    function getTotalCps() {
        const buildingCps = BUILDINGS.reduce((sum, building) => sum + getBuildingCps(building), 0);
        return buildingCps + getAutoClickCps();
    }

    function addCrystals(amount) {
        const gain = toBigInt(amount);
        if (gain <= 0n) {
            return;
        }
        state.crystals += gain;
        state.lifetimeEarned += gain;
        trackTaskProgress("earn", Number(gain > 9007199254740991n ? 9007199254740991n : gain));
    }

    function spendCrystals(cost) {
        if (!canAfford(state.crystals, cost)) {
            return false;
        }
        state.crystals -= cost;
        return true;
    }

    function isUpgradeUnlocked(upgrade) {
        if (hasUpgrade(upgrade.id) && !isRepeatableUpgrade(upgrade)) {
            return false;
        }

        if (upgrade.id === "click_hold" && state.shards > 0) {
            return false;
        }

        if (upgrade.unlock.lifetime !== undefined && state.lifetimeEarned < upgrade.unlock.lifetime) {
            return false;
        }

        if (upgrade.unlock.shards !== undefined && state.shards < upgrade.unlock.shards) {
            return false;
        }

        if (upgrade.unlock.building) {
            for (const [buildingId, required] of Object.entries(upgrade.unlock.building)) {
                if ((state.buildings[buildingId] || 0) < required) {
                    return false;
                }
            }
        }

        if (upgrade.unlock.requires) {
            for (const requiredId of upgrade.unlock.requires) {
                if (!hasUpgrade(requiredId)) {
                    return false;
                }
            }
        }

        return true;
    }

    function getBuyQuantity(building) {
        const owned = state.buildings[building.id] || 0;
        if (buyMode === "max") {
            return maxAffordableQuantity(state.crystals, building.baseCost, owned);
        }
        return buyMode;
    }

    function buyBuilding(buildingId) {
        const building = getBuildingDef(buildingId);
        if (!building) {
            return;
        }

        const owned = state.buildings[building.id] || 0;
        const quantity = getBuyQuantity(building);
        if (quantity <= 0) {
            return;
        }

        const cost = buildingCost(building.baseCost, owned, quantity);
        if (!spendCrystals(cost)) {
            return;
        }

        state.buildings[building.id] = owned + quantity;
        trackTaskProgress("building", quantity);
        save(state);
        refreshShop();
    }

    function buyUpgrade(upgradeId) {
        const upgrade = getUpgradeDef(upgradeId);
        if (!upgrade || (hasUpgrade(upgrade.id) && !isRepeatableUpgrade(upgrade)) || !isUpgradeUnlocked(upgrade)) {
            return;
        }

        if (upgrade.id === "artifact_rarity_infinite" || upgrade.id === "artifact_drop_infinite") {
            const plan = getRepeatableUpgradePurchasePlan(upgrade);
            if (plan.count <= 0 || !spendCrystals(plan.totalCost)) {
                return;
            }
            if (upgrade.id === "artifact_rarity_infinite") {
                state.artifactRarityLevel = (state.artifactRarityLevel || 0) + plan.count;
            } else {
                state.artifactDropLevel = (state.artifactDropLevel || 0) + plan.count;
            }
            trackTaskProgress("upgrade", plan.count);
        } else {
            const cost = getUpgradeCost(upgrade);
            if (!spendCrystals(cost)) {
                return;
            }
            state.upgrades.push(upgrade.id);
            trackTaskProgress("upgrade", 1);
        }
        save(state);
        renderUpgrades();
        renderStats();
        updateClickVisualState();
        renderPrestige();
        updateBuildingRowsIfPresent();
    }

    function getVisibleUpgrades() {
        return UPGRADES.filter((upgrade) => {
            if (isRepeatableUpgrade(upgrade)) {
                return isUpgradeUnlocked(upgrade);
            }
            return !hasUpgrade(upgrade.id) && isUpgradeUnlocked(upgrade);
        });
    }

    function getSortedVisibleUpgrades() {
        return getVisibleUpgrades().sort((a, b) => {
            const costA = getUpgradeCost(a);
            const costB = getUpgradeCost(b);
            if (costA < costB) return -1;
            if (costA > costB) return 1;
            return a.id.localeCompare(b.id);
        });
    }

    function getVisibleUpgradeIds() {
        return getSortedVisibleUpgrades()
            .map((upgrade) => upgrade.id)
            .join("|");
    }

    function getRenderedUpgradeIds() {
        return [...els.upgradeList.querySelectorAll("[data-upgrade-id]")]
            .map((row) => row.dataset.upgradeId)
            .join("|");
    }

    function updateBuildingRowsIfPresent() {
        const buildingRows = els.buildingList.querySelectorAll("[data-building-id]");
        if (buildingRows.length === BUILDINGS.length) {
            updateBuildingRows();
        }
    }

    function calculateShardGain() {
        const baseGain = calculateBaseShardGain();
        const artifactBonusRate = getArtifactShardBonusRate();
        const artifactBonusGain = Math.floor(baseGain * artifactBonusRate);
        return {
            baseGain,
            artifactBonusRate,
            artifactBonusGain,
            totalGain: baseGain + artifactBonusGain
        };
    }

    function calculateBaseShardGain() {
        if (state.lifetimeEarned < PRESTIGE.unlockLifetime) {
            return 0;
        }
        return Number(sqrtBigInt(state.lifetimeEarned / PRESTIGE.divisor));
    }

    function canPrestige() {
        return calculateShardGain().totalGain > 0;
    }

    function performPrestige() {
        const shardGain = calculateShardGain();
        if (shardGain.totalGain <= 0) {
            return;
        }
        const prestigeStartCrystals = getArtifactPrestigeStartCrystals();

        state.shards += shardGain.totalGain;
        state.crystals = 0n;
        state.lifetimeEarned = 0n;
        state.manualShockwaveChanceBonus = 0;
        lastManualShockwaveChargeAt = 0;
        state.upgrades = [];
        productionAccumulator = 0;
        autoClickAccumulator = 0;
        artifactRollAccumulator = 0;
        autoBuildAccumulator = 0;
        autoUpgradeAccumulator = 0;
        pendingAutoVisualGain = 0;
        if (autoVisualTimer) {
            window.clearTimeout(autoVisualTimer);
            autoVisualTimer = null;
        }
        stopHoldClick();

        BUILDINGS.forEach((building) => {
            state.buildings[building.id] = 0;
        });

        state.crystals = prestigeStartCrystals;

        save(state);
        if (shardGain.artifactBonusGain > 0) {
            spawnBurst(`+${formatShort(BigInt(shardGain.totalGain))} 碎片（神器 +${formatShort(BigInt(shardGain.artifactBonusGain))}）`);
        } else {
            spawnBurst(`+${formatShort(BigInt(shardGain.totalGain))} 碎片`);
        }
        window.IdleStars.reset();
        renderAll();
    }

    function isArtifactSystemUnlocked() {
        return state.shards >= ARTIFACT_SYSTEM.unlockShards;
    }

    function getArtifactDropChancePerSec() {
        let chance = ARTIFACT_SYSTEM.baseDropChancePerSec;
        chance += (state.artifactDropLevel || 0) * getArtifactDropUpgradePerLevel();
        chance += getArtifactScaledBonus("artifactDropPerRarity");
        let additiveRateBonus = 0;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || !upgrade.effect.artifactDropMult) {
                return;
            }
            additiveRateBonus += upgrade.effect.artifactDropMult - 1;
        });
        if (additiveRateBonus > 0) {
            chance *= 1 + additiveRateBonus;
        }
        return chance;
    }

    function getArtifactRarityCap() {
        let cap = ARTIFACT_SYSTEM.baseRarityCap;
        cap += (state.artifactRarityLevel || 0) * 10;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id)) {
                return;
            }
            if (upgrade.effect.artifactRarityCapAdd) {
                cap += upgrade.effect.artifactRarityCapAdd;
            } else if (upgrade.effect.artifactRarityCap) {
                cap = Math.max(cap, upgrade.effect.artifactRarityCap);
            }
        });
        return cap;
    }

    function rollArtifactRarity() {
        const cap = getArtifactRarityCap();
        const u = Math.random();
        const weighted = Math.pow(u, 4.2);
        let rarity = 1 + Math.floor(weighted * cap);

        // Keep near-cap tiers very rare even as cap grows.
        if (rarity > cap - 3 && Math.random() < 0.92) {
            rarity = Math.max(1, rarity - 4);
        } else if (rarity > cap - 8 && Math.random() < 0.78) {
            rarity = Math.max(1, rarity - 3);
        } else if (rarity > cap - 16 && Math.random() < 0.62) {
            rarity = Math.max(1, rarity - 2);
        }

        return Math.min(cap, rarity);
    }

    function getArtifactRarity(artifactId) {
        const bucket = state.artifacts[artifactId];
        return bucket && Number.isFinite(bucket.rarity) ? Math.max(0, bucket.rarity) : 0;
    }

    function getArtifactAutoDiscountPercent(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }
        // Saturating curve: low rarity gives small discounts; 99% is only reached at extremely high rarity.
        const scaled = 99 * (1 - Math.exp(-rarity / 180));
        return Math.min(99, Math.max(0, Math.floor(scaled)));
    }

    function getArtifactShockwaveChancePerCheck() {
        const base = getArtifactShockwaveChancePerCheckByRarity(getArtifactRarity("shockwave_emitter"));
        return Math.min(1, base + getManualShockwaveBonusChance());
    }

    function getManualShockwaveUpgradeConfig() {
        return UPGRADES.reduce(
            (acc, upgrade) => {
                if (!hasUpgrade(upgrade.id)) {
                    return acc;
                }
                const effect = upgrade.effect || {};
                if (effect.manualShockwaveChancePerClick) {
                    acc.perClick += effect.manualShockwaveChancePerClick;
                }
                if (effect.manualShockwaveChanceCap) {
                    acc.cap = Math.max(acc.cap, effect.manualShockwaveChanceCap);
                }
                return acc;
            },
            { perClick: 0, cap: 0 }
        );
    }

    function getManualShockwaveBonusChance() {
        const config = getManualShockwaveUpgradeConfig();
        if (config.cap <= 0) {
            return 0;
        }
        return Math.max(0, Math.min(config.cap, state.manualShockwaveChanceBonus || 0));
    }

    function applyManualShockwaveCharge() {
        const config = getManualShockwaveUpgradeConfig();
        if (config.perClick <= 0 || config.cap <= 0) {
            return;
        }
        const now = nowMs();
        const sinceLast = lastManualShockwaveChargeAt > 0 ? now - lastManualShockwaveChargeAt : 0;
        const isComboActive = lastManualShockwaveChargeAt > 0 && sinceLast <= MANUAL_SHOCKWAVE_FAST_WINDOW_MS;
        const current = isComboActive ? Math.max(0, state.manualShockwaveChanceBonus || 0) : 0;
        state.manualShockwaveChanceBonus = Math.min(config.cap, current + config.perClick);
        lastManualShockwaveChargeAt = now;
    }

    function decayManualShockwaveCharge(deltaMs) {
        const config = getManualShockwaveUpgradeConfig();
        if (config.cap <= 0) {
            state.manualShockwaveChanceBonus = 0;
            lastManualShockwaveChargeAt = 0;
            return;
        }

        const current = Math.max(0, state.manualShockwaveChanceBonus || 0);
        if (current <= 0) {
            state.manualShockwaveChanceBonus = 0;
            return;
        }

        const now = nowMs();
        if (lastManualShockwaveChargeAt > 0 && now - lastManualShockwaveChargeAt <= MANUAL_SHOCKWAVE_FAST_WINDOW_MS) {
            return;
        }

        const decay = MANUAL_SHOCKWAVE_DECAY_PER_SEC * (Math.max(0, deltaMs) / 1000);
        state.manualShockwaveChanceBonus = Math.max(0, current - decay);
        if (state.manualShockwaveChanceBonus <= 0) {
            lastManualShockwaveChargeAt = 0;
        }
    }

    function getArtifactShockwaveChancePerCheckByRarity(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }
        // 10-second check window: keep very low at normal rarity, approaching 100% only at extreme rarity.
        return Math.min(1, 1 - Math.exp(-rarity / 1800));
    }

    function getDiscountedAutoBuyCost(cost, rarity) {
        const discountPercent = getArtifactAutoDiscountPercent(rarity);
        const multiplier = BigInt(100 - discountPercent);
        const discountedCost = (cost * multiplier + 99n) / 100n;
        return discountedCost > 0n ? discountedCost : 1n;
    }

    function getAutoBuildArtifactRarity() {
        return getArtifactRarity(AUTO_BUILD_ARTIFACT_ID);
    }

    function getAutoUpgradeArtifactRarity() {
        return getArtifactRarity(AUTO_UPGRADE_ARTIFACT_ID);
    }

    function canUseAutoBuild() {
        return getAutoBuildArtifactRarity() > 0;
    }

    function canUseAutoUpgrade() {
        return getAutoUpgradeArtifactRarity() > 0;
    }

    function toggleAutoBuild() {
        if (!canUseAutoBuild()) {
            return;
        }
        state.artifactAutoBuildEnabled = !state.artifactAutoBuildEnabled;
        if (state.artifactAutoBuildEnabled) {
            const bought = tryAutoBuyBuilding();
            if (bought) {
                refreshShop();
            }
            autoBuildAccumulator = 0;
        }
        save(state);
        renderArtifacts();
    }

    function toggleAutoUpgrade() {
        if (!canUseAutoUpgrade()) {
            return;
        }
        state.artifactAutoUpgradeEnabled = !state.artifactAutoUpgradeEnabled;
        if (state.artifactAutoUpgradeEnabled) {
            const bought = tryAutoBuyCheapestUpgrade();
            if (bought) {
                refreshShop();
            }
            autoUpgradeAccumulator = 0;
        }
        save(state);
        renderArtifacts();
    }

    function setAutoBuildIntervalMs(nextIntervalMs) {
        if (!canUseAutoBuild()) {
            return;
        }
        if (!AUTO_BUY_OPTIONS_MS.includes(nextIntervalMs)) {
            return;
        }
        state.artifactAutoBuildIntervalMs = nextIntervalMs;
        autoBuildAccumulator = 0;
        save(state);
        renderArtifacts();
    }

    function setAutoUpgradeIntervalMs(nextIntervalMs) {
        if (!canUseAutoUpgrade()) {
            return;
        }
        if (!AUTO_BUY_OPTIONS_MS.includes(nextIntervalMs)) {
            return;
        }
        state.artifactAutoUpgradeIntervalMs = nextIntervalMs;
        autoUpgradeAccumulator = 0;
        save(state);
        renderArtifacts();
    }

    function tryAutoBuyBuilding() {
        const rarity = getAutoBuildArtifactRarity();
        if (!state.artifactAutoBuildEnabled || rarity <= 0) {
            return false;
        }

        const candidates = BUILDINGS.map((building) => {
            const owned = state.buildings[building.id] || 0;
            const baseCost = buildingCost(building.baseCost, owned, 1);
            const discountedCost = getDiscountedAutoBuyCost(baseCost, rarity);
            const cpsValue = building.baseCps * getBuildingMultiplier(building.id) * getGlobalMultiplier() * getBuildingArtifactMultiplier();
            return {
                building,
                discountedCost,
                owned,
                score: cpsValue / Math.max(1, Number(discountedCost))
            };
        }).sort((a, b) => {
            if (a.score > b.score) return -1;
            if (a.score < b.score) return 1;
            if (a.discountedCost < b.discountedCost) return -1;
            if (a.discountedCost > b.discountedCost) return 1;
            return a.building.id.localeCompare(b.building.id);
        });

        for (const candidate of candidates) {
            if (!canAfford(state.crystals, candidate.discountedCost)) {
                continue;
            }
            state.crystals -= candidate.discountedCost;
            state.buildings[candidate.building.id] = candidate.owned + 1;
            return true;
        }

        return false;
    }

    function tryAutoBuyCheapestUpgrade() {
        const rarity = getAutoUpgradeArtifactRarity();
        if (!state.artifactAutoUpgradeEnabled || rarity <= 0) {
            return false;
        }

        const candidates = getSortedVisibleUpgrades()
            .map((upgrade) => {
                let baseCost;
                if (upgrade.id === "artifact_rarity_infinite") {
                    baseCost = getArtifactRarityUpgradeCost();
                } else if (upgrade.id === "artifact_drop_infinite") {
                    baseCost = getArtifactDropUpgradeCost();
                } else {
                    baseCost = getUpgradeCost(upgrade);
                }

                return {
                    upgrade,
                    discountedCost: getDiscountedAutoBuyCost(baseCost, rarity)
                };
            })
            .sort((a, b) => {
                if (a.discountedCost < b.discountedCost) return -1;
                if (a.discountedCost > b.discountedCost) return 1;
                return a.upgrade.id.localeCompare(b.upgrade.id);
            });

        for (const candidate of candidates) {
            if (!canAfford(state.crystals, candidate.discountedCost)) {
                continue;
            }

            state.crystals -= candidate.discountedCost;
            if (candidate.upgrade.id === "artifact_rarity_infinite") {
                state.artifactRarityLevel = (state.artifactRarityLevel || 0) + 1;
            } else if (candidate.upgrade.id === "artifact_drop_infinite") {
                state.artifactDropLevel = (state.artifactDropLevel || 0) + 1;
            } else {
                state.upgrades.push(candidate.upgrade.id);
            }
            trackTaskProgress("upgrade", 1);
            return true;
        }

        return false;
    }

    function showArtifactToast(message) {
        const toast = els.artifactToast;
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.hidden = false;
        toast.classList.remove("idle-artifact-toast--visible");
        void toast.offsetWidth;
        toast.classList.add("idle-artifact-toast--visible");

        window.clearTimeout(showArtifactToast.hideTimer);
        showArtifactToast.hideTimer = window.setTimeout(() => {
            toast.classList.remove("idle-artifact-toast--visible");
            window.setTimeout(() => {
                toast.hidden = true;
            }, 260);
        }, 2200);
    }

    function getArtifactUpgradeDetailText(artifact, previousRarity, newRarity) {
        const effect = artifact.effect || {};
        const oldR = Math.max(0, previousRarity || 0);
        const newR = Math.max(0, newRarity || 0);

        function formatPct(value) {
            return Math.round(value * 1000) / 10;
        }

        if (effect.shardGainPerRarity) {
            const oldV = getArtifactEffectValueByRarity(oldR, effect.shardGainPerRarity);
            const newV = getArtifactEffectValueByRarity(newR, effect.shardGainPerRarity);
            return `轉生碎片 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.prestigeStartCrystalsPerRarity) {
            const oldV = Math.max(0, Math.floor(getArtifactEffectValueByRarity(oldR, effect.prestigeStartCrystalsPerRarity)));
            const newV = Math.max(0, Math.floor(getArtifactEffectValueByRarity(newR, effect.prestigeStartCrystalsPerRarity)));
            return `轉生起始星晶 +${formatShort(BigInt(Math.max(0, newV - oldV)))}（總 ${formatShort(BigInt(newV))}）`;
        }
        if (effect.globalMultPerRarity) {
            const oldV = getArtifactEffectValueByRarity(oldR, effect.globalMultPerRarity);
            const newV = getArtifactEffectValueByRarity(newR, effect.globalMultPerRarity);
            return `全域產出 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.clickAddPerRarity) {
            const oldV = getArtifactEffectValueByRarity(oldR, effect.clickAddPerRarity);
            const newV = getArtifactEffectValueByRarity(newR, effect.clickAddPerRarity);
            return `點擊基礎 +${Math.round((newV - oldV) * 10) / 10}（總 +${Math.round(newV * 10) / 10}）`;
        }
        if (effect.starSpawnPerRarity || effect.starRewardPerRarity) {
            const oldSpawn = getArtifactEffectValueByRarity(oldR, effect.starSpawnPerRarity || 0);
            const newSpawn = getArtifactEffectValueByRarity(newR, effect.starSpawnPerRarity || 0);
            const oldReward = getArtifactEffectValueByRarity(oldR, effect.starRewardPerRarity || 0);
            const newReward = getArtifactEffectValueByRarity(newR, effect.starRewardPerRarity || 0);
            return `流星機率 +${formatPct(newSpawn - oldSpawn)}%（總 ${formatPct(newSpawn)}%） · 流星獎勵 +${formatPct(newReward - oldReward)}%（總 ${formatPct(newReward)}%）`;
        }
        if (effect.buildingMultPerRarity) {
            const oldV = getArtifactEffectValueByRarity(oldR, effect.buildingMultPerRarity);
            const newV = getArtifactEffectValueByRarity(newR, effect.buildingMultPerRarity);
            return `建築產出 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.artifactDropPerRarity) {
            const oldV = getArtifactEffectValueByRarity(oldR, effect.artifactDropPerRarity);
            const newV = getArtifactEffectValueByRarity(newR, effect.artifactDropPerRarity);
            return `神器掉落率每秒 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.autoBuildEnabled || effect.autoUpgradeEnabled) {
            const oldD = getArtifactAutoDiscountPercent(oldR);
            const newD = getArtifactAutoDiscountPercent(newR);
            return `自動購買折扣 +${Math.max(0, newD - oldD)}%（總 ${newD}%）`;
        }
        if (effect.starShockwavePerRarity) {
            const oldV = getArtifactShockwaveChancePerCheckByRarity(oldR);
            const newV = getArtifactShockwaveChancePerCheckByRarity(newR);
            return `每 10 秒震波機率 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.starGoldDropChancePerRarity) {
            const oldV = getArtifactStarGoldDropChanceByRarity(oldR);
            const newV = getArtifactStarGoldDropChanceByRarity(newR);
            return `流星額外掉落機率 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%）`;
        }
        if (effect.starMinGapReducePerRarity || effect.starMaxActivePerRarity) {
            const oldGapReduce = Math.max(0, getArtifactEffectValueByRarity(oldR, effect.starMinGapReducePerRarity || 0));
            const newGapReduce = Math.max(0, getArtifactEffectValueByRarity(newR, effect.starMinGapReducePerRarity || 0));
            const oldGapPct = Math.min(80, Math.round(oldGapReduce * 1000) / 10);
            const newGapPct = Math.min(80, Math.round(newGapReduce * 1000) / 10);

            const oldMax = getArtifactStarMaxActiveAddByRarity(oldR, effect.starMaxActivePerRarity || 0);
            const newMax = getArtifactStarMaxActiveAddByRarity(newR, effect.starMaxActivePerRarity || 0);

            return `流星間隔再降 ${Math.max(0, newGapPct - oldGapPct)}%（總 -${newGapPct}%） · 同時上限 +${Math.max(
                0,
                newMax - oldMax
            )}（總 +${newMax}）`;
        }
        if (effect.starMultiSpawnPerRarity) {
            const oldV = getArtifactStarMultiSpawnChainChanceByRarity(oldR);
            const newV = getArtifactStarMultiSpawnChainChanceByRarity(newR);
            const oldMax = getArtifactStarMultiSpawnMaxExtraByRarity(oldR);
            const newMax = getArtifactStarMultiSpawnMaxExtraByRarity(newR);
            const maxDelta = Math.max(0, newMax - oldMax);
            return `連鎖機率 +${formatPct(newV - oldV)}%（總 ${formatPct(newV)}%，上限 90%） · 額外上限 +${maxDelta}（總 +${newMax}，每 100 稀有度 +1）`;
        }

        return "";
    }

    function collectArtifact() {
        const artifact = ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)];
        const rarity = rollArtifactRarity();
        const bucket = state.artifacts[artifact.id];
        const previousRarity = bucket.rarity;

        if (rarity <= previousRarity) {
            return;
        }

        bucket.rarity = rarity;
        if (previousRarity > 0) {
            bucket.replacements += 1;
            const detail = getArtifactUpgradeDetailText(artifact, previousRarity, rarity);
            spawnBurst(`神器升級：${artifact.name} R${previousRarity}→R${rarity}`);
            showArtifactToast(
                detail
                    ? `神器升級：${artifact.name} R${previousRarity}→R${rarity}（${detail}）`
                    : `神器升級：${artifact.name} R${previousRarity}→R${rarity}`
            );
            return;
        }

        const detail = getArtifactUpgradeDetailText(artifact, 0, rarity);
        spawnBurst(`神器獲得：${artifact.name} R${rarity}`);
        showArtifactToast(detail ? `獲得神器：${artifact.name}（R${rarity}，${detail}）` : `獲得神器：${artifact.name}（稀有度 R${rarity}）`);
    }

    function getArtifactTotals() {
        return ARTIFACTS.reduce(
            (acc, artifact) => {
                const bucket = state.artifacts[artifact.id];
                if (bucket.rarity > 0) {
                    acc.equipped += 1;
                }
                acc.totalRarity += bucket.rarity;
                acc.bestRarity = Math.max(acc.bestRarity, bucket.rarity);
                acc.replacements += bucket.replacements;
                return acc;
            },
            { equipped: 0, totalRarity: 0, bestRarity: 0, replacements: 0 }
        );
    }

    function getArtifactShardBonusRate() {
        return ARTIFACTS.reduce((rate, artifact) => {
            if (!artifact.effect.shardGainPerRarity) {
                return rate;
            }
            return rate + getArtifactEffectValueByRarity(getArtifactRarity(artifact.id), artifact.effect.shardGainPerRarity);
        }, 0);
    }

    function getArtifactPrestigeStartCrystals() {
        const bonus = getArtifactScaledBonus("prestigeStartCrystalsPerRarity");
        if (!Number.isFinite(bonus) || bonus <= 0) {
            return 0n;
        }
        return BigInt(Math.max(0, Math.floor(bonus)));
    }

    function getArtifactStarBonuses() {
        const meteorSplitterRarity = getArtifactRarity("meteor_splitter");
        const multiSpawnChainChance = getArtifactStarMultiSpawnChainChance();
        const multiSpawnMaxExtra = getArtifactStarMultiSpawnMaxExtraByRarity(meteorSplitterRarity);
        const minGapMult = getArtifactStarMinGapMultiplier();
        const maxActiveAdd = getArtifactStarMaxActiveAdd();
        return {
            spawnMult: 1 + getArtifactScaledBonus("starSpawnPerRarity"),
            rewardMult: 1 + getArtifactScaledBonus("starRewardPerRarity"),
            extraSpawnMult: getSkillStarSpawnMultiplier(),
            minGapMult,
            maxActiveAdd,
            multiSpawnChainChance,
            multiSpawnMaxExtra,
            shockwaveChancePerCheck: getArtifactShockwaveChancePerCheck(),
            goldDropChance: getArtifactStarGoldDropChance()
        };
    }

    function getArtifactStarMultiSpawnChainChance() {
        return getArtifactStarMultiSpawnChainChanceByRarity(getArtifactRarity("meteor_splitter"));
    }

    function getArtifactStarMultiSpawnChainChanceByRarity(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }
        // Approaches 90% only at very high rarity; each extra spawn uses the same chance.
        return Math.min(0.9, 0.9 * (1 - Math.exp(-rarity / 220)));
    }

    function getArtifactStarMultiSpawnMaxExtraByRarity(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }
        return Math.max(0, Math.floor(rarity / 100));
    }

    function getArtifactStarMinGapMultiplier() {
        const reduce = Math.max(0, getArtifactScaledBonus("starMinGapReducePerRarity"));
        return Math.max(0.2, 1 - reduce);
    }

    function getArtifactStarMaxActiveAdd() {
        return ARTIFACTS.reduce((sum, artifact) => {
            const perRarity = artifact.effect?.starMaxActivePerRarity;
            if (!perRarity) {
                return sum;
            }
            return sum + getArtifactStarMaxActiveAddByRarity(getArtifactRarity(artifact.id), perRarity);
        }, 0);
    }

    function getArtifactStarMaxActiveAddByRarity(rarity, perRarity) {
        if (!Number.isFinite(rarity) || rarity <= 0 || !Number.isFinite(perRarity) || perRarity <= 0) {
            return 0;
        }
        // Linear scaling for this effect: with perRarity=0.01, every 100 rarity grants +1 max active star.
        return Math.max(0, Math.floor(rarity * perRarity));
    }

    function getArtifactStarGoldDropChance() {
        return getArtifactStarGoldDropChanceByRarity(getArtifactRarity("gilded_tail"));
    }

    function getArtifactStarGoldDropChanceByRarity(rarity) {
        if (!Number.isFinite(rarity) || rarity <= 0) {
            return 0;
        }

        // Keep chance moderate early, then guarantee at extreme rarity.
        if (rarity >= 1000) {
            return 1;
        }

        return Math.min(1, 1 - Math.exp(-rarity / 260));
    }

    function queueAutoVisual(gain) {
        pendingAutoVisualGain += gain;
        if (autoVisualTimer) {
            return;
        }
        autoVisualTimer = window.setTimeout(() => {
            autoVisualTimer = null;
            if (pendingAutoVisualGain <= 0) {
                return;
            }
            const batch = pendingAutoVisualGain;
            pendingAutoVisualGain = 0;
            playAutoClickVisual(batch);
            if (pendingAutoVisualGain > 0) {
                queueAutoVisual(0);
            }
        }, 400);
    }

    function playAutoClickVisual(gain) {
        const ticks = els.clickScene.querySelectorAll(".idle-auto-tick");
        if (ticks.length >= 2) {
            ticks[0].remove();
        }

        const tick = document.createElement("span");
        tick.className = "idle-auto-tick";
        tick.textContent = `+${formatShort(BigInt(gain))}`;
        tick.setAttribute("aria-hidden", "true");
        els.clickScene.appendChild(tick);

        requestAnimationFrame(() => {
            tick.classList.add("idle-auto-tick--visible");
        });

        els.clickGlow.classList.remove("idle-click-glow--auto-pulse");
        void els.clickGlow.offsetWidth;
        els.clickGlow.classList.add("idle-click-glow--auto-pulse");

        window.setTimeout(() => {
            tick.classList.remove("idle-auto-tick--visible");
            window.setTimeout(() => tick.remove(), 280);
        }, 650);
    }

    function playManualClickVisual(gain, options = {}) {
        const now = Date.now();
        const throttleMs = options.fromHold ? 150 : 0;

        if (throttleMs === 0 || now - lastBurstAt >= throttleMs) {
            spawnBurst(`+${formatShort(BigInt(gain))}`);
            lastBurstAt = now;

            els.clickBtn.classList.add("idle-click-btn--pulse");
            window.clearTimeout(playManualClickVisual.pulseTimer);
            playManualClickVisual.pulseTimer = window.setTimeout(() => {
                els.clickBtn.classList.remove("idle-click-btn--pulse");
            }, 120);
        }
    }

    function spawnBurst(text, options = {}) {
        const existingBursts = els.clickWrap.querySelectorAll(".idle-click-burst");
        if (existingBursts.length >= 2) {
            existingBursts[0].remove();
        }

        const burst = document.createElement("span");
        burst.className = "idle-click-burst";
        if (options.star) {
            burst.classList.add("idle-click-burst--star");
        }
        burst.textContent = text;
        burst.setAttribute("aria-hidden", "true");

        const offsetX = Math.round((Math.random() - 0.5) * 56);
        burst.style.left = `calc(50% + ${offsetX}px)`;

        els.clickWrap.appendChild(burst);

        requestAnimationFrame(() => {
            burst.classList.add("idle-click-burst--visible");
        });

        window.setTimeout(() => {
            burst.classList.remove("idle-click-burst--visible");
            window.setTimeout(() => burst.remove(), 220);
        }, 700);
    }

    function onClick(options = {}) {
        const gain = getClickMultiplier();
        addCrystals(gain);
        trackTaskProgress("click", 1);
        applyManualShockwaveCharge();
        playManualClickVisual(gain, options);
        refreshShop();
    }

    function startHoldClick() {
        if (!hasHoldClick() || holdClickTimer) {
            return;
        }
        els.clickBtn.classList.add("idle-click-btn--holding");
        holdClickTimer = window.setInterval(() => onClick({ fromHold: true }), HOLD_CLICK_MS);
        updateClickVisualState();
    }

    function stopHoldClick() {
        if (holdClickTimer) {
            window.clearInterval(holdClickTimer);
            holdClickTimer = null;
        }
        els.clickBtn.classList.remove("idle-click-btn--holding");
        updateClickVisualState();
    }

    function onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }
        clickFromPointer = true;
        els.clickBtn.setPointerCapture(event.pointerId);
        onClick();
        startHoldClick();
    }

    function onPointerUp(event) {
        if (els.clickBtn.hasPointerCapture(event.pointerId)) {
            els.clickBtn.releasePointerCapture(event.pointerId);
        }
        stopHoldClick();
        window.setTimeout(() => {
            clickFromPointer = false;
        }, 0);
    }

    function onClickButton(event) {
        if (clickFromPointer) {
            return;
        }
        onClick();
        if (hasHoldClick()) {
            startHoldClick();
            const stopOnKeyUp = () => {
                stopHoldClick();
                window.removeEventListener("keyup", stopOnKeyUp);
            };
            window.addEventListener("keyup", stopOnKeyUp);
        }
    }

    function tick() {
        let gained = false;
        let autoBought = false;

        cleanupExpiredTemporaryEffects();
        tryTriggerRandomEvents(TICK_MS);
        decayManualShockwaveCharge(TICK_MS);

        const cps = BUILDINGS.reduce((sum, building) => sum + getBuildingCps(building), 0);
        if (cps > 0) {
            productionAccumulator += cps * (TICK_MS / 1000);
            const wholeGain = Math.floor(productionAccumulator);
            if (wholeGain > 0) {
                productionAccumulator -= wholeGain;
                addCrystals(wholeGain);
                gained = true;
            }
        }

        const autoRate = getAutoClickRate();
        if (autoRate > 0) {
            autoClickAccumulator += autoRate * (TICK_MS / 1000);
            const autoClicks = Math.floor(autoClickAccumulator);
            if (autoClicks > 0) {
                autoClickAccumulator -= autoClicks;
                const perClick = getClickMultiplier();
                const totalGain = perClick * autoClicks;
                addCrystals(totalGain);
                queueAutoVisual(totalGain);
                gained = true;
            }
        }

        if (isArtifactSystemUnlocked()) {
            artifactRollAccumulator += TICK_MS;
            while (artifactRollAccumulator >= ARTIFACT_CHECK_MS) {
                artifactRollAccumulator -= ARTIFACT_CHECK_MS;
                const dropRate = getArtifactDropChancePerSec();
                const guaranteed = Math.floor(dropRate);
                const extraChance = dropRate - guaranteed;
                let drops = guaranteed;
                if (Math.random() < extraChance) {
                    drops += 1;
                }
                for (let i = 0; i < drops; i++) {
                    collectArtifact();
                    gained = true;
                }
            }
        }

        autoBuildAccumulator += TICK_MS;
        autoUpgradeAccumulator += TICK_MS;

        const autoBuildIntervalMs = state.artifactAutoBuildIntervalMs || AUTO_BUY_DEFAULT_MS;
        while (autoBuildAccumulator >= autoBuildIntervalMs) {
            autoBuildAccumulator -= autoBuildIntervalMs;
            if (tryAutoBuyBuilding()) {
                autoBought = true;
            }
        }

        const autoUpgradeIntervalMs = state.artifactAutoUpgradeIntervalMs || AUTO_BUY_DEFAULT_MS;
        while (autoUpgradeAccumulator >= autoUpgradeIntervalMs) {
            autoUpgradeAccumulator -= autoUpgradeIntervalMs;
            if (tryAutoBuyCheapestUpgrade()) {
                autoBought = true;
            }
        }

        if (tryAutoClaimCompletedTasks()) {
            gained = true;
        }

        if (gained || autoBought) {
            refreshShop();
        } else {
            renderStats();
            renderSystems();
        }

        window.IdleStars.tick(TICK_MS);
    }

    function updateClickVisualState() {
        const hasAuto = getAutoClickRate() > 0;
        const isHolding = Boolean(holdClickTimer);
        const tier = getClickVisualTier();
        const tierLabel = ["採集星晶", "共振採集", "躍遷採集", "超弦採集", "奇點採集"][tier] || "採集星晶";
        const tierIcon = ["✦", "✶", "✹", "❈", "✺"][tier] || "✦";

        els.clickScene.classList.toggle("idle-click-scene--auto", hasAuto);
        els.clickScene.classList.toggle("idle-click-scene--holding", isHolding);
        els.clickBtn.classList.toggle("idle-click-btn--auto", hasAuto);
        els.clickBtn.classList.toggle("idle-click-btn--holding", isHolding);
        for (let i = 1; i <= 4; i++) {
            els.clickBtn.classList.toggle(`idle-click-btn--tier-${i}`, tier === i);
        }
        if (els.clickLabel) {
            els.clickLabel.textContent = tierLabel;
        }
        if (els.clickIcon) {
            els.clickIcon.textContent = tierIcon;
        }
    }

    function getClickVisualTier() {
        const earned = state.lifetimeEarned || 0n;
        const shards = state.shards || 0;
        if (earned >= 1000000000000000000000n || shards >= 500) {
            return 4;
        }
        if (earned >= 1000000000000000n || shards >= 150) {
            return 3;
        }
        if (earned >= 10000000000n || shards >= 25) {
            return 2;
        }
        if (earned >= 1000000n || shards >= 1) {
            return 1;
        }
        return 0;
    }

    function renderArtifactAutomationControls() {
        if (!els.artifactAutomation) {
            return;
        }

        const autoBuildRarity = getAutoBuildArtifactRarity();
        const autoUpgradeRarity = getAutoUpgradeArtifactRarity();
        const autoBuildDiscount = getArtifactAutoDiscountPercent(autoBuildRarity);
        const autoUpgradeDiscount = getArtifactAutoDiscountPercent(autoUpgradeRarity);
        const canBuild = autoBuildRarity > 0;
        const canUpgrade = autoUpgradeRarity > 0;
        const autoBuildIntervalMs = state.artifactAutoBuildIntervalMs || AUTO_BUY_DEFAULT_MS;
        const autoUpgradeIntervalMs = state.artifactAutoUpgradeIntervalMs || AUTO_BUY_DEFAULT_MS;
        const optionLabel = (ms) => `${ms / 1000}秒`;
        const renderFrequencyOptions = (selectedMs) =>
            AUTO_BUY_OPTIONS_MS.map(
                (ms) => `<option value="${ms}" ${selectedMs === ms ? "selected" : ""}>${optionLabel(ms)}</option>`
            ).join("");

        els.artifactAutomation.innerHTML = `
            <button type="button" class="idle-artifact-automation-btn${state.artifactAutoBuildEnabled ? " active" : ""}" data-artifact-toggle="build" ${canBuild ? "" : "disabled"
            }>
                <span class="idle-artifact-automation-label">自動建築：${state.artifactAutoBuildEnabled ? "開" : "關"}</span>
                <span class="idle-artifact-automation-meta">${canBuild ? `工匠自治核 R${autoBuildRarity} · 折扣 ${autoBuildDiscount}%` : "需先獲得工匠自治核"
            }</span>
            </button>
            <label class="idle-artifact-automation-frequency">
                <span>工匠自治核頻率</span>
                <select data-artifact-frequency="build" ${canBuild ? "" : "disabled"}>
                    ${renderFrequencyOptions(autoBuildIntervalMs)}
                </select>
            </label>
            <button type="button" class="idle-artifact-automation-btn${state.artifactAutoUpgradeEnabled ? " active" : ""}" data-artifact-toggle="upgrade" ${canUpgrade ? "" : "disabled"
            }>
                <span class="idle-artifact-automation-label">自動最便宜升級：${state.artifactAutoUpgradeEnabled ? "開" : "關"}</span>
                <span class="idle-artifact-automation-meta">${canUpgrade ? `優化先知核 R${autoUpgradeRarity} · 折扣 ${autoUpgradeDiscount}%` : "需先獲得優化先知核"
            }</span>
            </button>
            <label class="idle-artifact-automation-frequency">
                <span>優化先知核頻率</span>
                <select data-artifact-frequency="upgrade" ${canUpgrade ? "" : "disabled"}>
                    ${renderFrequencyOptions(autoUpgradeIntervalMs)}
                </select>
            </label>
        `;

        els.artifactAutomation.querySelector('[data-artifact-toggle="build"]')?.addEventListener("click", toggleAutoBuild);
        els.artifactAutomation
            .querySelector('[data-artifact-toggle="upgrade"]')
            ?.addEventListener("click", toggleAutoUpgrade);
        els.artifactAutomation.querySelector('[data-artifact-frequency="build"]')?.addEventListener("change", (event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
                setAutoBuildIntervalMs(next);
            }
        });
        els.artifactAutomation.querySelector('[data-artifact-frequency="upgrade"]')?.addEventListener("change", (event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) {
                setAutoUpgradeIntervalMs(next);
            }
        });
    }

    function renderStats() {
        const crystalText = formatShort(state.crystals);
        const cpsText = `+${formatRate(getTotalCps())}/s`;
        const clickText = formatShort(BigInt(getClickMultiplier()));
        const shardText = formatShort(BigInt(state.shards));
        const bonusPct = Math.round((getPrestigeMultiplier() - 1) * 100);
        const bonusText = bonusPct > 0 ? `(+${bonusPct}%)` : "(+0%)";

        if (lastStatsRender.crystal !== crystalText) {
            els.crystalCount.textContent = crystalText;
            lastStatsRender.crystal = crystalText;
        }
        if (lastStatsRender.cps !== cpsText) {
            els.cpsValue.textContent = cpsText;
            lastStatsRender.cps = cpsText;
        }
        if (lastStatsRender.click !== clickText) {
            els.clickPower.textContent = clickText;
            lastStatsRender.click = clickText;
        }
        if (lastStatsRender.shards !== shardText) {
            els.shardCount.textContent = shardText;
            lastStatsRender.shards = shardText;
        }
        if (lastStatsRender.prestigeBonus !== bonusText) {
            els.prestigeBonus.textContent = bonusText;
            lastStatsRender.prestigeBonus = bonusText;
        }

        updateClickVisualState();
    }

    function renderBuyModes() {
        els.buyModeBar.innerHTML = "";
        BUY_MODES.forEach((mode) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "idle-buy-mode-btn";
            if (buyMode === mode) {
                btn.classList.add("active");
            }
            btn.textContent = mode === "max" ? "Max" : `×${mode}`;
            btn.addEventListener("click", () => {
                buyMode = mode;
                renderBuyModes();
                renderBuildings();
            });
            els.buyModeBar.appendChild(btn);
        });
    }

    function renderTabs() {
        const tabs = [
            { id: "buildings", label: "建築" },
            { id: "upgrades", label: "升級" },
            { id: "prestige", label: "轉生" },
            { id: "artifact", label: "神器" }
        ];

        els.tabBar.innerHTML = "";
        tabs.forEach((tab) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "idle-tab-btn";
            btn.dataset.tab = tab.id;
            if (activeTab === tab.id) {
                btn.classList.add("active");
            }
            btn.textContent = tab.label;
            btn.addEventListener("click", () => {
                activeTab = tab.id;
                renderTabs();
                renderShopPanels();
                renderShop();
            });
            els.tabBar.appendChild(btn);
        });
    }

    function updateDescriptionToggle() {
        const onBuildingsTab = activeTab === "buildings";
        els.descToggleBtn.hidden = !onBuildingsTab;
        els.shopPanel.classList.toggle("idle-shop-panel--show-desc", showDescriptions);
        els.shopPanel.classList.toggle("idle-shop-panel--tab-upgrades", activeTab === "upgrades");
        els.descToggleBtn.classList.toggle("active", showDescriptions);
        els.descToggleBtn.setAttribute("aria-pressed", String(showDescriptions));
        els.descToggleBtn.textContent = showDescriptions ? "收起說明" : "說明";
    }

    function setPanelVisible(element, visible) {
        element.hidden = !visible;
        element.classList.toggle("idle-shop-panel--active", visible);
    }

    function renderShopPanels() {
        setPanelVisible(els.buildingList, activeTab === "buildings");
        setPanelVisible(els.upgradeList, activeTab === "upgrades");
        setPanelVisible(els.prestigePanel, activeTab === "prestige");
        setPanelVisible(els.artifactPanel, activeTab === "artifact");
        els.buyModeBar.hidden = activeTab !== "buildings";
        updateDescriptionToggle();
    }

    function openCodex() {
        renderCodex();
        els.codexModal.hidden = false;
        document.body.classList.add("idle-modal-open");
    }

    function closeCodex() {
        els.codexModal.hidden = true;
        document.body.classList.remove("idle-modal-open");
    }

    function renderBuildings() {
        els.buildingList.innerHTML = "";

        BUILDINGS.forEach((building) => {
            const owned = state.buildings[building.id] || 0;
            const quantity = getBuyQuantity(building);
            const cost = quantity > 0 ? buildingCost(building.baseCost, owned, quantity) : buildingCost(building.baseCost, owned, 1);
            const affordable = quantity > 0 && canAfford(state.crystals, cost);
            const perBuildingCps = building.baseCps * getBuildingMultiplier(building.id) * getGlobalMultiplier() * getBuildingArtifactMultiplier();

            const row = document.createElement("article");
            row.className = `idle-shop-item${affordable ? "" : " idle-shop-item--locked"}`;
            row.dataset.buildingId = building.id;

            row.innerHTML = `
                <div class="idle-shop-item-main">
                    <h3 class="idle-shop-item-title">${building.name}</h3>
                    <p class="idle-shop-item-desc">${building.description}</p>
                    <p class="idle-shop-item-meta">
                        <strong class="idle-shop-owned">${owned}</strong> 棟 ·
                        <strong>${formatRate(perBuildingCps)}</strong>/s
                    </p>
                </div>
                <button type="button" class="btn btn-primary idle-shop-buy" title="${building.description}" ${affordable ? "" : "disabled"}>
                    <span class="idle-shop-buy-qty">${quantity > 0 ? `×${quantity}` : "—"}</span>
                    <span class="idle-shop-buy-cost">${formatShort(cost)}</span>
                </button>
            `;

            const buyBtn = row.querySelector(".idle-shop-buy");
            buyBtn.addEventListener("click", () => buyBuilding(building.id));
            els.buildingList.appendChild(row);
        });
    }

    function renderUpgrades() {
        els.upgradeList.innerHTML = "";

        const visibleUpgrades = getSortedVisibleUpgrades();

        if (visibleUpgrades.length === 0) {
            const empty = document.createElement("p");
            empty.className = "idle-empty-note";
            empty.textContent = hasUpgrade(UPGRADES[UPGRADES.length - 1].id)
                ? "所有升級已購買完畢。"
                : "尚未解鎖任何升級，繼續採集星晶吧！";
            els.upgradeList.appendChild(empty);
            return;
        }

        visibleUpgrades.forEach((upgrade) => {
            const repeatablePlan = isRepeatableUpgrade(upgrade) ? getRepeatableUpgradePurchasePlan(upgrade) : null;
            const cost = repeatablePlan ? repeatablePlan.totalCost : getUpgradeCost(upgrade);
            const affordable = repeatablePlan ? repeatablePlan.count > 0 : canAfford(state.crystals, cost);
            const repeatableRarityMeta = getRepeatableRarityUpgradeMeta(upgrade);
            const repeatableDropMeta = getRepeatableDropUpgradeMeta(upgrade);
            const row = document.createElement("article");
            row.className = `idle-shop-item idle-shop-item--upgrade${affordable ? "" : " idle-shop-item--locked"}`;
            row.dataset.upgradeId = upgrade.id;

            const typeLabel =
                upgrade.type === "click"
                    ? "點擊"
                    : upgrade.type === "building"
                        ? "建築"
                        : upgrade.type === "star"
                            ? "流星"
                            : upgrade.type === "artifact"
                                ? "神器"
                                : "全域";
            const tagClass =
                upgrade.type === "star"
                    ? "idle-upgrade-tag idle-upgrade-tag--star"
                    : upgrade.type === "artifact"
                        ? "idle-upgrade-tag idle-upgrade-tag--artifact"
                        : "idle-upgrade-tag";

            row.innerHTML = `
                <div class="idle-shop-item-main">
                    <div class="idle-shop-item-head">
                        <h3 class="idle-shop-item-title">${upgrade.name}</h3>
                        <span class="${tagClass}">${typeLabel}</span>
                    </div>
                    <p class="idle-shop-item-desc">${upgrade.description}</p>
                </div>
                <button type="button" class="btn btn-outline idle-shop-buy" title="${upgrade.description}" ${affordable ? "" : "disabled"}>
                    <span class="idle-shop-buy-cost">${formatShort(cost)}</span>
                    ${repeatableRarityMeta
                    ? `<span class="idle-shop-buy-note">Lv.${repeatableRarityMeta.level} · 下一級上限 R${repeatableRarityMeta.nextCap}${repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                    }</span>`
                    : repeatableDropMeta
                        ? `<span class="idle-shop-buy-note">Lv.${repeatableDropMeta.level} · 下一級掉率 ${repeatableDropMeta.nextRatePct}%/秒${repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                        }</span>`
                        : ""
                }
                </button>
            `;

            row.querySelector(".idle-shop-buy").addEventListener("click", () => buyUpgrade(upgrade.id));
            els.upgradeList.appendChild(row);
        });
    }

    function renderPrestige() {
        const shardGain = calculateShardGain();
        const artifactTotals = getArtifactTotals();
        const artifactUnlocked = isArtifactSystemUnlocked();
        const artifactBonusPct = Math.round(getArtifactShardBonusRate() * 100);
        const prestigeStartCrystals = getArtifactPrestigeStartCrystals();
        const unlocked = state.lifetimeEarned >= PRESTIGE.unlockLifetime;

        els.prestigePreview.innerHTML = `
            <p>本輪生涯獲得：<strong>${formatShort(state.lifetimeEarned)}</strong> 星晶</p>
            <p>轉生門檻：<strong>${formatShort(PRESTIGE.unlockLifetime)}</strong> 星晶</p>
            <p>目前碎片：<strong>${formatShort(BigInt(state.shards))}</strong>（每碎片 +${Math.round(PRESTIGE.bonusPerShard * 100)}% 全域產出）</p>
            <p>神器裝備：<strong>${artifactTotals.equipped}</strong> / ${ARTIFACTS.length} 件（最高稀有度 R${artifactTotals.bestRarity || 0}，目前上限 R${getArtifactRarityCap()}）</p>
            <p>神器轉生加成：<strong>${artifactBonusPct}%</strong>（額外 +${formatShort(BigInt(shardGain.artifactBonusGain))} 碎片）</p>
            <p>本次轉生可獲得：<strong>${formatShort(BigInt(shardGain.totalGain))}</strong> 新碎片（基礎 ${formatShort(BigInt(shardGain.baseGain))}）</p>
            <p>轉生起始星晶：<strong>${formatShort(prestigeStartCrystals)}</strong></p>
            <p class="idle-prestige-note">${artifactUnlocked ? `每秒有 ${Math.round(getArtifactDropChancePerSec() * 1000) / 10}% 機率獲得神器。` : `首次轉生後（${ARTIFACT_SYSTEM.unlockShards} 碎片）解鎖神器系統。`}</p>
            <p class="idle-prestige-note">轉生會重置星晶、建築與升級，但保留碎片加成。</p>
        `;

        els.prestigeBtn.disabled = shardGain.totalGain <= 0;
        els.prestigeBtn.textContent = shardGain.totalGain > 0
            ? `轉生（+${formatShort(BigInt(shardGain.totalGain))} 碎片）`
            : unlocked
                ? "需要更多本輪星晶"
                : `解鎖於 ${formatShort(PRESTIGE.unlockLifetime)} 生涯星晶`;
    }

    function renderArtifacts() {
        const totals = getArtifactTotals();
        const unlocked = isArtifactSystemUnlocked();
        const shardBonusRate = getArtifactShardBonusRate();
        const rarityCap = getArtifactRarityCap();
        const dropRate = getArtifactDropChancePerSec();
        const autoBuildRarity = getAutoBuildArtifactRarity();
        const autoUpgradeRarity = getAutoUpgradeArtifactRarity();
        const autoBuildDiscount = getArtifactAutoDiscountPercent(autoBuildRarity);
        const autoUpgradeDiscount = getArtifactAutoDiscountPercent(autoUpgradeRarity);
        const artifactStateKey = ARTIFACTS.map((artifact) => {
            const bucket = state.artifacts[artifact.id];
            return `${artifact.id}:${bucket.rarity || 0}:${bucket.replacements || 0}`;
        }).join("|");
        const renderKey = [
            unlocked ? 1 : 0,
            totals.equipped,
            totals.bestRarity,
            totals.replacements,
            Math.round(shardBonusRate * 100000),
            Math.round(dropRate * 100000),
            rarityCap,
            state.artifactAutoBuildEnabled ? 1 : 0,
            state.artifactAutoUpgradeEnabled ? 1 : 0,
            state.artifactAutoBuildIntervalMs || AUTO_BUY_DEFAULT_MS,
            state.artifactAutoUpgradeIntervalMs || AUTO_BUY_DEFAULT_MS,
            artifactStateKey
        ].join(";");

        if (renderKey === lastArtifactRenderKey) {
            return;
        }
        lastArtifactRenderKey = renderKey;

        renderArtifactAutomationControls();

        const cards = ARTIFACTS.map((artifact) => {
            const bucket = state.artifacts[artifact.id];
            const rarity = bucket.rarity || 0;
            let effectText = "尚未提供效果";

            if (artifact.effect.shardGainPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.shardGainPerRarity);
                effectText = `轉生碎片 +${Math.round(bonus * 1000) / 10}%`;
            } else if (artifact.effect.prestigeStartCrystalsPerRarity) {
                const startCrystals = Math.max(0, Math.floor(getArtifactEffectValueByRarity(rarity, artifact.effect.prestigeStartCrystalsPerRarity)));
                effectText = `每次轉生起始星晶 +${formatShort(BigInt(startCrystals))}`;
            } else if (artifact.effect.globalMultPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.globalMultPerRarity);
                effectText = `全域產出 +${Math.round(bonus * 1000) / 10}%`;
            } else if (artifact.effect.clickAddPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.clickAddPerRarity);
                effectText = `點擊基礎 +${Math.round(bonus * 10) / 10}`;
            } else if (artifact.effect.starSpawnPerRarity || artifact.effect.starRewardPerRarity) {
                const spawnPct =
                    Math.round(getArtifactEffectValueByRarity(rarity, artifact.effect.starSpawnPerRarity || 0) * 1000) / 10;
                const rewardPct =
                    Math.round(getArtifactEffectValueByRarity(rarity, artifact.effect.starRewardPerRarity || 0) * 1000) / 10;
                effectText = `流星機率 +${spawnPct}% · 流星獎勵 +${rewardPct}%`;
            } else if (artifact.effect.starShockwavePerRarity) {
                const chancePct = Math.round(getArtifactShockwaveChancePerCheck() * 1000) / 10;
                effectText = rarity > 0 ? `每 10 秒 ${chancePct}% 機率觸發震波清除全部流星` : "可解鎖流星震波";
            } else if (artifact.effect.starGoldDropChancePerRarity) {
                const chancePct = Math.round(getArtifactStarGoldDropChance() * 1000) / 10;
                effectText = rarity > 0 ? `捕獲流星有 ${chancePct}% 機率額外掉落目前星晶 1%` : "可解鎖流星額外掉落";
            } else if (artifact.effect.starMinGapReducePerRarity || artifact.effect.starMaxActivePerRarity) {
                const gapReduce = Math.max(0, getArtifactEffectValueByRarity(rarity, artifact.effect.starMinGapReducePerRarity || 0));
                const gapPct = Math.min(80, Math.round(gapReduce * 1000) / 10);
                const maxAdd = getArtifactStarMaxActiveAddByRarity(rarity, artifact.effect.starMaxActivePerRarity || 0);
                effectText = rarity > 0 ? `流星間隔 -${gapPct}% · 同時上限 +${maxAdd}` : "可解鎖流星節奏強化";
            } else if (artifact.effect.starMultiSpawnPerRarity) {
                const chainChancePct = Math.round(getArtifactStarMultiSpawnChainChanceByRarity(rarity) * 1000) / 10;
                const maxExtra = getArtifactStarMultiSpawnMaxExtraByRarity(rarity);
                effectText =
                    rarity > 0
                        ? `每次額外生成判定 ${chainChancePct}%（最高 90%）· 額外最多 +${maxExtra} 顆（每 100 稀有度 +1）`
                        : "可解鎖流星裂變";
            } else if (artifact.effect.buildingMultPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.buildingMultPerRarity);
                effectText = `建築產出 +${Math.round(bonus * 1000) / 10}%`;
            } else if (artifact.effect.artifactDropPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.artifactDropPerRarity);
                effectText = `神器掉落率 +${Math.round(bonus * 1000) / 10}%/秒`;
            } else if (artifact.effect.autoBuildEnabled) {
                const discount = getArtifactAutoDiscountPercent(rarity);
                effectText = rarity > 0 ? `解鎖自動建築 · 自動購買折扣 ${discount}%` : "可解鎖自動建築";
            } else if (artifact.effect.autoUpgradeEnabled) {
                const discount = getArtifactAutoDiscountPercent(rarity);
                effectText = rarity > 0 ? `解鎖自動最便宜升級 · 自動購買折扣 ${discount}%` : "可解鎖自動最便宜升級";
            }

            return `
                <article class="idle-artifact-item">
                    <div class="idle-artifact-item-head">
                        <h3 class="idle-artifact-item-title">${artifact.name}</h3>
                        <span class="idle-upgrade-tag idle-upgrade-tag--artifact">神器</span>
                    </div>
                    <p class="idle-artifact-item-desc">${artifact.description}</p>
                    <p class="idle-artifact-item-meta">
                        目前稀有度 <strong>R${rarity}</strong> ${bucket.replacements > 0 ? `· 已替換 ${bucket.replacements} 次` : ""}
                    </p>
                    <p class="idle-artifact-item-meta">當前效果：<strong>${effectText}</strong></p>
                </article>
            `;
        }).join("");

        els.artifactPreview.innerHTML = `
            <p>系統狀態：<strong>${unlocked ? "已解鎖" : "未解鎖"}</strong>（首次轉生後解鎖）</p>
            <p>目前效果：轉生碎片加成 <strong>+${Math.round(shardBonusRate * 1000) / 10}%</strong>（由時序透鏡提供）</p>
            <p>掉落機率：<strong>${Math.round(dropRate * 1000) / 10}% / 秒</strong> · 稀有度上限：<strong>R${rarityCap}</strong></p>
            <p>已裝備：<strong>${totals.equipped}</strong> / ${ARTIFACTS.length} 件 · 最高稀有度 <strong>R${totals.bestRarity || 0}</strong> · 總替換次數 <strong>${totals.replacements}</strong></p>
            <p>自動建築：<strong>${state.artifactAutoBuildEnabled ? "開" : "關"}</strong>（工匠自治核 R${autoBuildRarity} · 折扣 ${autoBuildDiscount}%）</p>
            <p>自動最便宜升級：<strong>${state.artifactAutoUpgradeEnabled ? "開" : "關"}</strong>（優化先知核 R${autoUpgradeRarity} · 折扣 ${autoUpgradeDiscount}%）</p>
            <p class="idle-prestige-note">每種神器只能持有 1 件；僅在掉到更高稀有度時替換。</p>
            <div class="idle-artifact-grid">${cards}</div>
        `;
    }

    function formatUpgradeCondition(upgrade) {
        const parts = [];
        const unlock = upgrade.unlock || {};

        if (unlock.lifetime !== undefined) {
            parts.push(`生涯星晶 ${formatShort(unlock.lifetime)}+`);
        }
        if (unlock.shards !== undefined) {
            parts.push(`碎片 ${unlock.shards}+`);
        }
        if (unlock.building) {
            Object.entries(unlock.building).forEach(([buildingId, amount]) => {
                const building = getBuildingDef(buildingId);
                parts.push(`${building ? building.name : buildingId} ${amount} 棟`);
            });
        }
        if (unlock.requires && unlock.requires.length > 0) {
            const reqNames = unlock.requires
                .map((id) => getUpgradeDef(id)?.name || id)
                .join("、");
            parts.push(`前置：${reqNames}`);
        }
        return parts.length > 0 ? parts.join(" · ") : "無條件";
    }

    function formatUpgradeEffect(upgrade) {
        const effect = upgrade.effect || {};
        const parts = [];

        if (effect.clickAdd) parts.push(`點擊 +${effect.clickAdd}`);
        if (effect.clickMult) parts.push(`點擊 ×${effect.clickMult}`);
        if (effect.autoClickRate) parts.push(`自動採集 +${effect.autoClickRate}/秒`);
        if (effect.holdClick) parts.push("解鎖按住採集");
        if (effect.globalMult) parts.push(`全域產出 ×${effect.globalMult}`);
        if (effect.buildingMult) {
            const building = getBuildingDef(upgrade.buildingId);
            parts.push(`${building ? building.name : "建築"} ×${effect.buildingMult}`);
        }
        if (effect.starUnlock) parts.push("解鎖流星系統");
        if (effect.starSpawnMult) parts.push(`流星機率 ×${effect.starSpawnMult}`);
        if (effect.starRewardMult) parts.push(`流星獎勵 ×${effect.starRewardMult}`);
        if (effect.starDurationMult) parts.push(`流星停留 ×${effect.starDurationMult}`);
        if (effect.starMaxActiveAdd) parts.push(`同時流星 +${effect.starMaxActiveAdd}`);
        if (effect.starMinGapMult) parts.push(`流星間隔 ×${effect.starMinGapMult}`);
        if (effect.starShockwavePerRarity) parts.push(`流星震波機率隨稀有度提升（每 10 秒判定）`);
        if (effect.starGoldDropChancePerRarity)
            parts.push(`每稀有度單位提供流星額外掉落機率 +${Math.round(effect.starGoldDropChancePerRarity * 10000) / 100}%`);
        if (effect.manualShockwaveChancePerClick) {
            const perClickPct = Math.round(effect.manualShockwaveChancePerClick * 10000) / 100;
            const capPct = Math.round((effect.manualShockwaveChanceCap || 0) * 1000) / 10;
            parts.push(`手動點擊/按住每次提升震波機率 +${perClickPct}%（上限 +${capPct}%）`);
        }
        if (effect.prestigeStartCrystalsPerRarity) parts.push(`每稀有度單位提供轉生起始星晶 +${effect.prestigeStartCrystalsPerRarity}`);
        if (effect.starMinGapReducePerRarity)
            parts.push(`每稀有度單位降低流星間隔 ${Math.round(effect.starMinGapReducePerRarity * 10000) / 100}%（總減幅上限 80%）`);
        if (effect.starMaxActivePerRarity) parts.push(`每稀有度單位提高同時流星上限 ${effect.starMaxActivePerRarity}`);
        if (effect.starMultiSpawnPerRarity) parts.push(`流星額外生成連鎖機率隨稀有度提升（上限 90%）`);
        if (effect.artifactRarityCapAdd) parts.push(`神器稀有度上限 +${effect.artifactRarityCapAdd}`);
        if (effect.artifactRarityCap) parts.push(`神器稀有度上限 R${effect.artifactRarityCap}`);
        if (effect.artifactDropRateAdd) parts.push(`神器掉落率 +${Math.round(effect.artifactDropRateAdd * 100)}%/秒`);
        if (effect.repeatable) parts.push("可重複購買");
        if (effect.artifactDropMult) parts.push(`神器掉落率 ×${effect.artifactDropMult}`);
        if (effect.autoMissionClaim) parts.push("自動領取任務獎勵");

        return parts.length > 0 ? parts.join(" · ") : "效果說明見描述";
    }

    function renderCodex() {
        const pages = [
            { id: "buildings", label: "建築" },
            { id: "upgrades", label: "升級" },
            { id: "prestige", label: "轉生" },
            { id: "artifacts", label: "神器" }
        ];

        els.codexTabBar.innerHTML = pages
            .map(
                (page) =>
                    `<button type="button" class="idle-codex-tab-btn${activeCodexPage === page.id ? " active" : ""}" data-codex-tab="${page.id}" role="tab" aria-selected="${activeCodexPage === page.id}">${page.label}</button>`
            )
            .join("");

        els.codexTabBar.querySelectorAll("[data-codex-tab]").forEach((btn) => {
            btn.addEventListener("click", () => {
                activeCodexPage = btn.dataset.codexTab;
                renderCodex();
            });
        });

        if (activeCodexPage === "buildings") {
            const rows = BUILDINGS.map((building) => {
                const owned = state.buildings[building.id] || 0;
                return `
                    <article class="idle-codex-item${owned > 0 ? " idle-codex-item--owned" : ""}">
                        <div class="idle-codex-item-head">
                            <h3 class="idle-codex-item-title">${building.name}</h3>
                            <span class="idle-codex-item-type">建築</span>
                        </div>
                        <p class="idle-codex-item-line"><strong>描述：</strong>${building.description}</p>
                        <p class="idle-codex-item-line"><strong>基礎產出：</strong>${formatRate(building.baseCps)}/s</p>
                        <p class="idle-codex-item-line"><strong>起始費用：</strong>${formatShort(building.baseCost)}${owned > 0 ? ` · 已持有 ${owned} 棟` : ""}</p>
                    </article>
                `;
            }).join("");

            els.codexPreview.innerHTML = `<div class="idle-codex-grid">${rows}</div>`;
            return;
        }

        if (activeCodexPage === "prestige") {
            els.codexPreview.innerHTML = `
                <div class="idle-codex-grid">
                    <article class="idle-codex-item">
                        <div class="idle-codex-item-head">
                            <h3 class="idle-codex-item-title">轉生機制</h3>
                            <span class="idle-codex-item-type">轉生</span>
                        </div>
                        <p class="idle-codex-item-line"><strong>解鎖門檻：</strong>生涯星晶 ${formatShort(PRESTIGE.unlockLifetime)}</p>
                        <p class="idle-codex-item-line"><strong>碎片公式：</strong>floor(sqrt(生涯星晶 / ${formatShort(PRESTIGE.divisor)}))</p>
                        <p class="idle-codex-item-line"><strong>碎片加成：</strong>每 1 碎片提供 +${Math.round(PRESTIGE.bonusPerShard * 100)}% 全域產出</p>
                        <p class="idle-codex-item-line"><strong>重置內容：</strong>星晶、建築、升級</p>
                    </article>
                </div>
            `;
            return;
        }

        if (activeCodexPage === "artifacts") {
            const rows = ARTIFACTS.map((artifact) => {
                const rarity = getArtifactRarity(artifact.id);
                let scalingText = "特殊效果";
                if (artifact.effect.shardGainPerRarity) scalingText = `轉生碎片係數 ${artifact.effect.shardGainPerRarity}/單位`;
                if (artifact.effect.prestigeStartCrystalsPerRarity)
                    scalingText = `轉生起始星晶係數 ${artifact.effect.prestigeStartCrystalsPerRarity}/單位`;
                if (artifact.effect.globalMultPerRarity) scalingText = `全域產出係數 ${artifact.effect.globalMultPerRarity}/單位`;
                if (artifact.effect.clickAddPerRarity) scalingText = `點擊基礎係數 ${artifact.effect.clickAddPerRarity}/單位`;
                if (artifact.effect.buildingMultPerRarity) scalingText = `建築產出係數 ${artifact.effect.buildingMultPerRarity}/單位`;
                if (artifact.effect.artifactDropPerRarity) scalingText = `神器掉落率係數 ${artifact.effect.artifactDropPerRarity}/單位`;
                if (artifact.effect.starShockwavePerRarity) scalingText = `流星震波機率隨稀有度提升（每 10 秒判定，極高稀有度才接近 100%）`;
                if (artifact.effect.starGoldDropChancePerRarity)
                    scalingText = `流星額外掉落機率係數 ${artifact.effect.starGoldDropChancePerRarity}/單位（上限 100%）`;
                if (artifact.effect.starMinGapReducePerRarity || artifact.effect.starMaxActivePerRarity) {
                    scalingText = `流星間隔降低係數 ${artifact.effect.starMinGapReducePerRarity || 0}/單位（總減幅上限 80%）`;
                    if (artifact.effect.starMaxActivePerRarity) {
                        scalingText += ` · 同時上限係數 ${artifact.effect.starMaxActivePerRarity}/單位`;
                    }
                }
                if (artifact.effect.starMultiSpawnPerRarity)
                    scalingText = `每次額外生成判定機率隨稀有度提升，最高 90%（連鎖判定）`;
                if (artifact.effect.starSpawnPerRarity || artifact.effect.starRewardPerRarity) {
                    scalingText = `流星機率係數 ${artifact.effect.starSpawnPerRarity || 0} / 流星獎勵係數 ${artifact.effect.starRewardPerRarity || 0
                        }`;
                }
                return `
                    <article class="idle-codex-item${rarity > 0 ? " idle-codex-item--owned" : ""}">
                        <div class="idle-codex-item-head">
                            <h3 class="idle-codex-item-title">${artifact.name}</h3>
                            <span class="idle-codex-item-type">神器</span>
                        </div>
                        <p class="idle-codex-item-line"><strong>效果：</strong>${artifact.description}</p>
                        <p class="idle-codex-item-line"><strong>成長：</strong>${scalingText}</p>
                        <p class="idle-codex-item-line"><strong>目前稀有度：</strong>R${rarity}</p>
                    </article>
                `;
            }).join("");
            els.codexPreview.innerHTML = `<div class="idle-codex-grid">${rows}</div>`;
            return;
        }

        function getCodexUpgradeDisplayCost(upgrade) {
            if (upgrade.id !== "artifact_rarity_infinite") {
                return getUpgradeCost(upgrade);
            }
            const plan = getRepeatableUpgradePurchasePlan(upgrade);
            return plan.count > 0 ? plan.totalCost : getUpgradeCost(upgrade);
        }

        const rows = UPGRADES.map((upgrade) => {
            const owned = hasUpgrade(upgrade.id);
            const cost = getCodexUpgradeDisplayCost(upgrade);
            const extra =
                upgrade.id === "artifact_rarity_infinite"
                    ? ` · 目前等級 ${state.artifactRarityLevel || 0}`
                    : upgrade.id === "artifact_drop_infinite"
                        ? ` · 目前等級 ${state.artifactDropLevel || 0}`
                        : owned
                            ? " · 已購買"
                            : "";
            return `
                <article class="idle-codex-item${owned ? " idle-codex-item--owned" : ""}">
                    <div class="idle-codex-item-head">
                        <h3 class="idle-codex-item-title">${upgrade.name}</h3>
                        <span class="idle-codex-item-type">${upgrade.type}</span>
                    </div>
                    <p class="idle-codex-item-line"><strong>效果：</strong>${formatUpgradeEffect(upgrade)}</p>
                    <p class="idle-codex-item-line"><strong>條件：</strong>${formatUpgradeCondition(upgrade)}</p>
                    <p class="idle-codex-item-line"><strong>費用：</strong>${formatShort(cost)}${extra}</p>
                </article>
            `;
        }).join("");

        els.codexPreview.innerHTML = `<div class="idle-codex-grid">${rows}</div>`;
    }

    function updateBuildingRows() {
        BUILDINGS.forEach((building) => {
            const row = els.buildingList.querySelector(`[data-building-id="${building.id}"]`);
            if (!row) {
                return;
            }

            const owned = state.buildings[building.id] || 0;
            const quantity = getBuyQuantity(building);
            const cost =
                quantity > 0
                    ? buildingCost(building.baseCost, owned, quantity)
                    : buildingCost(building.baseCost, owned, 1);
            const affordable = quantity > 0 && canAfford(state.crystals, cost);
            const perBuildingCps = building.baseCps * getBuildingMultiplier(building.id) * getGlobalMultiplier() * getBuildingArtifactMultiplier();

            row.classList.toggle("idle-shop-item--locked", !affordable);

            const ownedEl = row.querySelector(".idle-shop-owned");
            if (ownedEl) {
                ownedEl.textContent = String(owned);
            }

            const meta = row.querySelector(".idle-shop-item-meta");
            if (meta) {
                meta.innerHTML = `
                    <strong class="idle-shop-owned">${owned}</strong> 棟 ·
                    <strong>${formatRate(perBuildingCps)}</strong>/s
                `;
            }

            const buyBtn = row.querySelector(".idle-shop-buy");
            const qtyEl = row.querySelector(".idle-shop-buy-qty");
            const costEl = row.querySelector(".idle-shop-buy-cost");

            if (buyBtn) {
                buyBtn.disabled = !affordable;
            }
            if (qtyEl) {
                qtyEl.textContent = quantity > 0 ? `×${quantity}` : "—";
            }
            if (costEl) {
                costEl.textContent = formatShort(cost);
            }
        });
    }

    function updateUpgradeRows() {
        const visibleUpgrades = getSortedVisibleUpgrades();

        visibleUpgrades.forEach((upgrade) => {
            const row = els.upgradeList.querySelector(`[data-upgrade-id="${upgrade.id}"]`);
            if (!row) {
                return;
            }

            const repeatablePlan = isRepeatableUpgrade(upgrade) ? getRepeatableUpgradePurchasePlan(upgrade) : null;
            const cost = repeatablePlan ? repeatablePlan.totalCost : getUpgradeCost(upgrade);
            const affordable = repeatablePlan ? repeatablePlan.count > 0 : canAfford(state.crystals, cost);
            const repeatableRarityMeta = getRepeatableRarityUpgradeMeta(upgrade);
            const repeatableDropMeta = getRepeatableDropUpgradeMeta(upgrade);
            row.classList.toggle("idle-shop-item--locked", !affordable);

            const buyBtn = row.querySelector(".idle-shop-buy");
            const costEl = row.querySelector(".idle-shop-buy-cost");
            const noteEl = row.querySelector(".idle-shop-buy-note");
            if (buyBtn) {
                buyBtn.disabled = !affordable;
            }
            if (costEl) {
                costEl.textContent = formatShort(cost);
            }
            if (noteEl && repeatableRarityMeta) {
                noteEl.textContent = `Lv.${repeatableRarityMeta.level} · 下一級上限 R${repeatableRarityMeta.nextCap}${repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                    }`;
            } else if (noteEl && repeatableDropMeta) {
                noteEl.textContent = `Lv.${repeatableDropMeta.level} · 下一級掉率 ${repeatableDropMeta.nextRatePct}%/秒${repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                    }`;
            }
        });
    }

    function refreshUpgrades() {
        const visibleIds = getVisibleUpgradeIds();
        const renderedIds = getRenderedUpgradeIds();

        if (visibleIds !== renderedIds) {
            renderUpgrades();
            return;
        }

        if (visibleIds) {
            updateUpgradeRows();
        }
    }

    function refreshShop() {
        renderStats();
        renderSystems();

        if (activeTab === "buildings") {
            const buildingRows = els.buildingList.querySelectorAll("[data-building-id]");
            if (buildingRows.length === BUILDINGS.length) {
                updateBuildingRows();
            } else {
                renderBuildings();
            }
        } else if (activeTab === "upgrades") {
            refreshUpgrades();
        } else if (activeTab === "prestige") {
            renderPrestige();
        } else if (activeTab === "artifact") {
            renderArtifacts();
        }

        if (!els.codexModal.hidden) {
            renderCodex();
        }
    }

    function renderShop() {
        renderBuildings();
        renderUpgrades();
        renderPrestige();
        renderArtifacts();
        renderSystems();
        renderCodex();
    }

    function renderAll() {
        renderStats();
        renderBuyModes();
        renderTabs();
        renderShopPanels();
        renderShop();
    }

    function init() {
        els.clickBtn.addEventListener("pointerdown", onPointerDown);
        els.clickBtn.addEventListener("pointerup", onPointerUp);
        els.clickBtn.addEventListener("pointercancel", onPointerUp);
        els.clickBtn.addEventListener("lostpointercapture", stopHoldClick);
        els.clickBtn.addEventListener("click", onClickButton);
        els.clickBtn.addEventListener("contextmenu", (event) => event.preventDefault());
        window.addEventListener("blur", stopHoldClick);
        els.prestigeBtn.addEventListener("click", performPrestige);
        els.descToggleBtn.addEventListener("click", () => {
            showDescriptions = !showDescriptions;
            updateDescriptionToggle();
        });
        els.codexOpenBtn.addEventListener("click", openCodex);
        els.codexCloseBtn.addEventListener("click", closeCodex);
        els.codexModal.addEventListener("click", (event) => {
            if (event.target === els.codexModal) {
                closeCodex();
            }
        });
        window.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !els.codexModal.hidden) {
                closeCodex();
            }
        });

        window.IdleStars.init({
            layer: els.starLayer,
            hasUpgrade,
            getClickMultiplier,
            getArtifactStarBonuses,
            addCrystals,
            formatShort,
            onCatch(reward) {
                spawnBurst(`流星 +${formatShort(BigInt(reward))}`, { star: true });
                trackTaskProgress("star", 1);

                const extraChance = getArtifactStarGoldDropChance();
                if (extraChance > 0 && Math.random() < extraChance) {
                    const bonus = state.crystals / 100n;
                    if (bonus > 0n) {
                        addCrystals(bonus);
                        spawnBurst(`流星加成 +${formatShort(bonus)}`, { star: true });
                    }
                }

                lastBurstAt = Date.now();
                els.clickBtn.classList.add("idle-click-btn--pulse");
                window.clearTimeout(playManualClickVisual.pulseTimer);
                playManualClickVisual.pulseTimer = window.setTimeout(() => {
                    els.clickBtn.classList.remove("idle-click-btn--pulse");
                }, 120);
                refreshShop();
            },
            onShockwave(cleared) {
                spawnBurst(`震波清場 ×${cleared}`, { star: true });
                refreshShop();
            }
        });

        renderAll();
        setupAutosave(() => state);
        tickTimer = window.setInterval(tick, TICK_MS);
    }

    init();
})();
