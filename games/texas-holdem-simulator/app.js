const engine = window.POKER_ENGINE;
const play = window.POKER_PLAY;

const YOU_PLAYER_NAME = "You";
const QUIZ_ITERATIONS = 10000;
const PLAY_CHEATER_EQUITY_ITERATIONS = 4000;
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

function buildOvalSeatLayout(playerCount) {
    const radiusX = 46;
    const radiusY = 46;
    const centerX = 50;
    const centerY = 50;
    const seats = [];
    for (let index = 0; index < playerCount; index += 1) {
        const angle = Math.PI / 2 + index * ((2 * Math.PI) / playerCount);
        seats.push([
            centerX + radiusX * Math.cos(angle),
            centerY + radiusY * Math.sin(angle)
        ]);
    }
    return relaxSeatLayout(seats, playerCount >= 9 ? 17 : 15);
}

function relaxSeatLayout(seats, minDistance = 15) {
    const points = seats.map(([x, y]) => [x, y]);
    const count = points.length;
    const iterations = count >= 9 ? 10 : 6;

    for (let step = 0; step < iterations; step += 1) {
        for (let i = 0; i < count; i += 1) {
            for (let j = i + 1; j < count; j += 1) {
                const dx = points[j][0] - points[i][0];
                const dy = points[j][1] - points[i][1];
                const dist = Math.hypot(dx, dy) || 0.01;
                if (dist >= minDistance) {
                    continue;
                }
                const push = (minDistance - dist) / 2;
                const ux = dx / dist;
                const uy = dy / dist;
                points[i][0] -= ux * push;
                points[i][1] -= uy * push;
                points[j][0] += ux * push;
                points[j][1] += uy * push;
            }
        }

        points.forEach((point, index) => {
            const angle = Math.PI / 2 + index * ((2 * Math.PI) / count);
            const targetX = 50 + 46 * Math.cos(angle);
            const targetY = 50 + 46 * Math.sin(angle);
            point[0] += (targetX - point[0]) * 0.12;
            point[1] += (targetY - point[1]) * 0.12;
        });
    }

    return points.map(([x, y]) => [
        Math.round(Math.min(96, Math.max(4, x))),
        Math.round(Math.min(96, Math.max(4, y)))
    ]);
}

function nudgeSeatOutward(x, y, amount = 4) {
    const dx = x - 50;
    const dy = y - 50;
    const dist = Math.hypot(dx, dy) || 1;
    return [
        Math.round(Math.min(97, Math.max(3, x + (dx / dist) * amount))),
        Math.round(Math.min(97, Math.max(3, y + (dy / dist) * amount)))
    ];
}

function tableBetPosition(x, y, crowded = false) {
    const dx = 50 - x;
    const dy = 50 - y;
    const dist = Math.hypot(dx, dy) || 1;
    const minShift = crowded ? 18 : 16;
    const shift = Math.max(minShift, dist * (crowded ? 0.24 : 0.2));
    return {
        x: Math.min(88, Math.max(12, x + (dx / dist) * shift)),
        y: Math.min(84, Math.max(16, y + (dy / dist) * shift))
    };
}

const SEAT_LAYOUTS = {
    2: [[50, 90], [50, 8]],
    3: [[50, 90], [14, 38], [86, 38]],
    4: [[50, 90], [8, 55], [50, 6], [92, 55]],
    5: [[50, 90], [10, 68], [6, 34], [50, 5], [94, 34]],
    6: [[50, 90], [12, 74], [5, 48], [26, 8], [74, 8], [95, 48]],
    7: [[50, 90], [10, 76], [4, 54], [14, 20], [50, 4], [86, 20], [96, 54]],
    8: buildOvalSeatLayout(8),
    9: buildOvalSeatLayout(9),
    10: buildOvalSeatLayout(10)
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
let heroRaiseInputDraft = "";
let heroActionPreset = "none";
let botIntelOpen = false;
let playAutoNextTimer = null;
let playAutoNextKey = "";
let playToolbarCollapsed = false;
let playVisualCue = {
    handNumber: -1,
    boardCount: 0,
    bets: [],
    pot: 0
};
let playCheaterHeroEquity = null;
let playCheaterEquityCacheKey = "";

const CHIP_DENOMS = [
    { value: 100, color: "black", label: "100" },
    { value: 25, color: "green", label: "25" },
    { value: 10, color: "blue", label: "10" },
    { value: 5, color: "red", label: "5" },
    { value: 1, color: "white", label: "1" }
];

function isPlayCheaterMode() {
    return isPlayMode() && Boolean($("playCheaterMode")?.checked);
}

function syncPlayCheaterModeClass() {
    document.body.classList.toggle("poker-mode-play-cheater", isPlayCheaterMode());
}

function formatBotStyleLabel(playPlayer) {
    if (!playPlayer || playPlayer.isHuman) {
        return "";
    }
    const style = play.BOT_STYLE_LABELS[playPlayer.botStyle] ?? playPlayer.botStyle;
    return playPlayer.tiltHands > 0 ? `${style} · Tilt` : style;
}

function getBotStyleSummary(playPlayer) {
    if (!playPlayer || playPlayer.isHuman) {
        return "";
    }
    const details = play.BOT_STYLE_DETAILS[playPlayer.botStyle];
    return details?.summary ?? "";
}

function getBotStyleDetailText(playPlayer) {
    if (!playPlayer || playPlayer.isHuman) {
        return "";
    }
    const details = play.BOT_STYLE_DETAILS[playPlayer.botStyle];
    const parts = [details?.detail ?? ""];
    if (playPlayer.tiltHands > 0) {
        parts.push(`${play.TILT_DETAIL} (${playPlayer.tiltHands} hand${playPlayer.tiltHands === 1 ? "" : "s"} left)`);
    }
    return parts.filter(Boolean).join(" ");
}

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
            play: playState,
            playCheaterMode: isPlayCheaterMode()
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

function buildPlayCheaterSimulationSetup() {
    if (!playState || !isPlayCheaterMode()) {
        return null;
    }

    const hero = playState.players[0];
    if (!hero || hero.folded || hero.busted || hero.hole?.filter(Boolean).length < 2) {
        return null;
    }

    const liveEntries = playState.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => !player.folded && !player.busted && player.hole?.filter(Boolean).length === 2);

    if (liveEntries.length <= 1) {
        return { solo: true };
    }

    const heroEntry = liveEntries.find((entry) => entry.index === 0);
    if (!heroEntry) {
        return null;
    }

    const players = [
        heroEntry,
        ...liveEntries.filter((entry) => entry.index !== 0)
    ].map(({ player }) => ({
        name: player.name,
        hole: [...player.hole]
    }));

    const board = [...playState.board];
    while (board.length < 5) {
        board.push(null);
    }
    const revealedCount = playState.revealAll
        ? 5
        : board.filter(Boolean).length;
    const maskedBoard = board.map((code, index) => (
        index < revealedCount ? code : null
    ));

    return { players, board: maskedBoard };
}

function playCheaterEquityStateKey() {
    if (!playState) {
        return "";
    }
    return [
        playState.handNumber,
        playState.street,
        playState.phase,
        playState.board.join(","),
        playState.players.map((player) => (
            `${player.folded}:${player.busted}:${player.hole?.join(",") ?? ""}`
        )).join("|")
    ].join(";");
}

function updatePlayCheaterEquity() {
    if (!isPlayCheaterMode() || !playState || playState.phase === "idle") {
        playCheaterHeroEquity = null;
        playCheaterEquityCacheKey = "";
        return;
    }

    const cacheKey = playCheaterEquityStateKey();
    if (cacheKey === playCheaterEquityCacheKey) {
        return;
    }

    playCheaterHeroEquity = null;
    const setup = buildPlayCheaterSimulationSetup();
    if (!setup) {
        playCheaterEquityCacheKey = cacheKey;
        return;
    }

    if (setup.solo) {
        playCheaterHeroEquity = 100;
        playCheaterEquityCacheKey = cacheKey;
        return;
    }

    try {
        const result = engine.simulateEquity(setup.players, setup.board, {
            iterations: PLAY_CHEATER_EQUITY_ITERATIONS
        });
        playCheaterHeroEquity = result.heroEquity;
    } catch {
        playCheaterHeroEquity = null;
    }
    playCheaterEquityCacheKey = cacheKey;
}

function formatPlayHeroEquity(equity) {
    if (equity == null) {
        return "";
    }
    return `${equity.toFixed(1)}%`;
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

    if (y >= 68) {
        if (adx < 26) {
            return "bottom";
        }
        return dx > 0 ? "left" : "right";
    }
    if (y <= 20) {
        if (adx < 26) {
            return "top";
        }
        return dx > 0 ? "left" : "right";
    }
    if (x <= 22) {
        return "left";
    }
    if (x >= 78) {
        return "right";
    }
    if (adx > ady * 1.05) {
        return dx > 0 ? "left" : "right";
    }
    return y > 50 ? "bottom" : "top";
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
    mount.classList.toggle("poker-seats--crowded", state.players.length >= 8);
    mount.replaceChildren();

    state.players.forEach((player, playerIndex) => {
        const [layoutX, layoutY] = layout[playerIndex] ?? [50, 50];
        const outwardAmount = state.players.length >= 9 ? 3 : 4;
        const [x, y] = nudgeSeatOutward(layoutX, layoutY, outwardAmount);
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
        const showBotHole = state.playCheaterMode && !isHero && state.play && playPlayer;
        const showHole = state.interactive || isHero || showAllPlay || showBotHole;
        hole.forEach((code, cardIndex) => {
            const key = slotKey("player", playerIndex, cardIndex);
            const label = `${player.name} hole card ${cardIndex + 1}`;
            const peeked = !isHero && (isOpponentCardRevealed(state, playerIndex, cardIndex) || state.playCheaterMode);
            const cardVisible = showHole || peeked;
            const showFace = !playPlayer?.folded || state.playCheaterMode;
            if (state.interactive) {
                cards.appendChild(createCardSlot(key, code, label, true));
            } else if (cardVisible && showFace) {
                const cardEl = renderStaticCard(code, !code, peeked, animateHole);
                if (animateHole) {
                    cardEl.style.animationDelay = `${cardIndex * 70}ms`;
                }
                cards.appendChild(cardEl);
            } else if (state.play && !playPlayer?.folded) {
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
            if (isHero && state.playCheaterMode && playCheaterHeroEquity != null && !playPlayer?.folded) {
                footer.classList.add("poker-hero-equity-footer");
                footer.textContent = formatPlayHeroEquity(playCheaterHeroEquity);
                footer.title = "Your win equity (all live hands known in cheater mode)";
            } else if (state.playCheaterMode && !isHero && playPlayer) {
                footer.classList.add("poker-bot-style-footer");
                footer.textContent = formatBotStyleLabel(playPlayer);
                footer.title = `${formatBotStyleLabel(playPlayer)} — ${getBotStyleSummary(playPlayer)}. ${getBotStyleDetailText(playPlayer)}`;
            } else if (playPlayer?.folded) {
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
            const betPos = tableBetPosition(x, y, state.players.length >= 8);
            betMount.className = "poker-table-bet";
            betMount.style.left = `${betPos.x}%`;
            betMount.style.top = `${betPos.y}%`;
            betMount.appendChild(createChipStack(playPlayer.betThisStreet, {
                animate: shouldAnimateBet(playerIndex, playPlayer.betThisStreet),
                showLabel: true,
                size: "sm"
            }));
            mount.appendChild(betMount);
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
    if (isPlayMode()) {
        updatePlayCheaterEquity();
    } else {
        playCheaterHeroEquity = null;
        playCheaterEquityCacheKey = "";
    }
    renderBoard(state);
    renderSeats(state);
    if (isPlayMode()) {
        renderPotDisplay();
        renderPlayDock();
        syncPlayVisualCue();
        syncPlayCheaterModeClass();
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
    syncPlayCheaterModeClass();
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
            createPlaySession({ dealHand: false });
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
    let playerCount = Number.parseInt($("playPlayerCount")?.value ?? "4", 10);
    let startingChips = Number.parseInt($("playStartingChips")?.value ?? "1000", 10);
    let smallBlind = Number.parseInt($("playSmallBlind")?.value ?? "5", 10);
    let bigBlind = Number.parseInt($("playBigBlind")?.value ?? "10", 10);
    playerCount = Math.max(2, Math.min(10, Number.isFinite(playerCount) ? playerCount : 4));
    startingChips = Math.max(100, Number.isFinite(startingChips) ? startingChips : 1000);
    smallBlind = Math.max(1, Number.isFinite(smallBlind) ? smallBlind : 5);
    bigBlind = Math.max(smallBlind, Number.isFinite(bigBlind) ? bigBlind : 10);
    return {
        playerCount,
        startingChips,
        smallBlind,
        bigBlind
    };
}

function playStructureConfigChanged(ui = getPlayConfigFromUi()) {
    if (!playState) {
        return false;
    }
    return playState.config.playerCount !== ui.playerCount
        || playState.config.startingChips !== ui.startingChips;
}

function normalizePlayConfigInputs() {
    const config = getPlayConfigFromUi();
    const playerCountInput = $("playPlayerCount");
    const startingChipsInput = $("playStartingChips");
    const sbInput = $("playSmallBlind");
    const bbInput = $("playBigBlind");
    if (playerCountInput) {
        playerCountInput.value = String(config.playerCount);
    }
    if (startingChipsInput && document.activeElement !== startingChipsInput) {
        startingChipsInput.value = String(config.startingChips);
    }
    if (sbInput && document.activeElement !== sbInput) {
        sbInput.value = String(config.smallBlind);
    }
    if (bbInput && document.activeElement !== bbInput) {
        bbInput.value = String(config.bigBlind);
    }
    return config;
}

function onPlaySettingChange() {
    const config = normalizePlayConfigInputs();
    updatePlayToolbarSummary();
    if (!playState || playState.phase === "betting") {
        return;
    }
    if (!playStructureConfigChanged(config)) {
        syncPlayConfigFromUi();
        renderPlayDock();
    }
}

function getPlayAutoNextConfigFromUi() {
    let seconds = Number.parseInt($("playAutoNextSeconds")?.value ?? "2", 10);
    seconds = Math.max(1, Math.min(30, Number.isFinite(seconds) ? seconds : 2));
    return {
        enabled: true,
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
}

function updatePlayToolbarSummary() {
    const summary = $("playToolbarSummary");
    if (!summary) {
        return;
    }
    const config = getPlayConfigFromUi();
    const autoNext = getPlayAutoNextConfigFromUi();
    const autoText = `Auto ${autoNext.seconds}s`;
    const cheaterText = isPlayCheaterMode() ? "Cheater on" : "Cheater off";
    summary.textContent = `${config.playerCount} players · ${play.formatChips(config.startingChips)} chips · SB ${config.smallBlind} / BB ${config.bigBlind} · ${autoText} · ${cheaterText}`;
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
    const isTerminal = playState.phase === "hand-complete";
    if (!isTerminal) {
        stopAutoNextTimer();
        return;
    }
    const config = getPlayAutoNextConfigFromUi();
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

function isPlaySetupIdle() {
    return !playState || playState.phase === "idle";
}

function syncPlayToolbarActions() {
    const newGameBtn = $("newPlayGameBtn");
    if (!newGameBtn) {
        return;
    }
    const idle = isPlaySetupIdle();
    newGameBtn.textContent = idle ? "Start game" : "New game";
    newGameBtn.classList.toggle("btn-primary", idle);
    newGameBtn.classList.toggle("btn-outline", !idle);
}

function resetPlayToSetup() {
    createPlaySession({ dealHand: false });
    setPlayToolbarCollapsed(false);
}

function beginPlayHand() {
    if (!playState) {
        return false;
    }
    const ui = getPlayConfigFromUi();
    if (playStructureConfigChanged(ui)) {
        createPlaySession({ dealHand: true });
        return true;
    }
    syncPlayConfigFromUi();
    heroActionPreset = "none";
    const started = play.startHand(playState);
    if (!started) {
        renderTable();
        setTableLog(playState.message);
        renderPlayDock();
        return false;
    }
    setPlayToolbarCollapsed(true);
    renderTable();
    setTableLog(playState.message);
    renderPlayDock();
    schedulePlayBots();
    return true;
}

function createPlaySession({ dealHand = false } = {}) {
    stopPlayBots();
    stopAutoNextTimer();
    playState = play.createGame(getPlayConfigFromUi());
    playVisualCue = { handNumber: -1, boardCount: 0, bets: [], pot: 0 };
    lastEquities = null;
    playCheaterHeroEquity = null;
    playCheaterEquityCacheKey = "";
    heroActionPreset = "none";
    if (dealHand) {
        setPlayToolbarCollapsed(true);
        beginPlayHand();
    } else {
        setPlayToolbarCollapsed(false);
        renderTable();
        setTableLog(playState.message);
        renderPlayDock();
    }
    syncPlayToolbarActions();
}

function startNewPlayGame() {
    if (playState && playState.phase !== "idle") {
        resetPlayToSetup();
        return;
    }
    createPlaySession({ dealHand: true });
}

function dealPlayHand() {
    if (!playState) {
        resetPlayToSetup();
        return;
    }
    stopPlayBots();
    stopAutoNextTimer();

    if (playState.phase === "game-over") {
        resetPlayToSetup();
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

    beginPlayHand();
}

const HERO_ACTION_PRESETS = [
    { id: "none", label: "None" },
    { id: "check", label: "Check if free" },
    { id: "check-fold", label: "Check / Fold" },
    { id: "call", label: "Call any" },
    { id: "fold", label: "Fold" }
];

function resolveHeroPreset(preset, legal) {
    if (!preset || preset === "none" || legal.length === 0) {
        return null;
    }
    const find = (type) => legal.find((action) => action.type === type);
    if (preset === "check") {
        return find("check") ?? null;
    }
    if (preset === "check-fold") {
        return find("check") ?? find("fold") ?? null;
    }
    if (preset === "call") {
        return find("check") ?? find("call") ?? null;
    }
    if (preset === "fold") {
        return find("fold") ?? null;
    }
    return null;
}

function getPresetHint(preset) {
    switch (preset) {
        case "check":
            return "Will check when action reaches you if no bet is pending.";
        case "check-fold":
            return "Will check if free, otherwise fold.";
        case "call":
            return "Will check if free, otherwise call.";
        case "fold":
            return "Will fold when action reaches you.";
        default:
            return "";
    }
}

function renderPlayPresets(mount) {
    const wrap = document.createElement("div");
    wrap.className = "poker-play-presets";

    const label = document.createElement("p");
    label.className = "poker-play-presets-label";
    label.textContent = "Pre-action";

    const row = document.createElement("div");
    row.className = "poker-play-preset-buttons";
    HERO_ACTION_PRESETS.forEach((preset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-sm ${heroActionPreset === preset.id ? "btn-primary" : "btn-outline"}`;
        button.textContent = preset.label;
        if (preset.id !== "none") {
            button.title = getPresetHint(preset.id);
        }
        button.addEventListener("click", () => {
            heroActionPreset = preset.id;
            renderPlayDock();
        });
        row.appendChild(button);
    });

    wrap.append(label, row);
    mount.appendChild(wrap);
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

function customRaiseErrorMessage(result) {
    if (result.reason === "too_low") {
        const min = play.formatChips(result.bounds.minTotal);
        if (result.bounds.maxTotal < result.bounds.minTotal) {
            return `Not enough chips for a full raise — all-in is ${play.formatChips(result.bounds.maxTotal)}.`;
        }
        return `Minimum raise to ${min}.`;
    }
    if (result.reason === "too_high") {
        return `Maximum raise to ${play.formatChips(result.bounds.maxTotal)}.`;
    }
    if (result.reason === "invalid") {
        return "Enter a valid chip amount.";
    }
    return "Raise is not available right now.";
}

function renderHeroRaiseInput(actionsMount, raiseBounds) {
    const row = document.createElement("div");
    row.className = "poker-play-raise-custom";

    const label = document.createElement("label");
    label.className = "poker-play-raise-label";
    label.htmlFor = "playRaiseInput";
    label.textContent = "Raise to";

    const input = document.createElement("input");
    input.id = "playRaiseInput";
    input.type = "number";
    input.className = "poker-play-raise-input";
    input.min = String(raiseBounds.minTotal);
    input.max = String(raiseBounds.maxTotal);
    input.step = "1";
    input.inputMode = "numeric";
    input.value = heroRaiseInputDraft || String(raiseBounds.minTotal);
    input.addEventListener("input", () => {
        heroRaiseInputDraft = input.value;
        error.hidden = true;
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            raiseBtn.click();
        }
    });

    const hint = document.createElement("span");
    hint.className = "poker-play-raise-hint";
    hint.textContent = `Min ${play.formatChips(raiseBounds.minTotal)} · Max ${play.formatChips(raiseBounds.maxTotal)}`;

    const error = document.createElement("span");
    error.className = "poker-play-raise-error";
    error.hidden = true;
    error.setAttribute("role", "alert");

    const raiseBtn = document.createElement("button");
    raiseBtn.type = "button";
    raiseBtn.className = "btn btn-sm btn-primary poker-play-raise-submit";
    raiseBtn.textContent = "Raise";
    raiseBtn.addEventListener("click", () => {
        const result = play.buildRaiseAction(playState, input.value);
        if (!result.ok) {
            error.hidden = false;
            error.textContent = customRaiseErrorMessage(result);
            input.focus();
            return;
        }
        heroRaiseInputDraft = "";
        applyHeroPlayAction(result.action);
    });

    label.appendChild(input);
    row.append(label, hint, raiseBtn, error);
    actionsMount.appendChild(row);
}

function shortPlayerName(name) {
    return name.replace(/^Player\s+/, "P");
}

function renderPlayBotIntel(mount) {
    mount.replaceChildren();
    if (!isPlayCheaterMode() || !playState) {
        mount.hidden = true;
        return;
    }

    const bots = playState.players.filter((player) => !player.isHuman && !player.busted);
    if (bots.length === 0) {
        mount.hidden = true;
        return;
    }

    mount.hidden = false;
    const details = document.createElement("details");
    details.className = "poker-play-bot-intel";
    details.open = botIntelOpen;
    details.addEventListener("toggle", () => {
        botIntelOpen = details.open;
    });

    const summary = document.createElement("summary");
    summary.className = "poker-play-bot-intel-summary";
    const summaryLabel = document.createElement("span");
    summaryLabel.className = "poker-play-bot-intel-summary-label";
    summaryLabel.textContent = `Bot styles (${bots.length})`;
    const summaryChips = document.createElement("span");
    summaryChips.className = "poker-play-bot-intel-chips";
    summaryChips.textContent = bots
        .map((player) => `${shortPlayerName(player.name)} ${formatBotStyleLabel(player)}`)
        .join(" · ");
    summary.append(summaryLabel, summaryChips);

    const panel = document.createElement("div");
    panel.className = "poker-play-bot-intel-panel";
    bots.forEach((player) => {
        const row = document.createElement("p");
        row.className = "poker-play-bot-intel-row";
        row.textContent = `${player.name} — ${formatBotStyleLabel(player)} — ${getBotStyleDetailText(player)}`;
        panel.appendChild(row);
    });

    details.append(summary, panel);
    mount.appendChild(details);
}

function renderPlayDock() {
    if (!playState) {
        return;
    }

    const playDock = $("playDock");
    if (playDock) {
        const activeHand = playState.phase === "betting" || playState.phase === "hand-complete";
        playDock.classList.toggle("poker-play-dock--active", activeHand);
        playDock.classList.toggle("poker-play-dock--idle", playState.phase === "idle");
        playDock.classList.toggle("poker-play-dock--hand-complete", playState.phase === "hand-complete");
    }

    const potLabel = $("playPotLabel");
    const streetLabel = $("playStreetLabel");
    const message = $("playMessage");
    const actionsMount = $("playActions");

    if (potLabel) {
        potLabel.textContent = `Pot: ${play.formatChips(playState.pot)}`;
    }
    const heroEquityLabel = $("playHeroEquity");
    if (heroEquityLabel) {
        if (isPlayCheaterMode() && playCheaterHeroEquity != null && !playState.players[0]?.folded) {
            heroEquityLabel.hidden = false;
            heroEquityLabel.textContent = `Your equity: ${formatPlayHeroEquity(playCheaterHeroEquity)}`;
        } else {
            heroEquityLabel.hidden = true;
        }
    }
    if (streetLabel) {
        const street = playState.street ? playState.street.toUpperCase() : "IDLE";
        let blindText = `Blinds ${playState.config.smallBlind}/${playState.config.bigBlind}`;
        if (playState.smallBlindIndex >= 0 && playState.bigBlindIndex >= 0) {
            const sbName = shortPlayerName(playState.players[playState.smallBlindIndex]?.name ?? "?");
            const bbName = shortPlayerName(playState.players[playState.bigBlindIndex]?.name ?? "?");
            blindText = `SB ${sbName} (${playState.config.smallBlind}) · BB ${bbName} (${playState.config.bigBlind})`;
        }
        streetLabel.textContent = `${street} · ${blindText}`;
    }
    const cheaterBadge = $("playCheaterBadge");
    if (cheaterBadge) {
        cheaterBadge.hidden = !isPlayCheaterMode();
    }
    if (message) {
        if (playState.phase === "hand-complete") {
            const autoNext = getPlayAutoNextConfigFromUi();
            message.hidden = false;
            message.textContent = `${playState.message} · Next hand in ${autoNext.seconds}s`;
        } else {
            message.textContent = playState.message;
            message.hidden = playState.phase === "betting";
        }
    }

    if (actionsMount) {
        actionsMount.replaceChildren();
        if (playState.phase === "betting") {
            renderPlayPresets(actionsMount);
            if (play.isHumanTurn(playState)) {
                const legal = play.getLegalActions(playState);
                const raiseBounds = play.getRaiseBounds(playState);
                const buttonRow = document.createElement("div");
                buttonRow.className = "poker-play-action-buttons";
                legal.forEach((action) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = `btn btn-sm ${action.type === "fold" ? "btn-outline" : "btn-primary"}`;
                    button.textContent = actionLabel(action);
                    button.addEventListener("click", () => {
                        applyHeroPlayAction(action);
                    });
                    buttonRow.appendChild(button);
                });
                actionsMount.appendChild(buttonRow);
                if (raiseBounds) {
                    renderHeroRaiseInput(actionsMount, raiseBounds);
                } else {
                    heroRaiseInputDraft = "";
                }
            } else {
                heroRaiseInputDraft = "";
            }
        } else {
            heroRaiseInputDraft = "";
        }
    }

    const botIntelMount = $("playBotIntel");
    if (botIntelMount) {
        if (isPlayCheaterMode() && playState.phase !== "betting") {
            renderPlayBotIntel(botIntelMount);
        } else {
            botIntelMount.hidden = true;
            botIntelMount.replaceChildren();
        }
    }

    syncPlaySettingsDisabled();
    syncPlayAutoNextControls();
    updatePlayToolbarSummary();
    syncPlayToolbarActions();
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
        const legal = play.getLegalActions(playState);
        const autoAction = resolveHeroPreset(heroActionPreset, legal);
        if (autoAction) {
            applyHeroPlayAction(autoAction);
            return;
        }
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
    $("playToolbarToggle")?.addEventListener("click", () => {
        setPlayToolbarCollapsed(!playToolbarCollapsed);
    });
    ["playPlayerCount", "playStartingChips", "playSmallBlind", "playBigBlind"].forEach((id) => {
        const input = $(id);
        input?.addEventListener("change", onPlaySettingChange);
        if (input && input.tagName !== "SELECT") {
            input.addEventListener("input", () => {
                updatePlayToolbarSummary();
            });
        }
    });
    $("playAutoNextSeconds")?.addEventListener("input", () => {
        syncPlayAutoNextControls();
        updatePlayToolbarSummary();
        scheduleAutoNextHand();
        renderPlayDock();
    });
    $("playCheaterMode")?.addEventListener("change", () => {
        syncPlayCheaterModeClass();
        updatePlayToolbarSummary();
        renderTable();
        renderPlayDock();
    });
}

function init() {
    bindEvents();
    syncPlayerCount(playerCount);
    syncPlayAutoNextControls();
    syncPlayCheaterModeClass();
    updatePlayToolbarSummary();
    syncPlayToolbarActions();
    switchMode("play");
}

init();
