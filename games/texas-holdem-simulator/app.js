const engine = window.POKER_ENGINE;
const play = window.POKER_PLAY;

const YOU_PLAYER_NAME = "You";
const QUIZ_ITERATIONS = 10000;
const PICKER_DISPLAY_RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const DISPLAY_RANK_TO_CODE = { 10: "T" };

function displayRankToCode(displayRank) {
    return DISPLAY_RANK_TO_CODE[displayRank] ?? displayRank;
}
const SUIT_FILTER_OPTIONS = [
    { id: "all", label: "All" },
    { id: "s", label: "\u2660", red: false },
    { id: "h", label: "\u2665", red: true },
    { id: "d", label: "\u2666", red: true },
    { id: "c", label: "\u2663", red: false }
];

const SEAT_LAYOUTS = {
    2: [[50, 90], [50, 8]],
    3: [[50, 90], [14, 38], [86, 38]],
    4: [[50, 90], [8, 55], [50, 6], [92, 55]],
    5: [[50, 90], [10, 68], [6, 34], [50, 5], [94, 34]],
    6: [[50, 90], [12, 74], [5, 48], [26, 8], [74, 8], [95, 48]],
    7: [[50, 90], [10, 76], [4, 54], [14, 20], [50, 4], [86, 20], [96, 54]],
    8: [[50, 90], [8, 78], [4, 58], [10, 28], [34, 6], [66, 6], [90, 28], [96, 58]],
    9: [[50, 90], [8, 80], [4, 64], [6, 40], [22, 10], [50, 4], [78, 10], [94, 40], [96, 64]],
    10: [[50, 90], [8, 82], [4, 66], [6, 44], [20, 14], [50, 3], [80, 14], [94, 44], [96, 66], [92, 82]]
};

let playerCount = 2;
let board = [null, null, null, null, null];
let players = [
    { name: YOU_PLAYER_NAME, hole: [null, null] },
    { name: "Player 2", hole: [null, null] }
];
let activeSlot = null;
let pickerSuitFilter = "all";
let activeMode = "play";
let lastEquities = null;
let quizScenario = null;
let quizStats = { rounds: 0, correct: 0 };
let cheaterQuizStats = { rounds: 0, correct: 0 };
let playState = null;
let playBotTimer = null;
let playAutoNextTimer = null;
let playAutoNextKey = "";
let playToolbarCollapsed = false;
let playVisualCue = {
    handNumber: -1,
    boardCount: 0,
    bets: [],
    pot: 0
};

const CHIP_DENOMS = [
    { value: 100, color: "black", label: "100" },
    { value: 25, color: "green", label: "25" },
    { value: 10, color: "blue", label: "10" },
    { value: 5, color: "red", label: "5" },
    { value: 1, color: "white", label: "1" }
];

function isPlayMode(mode = activeMode) {
    return mode === "play";
}

function isQuizLikeMode(mode = activeMode) {
    return mode === "quiz" || mode === "cheater-quiz";
}

function isCheaterQuizMode(mode = activeMode) {
    return mode === "cheater-quiz";
}

function getActiveQuizStats() {
    return isCheaterQuizMode() ? cheaterQuizStats : quizStats;
}

function isOpponentCardRevealed(state, playerIndex, cardIndex) {
    if (playerIndex === 0) {
        return true;
    }
    return (state.revealedPeeks ?? []).some(
        (peek) => peek.playerIndex === playerIndex && peek.cardIndex === cardIndex
    );
}

function $(id) {
    return document.getElementById(id);
}

function setStatus(message, type = "") {
    const status = $("calcStatus");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function setQuizStatus(message, type = "") {
    const status = $("quizStatus");
    if (!status) {
        return;
    }
    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function setTableLog(message) {
    const log = $("tableLog");
    if (log) {
        log.textContent = message;
    }
}

function slotKey(kind, playerIndex, cardIndex) {
    return `${kind}:${playerIndex}:${cardIndex}`;
}

function parseSlotKey(key) {
    const [kind, playerIndex, cardIndex] = key.split(":");
    return {
        kind,
        playerIndex: Number(playerIndex),
        cardIndex: Number(cardIndex)
    };
}

function getTableState() {
    if (isPlayMode() && playState) {
        const revealed = playState.revealAll
            ? 5
            : playState.board.filter(Boolean).length;
        return {
            players: playState.players.map((player) => ({
                name: player.name,
                hole: player.hole
            })),
            board: playState.board,
            revealedBoardCount: revealed,
            revealedPeeks: [],
            interactive: false,
            play: playState
        };
    }
    if (isQuizLikeMode() && quizScenario) {
        return {
            players: quizScenario.players,
            board: quizScenario.board,
            revealedBoardCount: quizScenario.revealedBoardCount,
            revealedPeeks: quizScenario.revealedPeeks ?? [],
            interactive: false
        };
    }
    return {
        players,
        board,
        revealedBoardCount: 5,
        interactive: true
    };
}

function buildQuizSimulationSetup() {
    if (!quizScenario) {
        return null;
    }

    const simulationState = {
        revealedBoardCount: quizScenario.revealedBoardCount,
        revealedPeeks: quizScenario.revealedPeeks ?? []
    };

    const players = quizScenario.players.map((player, playerIndex) => {
        const hole = [...(player.hole ?? [null, null])];
        while (hole.length < 2) {
            hole.push(null);
        }

        if (playerIndex === 0) {
            return { name: player.name, hole: [...hole] };
        }

        if (isCheaterQuizMode()) {
            return {
                name: player.name,
                hole: hole.map((code, cardIndex) => (
                    isOpponentCardRevealed(simulationState, playerIndex, cardIndex) ? code : null
                ))
            };
        }

        return { name: player.name, hole: [null, null] };
    });

    const board = [...quizScenario.board];
    while (board.length < 5) {
        board.push(null);
    }
    const maskedBoard = board.map((code, index) => (
        index < quizScenario.revealedBoardCount ? code : null
    ));

    return { players, board: maskedBoard };
}

function getUsedCodes() {
    const state = getTableState();
    return new Set(engine.collectUsedCodes(state.players, state.board));
}

function seatRegion(x, y) {
    const dx = 50 - x;
    const dy = 50 - y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (y >= 70 && adx < 24) {
        return "bottom";
    }
    if (y <= 18 && adx < 24) {
        return "top";
    }
    if (x <= 20) {
        return "left";
    }
    if (x >= 80) {
        return "right";
    }
    if (adx > ady * 1.05) {
        return dx > 0 ? "left" : "right";
    }
    return dy > 0 ? "bottom" : "top";
}

function mountSeatContent(seat, pod) {
    seat.append(pod);
}

function closeCardPicker() {
    activeSlot = null;
    renderTable();
    renderCardPicker();
    updatePickerTarget();
}

function createCardButton(code, used) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "poker-picker-card";
    button.dataset.card = code;
    button.disabled = used.has(code);
    button.title = engine.cardLabel(code);
    button.setAttribute("aria-label", engine.cardLabel(code));
    button.innerHTML = engine.cardFaceHtml(code, "poker-picker-rank", "poker-picker-suit");
    button.addEventListener("click", () => assignCard(code));
    return button;
}

function renderSuitFilters() {
    const mount = $("pickerSuitFilters");
    if (!mount) {
        return;
    }
    mount.replaceChildren();
    SUIT_FILTER_OPTIONS.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `poker-picker-filter${pickerSuitFilter === option.id ? " active" : ""}${option.red ? " red" : ""}`;
        button.dataset.suit = option.id;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", pickerSuitFilter === option.id ? "true" : "false");
        button.textContent = option.label;
        button.addEventListener("click", () => {
            pickerSuitFilter = option.id;
            renderCardPicker();
        });
        mount.appendChild(button);
    });
}

function renderCardPicker() {
    const deck = $("cardPicker");
    if (!deck || activeMode !== "calculator") {
        updatePickerOverlay();
        return;
    }

    const used = getUsedCodes();
    if (activeSlot) {
        const current = getSlotValue(activeSlot);
        if (current) {
            used.delete(current);
        }
    }

    renderSuitFilters();
    deck.replaceChildren();

    const table = document.createElement("table");
    table.className = "poker-picker-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "poker-picker-corner";
    corner.scope = "col";
    headRow.appendChild(corner);
    PICKER_DISPLAY_RANKS.forEach((displayRank) => {
        const th = document.createElement("th");
        th.className = `poker-picker-rank-head${displayRank === "10" ? " is-ten" : ""}`;
        th.scope = "col";
        th.textContent = displayRank;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    engine.SUITS.split("").forEach((suit) => {
        if (pickerSuitFilter !== "all" && pickerSuitFilter !== suit) {
            return;
        }
        const row = document.createElement("tr");
        const suitHead = document.createElement("th");
        suitHead.className = `poker-picker-suit-head${engine.isRedSuit(`Ts`) ? " red" : ""}`;
        suitHead.scope = "row";
        suitHead.textContent = engine.SUIT_SYMBOLS[suit];
        row.appendChild(suitHead);

        PICKER_DISPLAY_RANKS.forEach((displayRank) => {
            const cell = document.createElement("td");
            const rank = displayRankToCode(displayRank);
            const code = `${rank}${suit}`;
            cell.appendChild(createCardButton(code, used));
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    deck.appendChild(table);

    const clearPickerBtn = $("clearSlotPickerBtn");
    if (clearPickerBtn) {
        clearPickerBtn.hidden = !activeSlot || !getSlotValue(activeSlot);
    }

    updatePickerOverlay();
}

function updatePickerOverlay() {
    const overlay = $("cardPickerOverlay");
    if (!overlay) {
        return;
    }
    const show = activeMode === "calculator" && Boolean(activeSlot);
    overlay.hidden = !show;
    document.body.classList.toggle("poker-picker-open", show);
}

function getSlotValue(key) {
    const slot = parseSlotKey(key);
    const state = getTableState();
    if (slot.kind === "board") {
        if (isQuizLikeMode() && slot.cardIndex >= state.revealedBoardCount) {
            return null;
        }
        return state.board[slot.cardIndex] ?? null;
    }
    return state.players[slot.playerIndex]?.hole?.[slot.cardIndex] ?? null;
}

function setSlotValue(key, code) {
    const slot = parseSlotKey(key);
    if (slot.kind === "board") {
        board[slot.cardIndex] = code;
        return;
    }
    if (!players[slot.playerIndex]) {
        return;
    }
    if (!players[slot.playerIndex].hole) {
        players[slot.playerIndex].hole = [null, null];
    }
    players[slot.playerIndex].hole[slot.cardIndex] = code;
}

function clearSlot(key) {
    setSlotValue(key, null);
    lastEquities = null;
    closeCardPicker();
}

function assignCard(code) {
    if (!activeSlot || activeMode !== "calculator") {
        return;
    }
    setSlotValue(activeSlot, code);
    lastEquities = null;
    closeCardPicker();
}

function createCardSlot(key, code, label, interactive) {
    if (!interactive) {
        return renderStaticCard(code, true);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "poker-card-slot";
    button.dataset.slot = key;
    button.setAttribute("aria-label", label);

    if (code) {
        button.classList.add("filled");
        button.innerHTML = engine.cardFaceHtml(code);
    } else {
        button.classList.add("face-down");
        button.innerHTML = '<span class="poker-card-back" aria-hidden="true"></span>';
    }

    if (activeSlot === key) {
        button.classList.add("active");
    }

    button.addEventListener("click", () => {
        activeSlot = key;
        renderTable();
        renderCardPicker();
        updatePickerTarget();
    });

    return button;
}

function renderStaticCard(code, hideUnknown = false, peeked = false, animate = false) {
    const span = document.createElement("span");
    span.className = "poker-card-slot static";
    if (peeked) {
        span.classList.add("is-peeked");
    }
    if (animate) {
        span.classList.add("is-deal-in");
    }
    if (code) {
        span.classList.add("filled");
        span.innerHTML = engine.cardFaceHtml(code);
    } else if (hideUnknown) {
        span.classList.add("face-down");
        span.innerHTML = '<span class="poker-card-back" aria-hidden="true"></span>';
    } else {
        span.classList.add("empty");
        span.textContent = "?";
    }
    return span;
}

function formatEquityBadge(equity) {
    if (!equity) {
        return "—";
    }
    return `${equity.equityPct.toFixed(1)}%`;
}

function breakdownChipPieces(amount, maxChips = 5) {
    const pieces = [];
    let remaining = Math.max(0, Math.floor(amount));
    CHIP_DENOMS.forEach((denom) => {
        while (remaining >= denom.value && pieces.length < maxChips) {
            pieces.push(denom);
            remaining -= denom.value;
        }
    });
    if (pieces.length === 0 && amount > 0) {
        pieces.push(CHIP_DENOMS[CHIP_DENOMS.length - 1]);
    }
    return pieces;
}

function createPokerChip(denom, index = 0) {
    const chip = document.createElement("span");
    chip.className = `poker-chip poker-chip--${denom.color}`;
    chip.style.setProperty("--chip-layer", index);
    chip.setAttribute("aria-hidden", "true");
    const face = document.createElement("span");
    face.className = "poker-chip-face";
    face.textContent = denom.label;
    chip.append(face);
    return chip;
}

function createChipStack(amount, options = {}) {
    const {
        size = "sm",
        animate = false,
        showLabel = true,
        maxChips = 5
    } = options;
    const stack = document.createElement("div");
    stack.className = `poker-chip-stack poker-chip-stack--${size}${animate ? " is-anim-in" : ""}`;

    if (amount <= 0) {
        stack.classList.add("is-empty");
        return stack;
    }

    breakdownChipPieces(amount, maxChips).forEach((denom, index) => {
        stack.appendChild(createPokerChip(denom, index));
    });

    if (showLabel) {
        const label = document.createElement("span");
        label.className = "poker-chip-stack-label";
        label.textContent = play.formatChips(amount);
        stack.appendChild(label);
    }

    return stack;
}

function shouldAnimateHoleCards(handNumber) {
    return handNumber !== playVisualCue.handNumber;
}

function shouldAnimateBoardCard(index, handNumber, boardCount) {
    return handNumber === playVisualCue.handNumber && index < boardCount && index >= playVisualCue.boardCount;
}

function shouldAnimateBet(playerIndex, betAmount) {
    return betAmount > (playVisualCue.bets[playerIndex] ?? 0);
}

function syncPlayVisualCue() {
    if (!playState) {
        playVisualCue = { handNumber: -1, boardCount: 0, bets: [], pot: 0 };
        return;
    }
    playVisualCue = {
        handNumber: playState.handNumber,
        boardCount: playState.board.filter(Boolean).length,
        bets: playState.players.map((player) => player.betThisStreet),
        pot: playState.pot
    };
}

function renderSeats(state) {
    const mount = $("pokerSeats");
    if (!mount) {
        return;
    }

    const layout = SEAT_LAYOUTS[state.players.length] ?? SEAT_LAYOUTS[2];
    mount.replaceChildren();

    state.players.forEach((player, playerIndex) => {
        const [x, y] = layout[playerIndex] ?? [50, 50];
        const region = seatRegion(x, y);
        const isHero = playerIndex === 0;
        const equity = lastEquities?.[playerIndex] ?? null;
        const playPlayer = state.play?.players?.[playerIndex] ?? null;

        const seat = document.createElement("div");
        seat.className = `poker-seat poker-seat-${region}${isHero ? " poker-seat-hero" : ""}`;
        if (state.play && state.play.actionIndex === playerIndex && state.play.phase === "betting") {
            seat.classList.add("is-action-seat");
        }
        if (state.play && state.play.buttonIndex === playerIndex) {
            seat.classList.add("is-dealer-seat");
        }
        seat.style.setProperty("--seat-x", `${x}%`);
        seat.style.setProperty("--seat-y", `${y}%`);

        const pod = document.createElement("div");
        pod.className = "poker-seat-pod";
        pod.setAttribute("role", "group");
        pod.setAttribute("aria-label", `${player.name} info`);

        const info = document.createElement("div");
        info.className = `poker-seat-info${isHero ? " is-hero-seat" : ""}`;
        if (playPlayer?.folded) {
            info.classList.add("is-folded-seat");
        }
        if (playPlayer?.busted) {
            info.classList.add("is-busted-seat");
        }

        const name = document.createElement("div");
        name.className = "poker-seat-name";
        if (state.play) {
            name.replaceChildren();
            const stackIcon = createChipStack(Math.min(playPlayer?.chips ?? 0, 500), {
                showLabel: false,
                maxChips: 2,
                size: "xs"
            });
            stackIcon.classList.add("poker-seat-stack-icon");
            const nameText = document.createElement("span");
            nameText.className = "poker-seat-name-text";
            nameText.textContent = `${player.name} · ${play.formatChips(playPlayer?.chips ?? 0)}`;
            name.append(stackIcon, nameText);
        } else {
            name.textContent = player.name;
        }

        const avatar = document.createElement("div");
        avatar.className = "poker-seat-avatar";

        const cards = document.createElement("div");
        cards.className = "poker-seat-cards";
        const hole = [...(player.hole ?? [null, null])];
        while (hole.length < 2) {
            hole.push(null);
        }

        const animateHole = state.play
            && shouldAnimateHoleCards(state.play.handNumber)
            && !playPlayer?.folded;

        const showAllPlay = state.play?.revealAll;
        const showHole = state.interactive || isHero || showAllPlay;
        hole.forEach((code, cardIndex) => {
            const key = slotKey("player", playerIndex, cardIndex);
            const label = `${player.name} hole card ${cardIndex + 1}`;
            const peeked = !isHero && isOpponentCardRevealed(state, playerIndex, cardIndex);
            const cardVisible = showHole || peeked;
            if (state.interactive) {
                cards.appendChild(createCardSlot(key, code, label, true));
            } else if (cardVisible && !playPlayer?.folded) {
                const cardEl = renderStaticCard(code, !code, peeked, animateHole);
                if (animateHole) {
                    cardEl.style.animationDelay = `${cardIndex * 70}ms`;
                }
                cards.appendChild(cardEl);
            } else if (state.play && !playPlayer?.folded) {
                const cardEl = renderStaticCard(null, true, false, animateHole);
                if (animateHole) {
                    cardEl.style.animationDelay = `${cardIndex * 70}ms`;
                }
                cards.appendChild(cardEl);
            } else if (cardVisible) {
                cards.appendChild(renderStaticCard(code, !code, peeked));
            } else {
                cards.appendChild(renderStaticCard(null, true));
            }
        });

        avatar.appendChild(cards);

        const footer = document.createElement("div");
        if (state.play) {
            footer.className = "poker-seat-chips";
            if (playPlayer?.folded) {
                footer.textContent = "Folded";
            } else if (playPlayer?.allIn) {
                footer.textContent = "All-in";
            } else {
                footer.innerHTML = "&nbsp;";
            }
        } else {
            footer.className = `poker-seat-equity${equity ? " has-equity" : ""}`;
            footer.title = "Equity %";
            footer.textContent = formatEquityBadge(equity);
        }

        info.append(name, avatar, footer);
        pod.appendChild(info);
        mountSeatContent(seat, pod);

        if (state.play && playPlayer?.betThisStreet > 0) {
            const betMount = document.createElement("div");
            betMount.className = "poker-seat-bet";
            betMount.appendChild(createChipStack(playPlayer.betThisStreet, {
                animate: shouldAnimateBet(playerIndex, playPlayer.betThisStreet),
                showLabel: true,
                size: "sm"
            }));
            seat.appendChild(betMount);
        }

        if (state.play && state.play.buttonIndex === playerIndex && !playPlayer?.busted) {
            const dealer = document.createElement("span");
            dealer.className = "poker-dealer-chip";
            dealer.textContent = "D";
            dealer.title = "Dealer button";
            seat.appendChild(dealer);
        }

        if (state.play && state.play.smallBlindIndex === playerIndex && !playPlayer?.busted) {
            const sb = document.createElement("span");
            sb.className = "poker-blind-chip poker-blind-chip--sb";
            sb.textContent = "SB";
            sb.title = `Small blind (${state.play.config.smallBlind})`;
            seat.appendChild(sb);
        }

        if (state.play && state.play.bigBlindIndex === playerIndex && !playPlayer?.busted) {
            const bb = document.createElement("span");
            bb.className = "poker-blind-chip poker-blind-chip--bb";
            bb.textContent = "BB";
            bb.title = `Big blind (${state.play.config.bigBlind})`;
            seat.appendChild(bb);
        }

        mount.appendChild(seat);
    });
}

function renderBoard(state) {
    const row = $("boardRow");
    if (!row) {
        return;
    }
    row.replaceChildren();

    const cards = [...state.board];
    while (cards.length < 5) {
        cards.push(null);
    }

    const playHand = state.play;
    const boardCount = playHand
        ? state.board.filter(Boolean).length
        : state.revealedBoardCount;

    cards.forEach((code, index) => {
        const key = slotKey("board", 0, index);
        const label = `Board card ${index + 1}`;
        const revealed = index < state.revealedBoardCount;
        const animateBoard = playHand
            && code
            && shouldAnimateBoardCard(index, playHand.handNumber, boardCount);
        if (state.interactive) {
            row.appendChild(createCardSlot(key, code, label, true));
        } else {
            const cardEl = renderStaticCard(revealed ? code : null, !revealed || !code, false, animateBoard);
            if (animateBoard) {
                cardEl.style.animationDelay = `${index * 85}ms`;
            }
            row.appendChild(cardEl);
        }
    });

    const label = $("boardLabel");
    if (label) {
        if (state.play) {
            const street = state.play.street ? state.play.street.toUpperCase() : "WAITING";
            label.textContent = `Pot ${play.formatChips(state.play.pot)} · ${street}`;
        } else {
            const known = cards.filter((code, index) => code && index < state.revealedBoardCount).length;
            label.textContent = known > 0 ? `${known} / 5 community cards` : "Community cards";
        }
    }
}

function renderPotDisplay() {
    const mount = $("potChips");
    const display = $("potDisplay");
    if (!mount || !playState || !isPlayMode()) {
        if (display) {
            display.hidden = true;
        }
        return;
    }

    if (display) {
        display.hidden = false;
        display.setAttribute("aria-hidden", playState.pot > 0 ? "false" : "true");
    }

    const animate = playState.pot > playVisualCue.pot;
    mount.replaceChildren();
    if (playState.pot > 0) {
        mount.appendChild(createChipStack(playState.pot, {
            size: "lg",
            animate,
            maxChips: 6
        }));
    }
}

function renderTable() {
    const state = getTableState();
    renderBoard(state);
    renderSeats(state);
    if (isPlayMode()) {
        renderPotDisplay();
        renderPlayDock();
        syncPlayVisualCue();
    } else {
        const potDisplay = $("potDisplay");
        if (potDisplay) {
            potDisplay.hidden = true;
        }
    }

    const clearBtn = $("clearSlotBtn");
    if (clearBtn) {
        clearBtn.hidden = activeMode !== "calculator" || !activeSlot || !getSlotValue(activeSlot);
    }
}

function updatePickerTarget() {
    const target = $("pickerTarget");
    if (!target) {
        updatePickerOverlay();
        return;
    }
    if (activeMode !== "calculator") {
        target.textContent = "Card picker is available in equity calculator mode.";
        updatePickerOverlay();
        return;
    }
    if (!activeSlot) {
        target.textContent = "Click any empty card on the table to open the deck.";
        setTableLog("Click a card on the table to assign it.");
        updatePickerOverlay();
        return;
    }
    const slot = parseSlotKey(activeSlot);
    if (slot.kind === "board") {
        target.textContent = `Assigning community card ${slot.cardIndex + 1} of 5`;
        setTableLog(`Pick a card for board position ${slot.cardIndex + 1}.`);
        updatePickerOverlay();
        return;
    }
    target.textContent = `Assigning ${players[slot.playerIndex]?.name ?? "player"} — hole card ${slot.cardIndex + 1}`;
    setTableLog(`Pick a card for ${players[slot.playerIndex]?.name ?? "player"}.`);
    updatePickerOverlay();
}

function syncPlayerCount(nextCount) {
    const count = Math.max(2, Math.min(10, nextCount));
    playerCount = count;
    while (players.length < count) {
        players.push({ name: `Player ${players.length + 1}`, hole: [null, null] });
    }
    while (players.length > count) {
        players.pop();
    }
    players[0].name = YOU_PLAYER_NAME;
    for (let i = 1; i < players.length; i += 1) {
        players[i].name = `Player ${i + 1}`;
    }
    lastEquities = null;
    renderTable();
    renderCardPicker();
}

function clearTable() {
    board = [null, null, null, null, null];
    players = players.map((player, index) => ({
        name: index === 0 ? YOU_PLAYER_NAME : `Player ${index + 1}`,
        hole: [null, null]
    }));
    activeSlot = null;
    lastEquities = null;
    $("resultsWrap").hidden = true;
    $("resultsEmpty").hidden = false;
    setStatus("");
    renderTable();
    renderCardPicker();
    updatePickerTarget();
}

function formatPct(value) {
    return `${value.toFixed(2)}%`;
}

function holeLabel(hole) {
    const cards = (hole ?? []).filter(Boolean);
    if (cards.length === 0) {
        return "??";
    }
    const formatCode = (code) => engine.formatRankDisplay(code[0]) + code[1];
    if (cards.length === 1) {
        return `${formatCode(cards[0])} ?`;
    }
    return cards.map(formatCode).join(" ");
}

function renderResults(result) {
    const body = $("resultsBody");
    const wrap = $("resultsWrap");
    const empty = $("resultsEmpty");
    const meta = $("resultsMeta");

    if (!body || !wrap || !empty) {
        return;
    }

    lastEquities = result.equities;
    renderTable();

    body.replaceChildren();
    result.equities.forEach((equity, index) => {
        const row = document.createElement("tr");
        if (index === 0) {
            row.classList.add("poker-hero-row");
        }
        row.innerHTML = `
            <td>${players[index].name}</td>
            <td>${holeLabel(players[index].hole)}</td>
            <td>${formatPct(equity.winPct)}</td>
            <td>${formatPct(equity.tiePct)}</td>
            <td><strong>${formatPct(equity.equityPct)}</strong></td>
        `;
        body.appendChild(row);
    });

    if (meta) {
        meta.textContent = `Based on ${result.iterations.toLocaleString()} random completions of unknown cards.`;
    }

    wrap.hidden = false;
    empty.hidden = true;
    setTableLog(`Your equity: ${formatPct(result.heroEquity)} · ${result.iterations.toLocaleString()} simulations completed.`);
}

async function runSimulation() {
    const iterations = Number.parseInt($("iterations")?.value ?? "10000", 10);
    const runBtn = $("runSimBtn");
    if (runBtn) {
        runBtn.disabled = true;
    }
    setStatus("Running simulation…");
    setTableLog("Running Monte Carlo simulation…");

    await new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });

    try {
        const result = engine.simulateEquity(players, board, {
            iterations,
            onProgress(fraction) {
                setStatus(`Running simulation… ${Math.round(fraction * 100)}%`);
                setTableLog(`Simulating… ${Math.round(fraction * 100)}%`);
            }
        });
        renderResults(result);
        setStatus(`Your equity: ${formatPct(result.heroEquity)}`, "success");
    } catch (error) {
        lastEquities = null;
        renderTable();
        $("resultsWrap").hidden = true;
        $("resultsEmpty").hidden = false;
        setStatus(error.message ?? "Simulation failed.", "error");
        setTableLog(error.message ?? "Simulation failed.");
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
        }
    }
}

function switchMode(mode) {
    const previousMode = activeMode;
    if (isPlayMode(previousMode) && !isPlayMode(mode)) {
        stopPlayBots();
        stopAutoNextTimer();
    }
    activeMode = mode;
    activeSlot = null;
    lastEquities = null;

    document.querySelectorAll(".poker-mode-tab").forEach((tab) => {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    const quizLike = isQuizLikeMode(mode);
    const playMode = isPlayMode(mode);
    document.body.classList.toggle("poker-mode-quiz", quizLike);
    document.body.classList.toggle("poker-mode-cheater-quiz", mode === "cheater-quiz");
    document.body.classList.toggle("poker-mode-play", playMode);
    $("calculatorPanel").hidden = mode !== "calculator";
    $("quizDock").hidden = !quizLike;
    $("playDock").hidden = !playMode;
    $("calcToolbar").hidden = mode !== "calculator";
    $("playToolbar").hidden = !playMode;

    const quizDock = $("quizDock");
    if (quizDock) {
        quizDock.setAttribute("aria-labelledby", mode === "cheater-quiz" ? "tabCheaterQuiz" : "tabQuiz");
    }

    const intro = document.querySelector(".poker-game-intro");
    if (intro) {
        intro.hidden = quizLike || playMode;
    }

    if (playMode) {
        stopPlayBots();
        if (!playState || !isPlayMode(previousMode)) {
            startNewPlayGame();
        } else {
            renderPlayDock();
            renderTable();
        }
    } else if (quizLike) {
        const needsNewScenario = !quizScenario
            || !isQuizLikeMode(previousMode)
            || Boolean(quizScenario.cheater) !== isCheaterQuizMode(mode);
        if (needsNewScenario) {
            startNewQuiz();
        } else {
            renderQuizMeta();
            renderTable();
        }
    } else {
        renderTable();
    }

    renderCardPicker();
    updatePickerTarget();
}

function quizBoardStageLabel(count) {
    switch (count) {
        case 0:
            return "Preflop";
        case 3:
            return "Flop";
        case 4:
            return "Turn";
        case 5:
            return "River";
        default:
            return `${count} board cards`;
    }
}

function renderQuizMeta() {
    const meta = $("quizMeta");
    const prompt = $("quizPrompt");
    if (!meta || !quizScenario) {
        return;
    }
    const stage = quizBoardStageLabel(quizScenario.revealedBoardCount);
    if (isCheaterQuizMode()) {
        const peekCount = quizScenario.revealedPeeks?.length ?? 0;
        meta.textContent = `${quizScenario.playerCount} players · ${stage} · ${peekCount} opponent card(s) peeked.`;
        if (prompt) {
            prompt.textContent = "Do you have the highest equity at the table? (You've peeked at some opponent cards.)";
        }
    } else {
        meta.textContent = `${quizScenario.playerCount} players · ${stage} · opponents hidden.`;
        if (prompt) {
            prompt.textContent = "Do you have the highest equity at the table?";
        }
    }
}

function getQuizEmptyMessage() {
    return isCheaterQuizMode()
        ? "Pick Yes or No — use the peeked opponent cards to decide."
        : "Pick Yes or No based on whether you think you're leading.";
}

function setQuizChoicesDisabled(disabled) {
    document.querySelectorAll(".poker-quiz-choice").forEach((button) => {
        button.disabled = disabled;
    });
}

function setNextQuizVisible(visible) {
    const button = $("nextQuizBtn");
    if (button) {
        button.hidden = !visible;
    }
}

function startNewQuiz() {
    quizScenario = engine.generateQuizScenario({ cheater: isCheaterQuizMode() });
    lastEquities = null;
    setQuizChoicesDisabled(false);
    setNextQuizVisible(false);
    $("quizFeedback").innerHTML = `<p class="poker-results-empty">${getQuizEmptyMessage()}</p>`;
    renderQuizMeta();
    renderTable();
    const statusPrefix = isCheaterQuizMode() ? "New hand with peeked cards" : "New hand";
    setQuizStatus(`${statusPrefix} — do you have the highest equity at the table?`);
}

function updateQuizScoreboard() {
    const boardEl = $("quizScoreboard");
    const list = $("quizScoreList");
    const stats = getActiveQuizStats();
    if (!boardEl || !list || stats.rounds === 0) {
        if (boardEl) {
            boardEl.hidden = true;
        }
        return;
    }

    const accuracy = (stats.correct / stats.rounds) * 100;
    list.innerHTML = `
        <li><span>Rounds</span> <strong>${stats.rounds}</strong></li>
        <li><span>Correct</span> <strong>${stats.correct}</strong></li>
        <li><span>Accuracy</span> <strong>${accuracy.toFixed(0)}%</strong></li>
    `;
    boardEl.hidden = false;
}

async function checkQuizGuess(guessAnswer) {
    if (!quizScenario || (guessAnswer !== "yes" && guessAnswer !== "no")) {
        return;
    }

    const iterations = QUIZ_ITERATIONS;
    setQuizChoicesDisabled(true);
    setQuizStatus("Simulating table equity…");

    await new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });

    try {
        const setup = buildQuizSimulationSetup();
        const result = engine.simulateEquity(setup.players, setup.board, { iterations });
        const grade = engine.gradeQuizGuess(guessAnswer, result.equities);
        const stats = getActiveQuizStats();
        stats.rounds += 1;
        if (grade.correct) {
            stats.correct += 1;
        }

        lastEquities = result.equities;
        renderTable();

        const ratingClass = grade.correct ? "is-correct" : "is-wrong";
        $("quizFeedback").innerHTML = `
            <div class="poker-quiz-result">
                <p class="poker-quiz-rating ${ratingClass}">${grade.rating}</p>
                <dl class="poker-quiz-stats">
                    <div><dt>Guess</dt><dd>${grade.guessLabel}</dd></div>
                    <div><dt>Result</dt><dd>${grade.actualLabel}</dd></div>
                </dl>
            </div>
        `;
        setQuizStatus(`${grade.actualLabel} · Click Next for another hand.`, grade.correct ? "success" : "error");
        setNextQuizVisible(true);
        updateQuizScoreboard();
    } catch (error) {
        setQuizChoicesDisabled(false);
        setQuizStatus(error.message ?? "Quiz simulation failed.", "error");
    }
}

function stopPlayBots() {
    if (playBotTimer) {
        clearTimeout(playBotTimer);
        playBotTimer = null;
    }
}

function stopAutoNextTimer() {
    if (playAutoNextTimer) {
        clearTimeout(playAutoNextTimer);
        playAutoNextTimer = null;
    }
    playAutoNextKey = "";
}

function getPlayConfigFromUi() {
    const playerCount = Number.parseInt($("playPlayerCount")?.value ?? "4", 10);
    const startingChips = Number.parseInt($("playStartingChips")?.value ?? "1000", 10);
    let smallBlind = Number.parseInt($("playSmallBlind")?.value ?? "5", 10);
    let bigBlind = Number.parseInt($("playBigBlind")?.value ?? "10", 10);
    smallBlind = Math.max(1, Number.isFinite(smallBlind) ? smallBlind : 5);
    bigBlind = Math.max(smallBlind, Number.isFinite(bigBlind) ? bigBlind : 10);
    return {
        playerCount,
        startingChips,
        smallBlind,
        bigBlind
    };
}

function getPlayAutoNextConfigFromUi() {
    const enabled = Boolean($("playAutoNext")?.checked);
    let seconds = Number.parseInt($("playAutoNextSeconds")?.value ?? "2", 10);
    seconds = Math.max(1, Math.min(30, Number.isFinite(seconds) ? seconds : 2));
    return {
        enabled,
        seconds,
        delayMs: seconds * 1000
    };
}

function syncPlayAutoNextControls() {
    const config = getPlayAutoNextConfigFromUi();
    const secondsInput = $("playAutoNextSeconds");
    if (secondsInput && Number.parseInt(secondsInput.value, 10) !== config.seconds) {
        secondsInput.value = String(config.seconds);
    }
    if (secondsInput) {
        secondsInput.disabled = !config.enabled;
    }
}

function updatePlayToolbarSummary() {
    const summary = $("playToolbarSummary");
    if (!summary) {
        return;
    }
    const config = getPlayConfigFromUi();
    const autoNext = getPlayAutoNextConfigFromUi();
    const autoText = autoNext.enabled ? `Auto ${autoNext.seconds}s` : "Auto off";
    summary.textContent = `${config.playerCount} players · ${play.formatChips(config.startingChips)} chips · SB ${config.smallBlind} / BB ${config.bigBlind} · ${autoText}`;
}

function setPlayToolbarCollapsed(collapsed) {
    playToolbarCollapsed = collapsed;
    const toolbar = $("playToolbar");
    const toggle = $("playToolbarToggle");
    if (toolbar) {
        toolbar.classList.toggle("poker-play-toolbar--collapsed", collapsed);
    }
    if (toggle) {
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    updatePlayToolbarSummary();
}

function syncPlaySettingsDisabled() {
    const inHand = playState?.phase === "betting";
    ["playPlayerCount", "playStartingChips", "playSmallBlind", "playBigBlind"].forEach((id) => {
        const input = $(id);
        if (input) {
            input.disabled = inHand;
        }
    });
}

function syncPlayConfigFromUi() {
    if (!playState || playState.phase === "betting") {
        return;
    }
    const ui = getPlayConfigFromUi();
    playState.config.smallBlind = ui.smallBlind;
    playState.config.bigBlind = ui.bigBlind;
    playState.minRaise = ui.bigBlind;
}

function scheduleAutoNextHand() {
    if (!playState) {
        stopAutoNextTimer();
        return;
    }
    const isTerminal = playState.phase === "hand-complete" || playState.phase === "game-over";
    if (!isTerminal) {
        stopAutoNextTimer();
        return;
    }
    const config = getPlayAutoNextConfigFromUi();
    if (!config.enabled) {
        stopAutoNextTimer();
        return;
    }
    const key = `${playState.handNumber}:${playState.phase}:${config.seconds}`;
    if (playAutoNextTimer && playAutoNextKey === key) {
        return;
    }
    stopAutoNextTimer();
    playAutoNextKey = key;
    playAutoNextTimer = setTimeout(() => {
        playAutoNextTimer = null;
        playAutoNextKey = "";
        if (!isPlayMode() || !playState) {
            return;
        }
        dealPlayHand();
    }, config.delayMs);
}

function startNewPlayGame() {
    stopPlayBots();
    stopAutoNextTimer();
    setPlayToolbarCollapsed(false);
    playState = play.createGame(getPlayConfigFromUi());
    playVisualCue = { handNumber: -1, boardCount: 0, bets: [], pot: 0 };
    lastEquities = null;
    renderTable();
    setTableLog(playState.message);
    renderPlayDock();
}

function dealPlayHand() {
    if (!playState) {
        startNewPlayGame();
        return;
    }
    stopPlayBots();
    stopAutoNextTimer();
    const nextHandBtn = $("nextHandBtn");
    if (nextHandBtn) {
        nextHandBtn.hidden = true;
    }

    if (playState.phase === "game-over") {
        startNewPlayGame();
        return;
    }

    if (playState.phase === "betting") {
        play.syncActionIndex(playState);
        if (playState.phase === "betting") {
            if (!play.isHumanTurn(playState)) {
                schedulePlayBots();
                setTableLog("Current hand is still running. Finishing it now…");
                return;
            }
            renderTable();
            setTableLog("Finish the current hand before dealing the next one.");
            return;
        }
    }

    syncPlayConfigFromUi();
    const started = play.startHand(playState);
    if (!started) {
        startNewPlayGame();
        return;
    }
    setPlayToolbarCollapsed(true);
    renderTable();
    setTableLog(playState.message);
    renderPlayDock();
    schedulePlayBots();
}

function actionLabel(action) {
    if (action.type === "fold") {
        return "Fold";
    }
    if (action.type === "check") {
        return "Check";
    }
    if (action.type === "call") {
        return action.allIn ? `Call all-in ${play.formatChips(action.amount)}` : `Call ${play.formatChips(action.amount)}`;
    }
    if (action.type === "all-in") {
        return `All-in ${play.formatChips(action.amount)}`;
    }
    return `Raise to ${play.formatChips(action.total)}`;
}

function renderPlayDock() {
    if (!playState) {
        return;
    }

    const potLabel = $("playPotLabel");
    const streetLabel = $("playStreetLabel");
    const message = $("playMessage");
    const actionsMount = $("playActions");
    const nextHandBtn = $("nextHandBtn");
    const dealBtn = $("dealHandBtn");
    const autoNextConfig = getPlayAutoNextConfigFromUi();

    if (potLabel) {
        potLabel.textContent = `Pot: ${play.formatChips(playState.pot)}`;
    }
    if (streetLabel) {
        const street = playState.street ? playState.street.toUpperCase() : "IDLE";
        let blindText = `Blinds ${playState.config.smallBlind}/${playState.config.bigBlind}`;
        if (playState.smallBlindIndex >= 0 && playState.bigBlindIndex >= 0) {
            const sbName = playState.players[playState.smallBlindIndex]?.name ?? "?";
            const bbName = playState.players[playState.bigBlindIndex]?.name ?? "?";
            blindText = `SB: ${sbName} (${playState.config.smallBlind}) · BB: ${bbName} (${playState.config.bigBlind})`;
        }
        streetLabel.textContent = `${street} · ${blindText}`;
    }
    if (message) {
        message.textContent = playState.message;
    }

    if (actionsMount) {
        actionsMount.replaceChildren();
        if (playState.phase === "betting" && play.isHumanTurn(playState)) {
            const legal = play.getLegalActions(playState);
            legal.forEach((action) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = `btn ${action.type === "fold" ? "btn-outline" : "btn-primary"}`;
                button.textContent = actionLabel(action);
                button.addEventListener("click", () => {
                    applyHeroPlayAction(action);
                });
                actionsMount.appendChild(button);
            });
        }
    }

    if (nextHandBtn) {
        const showNext = playState.phase === "hand-complete" || playState.phase === "game-over";
        nextHandBtn.hidden = !showNext;
        nextHandBtn.textContent = playState.phase === "game-over" ? "New game" : "Next hand";
        if (showNext && autoNextConfig.enabled) {
            nextHandBtn.textContent = `${nextHandBtn.textContent} (${autoNextConfig.seconds}s)`;
        }
    }
    if (dealBtn) {
        dealBtn.disabled = playState.phase === "betting";
    }
    syncPlaySettingsDisabled();
    syncPlayAutoNextControls();
    updatePlayToolbarSummary();
    scheduleAutoNextHand();
}

function applyHeroPlayAction(action) {
    if (!playState || !play.applyAction(playState, action)) {
        return;
    }
    renderTable();
    setTableLog(playState.message);
    schedulePlayBots();
}

function schedulePlayBots() {
    stopPlayBots();
    if (!playState || playState.phase !== "betting") {
        renderPlayDock();
        return;
    }

    play.syncActionIndex(playState);
    if (!playState || playState.phase !== "betting") {
        renderTable();
        setTableLog(playState?.message ?? "");
        return;
    }

    if (play.isHumanTurn(playState)) {
        renderPlayDock();
        return;
    }
    playBotTimer = setTimeout(() => {
        if (!playState || playState.phase !== "betting" || play.isHumanTurn(playState)) {
            renderPlayDock();
            return;
        }
        play.syncActionIndex(playState);
        if (!playState || playState.phase !== "betting") {
            renderTable();
            setTableLog(playState?.message ?? "");
            return;
        }
        const botAction = play.botChooseAction(playState);
        if (!play.applyAction(playState, botAction)) {
            play.syncActionIndex(playState);
        }
        renderTable();
        setTableLog(playState.message);
        schedulePlayBots();
    }, 550);
}

function bindEvents() {
    $("playerCount")?.addEventListener("change", (event) => {
        syncPlayerCount(Number.parseInt(event.target.value, 10));
    });

    $("clearTableBtn")?.addEventListener("click", clearTable);
    $("clearSlotBtn")?.addEventListener("click", () => {
        if (activeSlot) {
            clearSlot(activeSlot);
        }
    });
    $("clearSlotPickerBtn")?.addEventListener("click", () => {
        if (activeSlot) {
            clearSlot(activeSlot);
        }
    });
    $("closePickerBtn")?.addEventListener("click", closeCardPicker);
    $("cardPickerBackdrop")?.addEventListener("click", closeCardPicker);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && activeSlot && activeMode === "calculator") {
            closeCardPicker();
        }
    });
    $("runSimBtn")?.addEventListener("click", runSimulation);

    document.querySelectorAll(".poker-mode-tab").forEach((tab) => {
        tab.addEventListener("click", () => switchMode(tab.dataset.mode));
    });

    $("nextQuizBtn")?.addEventListener("click", startNewQuiz);
    $("quizForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
    });
    document.querySelectorAll(".poker-quiz-choice").forEach((button) => {
        button.addEventListener("click", () => {
            if (!button.disabled) {
                checkQuizGuess(button.dataset.guess);
            }
        });
    });

    $("newPlayGameBtn")?.addEventListener("click", startNewPlayGame);
    $("dealHandBtn")?.addEventListener("click", dealPlayHand);
    $("nextHandBtn")?.addEventListener("click", dealPlayHand);
    $("playToolbarToggle")?.addEventListener("click", () => {
        setPlayToolbarCollapsed(!playToolbarCollapsed);
    });
    ["playPlayerCount", "playStartingChips", "playSmallBlind", "playBigBlind"].forEach((id) => {
        $(id)?.addEventListener("input", () => {
            const config = getPlayConfigFromUi();
            const sbInput = $("playSmallBlind");
            const bbInput = $("playBigBlind");
            if (sbInput && Number.parseInt(sbInput.value, 10) !== config.smallBlind) {
                sbInput.value = String(config.smallBlind);
            }
            if (bbInput && Number.parseInt(bbInput.value, 10) !== config.bigBlind) {
                bbInput.value = String(config.bigBlind);
            }
            updatePlayToolbarSummary();
        });
    });
    $("playAutoNext")?.addEventListener("change", () => {
        syncPlayAutoNextControls();
        updatePlayToolbarSummary();
        scheduleAutoNextHand();
        renderPlayDock();
    });
    $("playAutoNextSeconds")?.addEventListener("input", () => {
        syncPlayAutoNextControls();
        updatePlayToolbarSummary();
        scheduleAutoNextHand();
        renderPlayDock();
    });
}

function init() {
    bindEvents();
    syncPlayerCount(playerCount);
    syncPlayAutoNextControls();
    updatePlayToolbarSummary();
    switchMode("play");
}

init();
