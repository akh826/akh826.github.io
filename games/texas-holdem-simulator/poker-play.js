/**
 * Texas Hold'em play mode — chips, blinds, betting streets, simple bots.
 */
(function () {
    const STREETS = ["preflop", "flop", "turn", "river"];
    const BOT_STYLES = ["nit", "tag", "lag", "maniac", "station", "trapper"];
    const BOT_STYLE_LABELS = {
        nit: "Nit",
        tag: "TAG",
        lag: "LAG",
        maniac: "Maniac",
        station: "Station",
        trapper: "Trapper"
    };

    function shuffleDeck(random = Math.random) {
        const engine = window.POKER_ENGINE;
        const deck = engine.allCardCodes();
        for (let i = deck.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function randomBotStyle(random = Math.random) {
        return BOT_STYLES[Math.floor(random() * BOT_STYLES.length)] ?? "tag";
    }

    function createPlayer(name, chips, options = {}) {
        return {
            name,
            chips,
            isHuman: Boolean(options.isHuman),
            botStyle: options.botStyle ?? "tag",
            tiltHands: 0,
            handStartChips: chips,
            hole: [null, null],
            betThisStreet: 0,
            totalBet: 0,
            folded: false,
            allIn: false,
            busted: false
        };
    }

    function createGame(options = {}) {
        const playerCount = Math.max(2, Math.min(10, options.playerCount ?? 4));
        const startingChips = options.startingChips ?? 1000;
        const smallBlind = options.smallBlind ?? 5;
        const bigBlind = options.bigBlind ?? 10;
        const players = [createPlayer("You", startingChips, { isHuman: true })];
        for (let i = 1; i < playerCount; i += 1) {
            players.push(createPlayer(`Player ${i + 1}`, startingChips, {
                botStyle: randomBotStyle()
            }));
        }
        return {
            config: { playerCount, startingChips, smallBlind, bigBlind },
            players,
            deck: [],
            board: [null, null, null, null, null],
            buttonIndex: 0,
            street: null,
            phase: "idle",
            pot: 0,
            currentBet: 0,
            minRaise: bigBlind,
            actionIndex: -1,
            actedThisStreet: new Set(),
            handNumber: 0,
            message: "Press Deal hand to start.",
            revealAll: false,
            winners: [],
            smallBlindIndex: -1,
            bigBlindIndex: -1
        };
    }

    function playersWithChips(state) {
        return state.players.map((_, index) => index).filter((index) => state.players[index].chips > 0);
    }

    function livePlayerIndices(state) {
        return state.players.map((_, index) => index).filter((index) => {
            const player = state.players[index];
            // All-in players have 0 chips but are still in the hand until they fold.
            return !player.busted && !player.folded;
        });
    }

    function canPlayerAct(state, index) {
        const player = state.players[index];
        return !player.folded && !player.busted && !player.allIn && player.chips > 0;
    }

    function blindPositions(state) {
        const active = playersWithChips(state);
        const count = active.length;
        let buttonPos = active.indexOf(state.buttonIndex);
        if (buttonPos < 0) {
            buttonPos = 0;
            state.buttonIndex = active[0];
        }
        if (count === 2) {
            return { sb: active[buttonPos], bb: active[(buttonPos + 1) % 2] };
        }
        return {
            sb: active[(buttonPos + 1) % count],
            bb: active[(buttonPos + 2) % count]
        };
    }

    function firstToActPreflop(state) {
        const active = playersWithChips(state);
        const { sb, bb } = blindPositions(state);
        if (active.length === 2) {
            return sb;
        }
        const bbPos = active.indexOf(bb);
        return active[(bbPos + 1) % active.length];
    }

    function firstToActPostflop(state) {
        const candidates = livePlayerIndices(state).filter((index) => canPlayerAct(state, index));
        if (candidates.length === 0) {
            return -1;
        }
        const total = state.players.length;
        let index = (state.buttonIndex + 1) % total;
        for (let step = 0; step < total; step += 1) {
            if (candidates.includes(index)) {
                return index;
            }
            index = (index + 1) % total;
        }
        return candidates[0];
    }

    function commitChips(state, playerIndex, amount) {
        const player = state.players[playerIndex];
        const paid = Math.min(Math.max(0, amount), player.chips);
        player.chips -= paid;
        player.betThisStreet += paid;
        player.totalBet += paid;
        state.pot += paid;
        if (player.chips === 0) {
            player.allIn = true;
        }
        return paid;
    }

    function resetStreetBets(state) {
        state.players.forEach((player) => {
            player.betThisStreet = 0;
        });
        state.currentBet = 0;
        state.minRaise = state.config.bigBlind;
        state.actedThisStreet = new Set();
    }

    function drawCard(state) {
        const code = state.deck.shift();
        if (!code) {
            throw new Error("Deck exhausted.");
        }
        return code;
    }

    function dealBoardCards(state, count) {
        let dealt = 0;
        for (let index = 0; index < state.board.length && dealt < count; index += 1) {
            if (!state.board[index]) {
                state.board[index] = drawCard(state);
                dealt += 1;
            }
        }
    }

    function rotateButton(state) {
        const active = playersWithChips(state);
        if (active.length === 0) {
            return;
        }
        const current = active.indexOf(state.buttonIndex);
        const next = current < 0 ? 0 : (current + 1) % active.length;
        state.buttonIndex = active[next];
    }

    function postBlind(state, playerIndex, amount) {
        return commitChips(state, playerIndex, amount);
    }

    function startHand(state) {
        const eligible = playersWithChips(state);
        if (eligible.length < 2) {
            state.phase = "game-over";
            state.message = "Game over — not enough players with chips.";
            return false;
        }

        state.handNumber += 1;
        state.phase = "betting";
        state.street = "preflop";
        state.pot = 0;
        state.revealAll = false;
        state.winners = [];
        state.smallBlindIndex = -1;
        state.bigBlindIndex = -1;
        state.deck = shuffleDeck();
        state.board = [null, null, null, null, null];
        state.actedThisStreet = new Set();

        state.players.forEach((player) => {
            player.handStartChips = player.chips;
            player.hole = [drawCard(state), drawCard(state)];
            player.betThisStreet = 0;
            player.totalBet = 0;
            player.folded = player.chips <= 0;
            player.allIn = false;
            player.busted = player.chips <= 0;
            if (!player.isHuman && player.tiltHands > 0) {
                player.tiltHands -= 1;
            }
        });

        rotateButton(state);
        const { sb, bb } = blindPositions(state);
        const sbPaid = postBlind(state, sb, state.config.smallBlind);
        const bbPaid = postBlind(state, bb, state.config.bigBlind);
        state.smallBlindIndex = sb;
        state.bigBlindIndex = bb;
        state.currentBet = Math.max(sbPaid, bbPaid);
        state.minRaise = state.config.bigBlind;
        state.actionIndex = firstToActPreflop(state);
        const sbName = state.players[sb].name;
        const bbName = state.players[bb].name;
        state.message = `Hand #${state.handNumber} — ${sbName} posts Small Blind (${sbPaid}), ${bbName} posts Big Blind (${bbPaid}).`;
        syncActionIndex(state);
        return true;
    }

    function bettingRoundComplete(state) {
        const live = livePlayerIndices(state);
        if (live.length <= 1) {
            return true;
        }
        const actors = live.filter((index) => canPlayerAct(state, index));
        if (actors.length === 0) {
            return true;
        }
        const betsMatched = actors.every((index) => state.players[index].betThisStreet === state.currentBet);
        const everyoneActed = actors.every((index) => state.actedThisStreet.has(index));
        return betsMatched && everyoneActed;
    }

    function firstActablePlayer(state) {
        const total = state.players.length;
        for (let step = 0; step < total; step += 1) {
            const index = (state.actionIndex + 1 + step) % total;
            if (canPlayerAct(state, index)) {
                return index;
            }
        }
        return -1;
    }

    function syncActionIndex(state) {
        if (state.phase !== "betting") {
            return;
        }
        let guard = state.players.length * 4;
        while (guard-- > 0) {
            const live = livePlayerIndices(state);
            if (live.length <= 1) {
                finishByFold(state);
                return;
            }
            if (bettingRoundComplete(state)) {
                advanceStreet(state);
                if (state.phase !== "betting") {
                    return;
                }
                continue;
            }
            if (state.actionIndex >= 0 && canPlayerAct(state, state.actionIndex)) {
                return;
            }
            const next = state.actionIndex < 0
                ? firstActablePlayer(state)
                : nextActor(state, state.actionIndex);
            state.actionIndex = next;
            if (state.actionIndex < 0) {
                continue;
            }
        }
    }

    function nextActor(state, fromIndex) {
        const total = state.players.length;
        let index = (fromIndex + 1) % total;
        for (let step = 0; step < total; step += 1) {
            if (canPlayerAct(state, index)) {
                return index;
            }
            index = (index + 1) % total;
        }
        return -1;
    }

    function awardPot(state, winnerIndices) {
        const share = Math.floor(state.pot / winnerIndices.length);
        let remainder = state.pot - share * winnerIndices.length;
        winnerIndices.forEach((index) => {
            state.players[index].chips += share;
            if (remainder > 0) {
                state.players[index].chips += 1;
                remainder -= 1;
            }
        });
        state.winners = winnerIndices;
        state.pot = 0;
    }

    function showdown(state) {
        const engine = window.POKER_ENGINE;
        const live = livePlayerIndices(state);
        const boardCards = state.board.filter(Boolean).map((code) => engine.parseCard(code));
        const scores = live.map((index) => {
            const hole = state.players[index].hole.map((code) => engine.parseCard(code));
            return { index, score: engine.bestHandScore([...hole, ...boardCards]) };
        });
        let best = scores[0];
        scores.forEach((entry) => {
            if (engine.compareScores(entry.score, best.score) > 0) {
                best = entry;
            }
        });
        const winners = scores
            .filter((entry) => engine.compareScores(entry.score, best.score) === 0)
            .map((entry) => entry.index);
        const potAmount = state.pot;
        awardPot(state, winners);
        applyPostHandEmotion(state, potAmount, winners);
        state.revealAll = true;
        state.phase = "hand-complete";
        const names = winners.map((index) => state.players[index].name).join(", ");
        const handName = engine.handNameFromScore(best.score);
        state.message = `${names} win${winners.length > 1 ? "" : "s"} with ${handName} — ${potAmount.toLocaleString()} chips.`;
        state.players.forEach((player) => {
            player.busted = player.chips <= 0;
        });
    }

    function finishByFold(state) {
        const winner = livePlayerIndices(state)[0];
        const potAmount = state.pot;
        awardPot(state, [winner]);
        applyPostHandEmotion(state, potAmount, [winner]);
        state.revealAll = false;
        state.phase = "hand-complete";
        state.message = `${state.players[winner].name} wins ${potAmount.toLocaleString()} chips — everyone else folded.`;
        state.players.forEach((player) => {
            player.busted = player.chips <= 0;
        });
    }

    function advanceStreet(state) {
        const live = livePlayerIndices(state);
        if (live.length <= 1) {
            finishByFold(state);
            return;
        }

        resetStreetBets(state);
        if (state.street === "preflop") {
            state.street = "flop";
            dealBoardCards(state, 3);
        } else if (state.street === "flop") {
            state.street = "turn";
            dealBoardCards(state, 1);
        } else if (state.street === "turn") {
            state.street = "river";
            dealBoardCards(state, 1);
        } else if (state.street === "river") {
            showdown(state);
            return;
        }

        state.actionIndex = firstToActPostflop(state);
        state.message = `Hand #${state.handNumber} — ${state.street}.`;
        if (state.actionIndex < 0) {
            advanceStreet(state);
        }
    }

    function afterAction(state) {
        const live = livePlayerIndices(state);
        if (live.length === 1) {
            finishByFold(state);
            return;
        }
        if (bettingRoundComplete(state)) {
            advanceStreet(state);
            return;
        }
        state.actionIndex = nextActor(state, state.actionIndex);
        if (state.actionIndex < 0) {
            advanceStreet(state);
            return;
        }
        syncActionIndex(state);
    }

    function getLegalActions(state) {
        if (state.phase !== "betting" || state.actionIndex < 0) {
            return [];
        }
        const index = state.actionIndex;
        const player = state.players[index];
        if (!canPlayerAct(state, index)) {
            return [];
        }
        const toCall = state.currentBet - player.betThisStreet;
        const actions = [{ type: "fold" }];
        const minRaiseTotal = state.currentBet + state.minRaise;
        const maxTotal = player.betThisStreet + player.chips;

        if (toCall <= 0) {
            actions.push({ type: "check" });
        } else if (player.chips > toCall) {
            actions.push({ type: "call", amount: toCall });
        } else {
            actions.push({ type: "call", amount: player.chips, allIn: true });
        }

        if (player.chips > toCall) {
            const raiseTargets = new Set([
                minRaiseTotal,
                state.currentBet + state.config.bigBlind * 2,
                state.currentBet + Math.max(state.pot, state.config.bigBlind),
                maxTotal
            ]);
            [...raiseTargets]
                .filter((target) => target > state.currentBet && target <= maxTotal)
                .sort((a, b) => a - b)
                .forEach((target) => {
                    actions.push({
                        type: target === maxTotal ? "all-in" : "raise",
                        amount: target - player.betThisStreet,
                        total: target
                    });
                });
        }

        return actions;
    }

    function applyAction(state, action) {
        if (state.phase !== "betting" || state.actionIndex < 0) {
            return false;
        }
        const index = state.actionIndex;
        const player = state.players[index];
        if (!canPlayerAct(state, index)) {
            return false;
        }

        if (action.type === "fold") {
            player.folded = true;
            state.actedThisStreet.add(index);
        } else if (action.type === "check") {
            if (state.currentBet !== player.betThisStreet) {
                return false;
            }
            state.actedThisStreet.add(index);
        } else if (action.type === "call") {
            const toCall = state.currentBet - player.betThisStreet;
            if (toCall <= 0) {
                return false;
            }
            commitChips(state, index, Math.min(toCall, player.chips));
            state.actedThisStreet.add(index);
        } else if (action.type === "raise" || action.type === "all-in") {
            if (!action.total || action.total <= state.currentBet) {
                return false;
            }
            const maxTotal = player.betThisStreet + player.chips;
            const targetTotal = Math.min(action.total, maxTotal);
            if (targetTotal <= state.currentBet) {
                return false;
            }
            const previousBet = state.currentBet;
            const putIn = targetTotal - player.betThisStreet;
            commitChips(state, index, putIn);
            const raiseSize = player.betThisStreet - previousBet;
            if (raiseSize > 0) {
                state.minRaise = Math.max(state.config.bigBlind, raiseSize);
            }
            state.currentBet = player.betThisStreet;
            state.actedThisStreet = new Set([index]);
            state.players.forEach((_, playerIndex) => {
                if (playerIndex !== index && canPlayerAct(state, playerIndex)
                    && state.players[playerIndex].betThisStreet === state.currentBet) {
                    state.actedThisStreet.add(playerIndex);
                }
            });
        } else {
            return false;
        }

        afterAction(state);
        return true;
    }

    function estimateStrength(state, playerIndex) {
        const engine = window.POKER_ENGINE;
        const hole = state.players[playerIndex].hole;
        if (!hole[0] || !hole[1]) {
            return 0;
        }
        const board = state.board.filter(Boolean);
        if (board.length === 0) {
            const r1 = engine.RANKS.indexOf(hole[0][0]);
            const r2 = engine.RANKS.indexOf(hole[1][0]);
            const pair = hole[0][0] === hole[1][0];
            const high = Math.max(r1, r2);
            const suited = hole[0][1] === hole[1][1];
            let strength = high / 12 * 0.45;
            if (pair) {
                strength += 0.35 + high / 12 * 0.1;
            }
            if (suited) {
                strength += 0.08;
            }
            if (Math.abs(r1 - r2) === 1) {
                strength += 0.05;
            }
            return Math.min(1, strength);
        }
        const cards = [...hole, ...board].map((code) => engine.parseCard(code));
        const score = engine.bestHandScore(cards);
        return Math.min(1, score[0] / 8 + (score[1] ?? 0) / 52);
    }

    function applyPostHandEmotion(state, potAmount, winners) {
        const winnerSet = new Set(winners);
        const tiltLossThreshold = Math.max(
            state.config.bigBlind * 12,
            Math.floor(state.config.startingChips * 0.18)
        );
        state.players.forEach((player, index) => {
            if (player.isHuman) {
                return;
            }
            if (winnerSet.has(index)) {
                player.tiltHands = 0;
                return;
            }
            const chipsLost = Math.max(0, player.handStartChips - player.chips);
            if (chipsLost >= tiltLossThreshold || chipsLost >= potAmount * 0.38) {
                player.tiltHands = 2;
            }
        });
    }

    function botProfileFor(player) {
        const baseStyle = player?.botStyle ?? "tag";
        const base = {
            nit: {
                foldWeakThreshold: 0.28,
                potOddsBuffer: 0.03,
                strongRaiseThreshold: 0.83,
                strongRaiseChance: 0.78,
                checkRaiseThreshold: 0.66,
                checkRaiseChance: 0.28,
                callThreshold: 0.52
            },
            tag: {
                foldWeakThreshold: 0.22,
                potOddsBuffer: 0.08,
                strongRaiseThreshold: 0.78,
                strongRaiseChance: 0.65,
                checkRaiseThreshold: 0.55,
                checkRaiseChance: 0.45,
                callThreshold: 0.42
            },
            lag: {
                foldWeakThreshold: 0.16,
                potOddsBuffer: 0.14,
                strongRaiseThreshold: 0.7,
                strongRaiseChance: 0.48,
                checkRaiseThreshold: 0.46,
                checkRaiseChance: 0.62,
                callThreshold: 0.32
            },
            maniac: {
                foldWeakThreshold: 0.11,
                potOddsBuffer: 0.2,
                strongRaiseThreshold: 0.58,
                strongRaiseChance: 0.86,
                checkRaiseThreshold: 0.35,
                checkRaiseChance: 0.8,
                callThreshold: 0.26
            },
            station: {
                foldWeakThreshold: 0.09,
                potOddsBuffer: 0.24,
                strongRaiseThreshold: 0.86,
                strongRaiseChance: 0.22,
                checkRaiseThreshold: 0.7,
                checkRaiseChance: 0.14,
                callThreshold: 0.18
            },
            trapper: {
                foldWeakThreshold: 0.2,
                potOddsBuffer: 0.09,
                strongRaiseThreshold: 0.87,
                strongRaiseChance: 0.35,
                checkRaiseThreshold: 0.8,
                checkRaiseChance: 0.18,
                callThreshold: 0.38
            }
        }[baseStyle] ?? {
            foldWeakThreshold: 0.22,
            potOddsBuffer: 0.08,
            strongRaiseThreshold: 0.78,
            strongRaiseChance: 0.65,
            checkRaiseThreshold: 0.55,
            checkRaiseChance: 0.45,
            callThreshold: 0.42
        };

        if (!player?.tiltHands) {
            return base;
        }

        return {
            foldWeakThreshold: Math.max(0.08, base.foldWeakThreshold - 0.1),
            potOddsBuffer: base.potOddsBuffer + 0.06,
            strongRaiseThreshold: Math.max(0.5, base.strongRaiseThreshold - 0.12),
            strongRaiseChance: Math.min(0.92, base.strongRaiseChance + 0.15),
            checkRaiseThreshold: Math.max(0.3, base.checkRaiseThreshold - 0.12),
            checkRaiseChance: Math.min(0.9, base.checkRaiseChance + 0.2),
            callThreshold: Math.max(0.15, base.callThreshold - 0.08)
        };
    }

    function botChooseAction(state) {
        const index = state.actionIndex;
        const legal = getLegalActions(state);
        if (legal.length === 0) {
            return { type: "fold" };
        }
        const player = state.players[index];
        const toCall = state.currentBet - state.players[index].betThisStreet;
        const strength = estimateStrength(state, index);
        const potOdds = toCall > 0 ? toCall / (state.pot + toCall) : 0;
        const canCheck = legal.some((action) => action.type === "check");
        const raises = legal.filter((action) => action.type === "raise" || action.type === "all-in");
        const profile = botProfileFor(player);

        if (!canCheck && toCall > 0) {
            if (strength < profile.foldWeakThreshold && toCall >= state.config.bigBlind * 2) {
                return legal.find((action) => action.type === "fold") ?? legal[0];
            }
            if (strength < potOdds + profile.potOddsBuffer && toCall >= state.config.bigBlind * 3) {
                return legal.find((action) => action.type === "fold") ?? legal.find((action) => action.type === "call");
            }
        }

        if (strength > profile.strongRaiseThreshold && raises.length > 0 && Math.random() < profile.strongRaiseChance) {
            const pick = raises[Math.min(raises.length - 1, Math.floor(Math.random() * raises.length))];
            return { type: pick.type, amount: pick.amount, total: pick.total };
        }

        if (canCheck) {
            if (strength > profile.checkRaiseThreshold && raises.length > 0 && Math.random() < profile.checkRaiseChance) {
                return { type: raises[0].type, amount: raises[0].amount, total: raises[0].total };
            }
            return { type: "check" };
        }

        if (strength > profile.callThreshold || toCall <= state.config.bigBlind) {
            return legal.find((action) => action.type === "call") ?? legal[0];
        }

        return legal.find((action) => action.type === "fold")
            ?? legal.find((action) => action.type === "call")
            ?? legal[0];
    }

    function isHumanTurn(state) {
        return state.phase === "betting" && state.actionIndex === 0 && canPlayerAct(state, 0);
    }

    function formatChips(value) {
        return Number(value).toLocaleString();
    }

    window.POKER_PLAY = {
        createGame,
        startHand,
        getLegalActions,
        applyAction,
        botChooseAction,
        isHumanTurn,
        formatChips,
        canPlayerAct,
        blindPositions,
        BOT_STYLE_LABELS,
        syncActionIndex
    };
}());
