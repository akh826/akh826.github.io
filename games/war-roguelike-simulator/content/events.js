/**
 * War Roguelike — content: events
 */
(function (global) {
    "use strict";
    global.WarDataParts = global.WarDataParts || {};
    const EVENTS = [
        { id: "mysterious_merchant", title: "神秘商人", text: "一位商人提供補給，或簽下一紙戰場契約。", choices: [
            { label: "付費補給 (-20 金, +50 金物資)", cost: { gold: 20 }, reward: { gold: 50 } },
            { label: "簽賞金契約（下 2 場戰鬥金幣 ×1.5）", reward: { contract: { id: "bounty_pact", name: "賞金契約", rooms: 2, desc: "戰鬥金幣獎勵 ×1.5", effect: { goldMult: 1.5 } } } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "ancient_shrine", title: "古老神殿", text: "神殿散發神秘之光。", choices: [
            { label: "祈禱 (+30 金)", reward: { gold: 30 } },
            { label: "獻金 (+1 隨機神器, -30 金)", cost: { gold: 30 }, reward: { artifact: true } },
            { label: "立聖光契約（下 2 場僅神聖單位可戰，開場護盾 50）", reward: { contract: { id: "holy_pact", name: "聖光契約", rooms: 2, desc: "僅 [神聖] 可出戰，開場護盾 50", effect: { onlyFightTag: "holy", startShield: 50 } } } }
        ]},
        { id: "training_ground", title: "訓練場", text: "士兵在此磨練技藝。", choices: [
            { label: "強化部隊 (+全隊攻擊 3)", reward: { tempAtk: 3 } },
            { label: "離開", reward: {} }
        ]},
        { id: "wandering_healer", title: "流浪醫者", text: "醫者願意提供物資援助。", choices: [
            { label: "接受援助 (+40 金)", reward: { gold: 40 } },
            { label: "婉拒", reward: {} }
        ]},
        { id: "gamble", title: "賭徒", text: "賭一把？50% 機率獲得神器，失敗則失去 20 金幣。", choices: [
            { label: "賭博", reward: { gamble: true } },
            { label: "不賭", reward: {} }
        ]},
        { id: "recruit", title: "志願兵", text: "新兵願意加入你的隊伍。", choices: [
            { label: "招募隨機單位", reward: { recruit: true } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "cursed_idol", title: "詛咒神像", text: "觸碰神像可獲得力量，但要付出金幣。", choices: [
            { label: "觸碰 (-20 金, +隨機能力)", cost: { gold: 20 }, reward: { ability: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "supply_cache", title: "補給箱", text: "發現軍用補給。", choices: [
            { label: "取得 (+35 金)", reward: { gold: 35 } },
            { label: "離開", reward: {} }
        ]},
        { id: "old_general", title: "老將", text: "退休將軍分享戰術。", choices: [
            { label: "學習 (+隨機能力)", reward: { ability: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "fog_maze", title: "迷霧迷宮", text: "迷霧中傳出契約低語：以險換利。", choices: [
            { label: "簽再生契約（下 2 場敵軍皆再生，但獎勵更稀有）", reward: { contract: { id: "regen_pact", name: "再生契約", rooms: 2, desc: "敵軍強制再生詞綴；獎勵稀有度提升", effect: { forceEnemyAffix: "regenerating", rewardRarityBoost: 1.75 } } } },
            { label: "繞路 (+10 金)", reward: { gold: 10 } }
        ]},
        { id: "bandit_camp", title: "盜賊營地", text: "盜賊提出交易——或一紙血戰契約。", choices: [
            { label: "交贖金 (-25 金)", cost: { gold: 25 }, reward: {} },
            { label: "簽狂暴契約（下 2 場敵軍狂暴，戰後 +35 金）", reward: { contract: { id: "rage_pact", name: "狂暴契約", rooms: 2, desc: "敵軍強制狂暴；每場戰鬥額外 +35 金", effect: { forceEnemyAffix: "enraged", goldAfter: 35 } } } },
            { label: "強行通過 (+15 金)", reward: { gold: 15 } }
        ]},
        { id: "magic_well", title: "魔法泉", text: "泉水閃爍著魔力。", choices: [
            { label: "飲用 (+25 金)", reward: { gold: 25 } },
            { label: "裝瓶 (+20 金)", reward: { gold: 20 } }
        ]},
        { id: "deserter", title: "逃兵", text: "一名逃兵請求加入。", choices: [
            { label: "接納 (+隨機單位)", reward: { recruit: true } },
            { label: "驅逐 (+10 金)", reward: { gold: 10 } }
        ]},
        { id: "battlefield_loot", title: "戰場遺跡", text: "散落著未收的戰利品。", choices: [
            { label: "搜刮 (+30 金)", reward: { gold: 30 } },
            { label: "警戒離開", reward: {} }
        ]},
        { id: "prophet", title: "預言者", text: "預言者窺見你的命運。", choices: [
            { label: "聆聽預言 (+隨機能力)", reward: { ability: true } },
            { label: "無視", reward: {} }
        ]},
        { id: "weapon_smith", title: "鐵匠", text: "鐵匠願意強化武器。", choices: [
            { label: "強化 (-20 金, +攻擊 4)", cost: { gold: 20 }, reward: { tempAtk: 4 } },
            { label: "離開", reward: {} }
        ]},
        { id: "haunted_ruins", title: "鬧鬼遺跡", text: "幽靈低語。", choices: [
            { label: "調查 (-20 金, +神器)", cost: { gold: 20 }, reward: { artifact: true } },
            { label: "快速離開", reward: {} }
        ]},
        { id: "royal_envoy", title: "王室使者", text: "使者帶來資助。", choices: [
            { label: "接受資助 (+40 金)", reward: { gold: 40 } },
            { label: "謝絕 (+30 金物資)", reward: { gold: 30 } }
        ]},
        { id: "sparring", title: "切磋", text: "友軍邀請切磋。", choices: [
            { label: "切磋 (-10 金, +攻擊 5)", cost: { gold: 10 }, reward: { tempAtk: 5 } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "mystic_orb", title: "神秘寶珠", text: "寶珠脈動著能量。", choices: [
            { label: "吸收 (-16 金, +能力)", cost: { gold: 16 }, reward: { ability: true } },
            { label: "封存 (+25 金)", reward: { gold: 25 } }
        ]},
        { id: "refugee", title: "難民", text: "難民尋求庇護，並帶來一份情報契約。", choices: [
            { label: "救助 (-15 金, +40 金情報)", cost: { gold: 15 }, reward: { gold: 40 } },
            { label: "簽護盾契約（下 3 場敵軍開場護盾，寶藏金幣 ×1.5）", reward: { contract: { id: "shield_pact", name: "護盾契約", rooms: 3, desc: "敵軍強制護盾詞綴；寶藏金幣 ×1.5", effect: { forceEnemyAffix: "shielded", treasureMult: 1.5 } } } },
            { label: "忽略", reward: {} }
        ]},
        { id: "ancient_armory", title: "古代軍械庫", text: "塵封的武器庫。", choices: [
            { label: "探索 (+神器, -24 金)", cost: { gold: 24 }, reward: { artifact: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "scout_report", title: "偵察報告", text: "偵察兵帶回情報與一份戰場契約。", choices: [
            { label: "獎賞 (+15 金)", reward: { gold: 15 } },
            { label: "簽暗影契約（下 2 場僅暗影單位可戰，攻速感提升）", reward: { contract: { id: "shadow_pact", name: "暗影契約", rooms: 2, desc: "僅 [暗影] 可出戰；全隊攻速 ×1.2", effect: { onlyFightTag: "shadow", spdMult: 1.2 } } } },
            { label: "整頓 (+20 金)", reward: { gold: 20 } }
        ]},
        { id: "drunken_soldier", title: "醉酒士兵", text: "士兵醉醺醺地訴說戰場祕聞。", choices: [
            { label: "請酒 (-10 金, +攻擊 3)", cost: { gold: 10 }, reward: { tempAtk: 3 } },
            { label: "趕走", reward: {} }
        ]},
        { id: "eclipse", title: "日蝕", text: "日蝕籠罩戰場。", choices: [
            { label: "祈禱 (+能力)", reward: { ability: true } },
            { label: "繼續行軍", reward: { gold: 10 } }
        ]},
        { id: "merchant_caravan", title: "商隊", text: "商隊願意打折出售。", choices: [
            { label: "購買補給 (-15 金, +40 金物資)", cost: { gold: 15 }, reward: { gold: 40 } },
            { label: "簽商人契約（下 3 房商店折扣 30%）", reward: { contract: { id: "merchant_pact", name: "商人契約", rooms: 3, desc: "商店價格 -30%", effect: { shopDiscount: 0.3 } } } },
            { label: "路過", reward: {} }
        ]},
        { id: "war_memorial", title: "戰爭紀念碑", text: "紀念碑上刻滿名字。", choices: [
            { label: "致敬 (+30 金)", reward: { gold: 30 } },
            { label: "默哀離開", reward: {} }
        ]},
        { id: "hidden_cache", title: "隱藏儲藏", text: "發現隱蔽的補給點。", choices: [
            { label: "取用 (+55 金)", reward: { gold: 55 } },
            { label: "標記後離開", reward: { gold: 15 } }
        ]},
        { id: "rival_commander", title: "對手指揮官", text: "敵方指揮官提出決鬥——或以契約定勝負。", choices: [
            { label: "決鬥 (-36 金, +50 金)", cost: { gold: 36 }, reward: { gold: 50 } },
            { label: "簽反傷契約（下 2 場敵軍反傷，獎勵稀有度大增）", reward: { contract: { id: "thorn_pact", name: "反傷契約", rooms: 2, desc: "敵軍強制反傷；獎勵稀有度大幅提升", effect: { forceEnemyAffix: "thorny", rewardRarityBoost: 2.2 } } } },
            { label: "拒絕決鬥", reward: {} }
        ]},
        { id: "war_pact_envoy", title: "戰場契約官", text: "契約官攤開數份羊皮紙：以風險換取未來優勢。", choices: [
            { label: "再生契約（下 2 場敵再生，獎勵更稀有）", reward: { contract: { id: "regen_pact", name: "再生契約", rooms: 2, desc: "敵軍強制再生詞綴；獎勵稀有度提升", effect: { forceEnemyAffix: "regenerating", rewardRarityBoost: 1.75 } } } },
            { label: "迅捷契約（下 2 場敵迅捷，開場護盾 60）", reward: { contract: { id: "swift_pact", name: "迅捷契約", rooms: 2, desc: "敵軍強制迅捷；開場護盾 60", effect: { forceEnemyAffix: "swift", startShield: 60 } } } },
            { label: "賞金契約（下 3 場金幣 ×1.6）", reward: { contract: { id: "bounty_pact", name: "賞金契約", rooms: 3, desc: "戰鬥金幣獎勵 ×1.6", effect: { goldMult: 1.6 } } } },
            { label: "拒絕簽約", reward: {} }
        ]},
        { id: "blood_oath", title: "血誓祭壇", text: "以血為墨，簽下限定兵種的戰場誓約。", choices: [
            { label: "近戰血誓（下 2 場僅近戰可戰，HP +40）", reward: { contract: { id: "melee_oath", name: "近戰血誓", rooms: 2, desc: "僅 [近戰] 可出戰；全隊 HP +40", effect: { onlyFightTag: "melee", hpAll: 40 } } } },
            { label: "遠程血誓（下 2 場僅遠程可戰，攻擊 +8）", reward: { contract: { id: "ranged_oath", name: "遠程血誓", rooms: 2, desc: "僅 [遠程] 可出戰；全隊攻擊 +8", effect: { onlyFightTag: "ranged", atkAll: 8 } } } },
            { label: "離開", reward: {} }
        ]},
        { id: "transmutation_altar", title: "轉化祭壇", text: "古老祭壇嗡鳴著魔力，能將一名部隊轉化為其他兵種。", choices: [
            { label: "隨意轉化", reward: { convert: true } },
            { label: "定向轉化 (-25 金, 偏向更高稀有)", cost: { gold: 25 }, reward: { convert: true, convertUpgrade: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "field_chapel", title: "戰地禮拜堂", text: "教士以優惠價格喚回陣亡將士（約四折）。", choices: [
            { label: "優惠復活最近一名（約四折）", reward: { reviveFallen: true, reviveCostMult: 0.4 } },
            { label: "捐獻 (+20 金祝福)", reward: { gold: 20 } },
            { label: "離開", reward: {} }
        ]},
        { id: "blood_pact", title: "血契祭壇", text: "以鮮血換取力量。", choices: [
            { label: "獻血換神器（-35 金）", cost: { gold: 35 }, reward: { artifact: true } },
            { label: "獻祭一名隨機單位換高稀有獎勵", reward: { sacrificeUnit: true, epicReward: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "devil_deal", title: "惡魔交易", text: "低語承諾力量與詛咒。", choices: [
            { label: "接受詛咒神器（-20 金）", cost: { gold: 20 }, reward: { cursedArtifact: true } },
            { label: "賣血換金幣（部隊臨時攻擊 -5，+55 金）", reward: { gold: 55, tempAtk: -5 } },
            { label: "拒絕", reward: {} }
        ]},
        { id: "war_tax", title: "軍稅官", text: "官府索取軍費，或徵召一名士兵。", choices: [
            { label: "繳稅 (-40 金，+隨機能力)", cost: { gold: 40 }, reward: { ability: true } },
            { label: "交出一名隨機單位換 70 金", reward: { sacrificeUnit: true, gold: 70 } },
            { label: "抗命離開", reward: {} }
        ]},
        { id: "beast_den", title: "獸穴遺跡", text: "野獸的氣味與齒痕遍布岩壁，深處傳來低沉咆哮。", choices: [
            { label: "馴服幼獸（招募隨機 [野獸] 單位）", reward: { recruitTag: "beast" } },
            { label: "獸群契約（下 2 場僅 [野獸] 可戰，野獸攻擊 +12）", reward: { contract: { id: "beast_pact", name: "獸群契約", rooms: 2, desc: "僅 [野獸] 可出戰；野獸攻擊 +12", effect: { onlyFightTag: "beast", tag: "beast", atk: 12 } } } },
            { label: "繞道離開 (+18 金)", reward: { gold: 18 } }
        ]},
        { id: "clockwork_ruins", title: "齒輪廢墟", text: "生鏽的齒輪仍在緩慢轉動，殘留的魔力驅動著機械殘骸。", choices: [
            { label: "回收零件（招募隨機 [機械] 單位）", reward: { recruitTag: "mechanical" } },
            { label: "超載協議（下 2 場僅 [機械] 可戰，機械防禦 +10）", reward: { contract: { id: "mech_pact", name: "超載協議", rooms: 2, desc: "僅 [機械] 可出戰；機械防禦 +10", effect: { onlyFightTag: "mechanical", tag: "mechanical", def: 10 } } } },
            { label: "拆解換金 (+25 金)", reward: { gold: 25 } }
        ]},
        { id: "fusion_altar", title: "融合祭壇", text: "祭壇可用金幣強化一名部隊星級（不消耗單位，優先最高星，最高 ★10）。", choices: [
            { label: "獻金升星（不消耗單位）", reward: { mergeUnits: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "unique_legacy", title: "遺世遺產", text: "一座封印祭壇低語著唯一之名——隨機賜予一件尚未擁有的唯一單位或能力。", choices: [
            { label: "接受唯一賜福", reward: { uniqueGrant: true } },
            { label: "離開", reward: {} }
        ]},
        { id: "eternal_trial", title: "永恆試煉", text: "試煉官提出契約：付出金幣，換取指定的唯一之力。", choices: [
            { label: "召喚永恆守衛 (-50 金)", cost: { gold: 50 }, reward: { grantUnit: "eternal_warden" } },
            { label: "學習霸權 (-50 金)", cost: { gold: 50 }, reward: { grantAbility: "dominion" } },
            { label: "拒絕", reward: {} }
        ]}
    ];

    const TRAPS = [
        { id: "spike_pit", title: "尖刺陷阱", text: "隊伍踩入陷阱，損失物資！", damage: 12 },
        { id: "poison_gas", title: "毒氣", text: "有毒氣體迫使部隊丟棄補給！", damage: 18 },
        { id: "ambush", title: "伏擊", text: "敵人突襲！", damage: 10, combat: true },
        { id: "rockfall", title: "落石", text: "落石砸毀部分輜重！", damage: 15 },
        { id: "quicksand", title: "流沙", text: "陷入流沙，丟失金幣！", damage: 8 },
        { id: "fire_trap", title: "火焰機關", text: "火焰燒毀補給！", damage: 20 },
        { id: "cursed_ground", title: "詛咒之地", text: "詛咒吸走財運。", damage: 14 },
        { id: "snare", title: "捕獸夾", text: "耽誤行軍，損失金幣！", damage: 6 },
        { id: "arrow_rain", title: "箭雨", text: "箭雨來襲，被迫交戰！", damage: 16, combat: true },
        { id: "swamp", title: "沼澤", text: "部隊陷入沼澤，丟棄物資！", damage: 11 },
        { id: "explosive", title: "爆炸陷阱", text: "爆炸引發敵軍注意！", damage: 22, combat: true },
        { id: "net_trap", title: "羅網", text: "羅網困住前鋒！", damage: 9 },
        { id: "frost_rune", title: "冰霜符文", text: "寒氣凍壞補給！", damage: 13 },
        { id: "pitfall", title: "陷坑", text: "地面塌陷，遭遇伏兵！", damage: 17, combat: true },
        { id: "shadow_blade", title: "暗影刀刃", text: "無形之刃劃過輜重車！", damage: 19 }
    ];

    const SHOP_ITEMS = [
        { type: "ability", name: "戰術卷軸", desc: "獲得一個隨機能力（本店限購 1）", price: 40, maxBuys: 1, effect: { ability: true } },
        { type: "artifact", name: "隨機神器", desc: "獲得一件神器（本店限購 1）", price: 60, maxBuys: 1, effect: { artifact: true } },
        { type: "unit", name: "招募單位", desc: "獲得一個單位加入部隊（本店限購 2）", price: 45, maxBuys: 2, effect: { recruit: true } },
        { type: "upgrade", name: "部隊強化", desc: "全隊攻擊 +3（本局，限購 1）", price: 35, maxBuys: 1, effect: { tempAtk: 3 } },
        { type: "exp", name: "訓練手冊", desc: "隨機一名未滿星單位獲得 5 點經驗（本店限購 2）", price: 28, maxBuys: 2, effect: { unitExp: 5 } }
    ];
    global.WarDataParts.EVENTS = EVENTS;
    global.WarDataParts.TRAPS = TRAPS;
    global.WarDataParts.SHOP_ITEMS = SHOP_ITEMS;
})(typeof window !== "undefined" ? window : globalThis);
