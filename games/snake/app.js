(() => {
    const COLS = 20;
    const ROWS = 20;
    const BOARD_PX = 480;
    const BASE_TICK_MS = 140;
    const BASE_POINTS = 10;
    const HIGH_SCORE_KEY = "snakeHighScores";
    const DIFFICULTY_KEY = "snakeDifficulty";

    const DIFFICULTY = {
        easy: { speedFactor: 2, scoreFactor: 0.5, label: "Easy" },
        normal: { speedFactor: 1, scoreFactor: 1, label: "Normal" },
        hard: { speedFactor: 0.5, scoreFactor: 2, label: "Hard" }
    };

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreValue = document.getElementById("scoreValue");
    const bestValue = document.getElementById("bestValue");
    const lengthValue = document.getElementById("lengthValue");
    const startOverlay = document.getElementById("startOverlay");
    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverMessage = document.getElementById("gameOverMessage");
    const startBtn = document.getElementById("startBtn");
    const restartBtn = document.getElementById("restartBtn");
    const dpad = document.getElementById("dpad");

    let cellSize = canvas.width / COLS;
    let snake = [];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let food = null;
    let score = 0;
    let highScores = loadHighScores();
    let difficulty = loadDifficulty();
    let tickTimer = null;
    let running = false;

    function loadHighScores() {
        try {
            const stored = localStorage.getItem(HIGH_SCORE_KEY);
            const parsed = stored ? JSON.parse(stored) : {};
            const scores = {
                easy: Number.isFinite(parsed.easy) ? parsed.easy : 0,
                normal: Number.isFinite(parsed.normal) ? parsed.normal : 0,
                hard: Number.isFinite(parsed.hard) ? parsed.hard : 0
            };

            const legacy = localStorage.getItem("snakeHighScore");
            if (legacy && !stored) {
                const legacyScore = parseInt(legacy, 10);
                if (Number.isFinite(legacyScore)) {
                    scores.normal = legacyScore;
                }
                localStorage.removeItem("snakeHighScore");
                localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores));
            }

            return scores;
        } catch {
            return { easy: 0, normal: 0, hard: 0 };
        }
    }

    function loadDifficulty() {
        const stored = localStorage.getItem(DIFFICULTY_KEY);
        return DIFFICULTY[stored] ? stored : "normal";
    }

    function saveHighScores() {
        localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
    }

    function saveDifficulty() {
        localStorage.setItem(DIFFICULTY_KEY, difficulty);
    }

    function getDifficultyConfig() {
        return DIFFICULTY[difficulty];
    }

    function pointsPerFood() {
        return BASE_POINTS * getDifficultyConfig().scoreFactor;
    }

    function updateBestDisplay() {
        bestValue.textContent = String(highScores[difficulty]);
    }

    function setDifficulty(nextDifficulty) {
        if (!DIFFICULTY[nextDifficulty] || running) {
            return;
        }

        difficulty = nextDifficulty;
        saveDifficulty();
        updateDifficultyButtons();
        updateBestDisplay();
    }

    function updateDifficultyButtons() {
        document.querySelectorAll(".snake-difficulty-btn").forEach((button) => {
            const isActive = button.dataset.difficulty === difficulty;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const size = Math.min(BOARD_PX, Math.max(rect.width, 1));
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        cellSize = size / COLS;
        draw();
    }

    function resetGame() {
        const midX = Math.floor(COLS / 2);
        const midY = Math.floor(ROWS / 2);

        snake = [
            { x: midX, y: midY },
            { x: midX - 1, y: midY },
            { x: midX - 2, y: midY }
        ];
        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        score = 0;
        food = spawnFood();
        updateHud();
    }

    function spawnFood() {
        const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
        const freeCells = [];

        for (let y = 0; y < ROWS; y += 1) {
            for (let x = 0; x < COLS; x += 1) {
                if (!occupied.has(`${x},${y}`)) {
                    freeCells.push({ x, y });
                }
            }
        }

        if (freeCells.length === 0) {
            return null;
        }

        return freeCells[Math.floor(Math.random() * freeCells.length)];
    }

    function updateHud() {
        scoreValue.textContent = String(score);
        lengthValue.textContent = String(snake.length);
    }

    function tickInterval() {
        const speedBoost = Math.min(Math.floor(score / 50), 6);
        const base = Math.max(BASE_TICK_MS - speedBoost * 12, 70);
        return base * getDifficultyConfig().speedFactor;
    }

    function scheduleTick() {
        clearTimeout(tickTimer);
        if (!running) {
            return;
        }

        tickTimer = setTimeout(() => {
            step();
            scheduleTick();
        }, tickInterval());
    }

    function step() {
        direction = nextDirection;
        const head = snake[0];
        const newHead = { x: head.x + direction.x, y: head.y + direction.y };

        if (newHead.x < 0) {
            newHead.x = COLS - 1;
        } else if (newHead.x >= COLS) {
            newHead.x = 0;
        }

        if (newHead.y < 0) {
            newHead.y = ROWS - 1;
        } else if (newHead.y >= ROWS) {
            newHead.y = 0;
        }

        if (snake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
            endGame("You bit yourself!");
            return;
        }

        snake.unshift(newHead);

        if (food && newHead.x === food.x && newHead.y === food.y) {
            score += pointsPerFood();
            if (score > highScores[difficulty]) {
                highScores[difficulty] = score;
                saveHighScores();
                updateBestDisplay();
            }
            food = spawnFood();

            if (!food) {
                endGame("You filled the board — you win!");
                return;
            }
        } else {
            snake.pop();
        }

        updateHud();
        draw();
    }

    function draw() {
        const boardSize = cellSize * COLS;

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, boardSize, boardSize);

        ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= COLS; i += 1) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, boardSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(boardSize, i * cellSize);
            ctx.stroke();
        }

        if (food) {
            const padding = cellSize * 0.15;
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.roundRect(
                food.x * cellSize + padding,
                food.y * cellSize + padding,
                cellSize - padding * 2,
                cellSize - padding * 2,
                cellSize * 0.2
            );
            ctx.fill();
        }

        snake.forEach((segment, index) => {
            const padding = cellSize * 0.1;
            const lightness = Math.max(35, 55 - index * 1.5);
            ctx.fillStyle = index === 0 ? "#4ade80" : `hsl(142, 70%, ${lightness}%)`;
            ctx.beginPath();
            ctx.roundRect(
                segment.x * cellSize + padding,
                segment.y * cellSize + padding,
                cellSize - padding * 2,
                cellSize - padding * 2,
                cellSize * 0.22
            );
            ctx.fill();
        });
    }

    function startGame() {
        resetGame();
        running = true;
        startOverlay.hidden = true;
        gameOverOverlay.hidden = true;
        draw();
        scheduleTick();
    }

    function endGame(message) {
        running = false;
        clearTimeout(tickTimer);
        gameOverMessage.textContent = message;
        gameOverOverlay.hidden = false;
    }

    function setDirection(x, y) {
        if (direction.x + x === 0 && direction.y + y === 0) {
            return;
        }

        nextDirection = { x, y };
    }

    function handleKeyDown(event) {
        const key = event.key.toLowerCase();

        if (key === " " || key === "spacebar") {
            event.preventDefault();
            if (!running && !startOverlay.hidden) {
                startGame();
            }
            return;
        }

        if (!running) {
            return;
        }

        const directions = {
            arrowup: { x: 0, y: -1 },
            w: { x: 0, y: -1 },
            arrowdown: { x: 0, y: 1 },
            s: { x: 0, y: 1 },
            arrowleft: { x: -1, y: 0 },
            a: { x: -1, y: 0 },
            arrowright: { x: 1, y: 0 },
            d: { x: 1, y: 0 }
        };

        const next = directions[key];
        if (next) {
            event.preventDefault();
            setDirection(next.x, next.y);
        }
    }

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", startGame);

    document.querySelectorAll(".snake-difficulty-btn").forEach((button) => {
        button.addEventListener("click", () => {
            setDifficulty(button.dataset.difficulty);
        });
    });

    dpad?.querySelectorAll(".snake-dpad-btn").forEach((button) => {
        button.addEventListener("click", () => {
            if (!running) {
                startGame();
            }

            const dirMap = {
                up: { x: 0, y: -1 },
                down: { x: 0, y: 1 },
                left: { x: -1, y: 0 },
                right: { x: 1, y: 0 }
            };
            const dir = dirMap[button.dataset.dir];
            if (dir) {
                setDirection(dir.x, dir.y);
            }
        });
    });

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", resizeCanvas);

    updateDifficultyButtons();
    updateBestDisplay();
    resetGame();
    resizeCanvas();
})();
