/**
 * War Roguelike — build tags, offer compatibility, contract risk previews.
 */
(function (global) {
    "use strict";

    /** Tags shown as "build identity" in the codex (synergy-relevant). */
    const BUILD_TAG_IDS = [
        "holy", "summon", "fire", "arcane", "shadow", "beast", "mechanical",
        "tank", "warrior", "ranger", "caster", "support", "assassin",
        "melee", "ranged", "cavalry", "frenzy", "guard", "elite"
    ];

    function armyEntries(army) {
        return army || [];
    }

    function entryUnitId(entry) {
        if (!entry) return null;
        if (typeof entry === "string") return entry;
        return entry.id || null;
    }

    function countArmyTags(army, units) {
        const counts = {};
        armyEntries(army).forEach((entry) => {
            const def = units[entryUnitId(entry)];
            if (!def) return;
            const tags = new Set([...(def.tags || []), def.role, def.range].filter(Boolean));
            tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
        });
        return counts;
    }

    function tagLabel(tag, tagsMeta) {
        return (tagsMeta && tagsMeta[tag] && tagsMeta[tag].label) || tag;
    }

    function getArmyForProfile(state) {
        if (!state) return [];
        if (state.army && state.army.length) return state.army;
        return state.ownedUnits || [];
    }

    function getBuildProfile(state, data, warState) {
        const units = (data && data.UNITS) || {};
        const synergiesDef = (data && data.SYNERGIES) || [];
        const tagsMeta = (data && data.TAGS) || {};
        const army = getArmyForProfile(state);
        const counts = countArmyTags(army, units);
        const synergies = warState ? warState.computeSynergies(army) : [];
        const activeSynTags = new Set(synergies.map((s) => s.tag));

        const nearSynergies = [];
        synergiesDef.forEach((syn) => {
            const have = counts[syn.tag] || 0;
            if (have >= syn.count || activeSynTags.has(syn.tag)) return;
            if (have > 0 && have < syn.count) {
                nearSynergies.push({
                    ...syn,
                    have,
                    need: syn.count,
                    missing: syn.count - have
                });
            }
        });
        nearSynergies.sort((a, b) => a.missing - b.missing || b.have - a.have);

        const buildTags = BUILD_TAG_IDS
            .filter((t) => (counts[t] || 0) > 0)
            .map((t) => ({
                id: t,
                label: tagLabel(t, tagsMeta),
                count: counts[t],
                activeSynergy: activeSynTags.has(t)
            }))
            .sort((a, b) => b.count - a.count || (b.activeSynergy - a.activeSynergy));

        return { counts, synergies, nearSynergies, buildTags, armySize: army.length };
    }

    function isOfferOwned(offer, state) {
        if (!offer || !state) return false;
        if (offer.kind === "artifact") return (state.artifacts || []).includes(offer.id);
        if (offer.kind === "ability") return (state.abilities || []).includes(offer.id);
        if (offer.kind === "tactic") return (state.tacticUpgrades || []).includes(offer.id);
        if (offer.kind === "unit") {
            return (state.ownedUnits || []).some((u) => entryUnitId(u) === offer.id);
        }
        return false;
    }

    function effectTargetsTag(effect, tag) {
        if (!effect || !tag) return false;
        if (effect.tag === tag) return true;
        if (Array.isArray(effect.tagEffects)) {
            return effect.tagEffects.some((te) => {
                const need = te.tags || (te.tag ? [te.tag] : []);
                return need.includes(tag);
            });
        }
        return false;
    }

    function artifactTagAffinity(artifact, counts) {
        if (!artifact || !artifact.effect) return null;
        const eff = artifact.effect;
        if (eff.tag && (counts[eff.tag] || 0) > 0) {
            return { tag: eff.tag, count: counts[eff.tag] };
        }
        const tagEffects = eff.tagEffects || [];
        for (let i = 0; i < tagEffects.length; i++) {
            const te = tagEffects[i];
            const tags = te.tags || (te.tag ? [te.tag] : []);
            for (let j = 0; j < tags.length; j++) {
                const t = tags[j];
                if ((counts[t] || 0) > 0) return { tag: t, count: counts[t] };
            }
        }
        return null;
    }

    function unitTagOverlap(unitDef, counts) {
        if (!unitDef) return [];
        const tags = new Set([...(unitDef.tags || []), unitDef.role, unitDef.range].filter(Boolean));
        const hits = [];
        tags.forEach((t) => {
            if ((counts[t] || 0) > 0) hits.push({ tag: t, count: counts[t] });
        });
        hits.sort((a, b) => b.count - a.count);
        return hits;
    }

    function synergyIfRecruited(unitDef, counts, synergiesDef) {
        if (!unitDef) return [];
        const simulated = { ...counts };
        const tags = new Set([...(unitDef.tags || []), unitDef.role, unitDef.range].filter(Boolean));
        tags.forEach((t) => { simulated[t] = (simulated[t] || 0) + 1; });
        const unlocked = [];
        (synergiesDef || []).forEach((syn) => {
            const before = counts[syn.tag] || 0;
            const after = simulated[syn.tag] || 0;
            if (before < syn.count && after >= syn.count) unlocked.push(syn);
        });
        return unlocked;
    }

    function offerCompatibilityHints(offer, state, data, warState) {
        if (!offer || !state) return [];
        const hints = [];
        const tagsMeta = (data && data.TAGS) || {};
        const units = (data && data.UNITS) || {};
        const synergiesDef = (data && data.SYNERGIES) || [];
        const profile = getBuildProfile(state, data, warState);
        const { counts } = profile;

        if (isOfferOwned(offer, state)) {
            hints.push({ tone: "muted", text: "已擁有" });
            return hints;
        }

        if (offer.kind === "artifact") {
            const art = (data.ARTIFACTS || []).find((a) => a.id === offer.id);
            const aff = artifactTagAffinity(art, counts);
            if (aff) {
                hints.push({
                    tone: "good",
                    text: `相性佳 · 隊伍 [${tagLabel(aff.tag, tagsMeta)}]×${aff.count}`
                });
            }
        } else if (offer.kind === "ability") {
            const ab = (data.ABILITIES || []).find((a) => a.id === offer.id);
            if (ab && ab.effect) {
                const keys = Object.keys(ab.effect);
                if (keys.includes("atkAll") || keys.includes("hpAll")) {
                    hints.push({ tone: "good", text: "相性佳 · 全隊加成" });
                }
            }
        } else if (offer.kind === "unit") {
            const def = units[offer.id];
            const overlap = unitTagOverlap(def, counts);
            if (overlap.length) {
                const top = overlap[0];
                hints.push({
                    tone: "good",
                    text: `相性佳 · 已有 [${tagLabel(top.tag, tagsMeta)}]×${top.count}`
                });
            }
            const syn = synergyIfRecruited(def, counts, synergiesDef);
            if (syn.length) {
                hints.push({
                    tone: "great",
                    text: `招募後觸發：${syn.map((s) => s.name).join("、")}`
                });
            }
        } else if (offer.kind === "tactic") {
            hints.push({ tone: "good", text: "戰術升級 · 永久強化" });
        }

        profile.nearSynergies.slice(0, 1).forEach((near) => {
            if (offer.kind === "unit") {
                const def = units[offer.id];
                if (def && (def.tags || []).includes(near.tag)) {
                    hints.push({
                        tone: "great",
                        text: `再招 ${near.missing} 個 [${tagLabel(near.tag, tagsMeta)}] → ${near.name}`
                    });
                }
            }
        });

        return hints;
    }

    function shopItemHints(item, state, data, warState) {
        if (!item || !state) return [];
        const hints = [];
        const profile = getBuildProfile(state, data, warState);
        const tagsMeta = (data && data.TAGS) || {};
        const topTag = profile.buildTags[0];

        if (item.type === "unit" || item.effect?.recruit) {
            hints.push({ tone: "good", text: "擴充部隊" });
            if (topTag) {
                hints.push({
                    tone: "muted",
                    text: `目前主力 [${topTag.label}]×${topTag.count}`
                });
            }
        } else if (item.type === "artifact") {
            const unowned = (data.ARTIFACTS || []).filter((a) => !(state.artifacts || []).includes(a.id));
            hints.push({
                tone: unowned.length ? "good" : "muted",
                text: unowned.length ? `隨機神器（尚餘 ${unowned.length} 種）` : "神器已集齊"
            });
        } else if (item.type === "ability") {
            const unowned = (data.ABILITIES || []).filter((a) => !(state.abilities || []).includes(a.id));
            hints.push({
                tone: unowned.length ? "good" : "muted",
                text: unowned.length ? `隨機能力（尚餘 ${unowned.length} 種）` : "能力已集齊"
            });
        } else if (item.type === "upgrade") {
            hints.push({ tone: "good", text: "本局全隊攻擊 +3" });
        } else if (item.type === "exp") {
            hints.push({ tone: "good", text: "隨機單位 +5 經驗" });
        }

        if (topTag && topTag.activeSynergy && (item.type === "unit" || item.effect?.recruit)) {
            hints.push({ tone: "great", text: `可強化 ${topTag.label} 流派` });
        }
        return hints;
    }

    function contractRiskPreview(contract, data) {
        if (!contract) return { risks: [], benefits: [], lines: [] };
        const eff = contract.effect || {};
        const elite = (data && data.ELITE_AFFIXES) || [];
        const tagsMeta = (data && data.TAGS) || {};
        const risks = [];
        const benefits = [];
        const rooms = contract.rooms != null ? contract.rooms : "?";

        const onlyTag = eff.onlyFightTag || (Array.isArray(eff.onlyFightTags) ? eff.onlyFightTags[0] : null);
        if (onlyTag) {
            risks.push(`下 ${rooms} 場僅 [${tagLabel(onlyTag, tagsMeta)}] 單位可出戰`);
        }
        if (eff.forceEnemyAffix) {
            const aff = elite.find((a) => a.id === eff.forceEnemyAffix);
            risks.push(`敵軍強制「${aff ? aff.name : eff.forceEnemyAffix}」詞綴（${rooms} 場）`);
        }
        if (eff.noSkills) risks.push(`下 ${rooms} 場友軍無法施放技能`);

        if (eff.startShield) benefits.push(`開場護盾 ${eff.startShield}`);
        if (eff.goldMult && eff.goldMult > 1) {
            benefits.push(`戰鬥金幣 ×${eff.goldMult}（${rooms} 場）`);
        }
        if (eff.goldAfter) benefits.push(`每場戰鬥後 +${eff.goldAfter} 金`);
        if (eff.shopDiscount) benefits.push(`商店價格 -${Math.round(eff.shopDiscount * 100)}%（${rooms} 場）`);
        if (eff.rewardRarityBoost && eff.rewardRarityBoost > 1) {
            benefits.push(`獎勵稀有度提升（約 ×${eff.rewardRarityBoost}）`);
        }
        if (eff.treasureMult && eff.treasureMult > 1) benefits.push(`寶藏金幣 ×${eff.treasureMult}`);
        if (eff.hpAll) benefits.push(`全隊 HP +${eff.hpAll}`);
        if (eff.atkAll) benefits.push(`全隊攻擊 +${eff.atkAll}`);
        if (eff.spdMult && eff.spdMult > 1) benefits.push(`全隊攻速 ×${eff.spdMult}`);

        const lines = [];
        risks.forEach((r) => lines.push({ tone: "risk", text: r }));
        benefits.forEach((b) => lines.push({ tone: "benefit", text: b }));
        if (contract.desc && !lines.length) {
            lines.push({ tone: "muted", text: contract.desc });
        }
        return { risks, benefits, lines };
    }

    function choiceContractPreview(choice, data) {
        const contract = choice?.reward?.contract;
        if (!contract) return null;
        return contractRiskPreview(contract, data);
    }

    function hintsHtml(hints) {
        if (!hints || !hints.length) return "";
        return `<div class="war-offer-hints">${hints.map((h) => {
            const cls = h.tone ? `war-offer-hint war-offer-hint--${h.tone}` : "war-offer-hint";
            return `<span class="${cls}">${h.text}</span>`;
        }).join("")}</div>`;
    }

    function buildTagsHtml(profile, tagsMeta) {
        if (!profile || !profile.buildTags.length) {
            return `<p class="war-hint">出戰單位會決定本局 build 標籤與協同。</p>`;
        }
        const chips = profile.buildTags.slice(0, 10).map((t) => {
            const syn = t.activeSynergy ? " war-build-tag--active" : "";
            return `<span class="war-build-tag${syn}" title="${t.count} 名帶有此標籤">${t.label}×${t.count}</span>`;
        }).join("");
        let near = "";
        if (profile.nearSynergies.length) {
            const n = profile.nearSynergies[0];
            near = `<p class="war-hint war-build-near">再 ${n.missing} 個 [${tagLabel(n.tag, tagsMeta)}] → ${n.name}</p>`;
        }
        const synList = profile.synergies.length
            ? `<p class="war-hint war-build-synergy">已觸發：${profile.synergies.map((s) => s.name).join("、")}</p>`
            : "";
        return `<div class="war-build-tags">${chips}</div>${synList}${near}`;
    }

    function contractPreviewHtml(preview) {
        if (!preview || !preview.lines.length) return "";
        return `<div class="war-contract-preview">${preview.lines.map((l) => {
            const cls = l.tone === "risk" ? "war-contract-preview--risk"
                : l.tone === "benefit" ? "war-contract-preview--benefit" : "war-contract-preview--muted";
            const icon = l.tone === "risk" ? "⚠ " : l.tone === "benefit" ? "✓ " : "";
            return `<span class="war-contract-preview-line ${cls}">${icon}${l.text}</span>`;
        }).join("")}</div>`;
    }

    global.WarBuildHints = {
        BUILD_TAG_IDS,
        getArmyForProfile,
        getBuildProfile,
        isOfferOwned,
        offerCompatibilityHints,
        shopItemHints,
        contractRiskPreview,
        choiceContractPreview,
        hintsHtml,
        buildTagsHtml,
        contractPreviewHtml,
        tagLabel
    };
})(typeof window !== "undefined" ? window : globalThis);
