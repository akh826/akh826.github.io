/**
 * Texas Hold'em hand evaluation and Monte Carlo equity simulation.
 */
(function () {
    const RANKS = "23456789TJQKA";
    const SUITS = "shdc";
    const SUIT_SYMBOLS = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
    const HAND_NAMES = [
        "High card",
        "Pair",
        "Two pair",
        "Three of a kind",
        "Straight",
        "Flush",
        "Full house",
        "Four of a kind",
        "Straight flush"
    ];

    function parseCard(code) {
        if (!code || code.length < 2) {
            return null;
        }
        const rank = RANKS.indexOf(code[0].toUpperCase());
        const suit = SUITS.indexOf(code[1].toLowerCase());
        if (rank < 0 || suit < 0) {
            return null;
        }
        return { rank, suit, code: RANKS[rank] + SUITS[suit] };
    }

    function formatCard(card) {
        if (!card) {
            return "";
        }
        if (typeof card === "string") {
            return card;
        }
        return card.code ?? RANKS[card.rank] + SUITS[card.suit];
    }

    function formatRankDisplay(rankChar) {
        return rankChar === "T" ? "10" : rankChar;
    }

    function cardLabel(card) {
        const code = formatCard(card);
        if (!code) {
            return "";
        }
        return formatRankDisplay(code[0]) + SUIT_SYMBOLS[code[1]];
    }

    function cardFaceHtml(code, rankClassName = "poker-card-rank", suitClassName = "poker-card-suit") {
        if (!code) {
            return "";
        }
        const rankDisplay = formatRankDisplay(code[0]);
        const rankClass = rankDisplay === "10" ? `${rankClassName} is-ten` : rankClassName;
        const suitClass = `${suitClassName}${isRedSuit(code) ? " red" : ""}`;
        return `<span class="${rankClass}">${rankDisplay}</span><span class="${suitClass}">${SUIT_SYMBOLS[code[1]]}</span>`;
    }

    function isRedSuit(card) {
        const code = formatCard(card);
        return code[1] === "h" || code[1] === "d";
    }

    function createDeck() {
        const deck = [];
        for (let s = 0; s < 4; s += 1) {
            for (let r = 0; r < 13; r += 1) {
                deck.push({ rank: r, suit: s, code: RANKS[r] + SUITS[s] });
            }
        }
        return deck;
    }

    function allCardCodes() {
        return createDeck().map((card) => card.code);
    }

    function evaluate5(cards) {
        const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
        const suits = cards.map((c) => c.suit);
        const isFlush = suits.every((s) => s === suits[0]);

        const unique = [...new Set(ranks)].sort((a, b) => b - a);
        let isStraight = false;
        let straightHigh = unique[0];

        for (let i = 0; i <= unique.length - 5; i += 1) {
            if (unique[i] - unique[i + 4] === 4) {
                isStraight = true;
                straightHigh = unique[i];
                break;
            }
        }

        if (
            !isStraight &&
            unique.includes(12) &&
            unique.includes(3) &&
            unique.includes(2) &&
            unique.includes(1) &&
            unique.includes(0)
        ) {
            isStraight = true;
            straightHigh = 3;
        }

        const counts = new Map();
        ranks.forEach((rank) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
        const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
        const kickers = ranks.filter((rank) => rank !== groups[0][0]);

        if (isFlush && isStraight) {
            return [8, straightHigh];
        }
        if (groups[0][1] === 4) {
            return [7, groups[0][0], groups[1][0]];
        }
        if (groups[0][1] === 3 && groups[1][1] === 2) {
            return [6, groups[0][0], groups[1][0]];
        }
        if (isFlush) {
            return [5, ...ranks];
        }
        if (isStraight) {
            return [4, straightHigh];
        }
        if (groups[0][1] === 3) {
            const tripKickers = kickers.filter((rank) => rank !== groups[0][0]).slice(0, 2);
            return [3, groups[0][0], ...tripKickers];
        }
        if (groups[0][1] === 2 && groups[1][1] === 2) {
            const pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]).sort((a, b) => b - a);
            const kicker = ranks.find((rank) => !pairs.includes(rank));
            return [2, pairs[0], pairs[1], kicker];
        }
        if (groups[0][1] === 2) {
            const pairKickers = kickers.slice(0, 3);
            return [1, groups[0][0], ...pairKickers];
        }
        return [0, ...ranks];
    }

    function compareScores(a, b) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            const av = a[i] ?? 0;
            const bv = b[i] ?? 0;
            if (av !== bv) {
                return av - bv;
            }
        }
        return 0;
    }

    function combinations(items, size) {
        const result = [];
        function walk(start, combo) {
            if (combo.length === size) {
                result.push([...combo]);
                return;
            }
            for (let i = start; i < items.length; i += 1) {
                combo.push(items[i]);
                walk(i + 1, combo);
                combo.pop();
            }
        }
        walk(0, []);
        return result;
    }

    function bestHandScore(cards) {
        if (cards.length < 5) {
            return null;
        }
        if (cards.length === 5) {
            return evaluate5(cards);
        }
        let best = null;
        combinations(cards, 5).forEach((combo) => {
            const score = evaluate5(combo);
            if (!best || compareScores(score, best) > 0) {
                best = score;
            }
        });
        return best;
    }

    function handNameFromScore(score) {
        if (!score) {
            return "Incomplete";
        }
        return HAND_NAMES[score[0]] ?? "Unknown";
    }

    function shuffleInPlace(array, random = Math.random) {
        for (let i = array.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function normalizeKnownCards(knownCodes) {
        const parsed = [];
        const seen = new Set();
        knownCodes.forEach((code) => {
            if (!code) {
                return;
            }
            const card = parseCard(code);
            if (!card) {
                throw new Error(`Invalid card: ${code}`);
            }
            if (seen.has(card.code)) {
                throw new Error(`Duplicate card: ${card.code}`);
            }
            seen.add(card.code);
            parsed.push(card);
        });
        return parsed;
    }

    function collectUsedCodes(players, board) {
        const codes = [];
        players.forEach((player) => {
            (player.hole ?? []).forEach((code) => {
                if (code) {
                    codes.push(code);
                }
            });
        });
        (board ?? []).forEach((code) => {
            if (code) {
                codes.push(code);
            }
        });
        return codes;
    }

    function validateSetup(players, board) {
        if (!players || players.length < 2) {
            throw new Error("At least 2 players are required.");
        }
        if (players.length > 10) {
            throw new Error("Maximum 10 players supported.");
        }
        const used = collectUsedCodes(players, board);
        normalizeKnownCards(used);

        const hero = players[0];
        const heroCards = (hero.hole ?? []).filter(Boolean);
        if (heroCards.length === 0) {
            throw new Error("You (Player 1) need at least one known hole card.");
        }
    }

    function runSingleDeal(players, board, deck, random) {
        const workingDeck = shuffleInPlace([...deck], random);
        let drawIndex = 0;

        function drawCard() {
            if (drawIndex >= workingDeck.length) {
                throw new Error("Deck exhausted while dealing.");
            }
            const card = workingDeck[drawIndex];
            drawIndex += 1;
            return card;
        }

        const playerHoles = players.map((player) => {
            const hole = [...(player.hole ?? [null, null])];
            while (hole.length < 2) {
                hole.push(null);
            }
            return hole.map((code) => (code ? parseCard(code) : drawCard()));
        });

        const finalBoard = [...(board ?? [null, null, null, null, null])];
        while (finalBoard.length < 5) {
            finalBoard.push(null);
        }
        const boardCards = finalBoard.map((code) => (code ? parseCard(code) : drawCard()));

        const scores = playerHoles.map((hole) => bestHandScore([...hole, ...boardCards]));
        let bestIndex = 0;
        for (let i = 1; i < scores.length; i += 1) {
            if (compareScores(scores[i], scores[bestIndex]) > 0) {
                bestIndex = i;
            }
        }

        const winners = [];
        scores.forEach((score, index) => {
            if (compareScores(score, scores[bestIndex]) === 0) {
                winners.push(index);
            }
        });

        return { winners, scores, boardCards, playerHoles };
    }

    function simulateEquity(players, board, options = {}) {
        validateSetup(players, board);

        const iterations = Math.max(100, Math.min(options.iterations ?? 10000, 500000));
        const random = options.random ?? Math.random;
        const onProgress = options.onProgress;

        const usedCodes = collectUsedCodes(players, board);
        const usedSet = new Set(usedCodes.map((code) => parseCard(code).code));
        const deck = createDeck().filter((card) => !usedSet.has(card.code));

        const wins = new Array(players.length).fill(0);
        const ties = new Array(players.length).fill(0);

        for (let i = 0; i < iterations; i += 1) {
            const result = runSingleDeal(players, board, deck, random);
            if (result.winners.length === 1) {
                wins[result.winners[0]] += 1;
            } else {
                const share = 1 / result.winners.length;
                result.winners.forEach((index) => {
                    ties[index] += share;
                });
            }

            if (onProgress && i > 0 && i % 2000 === 0) {
                onProgress(i / iterations);
            }
        }

        const equities = players.map((_, index) => {
            const winRate = (wins[index] / iterations) * 100;
            const tieRate = (ties[index] / iterations) * 100;
            return {
                wins: wins[index],
                ties: ties[index],
                winPct: winRate,
                tiePct: tieRate,
                equityPct: winRate + tieRate
            };
        });

        return {
            iterations,
            equities,
            heroEquity: equities[0]?.equityPct ?? 0
        };
    }

    function randomInt(min, max, random = Math.random) {
        return Math.floor(random() * (max - min + 1)) + min;
    }

    function pickRandomCards(count, random = Math.random) {
        const deck = shuffleInPlace(createDeck(), random);
        return deck.slice(0, count).map((card) => card.code);
    }

    const QUIZ_BOARD_STAGES = [0, 3, 4, 5];

    function randomQuizBoardCount(random = Math.random) {
        const index = Math.floor(random() * QUIZ_BOARD_STAGES.length);
        return QUIZ_BOARD_STAGES[index];
    }

    function generateQuizScenario(options = {}) {
        const random = options.random ?? Math.random;
        const playerCount = options.playerCount ?? randomInt(2, 6, random);
        const boardCount = options.boardCount ?? randomQuizBoardCount(random);
        const cheater = options.cheater ?? false;

        if (cheater) {
            const totalCards = playerCount * 2 + boardCount;
            const allCards = pickRandomCards(totalCards, random);

            const players = [];
            let offset = 0;
            for (let i = 0; i < playerCount; i += 1) {
                players.push({
                    name: i === 0 ? "You" : `Player ${i + 1}`,
                    hole: allCards.slice(offset, offset + 2)
                });
                offset += 2;
            }

            const board = allCards.slice(offset);
            const paddedBoard = [...board];
            while (paddedBoard.length < 5) {
                paddedBoard.push(null);
            }

            const peekableSlots = [];
            for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
                for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
                    peekableSlots.push({ playerIndex, cardIndex });
                }
            }
            const peekCount = randomInt(1, peekableSlots.length, random);
            shuffleInPlace(peekableSlots, random);
            const revealedPeeks = peekableSlots.slice(0, peekCount);

            return {
                players,
                board: paddedBoard,
                revealedBoardCount: boardCount,
                playerCount,
                cheater: true,
                revealedPeeks
            };
        }

        const allCards = pickRandomCards(2 + boardCount, random);
        const heroHole = allCards.slice(0, 2);
        const board = allCards.slice(2);

        const players = [{ name: "You", hole: heroHole }];
        for (let i = 1; i < playerCount; i += 1) {
            players.push({ name: `Player ${i + 1}`, hole: [null, null] });
        }

        const paddedBoard = [...board];
        while (paddedBoard.length < 5) {
            paddedBoard.push(null);
        }

        return {
            players,
            board: paddedBoard,
            revealedBoardCount: boardCount,
            playerCount,
            cheater: false,
            revealedPeeks: []
        };
    }

    function heroHasTopEquity(equities) {
        const heroEquity = equities[0]?.equityPct ?? 0;
        return equities.every((entry, index) => index === 0 || entry.equityPct <= heroEquity + 1e-9);
    }

    function gradeQuizGuess(guessAnswer, equities) {
        const heroLeading = heroHasTopEquity(equities);
        const guessedLeading = guessAnswer === "yes";
        const guessLabel = guessedLeading ? "Yes — I'm leading" : "No";
        const heroEquity = equities[0]?.equityPct ?? 0;
        const maxEquity = Math.max(...equities.map((entry) => entry.equityPct));
        const tiedForTop = equities.filter((entry) => Math.abs(entry.equityPct - maxEquity) < 0.01).length > 1;

        let actualLabel;
        if (heroLeading && tiedForTop) {
            actualLabel = `Tied for top at ${heroEquity.toFixed(2)}%`;
        } else if (heroLeading) {
            actualLabel = `You lead at ${heroEquity.toFixed(2)}%`;
        } else {
            actualLabel = `You: ${heroEquity.toFixed(2)}% · Table high: ${maxEquity.toFixed(2)}%`;
        }

        const correct = guessedLeading === heroLeading;
        return {
            correct,
            rating: correct ? "Correct!" : "Not quite",
            guessLabel,
            actualLabel,
            heroLeading
        };
    }

    window.POKER_ENGINE = {
        RANKS,
        SUITS,
        SUIT_SYMBOLS,
        HAND_NAMES,
        parseCard,
        formatCard,
        formatRankDisplay,
        cardLabel,
        cardFaceHtml,
        isRedSuit,
        allCardCodes,
        bestHandScore,
        handNameFromScore,
        compareScores,
        simulateEquity,
        generateQuizScenario,
        gradeQuizGuess,
        validateSetup,
        collectUsedCodes
    };
}());
