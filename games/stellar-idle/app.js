(() => {
    const { toBigInt, canAfford, buildingCost, maxAffordableQuantity, formatShort, formatRate, sqrtBigInt } =
        window.IdleNumbers;
    const { BASE_CLICK, BUILDINGS, UPGRADES, PRESTIGE, ARTIFACTS, ARTIFACT_SYSTEM } = window.IdleData;
    const { load, save, setupAutosave } = window.IdleSave;

    const TICK_MS = 100;
    const HOLD_CLICK_MS = 100;
    const ARTIFACT_CHECK_MS = 1000;
    const BUY_MODES = [1, 10, 100, "max"];

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
    let lastArtifactRenderKey = "";
    let activeCodexPage = "upgrades";

    const els = {
        crystalCount: document.getElementById("crystalCount"),
        cpsValue: document.getElementById("cpsValue"),
        clickPower: document.getElementById("clickPower"),
        shardCount: document.getElementById("shardCount"),
        prestigeBonus: document.getElementById("prestigeBonus"),
        clickBtn: document.getElementById("clickBtn"),
        clickScene: document.getElementById("clickScene"),
        clickGlow: document.getElementById("clickGlow"),
        starLayer: document.getElementById("starLayer"),
        clickWrap: document.querySelector(".idle-click-wrap"),
        buyModeBar: document.getElementById("buyModeBar"),
        tabBar: document.getElementById("tabBar"),
        buildingList: document.getElementById("buildingList"),
        upgradeList: document.getElementById("upgradeList"),
        prestigePanel: document.getElementById("prestigePanel"),
        artifactPanel: document.getElementById("artifactPanel"),
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
    }

    normalizeArtifactState(state);

    function getBuildingDef(id) {
        return BUILDINGS.find((b) => b.id === id);
    }

    function getUpgradeDef(id) {
        return UPGRADES.find((u) => u.id === id);
    }

    function hasUpgrade(id) {
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
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "global") {
                return;
            }
            mult *= upgrade.effect.globalMult || 1;
        });

        const artifactGlobalBonus = getArtifactScaledBonus("globalMultPerRarity");
        if (artifactGlobalBonus > 0) {
            mult *= 1 + artifactGlobalBonus;
        }

        return mult * getPrestigeMultiplier();
    }

    function getBuildingMultiplier(buildingId) {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "building") {
                return;
            }
            if (upgrade.buildingId === buildingId) {
                mult *= upgrade.effect.buildingMult || 1;
            }
        });
        return mult;
    }

    function getClickMultiplier() {
        let add = BASE_CLICK;
        let mult = 1;

        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "click") {
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

        return Math.max(1, Math.floor(add * mult * getGlobalMultiplier()));
    }

    function getBuildingArtifactMultiplier() {
        const bonus = getArtifactScaledBonus("buildingMultPerRarity");
        return bonus > 0 ? 1 + bonus : 1;
    }

    function getAutoClickRate() {
        let rate = 0;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "click") {
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
        } else {
            const cost = getUpgradeCost(upgrade);
            if (!spendCrystals(cost)) {
                return;
            }
            state.upgrades.push(upgrade.id);
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

        state.shards += shardGain.totalGain;
        state.crystals = 0n;
        state.lifetimeEarned = 0n;
        state.upgrades = [];
        productionAccumulator = 0;
        autoClickAccumulator = 0;
        artifactRollAccumulator = 0;
        pendingAutoVisualGain = 0;
        if (autoVisualTimer) {
            window.clearTimeout(autoVisualTimer);
            autoVisualTimer = null;
        }
        stopHoldClick();

        BUILDINGS.forEach((building) => {
            state.buildings[building.id] = 0;
        });

        save(state);
        if (shardGain.artifactBonusGain > 0) {
            spawnBurst(`+${shardGain.totalGain} 碎片（神器 +${shardGain.artifactBonusGain}）`);
        } else {
            spawnBurst(`+${shardGain.totalGain} 碎片`);
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
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || !upgrade.effect.artifactDropMult) {
                return;
            }
            chance *= upgrade.effect.artifactDropMult;
        });
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
        const weighted = Math.pow(u, 2.35);
        let rarity = 1 + Math.floor(weighted * cap);

        // Near-cap tiers are intentionally much rarer in late game.
        if (rarity > cap - 5 && Math.random() < 0.8) {
            rarity = Math.max(1, rarity - 3);
        } else if (rarity > cap - 12 && Math.random() < 0.55) {
            rarity = Math.max(1, rarity - 2);
        }

        return Math.min(cap, rarity);
    }

    function getArtifactRarity(artifactId) {
        const bucket = state.artifacts[artifactId];
        return bucket && Number.isFinite(bucket.rarity) ? Math.max(0, bucket.rarity) : 0;
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
            spawnBurst(`神器升級：${artifact.name} R${previousRarity}→R${rarity}`);
            showArtifactToast(`神器升級：${artifact.name} R${previousRarity} → R${rarity}`);
            return;
        }

        spawnBurst(`神器獲得：${artifact.name} R${rarity}`);
        showArtifactToast(`獲得神器：${artifact.name}（稀有度 R${rarity}）`);
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

    function getArtifactStarBonuses() {
        return {
            spawnMult: 1 + getArtifactScaledBonus("starSpawnPerRarity"),
            rewardMult: 1 + getArtifactScaledBonus("starRewardPerRarity")
        };
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

        if (gained) {
            refreshShop();
        } else {
            renderStats();
        }

        window.IdleStars.tick(TICK_MS);
    }

    function updateClickVisualState() {
        const hasAuto = getAutoClickRate() > 0;
        const isHolding = Boolean(holdClickTimer);

        els.clickScene.classList.toggle("idle-click-scene--auto", hasAuto);
        els.clickScene.classList.toggle("idle-click-scene--holding", isHolding);
        els.clickBtn.classList.toggle("idle-click-btn--auto", hasAuto);
        els.clickBtn.classList.toggle("idle-click-btn--holding", isHolding);
    }

    function renderStats() {
        els.crystalCount.textContent = formatShort(state.crystals);
        els.cpsValue.textContent = `+${formatRate(getTotalCps())}/s`;
        els.clickPower.textContent = formatShort(BigInt(getClickMultiplier()));
        els.shardCount.textContent = String(state.shards);
        const bonusPct = Math.round((getPrestigeMultiplier() - 1) * 100);
        els.prestigeBonus.textContent = bonusPct > 0 ? `(+${bonusPct}%)` : "(+0%)";
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
                    ${
                        repeatableRarityMeta
                            ? `<span class="idle-shop-buy-note">Lv.${repeatableRarityMeta.level} · 下一級上限 R${repeatableRarityMeta.nextCap}${
                                  repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                              }</span>`
                            : repeatableDropMeta
                              ? `<span class="idle-shop-buy-note">Lv.${repeatableDropMeta.level} · 下一級掉率 ${repeatableDropMeta.nextRatePct}%/秒${
                                    repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
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
        const unlocked = state.lifetimeEarned >= PRESTIGE.unlockLifetime;

        els.prestigePreview.innerHTML = `
            <p>本輪生涯獲得：<strong>${formatShort(state.lifetimeEarned)}</strong> 星晶</p>
            <p>轉生門檻：<strong>${formatShort(PRESTIGE.unlockLifetime)}</strong> 星晶</p>
            <p>目前碎片：<strong>${state.shards}</strong>（每碎片 +${Math.round(PRESTIGE.bonusPerShard * 100)}% 全域產出）</p>
            <p>神器裝備：<strong>${artifactTotals.equipped}</strong> / ${ARTIFACTS.length} 件（最高稀有度 R${artifactTotals.bestRarity || 0}，目前上限 R${getArtifactRarityCap()}）</p>
            <p>神器轉生加成：<strong>${artifactBonusPct}%</strong>（額外 +${shardGain.artifactBonusGain} 碎片）</p>
            <p>本次轉生可獲得：<strong>${shardGain.totalGain}</strong> 新碎片（基礎 ${shardGain.baseGain}）</p>
            <p class="idle-prestige-note">${artifactUnlocked ? `每秒有 ${Math.round(getArtifactDropChancePerSec() * 1000) / 10}% 機率獲得神器。` : `首次轉生後（${ARTIFACT_SYSTEM.unlockShards} 碎片）解鎖神器系統。`}</p>
            <p class="idle-prestige-note">轉生會重置星晶、建築與升級，但保留碎片加成。</p>
        `;

        els.prestigeBtn.disabled = shardGain.totalGain <= 0;
        els.prestigeBtn.textContent = shardGain.totalGain > 0
            ? `轉生（+${shardGain.totalGain} 碎片）`
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
            artifactStateKey
        ].join(";");

        if (renderKey === lastArtifactRenderKey) {
            return;
        }
        lastArtifactRenderKey = renderKey;

        const cards = ARTIFACTS.map((artifact) => {
            const bucket = state.artifacts[artifact.id];
            const rarity = bucket.rarity || 0;
            let effectText = "尚未提供效果";

            if (artifact.effect.shardGainPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.shardGainPerRarity);
                effectText = `轉生碎片 +${Math.round(bonus * 1000) / 10}%`;
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
            } else if (artifact.effect.buildingMultPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.buildingMultPerRarity);
                effectText = `建築產出 +${Math.round(bonus * 1000) / 10}%`;
            } else if (artifact.effect.artifactDropPerRarity) {
                const bonus = getArtifactEffectValueByRarity(rarity, artifact.effect.artifactDropPerRarity);
                effectText = `神器掉落率 +${Math.round(bonus * 1000) / 10}%/秒`;
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
        if (effect.artifactRarityCapAdd) parts.push(`神器稀有度上限 +${effect.artifactRarityCapAdd}`);
        if (effect.artifactRarityCap) parts.push(`神器稀有度上限 R${effect.artifactRarityCap}`);
        if (effect.artifactDropRateAdd) parts.push(`神器掉落率 +${Math.round(effect.artifactDropRateAdd * 100)}%/秒`);
        if (effect.repeatable) parts.push("可重複購買");
        if (effect.artifactDropMult) parts.push(`神器掉落率 ×${effect.artifactDropMult}`);

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
                if (artifact.effect.globalMultPerRarity) scalingText = `全域產出係數 ${artifact.effect.globalMultPerRarity}/單位`;
                if (artifact.effect.clickAddPerRarity) scalingText = `點擊基礎係數 ${artifact.effect.clickAddPerRarity}/單位`;
                if (artifact.effect.buildingMultPerRarity) scalingText = `建築產出係數 ${artifact.effect.buildingMultPerRarity}/單位`;
                if (artifact.effect.artifactDropPerRarity) scalingText = `神器掉落率係數 ${artifact.effect.artifactDropPerRarity}/單位`;
                if (artifact.effect.starSpawnPerRarity || artifact.effect.starRewardPerRarity) {
                    scalingText = `流星機率係數 ${artifact.effect.starSpawnPerRarity || 0} / 流星獎勵係數 ${
                        artifact.effect.starRewardPerRarity || 0
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
                noteEl.textContent = `Lv.${repeatableRarityMeta.level} · 下一級上限 R${repeatableRarityMeta.nextCap}${
                    repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
                }`;
            } else if (noteEl && repeatableDropMeta) {
                noteEl.textContent = `Lv.${repeatableDropMeta.level} · 下一級掉率 ${repeatableDropMeta.nextRatePct}%/秒${
                    repeatablePlan ? ` · 本次 +${repeatablePlan.count} 級` : ""
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

        const buildingRows = els.buildingList.querySelectorAll("[data-building-id]");
        if (buildingRows.length === BUILDINGS.length) {
            updateBuildingRows();
        } else {
            renderBuildings();
        }

        refreshUpgrades();
        renderPrestige();
        renderArtifacts();
        renderCodex();
    }

    function renderShop() {
        renderBuildings();
        renderUpgrades();
        renderPrestige();
        renderArtifacts();
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
                lastBurstAt = Date.now();
                els.clickBtn.classList.add("idle-click-btn--pulse");
                window.clearTimeout(playManualClickVisual.pulseTimer);
                playManualClickVisual.pulseTimer = window.setTimeout(() => {
                    els.clickBtn.classList.remove("idle-click-btn--pulse");
                }, 120);
                refreshShop();
            }
        });

        renderAll();
        setupAutosave(() => state);
        tickTimer = window.setInterval(tick, TICK_MS);
    }

    init();
})();
