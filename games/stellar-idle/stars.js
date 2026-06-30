(() => {
    const { SHOOTING_STAR, UPGRADES } = window.IdleData;

    let layer = null;
    let activeStars = [];
    let lastSpawnAt = 0;
    let spawnCheckAccumulator = 0;
    let hasUpgrade = () => false;
    let getClickMultiplier = () => 1;
    let getArtifactStarBonuses = () => ({ spawnMult: 1, rewardMult: 1 });
    let addCrystals = () => {};
    let onCatch = () => {};
    let formatShort = (n) => String(n);

    function isUnlocked() {
        return UPGRADES.some((upgrade) => upgrade.effect?.starUnlock && hasUpgrade(upgrade.id));
    }

    function getSpawnMultiplier() {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "star") {
                return;
            }
            if (upgrade.effect.starSpawnMult) {
                mult *= upgrade.effect.starSpawnMult;
            }
        });
        const artifactBonuses = getArtifactStarBonuses();
        mult *= artifactBonuses.spawnMult || 1;
        return mult;
    }

    function getRewardMultiplier() {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "star") {
                return;
            }
            if (upgrade.effect.starRewardMult) {
                mult *= upgrade.effect.starRewardMult;
            }
        });
        const artifactBonuses = getArtifactStarBonuses();
        mult *= artifactBonuses.rewardMult || 1;
        return mult;
    }

    function getDurationMultiplier() {
        let mult = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "star") {
                return;
            }
            if (upgrade.effect.starDurationMult) {
                mult *= upgrade.effect.starDurationMult;
            }
        });
        return mult;
    }

    function getRewardAmount() {
        const seconds = SHOOTING_STAR.baseRewardSeconds * getRewardMultiplier();
        return Math.max(1, Math.floor(getClickMultiplier() * seconds));
    }

    function getMaxActiveStars() {
        let maxActive = 1;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "star") {
                return;
            }
            if (upgrade.effect.starMaxActiveSet) {
                maxActive = Math.max(maxActive, upgrade.effect.starMaxActiveSet);
            }
            if (upgrade.effect.starMaxActiveAdd) {
                maxActive += upgrade.effect.starMaxActiveAdd;
            }
        });
        return Math.max(1, Math.floor(maxActive));
    }

    function getMinGapMs() {
        let gap = SHOOTING_STAR.minGapMs;
        UPGRADES.forEach((upgrade) => {
            if (!hasUpgrade(upgrade.id) || upgrade.type !== "star") {
                return;
            }
            if (upgrade.effect.starMinGapMult) {
                gap *= upgrade.effect.starMinGapMult;
            }
        });
        return Math.max(800, Math.floor(gap));
    }

    function removeActiveStar(starRecord) {
        if (!starRecord) {
            return;
        }
        window.clearTimeout(starRecord.timeoutId);
        activeStars = activeStars.filter((item) => item !== starRecord);
    }

    function dismissActive() {
        activeStars.forEach((starRecord) => {
            window.clearTimeout(starRecord.timeoutId);
            starRecord.element.remove();
        });
        activeStars = [];
    }

    function catchStar(event) {
        event.preventDefault();
        event.stopPropagation();

        const starEl = event.currentTarget;
        if (!starEl) {
            return;
        }

        const starRecord = activeStars.find((item) => item.element === starEl);
        if (!starRecord) {
            return;
        }

        const reward = getRewardAmount();
        removeActiveStar(starRecord);

        // Freeze at current on-screen position before playing caught animation.
        const starRect = starEl.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        const centerX = starRect.left - layerRect.left + starRect.width / 2;
        const centerY = starRect.top - layerRect.top + starRect.height / 2;
        starEl.style.animation = "none";
        starEl.style.left = `${centerX}px`;
        starEl.style.top = `${centerY}px`;
        starEl.style.setProperty("--x0", `${centerX}px`);
        starEl.style.setProperty("--y0", `${centerY}px`);

        starEl.classList.add("idle-shooting-star--caught");
        starEl.style.pointerEvents = "none";
        window.setTimeout(() => starEl.remove(), 380);

        addCrystals(reward);
        onCatch(reward);
    }

    function spawnStar() {
        if (!layer || !isUnlocked() || activeStars.length >= getMaxActiveStars()) {
            return;
        }

        const rect = layer.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) {
            return;
        }

        const margin = 24;
        const paths = [
            { x0: -margin, y0: Math.random() * rect.height, x1: rect.width + margin, y1: Math.random() * rect.height },
            { x0: rect.width + margin, y0: Math.random() * rect.height, x1: -margin, y1: Math.random() * rect.height },
            { x0: Math.random() * rect.width, y0: -margin, x1: Math.random() * rect.width, y1: rect.height + margin },
            { x0: Math.random() * rect.width, y0: rect.height + margin, x1: Math.random() * rect.width, y1: -margin }
        ];
        const path = paths[Math.floor(Math.random() * paths.length)];
        const durationMs = Math.round(SHOOTING_STAR.baseDurationMs * getDurationMultiplier());
        const dx = path.x1 - path.x0;
        const dy = path.y1 - path.y0;
        const distance = Math.hypot(dx, dy);
        const duration = Math.max(durationMs, Math.round((distance / SHOOTING_STAR.speedPxPerSec) * 1000));

        const star = document.createElement("button");
        star.type = "button";
        star.className = "idle-shooting-star";
        star.setAttribute("aria-label", "捕獲流星");
        star.innerHTML = '<span class="idle-shooting-star-icon" aria-hidden="true">☆</span><span class="idle-shooting-star-trail" aria-hidden="true"></span>';

        star.style.setProperty("--x0", `${path.x0}px`);
        star.style.setProperty("--y0", `${path.y0}px`);
        star.style.setProperty("--x1", `${path.x1}px`);
        star.style.setProperty("--y1", `${path.y1}px`);
        star.style.setProperty("--fly-duration", `${duration}ms`);

        star.addEventListener("pointerdown", catchStar);
        star.addEventListener("click", catchStar);

        layer.appendChild(star);
        requestAnimationFrame(() => star.classList.add("idle-shooting-star--active"));

        const starRecord = { element: star, timeoutId: 0 };
        const timeoutId = window.setTimeout(() => {
            if (!activeStars.includes(starRecord)) {
                return;
            }
            star.classList.add("idle-shooting-star--missed");
            removeActiveStar(starRecord);
            window.setTimeout(() => {
                star.remove();
            }, 200);
        }, duration + 50);

        starRecord.timeoutId = timeoutId;
        activeStars.push(starRecord);
        lastSpawnAt = Date.now();
    }

    function tick(deltaMs) {
        if (!isUnlocked()) {
            return;
        }

        const now = Date.now();
        if (now - lastSpawnAt < getMinGapMs()) {
            return;
        }

        spawnCheckAccumulator += deltaMs / 1000;
        if (spawnCheckAccumulator < 1) {
            return;
        }

        const checks = Math.floor(spawnCheckAccumulator);
        spawnCheckAccumulator -= checks;
        const chance = SHOOTING_STAR.baseSpawnChancePerSec * getSpawnMultiplier();
        const maxActive = getMaxActiveStars();

        for (let i = 0; i < checks; i++) {
            if (activeStars.length >= maxActive) {
                break;
            }
            if (Math.random() < chance) {
                spawnStar();
            }
        }
    }

    function init(deps) {
        layer = deps.layer;
        hasUpgrade = deps.hasUpgrade;
        getClickMultiplier = deps.getClickMultiplier;
        getArtifactStarBonuses = deps.getArtifactStarBonuses || getArtifactStarBonuses;
        addCrystals = deps.addCrystals;
        onCatch = deps.onCatch;
        formatShort = deps.formatShort;
    }

    function reset() {
        dismissActive();
        lastSpawnAt = 0;
        spawnCheckAccumulator = 0;
    }

    window.IdleStars = {
        init,
        tick,
        reset,
        dismissActive,
        isUnlocked,
        getRewardAmount
    };
})();
