/**
 * War Roguelike — reward / recruit UI module.
 */
(function (global) {
    "use strict";

    const C = () => global.WarCtx;
    const bridge = () => global.WarAppBridge || {};

    function showUnitRecruitScreen() {
        const ctx = C();
        ctx.pendingRewardType = "unit";
        ctx.pendingRewardSource = "unit";
        showRewardScreen();
    }

    function resolveRewardPick(source) {
        const ctx = C();
        const b = bridge();
        const { WarState, getNode } = b;
        const state = ctx.state;
        if (source === "treasure") {
            const bonus = WarState.treasureBonusGold(state);
            if (bonus > 0) WarState.addGold(state, bonus);
            b.finishRoom();
            return;
        }
        if (source === "boss" || getNode(state.map, state.map.currentNodeId)?.type === "boss") {
            const adv = WarState.advanceWorld(state);
            if (adv && adv.endless) {
                b.showRoomMessage(
                    `通過第 ${state.endlessStages || 0} 關`,
                    `進入第 ${adv.loop} 環（僅史詩戰與 Boss，無獎勵）。目前最佳：${WarState.getEndlessBest()} 關`,
                    () => {
                        state.phase = "map";
                        b.showScreen("map");
                        b.renderMap();
                        WarState.saveGame(state);
                    }
                );
                return;
            }
            if (adv && adv.victory) {
                WarState.saveGame(state);
                b.showScreen("victory");
                return;
            }
            b.showRoomMessage("世界完成！", `進入 ${WarState.getActiveWorld(state).name}！獲得 40 金幣補給。`, () => {
                state.phase = "map";
                b.showScreen("map");
                b.renderMap();
                WarState.saveGame(state);
            });
            return;
        }
        if (source === "combat" || source === "epic_combat") {
            showUnitRecruitScreen();
            return;
        }
        b.finishRoom();
    }

    function showRewardScreen(opts) {
        const ctx = C();
        const b = bridge();
        const { WarState, WarData, WarBuildHints, UNITS } = b;
        const state = ctx.state;
        const $ = ctx.$;

        const isFresh = !(opts && opts.refresh);
        if (isFresh) {
            ctx.rewardRefreshLeft = 1;
            ctx.currentRewardOffers = [];
        }

        const excludeIds = (opts && opts.excludeIds) || [];
        let offers = WarState.offerRewards(state, ctx.pendingRewardType, excludeIds);
        if (!offers.length && excludeIds.length) {
            offers = WarState.offerRewards(state, ctx.pendingRewardType, []);
        }
        const skipBtn = $("rewardSkipBtn");
        const refreshBtn = $("rewardRefreshBtn");
        const allowSkip = ctx.pendingRewardSource === "unit";

        if (!offers.length) {
            if (ctx.pendingRewardSource === "treasure") {
                ctx.pendingRewardSource = null;
                const result = WarState.resolveTreasure(state);
                b.showRoomMessage("寶藏房", result.text, () => b.finishRoom());
                return;
            }
            if (allowSkip || ctx.pendingRewardSource === "unit") {
                ctx.pendingRewardSource = null;
                skipBtn.hidden = true;
                refreshBtn.hidden = true;
                b.finishRoom();
                return;
            }
            ctx.pendingRewardSource = null;
            skipBtn.hidden = true;
            refreshBtn.hidden = true;
            b.finishRoom();
            return;
        }

        ctx.currentRewardOffers = offers;

        const titleEl = $("screenReward").querySelector(".war-screen-title");
        const hintEl = $("screenReward").querySelector(".war-hint");
        if (ctx.pendingRewardSource === "treasure") {
            titleEl.textContent = "寶藏房";
            hintEl.textContent = "三選一神器 · 另附少量金幣 · 可刷新一次";
        } else if (ctx.pendingRewardSource === "unit") {
            titleEl.textContent = "招募單位";
            hintEl.textContent = "三選一加入部隊 · 可刷新一次 · 也可跳過";
        } else if (ctx.pendingRewardSource === "epic") {
            titleEl.textContent = "史詩秘庫";
            hintEl.textContent = "高稀有獎勵 · 可刷新一次";
        } else if (ctx.pendingRewardSource === "epic_combat") {
            titleEl.textContent = "史詩戰利品";
            hintEl.textContent = "高稀有戰利品 · 可刷新一次";
        } else {
            titleEl.textContent = "選擇獎勵";
            hintEl.textContent = "三選一 · 可刷新一次 · 稀有度越高效果越強";
        }

        skipBtn.hidden = !allowSkip;
        skipBtn.onclick = () => {
            ctx.pendingRewardSource = null;
            skipBtn.hidden = true;
            refreshBtn.hidden = true;
            b.finishRoom();
        };

        refreshBtn.hidden = ctx.rewardRefreshLeft <= 0;
        refreshBtn.textContent = ctx.rewardRefreshLeft > 0 ? `刷新選項（剩 ${ctx.rewardRefreshLeft}）` : "刷新選項";
        refreshBtn.onclick = () => {
            if (ctx.rewardRefreshLeft <= 0) return;
            ctx.rewardRefreshLeft -= 1;
            const exclude = ctx.currentRewardOffers.map((o) => o.id).filter(Boolean);
            showRewardScreen({ refresh: true, excludeIds: exclude });
        };

        const grid = $("rewardGrid");
        grid.innerHTML = "";
        offers.forEach((offer) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = `war-reward-card war-reward-card--${offer.rarity || "common"}${offer.cursed ? " war-reward-card--cursed" : ""}`;
            if (offer.kind === "unit") card.classList.add("war-reward-card--unit");
            const kindLabel = offer.kind === "artifact" ? (offer.cursed ? "詛咒神器" : "神器")
                : offer.kind === "ability" ? "能力"
                    : offer.kind === "unit" ? "單位"
                        : offer.kind === "tactic" ? "戰術升級" : "獎勵";
            const unitDef = offer.kind === "unit" ? UNITS[offer.id] : null;
            const body = unitDef
                ? b.unitRewardBodyHtml(unitDef)
                : `<p>${offer.desc || ""}</p>`;
            const title = unitDef
                ? `${unitDef.icon || ""} ${unitDef.name}`.trim()
                : offer.name;
            const compatHints = WarBuildHints.offerCompatibilityHints(offer, state, WarData, WarState);
            card.innerHTML = `
                <span class="war-reward-rarity">${offer.rarityLabel || offer.rarity || "普通"} · ${kindLabel}</span>
                <h3>${title}</h3>
                ${body}
                ${WarBuildHints.hintsHtml(compatHints)}
            `;
            card.addEventListener("click", () => {
                const applied = WarState.applyReward(state, offer);
                const source = ctx.pendingRewardSource;
                ctx.pendingRewardSource = null;
                skipBtn.hidden = true;
                refreshBtn.hidden = true;
                const grants = (applied && applied.grantMessages) || [];
                if (grants.length) {
                    b.showRoomMessage("神器賜福", grants.join("；"), () => resolveRewardPick(source));
                } else {
                    resolveRewardPick(source);
                }
            });
            grid.appendChild(card);
        });
        b.showScreen("reward");
    }

    global.WarUIReward = {
        showRewardScreen,
        resolveRewardPick,
        showUnitRecruitScreen
    };
})(typeof window !== "undefined" ? window : globalThis);
