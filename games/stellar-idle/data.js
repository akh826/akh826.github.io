(() => {
    const BASE_CLICK = 1;

    const BUILDINGS = [
        {
            id: "probe",
            name: "探測器",
            description: "掃描星域，發現微量星晶。",
            baseCost: 15n,
            baseCps: 0.1
        },
        {
            id: "mine",
            name: "採礦站",
            description: "在隕石帶穩定開採星晶。",
            baseCost: 100n,
            baseCps: 1
        },
        {
            id: "refinery",
            name: "精煉廠",
            description: "提純粗礦，提升產出效率。",
            baseCost: 1100n,
            baseCps: 8
        },
        {
            id: "orbital",
            name: "軌道收集器",
            description: "環繞恆星軌道，持續收集能量。",
            baseCost: 12000n,
            baseCps: 47
        },
        {
            id: "rift",
            name: "次元裂隙",
            description: "撕裂時空，湧出巨量星晶。",
            baseCost: 130000n,
            baseCps: 260
        },
        {
            id: "dyson",
            name: "戴森環核",
            description: "封裝恆星能量，產出爆發式成長。",
            baseCost: 2500000n,
            baseCps: 1400
        },
        {
            id: "singularity",
            name: "奇點熔爐",
            description: "壓縮重力井，釋放高維星晶流。",
            baseCost: 45000000n,
            baseCps: 7800
        },
        {
            id: "cosmic_archive",
            name: "宇宙檔案塔",
            description: "解析古代宇宙記錄，穩定提煉超量星晶。",
            baseCost: 900000000n,
            baseCps: 42000
        }
    ];

    const UPGRADES = [
        {
            id: "click_1",
            name: "強化手套",
            description: "每次手動採集 +1 星晶。",
            type: "click",
            cost: 25n,
            unlock: { lifetime: 0n },
            effect: { clickAdd: 1 }
        },
        {
            id: "click_1b",
            name: "探礦慣用手",
            description: "每次手動採集 +1 星晶。",
            type: "click",
            cost: 70n,
            unlock: { lifetime: 20n },
            effect: { clickAdd: 1 }
        },
        {
            id: "click_1c",
            name: "微光收集器",
            description: "每次手動採集 +2 星晶。",
            type: "click",
            cost: 175n,
            unlock: { lifetime: 60n },
            effect: { clickAdd: 2 }
        },
        {
            id: "click_2",
            name: "共振觸媒",
            description: "每次手動採集 +2 星晶。",
            type: "click",
            cost: 400n,
            unlock: { lifetime: 150n },
            effect: { clickAdd: 2 }
        },
        {
            id: "click_2b",
            name: "晶體粉碎爪",
            description: "每次手動採集 +3 星晶。",
            type: "click",
            cost: 850n,
            unlock: { lifetime: 350n },
            effect: { clickAdd: 3 }
        },
        {
            id: "click_2c",
            name: "高能採集臂",
            description: "每次手動採集 +5 星晶。",
            type: "click",
            cost: 1800n,
            unlock: { lifetime: 750n },
            effect: { clickAdd: 5 }
        },
        {
            id: "click_2d",
            name: "星屑篩網",
            description: "每次手動採集 +8 星晶。",
            type: "click",
            cost: 3200n,
            unlock: { lifetime: 1400n },
            effect: { clickAdd: 8 }
        },
        {
            id: "click_mult_1",
            name: "迅捷指環",
            description: "點擊收益 ×1.5。",
            type: "click",
            cost: 2800n,
            unlock: { lifetime: 1200n },
            effect: { clickMult: 1.5 }
        },
        {
            id: "click_hold",
            name: "持續採集模組",
            description: "按住左鍵可連續採集星晶；首次轉生後永久啟用，無需重複購買。",
            type: "click",
            cost: 2200n,
            unlock: { lifetime: 700n },
            effect: { holdClick: true }
        },
        {
            id: "click_3",
            name: "雙擊脈衝",
            description: "點擊收益 ×2。",
            type: "click",
            cost: 7000n,
            unlock: { lifetime: 3800n },
            effect: { clickMult: 2 }
        },
        {
            id: "click_3b",
            name: "星爆連擊",
            description: "每次手動採集 +12 星晶。",
            type: "click",
            cost: 11000n,
            unlock: { lifetime: 6500n },
            effect: { clickAdd: 12 }
        },
        {
            id: "click_auto",
            name: "自律探測核心",
            description: "自動模擬手動採集，每秒 1 次（收益等同點擊力），可與手動點擊疊加。",
            type: "click",
            cost: 13000n,
            unlock: { lifetime: 6000n },
            effect: { autoClickRate: 1 }
        },
        {
            id: "click_auto_2",
            name: "雙核探測器",
            description: "自動採集頻率 +1/秒。",
            type: "click",
            cost: 35000n,
            unlock: { lifetime: 15000n, requires: ["click_auto"] },
            effect: { autoClickRate: 1 }
        },
        {
            id: "click_auto_3",
            name: "量子並行模組",
            description: "自動採集頻率 +2/秒。",
            type: "click",
            cost: 90000n,
            unlock: { lifetime: 45000n, requires: ["click_auto_2"] },
            effect: { autoClickRate: 2 }
        },
        {
            id: "click_auto_4",
            name: "神經採集網",
            description: "自動採集頻率 +3/秒。",
            type: "click",
            cost: 250000n,
            unlock: { lifetime: 120000n, requires: ["click_auto_3"] },
            effect: { autoClickRate: 3 }
        },
        {
            id: "click_auto_5",
            name: "恆星自律矩陣",
            description: "自動採集頻率 +5/秒。",
            type: "click",
            cost: 750000n,
            unlock: { lifetime: 350000n, requires: ["click_auto_4"] },
            effect: { autoClickRate: 5 }
        },
        {
            id: "click_auto_6",
            name: "次元自動脈衝",
            description: "自動採集頻率 +8/秒。",
            type: "click",
            cost: 2500000n,
            unlock: { lifetime: 900000n, requires: ["click_auto_5"] },
            effect: { autoClickRate: 8 }
        },
        {
            id: "click_mult_2",
            name: "狂熱敲擊",
            description: "點擊收益 ×1.5。",
            type: "click",
            cost: 20000n,
            unlock: { lifetime: 11000n },
            effect: { clickMult: 1.5 }
        },
        {
            id: "click_3c",
            name: "脈衝放大器",
            description: "每次手動採集 +25 星晶。",
            type: "click",
            cost: 45000n,
            unlock: { lifetime: 25000n },
            effect: { clickAdd: 25 }
        },
        {
            id: "star_unlock",
            name: "流星觀測站",
            description: "解鎖劃過畫面的流星；點擊捕獲可獲得大量星晶。",
            type: "star",
            cost: 8000n,
            unlock: { lifetime: 3500n },
            effect: { starUnlock: true }
        },
        {
            id: "star_spawn_1",
            name: "星象雷達",
            description: "流星出現機率 ×1.5。",
            type: "star",
            cost: 25000n,
            unlock: { lifetime: 12000n, requires: ["star_unlock"] },
            effect: { starSpawnMult: 1.5 }
        },
        {
            id: "star_spawn_2",
            name: "廣域掃描陣",
            description: "流星出現機率 ×2。",
            type: "star",
            cost: 120000n,
            unlock: { lifetime: 60000n, requires: ["star_spawn_1"] },
            effect: { starSpawnMult: 2 }
        },
        {
            id: "star_reward_1",
            name: "星晶收缴器",
            description: "捕獲流星獎勵 ×2。",
            type: "star",
            cost: 45000n,
            unlock: { lifetime: 22000n, requires: ["star_unlock"] },
            effect: { starRewardMult: 2 }
        },
        {
            id: "star_reward_2",
            name: "超新星捕獲網",
            description: "捕獲流星獎勵 ×3。",
            type: "star",
            cost: 300000n,
            unlock: { lifetime: 150000n, requires: ["star_reward_1"] },
            effect: { starRewardMult: 3 }
        },
        {
            id: "star_duration_1",
            name: "緩時力場",
            description: "流星停留時間 +50%，更容易點中。",
            type: "star",
            cost: 18000n,
            unlock: { lifetime: 9000n, requires: ["star_unlock"] },
            effect: { starDurationMult: 1.5 }
        },
        {
            id: "star_duration_2",
            name: "時域扭曲環",
            description: "流星停留時間再 +70%。",
            type: "star",
            cost: 280000n,
            unlock: { lifetime: 120000n, requires: ["star_duration_1"] },
            effect: { starDurationMult: 1.7 }
        },
        {
            id: "star_spawn_3",
            name: "星海預測引擎",
            description: "流星出現機率 ×2.5。",
            type: "star",
            cost: 900000n,
            unlock: { lifetime: 350000n, requires: ["star_spawn_2"] },
            effect: { starSpawnMult: 2.5 }
        },
        {
            id: "star_reward_3",
            name: "引力透鏡捕獲器",
            description: "捕獲流星獎勵 ×2.5。",
            type: "star",
            cost: 1200000n,
            unlock: { lifetime: 450000n, requires: ["star_reward_2"] },
            effect: { starRewardMult: 2.5 }
        },
        {
            id: "star_multi_1",
            name: "雙流星協議",
            description: "允許同時存在 2 顆流星。",
            type: "star",
            cost: 1800000n,
            unlock: { lifetime: 700000n, requires: ["star_spawn_3", "star_duration_2"] },
            effect: { starMaxActiveAdd: 1 }
        },
        {
            id: "star_multi_2",
            name: "流星雨信標",
            description: "允許同時存在 3 顆流星，且最小間隔縮短。",
            type: "star",
            cost: 6500000n,
            unlock: { lifetime: 1800000n, requires: ["star_multi_1", "star_reward_3"] },
            effect: { starMaxActiveAdd: 1, starMinGapMult: 0.6 }
        },
        {
            id: "probe_eff_1",
            name: "探測器校準",
            description: "探測器產出 +50%。",
            type: "building",
            buildingId: "probe",
            cost: 250n,
            unlock: { building: { probe: 5 } },
            effect: { buildingMult: 1.5 }
        },
        {
            id: "probe_eff_2",
            name: "探測器自適應晶片",
            description: "探測器產出再 +200%。",
            type: "building",
            buildingId: "probe",
            cost: 1800000n,
            unlock: { building: { probe: 75 }, requires: ["probe_eff_1"] },
            effect: { buildingMult: 3 }
        },
        {
            id: "mine_eff_1",
            name: "採礦雷射",
            description: "採礦站產出 +50%。",
            type: "building",
            buildingId: "mine",
            cost: 2000n,
            unlock: { building: { mine: 5 } },
            effect: { buildingMult: 1.5 }
        },
        {
            id: "mine_eff_2",
            name: "反物質鑽頭",
            description: "採礦站產出再 +200%。",
            type: "building",
            buildingId: "mine",
            cost: 2200000n,
            unlock: { building: { mine: 70 }, requires: ["mine_eff_1"] },
            effect: { buildingMult: 3 }
        },
        {
            id: "refinery_eff_1",
            name: "高效精煉",
            description: "精煉廠產出 +100%。",
            type: "building",
            buildingId: "refinery",
            cost: 25000n,
            unlock: { building: { refinery: 5 } },
            effect: { buildingMult: 2 }
        },
        {
            id: "refinery_eff_2",
            name: "超導精煉鏈",
            description: "精煉廠產出再 +250%。",
            type: "building",
            buildingId: "refinery",
            cost: 3500000n,
            unlock: { building: { refinery: 60 }, requires: ["refinery_eff_1"] },
            effect: { buildingMult: 3.5 }
        },
        {
            id: "global_1",
            name: "星際協議",
            description: "所有產出 ×1.25。",
            type: "global",
            cost: 5000n,
            unlock: { lifetime: 3000n },
            effect: { globalMult: 1.25 }
        },
        {
            id: "global_2",
            name: "量子增幅",
            description: "所有產出 ×1.5。",
            type: "global",
            cost: 100000n,
            unlock: { lifetime: 50000n },
            effect: { globalMult: 1.5 }
        },
        {
            id: "orbital_eff_1",
            name: "軌道同步",
            description: "軌道收集器產出 +100%。",
            type: "building",
            buildingId: "orbital",
            cost: 150000n,
            unlock: { building: { orbital: 5 } },
            effect: { buildingMult: 2 }
        },
        {
            id: "orbital_eff_2",
            name: "日冕收束陣",
            description: "軌道收集器產出再 +250%。",
            type: "building",
            buildingId: "orbital",
            cost: 5200000n,
            unlock: { building: { orbital: 45 }, requires: ["orbital_eff_1"] },
            effect: { buildingMult: 3.5 }
        },
        {
            id: "rift_eff_1",
            name: "裂隙穩定器",
            description: "次元裂隙產出 +100%。",
            type: "building",
            buildingId: "rift",
            cost: 500000n,
            unlock: { building: { rift: 5 } },
            effect: { buildingMult: 2 }
        },
        {
            id: "rift_eff_2",
            name: "裂隙回授核心",
            description: "次元裂隙產出再 +300%。",
            type: "building",
            buildingId: "rift",
            cost: 8500000n,
            unlock: { building: { rift: 35 }, requires: ["rift_eff_1"] },
            effect: { buildingMult: 4 }
        },
        {
            id: "dyson_eff_1",
            name: "環核相位對準",
            description: "戴森環核產出 +150%。",
            type: "building",
            buildingId: "dyson",
            cost: 28000000n,
            unlock: { building: { dyson: 8 }, requires: ["global_3"] },
            effect: { buildingMult: 2.5 }
        },
        {
            id: "dyson_eff_2",
            name: "恆星汲能網",
            description: "戴森環核產出再 +300%。",
            type: "building",
            buildingId: "dyson",
            cost: 160000000n,
            unlock: { building: { dyson: 30 }, requires: ["dyson_eff_1"] },
            effect: { buildingMult: 4 }
        },
        {
            id: "singularity_eff_1",
            name: "奇點壓縮閥",
            description: "奇點熔爐產出 +200%。",
            type: "building",
            buildingId: "singularity",
            cost: 450000000n,
            unlock: { building: { singularity: 6 }, requires: ["dyson_eff_1"] },
            effect: { buildingMult: 3 }
        },
        {
            id: "singularity_eff_2",
            name: "事件視界擴增器",
            description: "奇點熔爐產出再 +350%。",
            type: "building",
            buildingId: "singularity",
            cost: 2800000000n,
            unlock: { building: { singularity: 18 }, requires: ["singularity_eff_1", "dyson_eff_2"] },
            effect: { buildingMult: 4.5 }
        },
        {
            id: "archive_eff_1",
            name: "宇宙索引矩陣",
            description: "宇宙檔案塔產出 +250%。",
            type: "building",
            buildingId: "cosmic_archive",
            cost: 7500000000n,
            unlock: { building: { cosmic_archive: 4 }, requires: ["singularity_eff_1"] },
            effect: { buildingMult: 3.5 }
        },
        {
            id: "archive_eff_2",
            name: "永恆編碼層",
            description: "宇宙檔案塔產出再 +500%。",
            type: "building",
            buildingId: "cosmic_archive",
            cost: 42000000000n,
            unlock: { building: { cosmic_archive: 12 }, requires: ["archive_eff_1", "singularity_eff_2"] },
            effect: { buildingMult: 6 }
        },
        {
            id: "global_3",
            name: "星核共鳴",
            description: "所有產出 ×2。",
            type: "global",
            cost: 1000000n,
            unlock: { lifetime: 500000n },
            effect: { globalMult: 2 }
        },
        {
            id: "global_4",
            name: "超弦匯流",
            description: "所有產出 ×2.5。",
            type: "global",
            cost: 90000000n,
            unlock: { lifetime: 30000000n, requires: ["global_3"] },
            effect: { globalMult: 2.5 }
        },
        {
            id: "global_5",
            name: "終極星海協定",
            description: "所有產出 ×3。",
            type: "global",
            cost: 2600000000n,
            unlock: { lifetime: 800000000n, requires: ["global_4", "archive_eff_1"] },
            effect: { globalMult: 3 }
        },
        {
            id: "click_5",
            name: "銀河重拳",
            description: "每次手動採集 +40 星晶。",
            type: "click",
            cost: 75000n,
            unlock: { lifetime: 40000n },
            effect: { clickAdd: 40 }
        },
        {
            id: "click_4",
            name: "超新星敲擊",
            description: "點擊收益 ×3。",
            type: "click",
            cost: 400000n,
            unlock: { lifetime: 200000n },
            effect: { clickMult: 3 }
        },
        {
            id: "artifact_rarity_infinite",
            name: "神器精鑄學",
            description: "可重複購買：每次神器稀有度上限 +10。",
            type: "artifact",
            cost: 90000n,
            unlock: { shards: 1, requires: ["click_auto_2"] },
            effect: { artifactRarityCapAdd: 10, repeatable: true }
        },
        {
            id: "artifact_hunt_1",
            name: "遺跡掃描陣",
            description: "神器掉落機率 ×1.5。",
            type: "artifact",
            cost: 350000n,
            unlock: { shards: 2, requires: ["artifact_rarity_infinite"] },
            effect: { artifactDropMult: 1.5 }
        },
        {
            id: "artifact_hunt_2",
            name: "古代訊號追跡",
            description: "神器掉落機率 ×2。",
            type: "artifact",
            cost: 2200000n,
            unlock: { shards: 5, requires: ["artifact_hunt_1", "artifact_rarity_infinite"] },
            effect: { artifactDropMult: 2 }
        },
        {
            id: "artifact_drop_infinite",
            name: "遺跡深層追獵",
            description: "可重複購買：神器掉落率 +5%/秒。",
            type: "artifact",
            cost: 4500000n,
            unlock: { shards: 6, requires: ["artifact_hunt_2"] },
            effect: { artifactDropRateAdd: 0.05, repeatable: true }
        }
    ];

    const PRESTIGE = {
        unlockLifetime: 1000000n,
        divisor: 1000000n,
        bonusPerShard: 0.05
    };

    const ARTIFACTS = [
        {
            id: "chronicle_lens",
            name: "時序透鏡",
            description: "提高轉生時的碎片收益。",
            effect: { shardGainPerRarity: 0.01 }
        },
        {
            id: "gravity_shard",
            name: "重力碎核",
            description: "提高全域產出倍率。",
            effect: { globalMultPerRarity: 0.008 }
        },
        {
            id: "void_relay",
            name: "虛空中繼器",
            description: "提高每次點擊基礎增益。",
            effect: { clickAddPerRarity: 1.2 }
        },
        {
            id: "meteor_prism",
            name: "流星棱鏡",
            description: "提高流星出現率與流星獎勵。",
            effect: { starSpawnPerRarity: 0.01, starRewardPerRarity: 0.012 }
        },
        {
            id: "architect_seal",
            name: "匠星印記",
            description: "提高全部建築產出倍率。",
            effect: { buildingMultPerRarity: 0.009 }
        },
        {
            id: "relic_compass",
            name: "遺跡羅盤",
            description: "提高神器掉落率。",
            effect: { artifactDropPerRarity: 0.0075 }
        }
    ];

    const ARTIFACT_SYSTEM = {
        unlockShards: 1,
        baseDropChancePerSec: 0.055,
        baseRarityCap: 20
    };

    const SHOOTING_STAR = {
        baseSpawnChancePerSec: 0.06,
        minGapMs: 10000,
        baseRewardSeconds: 45,
        baseDurationMs: 5500,
        speedPxPerSec: 200
    };

    window.IdleData = {
        BASE_CLICK,
        BUILDINGS,
        UPGRADES,
        PRESTIGE,
        ARTIFACTS,
        ARTIFACT_SYSTEM,
        SHOOTING_STAR
    };
})();
