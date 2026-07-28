(function () {
    "use strict";

    const DATA = window.CHINESE_TYPING_DATA;
    const CANGJIE_MAP = window.CANGJIE_MAP || {};
    // Prefer Hong Kong / Microsoft Cangjie 3 codes when the base map differs.
    const CANGJIE_OVERRIDES = {
        麵: { cj: "JNMWL", sc: "JL" },
        麻: { cj: "IJCC", sc: "IC" },
    };
    const STORAGE_KEY = "chinese-typing-progress";
    const PASS_ACCURACY = 90;

    const els = {
        modeScreen: document.getElementById("modeScreen"),
        stagesScreen: document.getElementById("stagesScreen"),
        playScreen: document.getElementById("playScreen"),
        resultScreen: document.getElementById("resultScreen"),
        stageList: document.getElementById("stageList"),
        btnStages: document.getElementById("btnStages"),
        btnInfinite: document.getElementById("btnInfinite"),
        btnCodePractice: document.getElementById("btnCodePractice"),
        btnCodeDrill: document.getElementById("btnCodeDrill"),
        stagesBackBtn: document.getElementById("stagesBackBtn"),
        playBackBtn: document.getElementById("playBackBtn"),
        endSessionBtn: document.getElementById("endSessionBtn"),
        playHeading: document.getElementById("playHeading"),
        promptMeta: document.getElementById("promptMeta"),
        promptDisplay: document.getElementById("promptDisplay"),
        codeToolbar: document.getElementById("codeToolbar"),
        codeBtnSucheng: document.getElementById("codeBtnSucheng"),
        codeBtnCangjie: document.getElementById("codeBtnCangjie"),
        typingInput: document.getElementById("typingInput"),
        typingInputLabel: document.getElementById("typingInputLabel"),
        submitBtn: document.getElementById("submitBtn"),
        playHint: document.getElementById("playHint"),
        virtualKeyboard: document.getElementById("virtualKeyboard"),
        vkbRows: document.getElementById("vkbRows"),
        vkbCurrent: document.getElementById("vkbCurrent"),
        statWpm: document.getElementById("statWpm"),
        statAccuracy: document.getElementById("statAccuracy"),
        statTime: document.getElementById("statTime"),
        statProgress: document.getElementById("statProgress"),
        statPromptNo: document.getElementById("statPromptNo"),
        resultHeading: document.getElementById("resultHeading"),
        resultWpm: document.getElementById("resultWpm"),
        resultAccuracy: document.getElementById("resultAccuracy"),
        resultTime: document.getElementById("resultTime"),
        resultChars: document.getElementById("resultChars"),
        resultMessage: document.getElementById("resultMessage"),
        resultRetryBtn: document.getElementById("resultRetryBtn"),
        resultHomeBtn: document.getElementById("resultHomeBtn"),
    };

    /** @type {{ mode: 'stages'|'infinite'|'code'|'drill', stageId: number|null, target: string, drillChar: string, drillRevealed: boolean, startTime: number|null, composing: boolean, finishedCorrect: number, finishedTyped: number, finishedMs: number, promptsDone: number, lastPrompt: string, passed: boolean|null, timerId: number|null, codeMethod: 'sucheng'|'cangjie' }} */
    const state = {
        mode: "stages",
        stageId: null,
        target: "",
        drillChar: "",
        drillRevealed: false,
        startTime: null,
        composing: false,
        finishedCorrect: 0,
        finishedTyped: 0,
        finishedMs: 0,
        promptsDone: 0,
        lastPrompt: "",
        passed: null,
        timerId: null,
        codeMethod: "sucheng",
    };

    function loadProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { clearedMax: 0 };
            const data = JSON.parse(raw);
            return {
                clearedMax: Math.max(0, Number(data.clearedMax) || 0),
            };
        } catch {
            return { clearedMax: 0 };
        }
    }

    function saveProgress(clearedMax) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ clearedMax: Math.max(0, clearedMax) })
        );
    }

    function showScreen(name) {
        els.modeScreen.hidden = name !== "mode";
        els.stagesScreen.hidden = name !== "stages";
        els.playScreen.hidden = name !== "play";
        els.resultScreen.hidden = name !== "result";
    }

    function formatTime(ms) {
        const totalSec = Math.floor(Math.max(0, ms) / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m + ":" + String(s).padStart(2, "0");
    }

    function countMatches(target, typed) {
        let correct = 0;
        const len = Math.min(target.length, typed.length);
        for (let i = 0; i < len; i++) {
            if (typed[i] === target[i]) correct++;
        }
        return correct;
    }

    function getElapsedMs() {
        if (state.startTime == null) return state.finishedMs;
        return state.finishedMs + (Date.now() - state.startTime);
    }

    function getLiveStats() {
        const typed = els.typingInput.value;
        const currentCorrect = countMatches(state.target, typed);
        const currentTyped = typed.length;
        const totalCorrect = state.finishedCorrect + currentCorrect;
        const totalTyped = state.finishedTyped + currentTyped;
        const elapsedMs = getElapsedMs();
        const minutes = elapsedMs / 60000;
        const wpm = minutes > 0 ? Math.round((totalCorrect / 5) / minutes) : 0;
        const accuracy =
            totalTyped > 0
                ? Math.round((totalCorrect / totalTyped) * 1000) / 10
                : 100;
        return {
            wpm,
            accuracy,
            elapsedMs,
            totalCorrect,
            totalTyped,
            currentTyped,
            targetLen: state.target.length,
        };
    }

    const CANGJIE_RADICALS = {
        Q: "手",
        W: "田",
        E: "水",
        R: "口",
        T: "廿",
        Y: "卜",
        U: "山",
        I: "戈",
        O: "人",
        P: "心",
        A: "日",
        S: "尸",
        D: "木",
        F: "火",
        G: "土",
        H: "竹",
        J: "十",
        K: "大",
        L: "中",
        Z: "重",
        X: "難",
        C: "金",
        V: "女",
        B: "月",
        N: "弓",
        M: "一",
    };

    const VKB_ROWS = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M"],
    ];

    /** @type {Record<string, HTMLElement>} */
    const vkbKeyEls = {};

    function buildVirtualKeyboard() {
        els.vkbRows.replaceChildren();
        VKB_ROWS.forEach(function (row, rowIndex) {
            const rowEl = document.createElement("div");
            rowEl.className = "typing-vkb-row";
            rowEl.dataset.row = String(rowIndex);
            row.forEach(function (letter) {
                const key = document.createElement("div");
                key.className = "typing-vkb-key";
                key.dataset.key = letter;

                const letterEl = document.createElement("span");
                letterEl.className = "typing-vkb-letter";
                letterEl.textContent = letter;

                const radicalEl = document.createElement("span");
                radicalEl.className = "typing-vkb-radical";
                radicalEl.textContent = CANGJIE_RADICALS[letter] || "";

                key.appendChild(letterEl);
                key.appendChild(radicalEl);
                if (letter === "F" || letter === "J") {
                    key.classList.add("has-bump");
                    const bump = document.createElement("span");
                    bump.className = "typing-vkb-bump";
                    bump.setAttribute("aria-hidden", "true");
                    key.appendChild(bump);
                }
                rowEl.appendChild(key);
                vkbKeyEls[letter] = key;
            });
            els.vkbRows.appendChild(rowEl);
        });
    }

    function codeToRadicals(code) {
        return String(code || "")
            .toUpperCase()
            .split("")
            .map(function (letter) {
                return CANGJIE_RADICALS[letter] || letter;
            })
            .join("");
    }

    function updateVirtualKeyboard() {
        if (!els.virtualKeyboard || els.virtualKeyboard.hidden) return;

        Object.keys(vkbKeyEls).forEach(function (letter) {
            const key = vkbKeyEls[letter];
            key.classList.remove("is-active", "is-next");
            const step = key.querySelector(".typing-vkb-step");
            if (step) step.remove();
        });

        let ch = "";
        let code = "";

        if (isDrillMode()) {
            ch = state.drillChar;
            code = state.target;
        } else {
            const typed = els.typingInput.value;
            const idx = Math.min(typed.length, Math.max(0, state.target.length - 1));
            ch = state.target.charAt(idx);
            if (!ch || !/[\u4e00-\u9fff]/.test(ch)) {
                els.vkbCurrent.textContent = "標點或空白無需碼";
                return;
            }
            code = getCharCode(ch);
        }

        if (!ch) {
            els.vkbCurrent.textContent = "";
            return;
        }

        if (!code) {
            els.vkbCurrent.textContent = ch + "（無碼資料）";
            return;
        }

        const letters = code.toUpperCase().split("");
        const radicalStr = codeToRadicals(code);
        els.vkbCurrent.textContent =
            "目前「" + ch + "」→ " + code + "（" + radicalStr + "）";

        letters.forEach(function (letter, i) {
            const key = vkbKeyEls[letter];
            if (!key) return;
            key.classList.add("is-active");
            if (i === 0) key.classList.add("is-next");

            if (!key.querySelector(".typing-vkb-step")) {
                const badge = document.createElement("span");
                badge.className = "typing-vkb-step";
                badge.textContent = String(i + 1);
                key.appendChild(badge);
            }
        });
    }

    function getCharCode(ch) {
        const entry = CANGJIE_OVERRIDES[ch] || CANGJIE_MAP[ch];
        if (!entry) return "";
        return state.codeMethod === "cangjie" ? entry.cj : entry.sc;
    }

    function isCodeMode() {
        return state.mode === "code";
    }

    function isDrillMode() {
        return state.mode === "drill";
    }

    function isInfiniteLike() {
        return (
            state.mode === "infinite" ||
            state.mode === "code" ||
            state.mode === "drill"
        );
    }

    function setInputModeForSession() {
        if (isDrillMode()) {
            els.typingInput.lang = "en";
            els.typingInput.setAttribute("inputmode", "latin");
            els.typingInputLabel.textContent =
                "在此輸入英文字母碼（關閉中文輸入法，直接打 A–Z）";
        } else {
            els.typingInput.lang = "zh-Hant";
            els.typingInput.setAttribute("inputmode", "text");
            els.typingInputLabel.textContent = "在此輸入（使用系統輸入法）";
        }
    }

    function setCodeMethod(method) {
        state.codeMethod = method === "cangjie" ? "cangjie" : "sucheng";
        els.codeBtnSucheng.classList.toggle("active", state.codeMethod === "sucheng");
        els.codeBtnCangjie.classList.toggle("active", state.codeMethod === "cangjie");
        if (els.playScreen.hidden) return;

        if (isDrillMode() && state.drillChar) {
            const nextCode = getCharCode(state.drillChar);
            if (nextCode) {
                state.target = nextCode;
                state.drillRevealed = false;
                els.typingInput.value = "";
            }
        }
        renderPrompt();
        updateVirtualKeyboard();
    }

    function updateStatsUi() {
        const s = getLiveStats();
        els.statWpm.textContent = String(s.wpm);
        els.statAccuracy.textContent = s.accuracy + "%";
        els.statTime.textContent = formatTime(s.elapsedMs);
        els.statProgress.textContent = s.currentTyped + "/" + s.targetLen;
        if (isInfiniteLike()) {
            els.statPromptNo.textContent = String(state.promptsDone + 1);
        } else if (state.mode === "stages" && state.stageId != null) {
            els.statPromptNo.textContent = String(state.stageId);
        } else {
            els.statPromptNo.textContent = "—";
        }
    }

    function renderPrompt() {
        const typed = els.typingInput.value;
        const target = state.target;
        const frag = document.createDocumentFragment();

        if (isDrillMode()) {
            els.promptDisplay.classList.add("is-code-mode");
            const card = document.createElement("div");
            card.className = "typing-drill-card";

            const codeLabel = document.createElement("div");
            codeLabel.className = "typing-drill-code-label";
            codeLabel.textContent =
                state.codeMethod === "cangjie" ? "倉頡碼" : "速成碼";

            const codeRow = document.createElement("div");
            codeRow.className = "typing-drill-code-row";

            for (let i = 0; i < target.length; i++) {
                const col = document.createElement("div");
                col.className = "typing-drill-col";

                const radicalEl = document.createElement("span");
                radicalEl.className = "typing-drill-radical";
                radicalEl.textContent =
                    CANGJIE_RADICALS[target[i]] || target[i];

                const letterEl = document.createElement("span");
                letterEl.className = "typing-drill-code-letter";
                if (i < typed.length) {
                    letterEl.textContent = typed[i];
                    letterEl.classList.add(
                        typed[i] === target[i] ? "is-correct" : "is-wrong"
                    );
                } else {
                    letterEl.textContent = "";
                    letterEl.classList.add("is-blank");
                    if (i === typed.length) letterEl.classList.add("is-current");
                }

                col.appendChild(radicalEl);
                col.appendChild(letterEl);
                codeRow.appendChild(col);
            }

            card.appendChild(codeLabel);
            card.appendChild(codeRow);

            if (state.drillRevealed) {
                const answer = document.createElement("div");
                answer.className = "typing-drill-answer";
                answer.innerHTML =
                    "正確答案：<span class=\"typing-drill-answer-code\">" +
                    target +
                    "</span>（" +
                    codeToRadicals(target) +
                    "）・字：<strong>" +
                    state.drillChar +
                    "</strong>・按 Tab／提交下一題";
                card.appendChild(answer);
            }

            frag.appendChild(card);
            els.promptDisplay.replaceChildren(frag);
            return;
        }

        const showCodes = isCodeMode();
        els.promptDisplay.classList.toggle("is-code-mode", showCodes);

        for (let i = 0; i < target.length; i++) {
            const ch = target[i];
            let statusClass = "is-pending";
            if (i < typed.length) {
                statusClass = typed[i] === ch ? "is-correct" : "is-wrong";
            } else if (i === typed.length) {
                statusClass = "is-current";
            }

            if (showCodes) {
                const cell = document.createElement("span");
                cell.className = "typing-char-cell " + statusClass;

                const charSpan = document.createElement("span");
                charSpan.className = "typing-char";
                charSpan.textContent = ch;

                const codeSpan = document.createElement("span");
                codeSpan.className = "typing-char-code";
                codeSpan.textContent = /[\u4e00-\u9fff]/.test(ch)
                    ? getCharCode(ch) || "—"
                    : "";

                cell.appendChild(charSpan);
                cell.appendChild(codeSpan);
                frag.appendChild(cell);
            } else {
                const span = document.createElement("span");
                span.className = "typing-char " + statusClass;
                span.textContent = ch;
                frag.appendChild(span);
            }
        }

        els.promptDisplay.replaceChildren(frag);
        updateVirtualKeyboard();
    }

    function startTimer() {
        stopTimer();
        state.timerId = window.setInterval(updateStatsUi, 200);
    }

    function stopTimer() {
        if (state.timerId != null) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
    }

    function ensureTimerStarted() {
        if (state.startTime == null) {
            state.startTime = Date.now();
            startTimer();
        }
    }

    function pickRandomPrompt() {
        const pool = [];

        if (isDrillMode()) {
            const seen = {};
            DATA.words.forEach(function (w) {
                for (let i = 0; i < w.length; i++) {
                    const ch = w.charAt(i);
                    if (!/[\u4e00-\u9fff]/.test(ch) || seen[ch]) continue;
                    const code = getCharCode(ch);
                    if (!code) continue;
                    seen[ch] = true;
                    pool.push({ text: ch, kind: "字", code: code });
                }
            });
        } else if (isCodeMode()) {
            DATA.words.forEach(function (w) {
                pool.push({ text: w, kind: "詞" });
            });
        } else {
            DATA.words.forEach(function (w) {
                pool.push({ text: w, kind: "詞" });
            });
            DATA.sentences.forEach(function (s) {
                pool.push({ text: s, kind: "句" });
            });
        }

        if (!pool.length) {
            return { text: "一", kind: "字", code: getCharCode("一") || "M" };
        }

        let choice = pool[Math.floor(Math.random() * pool.length)];
        let guard = 0;
        const lastKey = isDrillMode() ? state.drillChar : state.lastPrompt;
        while (
            (isDrillMode() ? choice.text : choice.text) === lastKey &&
            pool.length > 1 &&
            guard < 20
        ) {
            choice = pool[Math.floor(Math.random() * pool.length)];
            guard++;
        }
        return choice;
    }

    function setPrompt(text, meta) {
        state.target = text;
        state.lastPrompt = text;
        els.typingInput.value = "";
        els.promptMeta.textContent = meta || "";
        renderPrompt();
        updateStatsUi();
        els.typingInput.focus();
    }

    function setDrillPrompt(ch, meta) {
        const code = getCharCode(ch);
        state.drillChar = ch;
        state.drillRevealed = false;
        state.target = code;
        state.lastPrompt = ch;
        els.typingInput.value = "";
        els.promptMeta.textContent = meta || "";
        renderPrompt();
        updateStatsUi();
        els.typingInput.focus();
    }

    function beginStage(stageId) {
        const stage = DATA.stages.find(function (s) {
            return s.id === stageId;
        });
        if (!stage) return;

        resetSession("stages", stageId);
        setInputModeForSession();
        els.playHeading.textContent = stage.title;
        els.endSessionBtn.hidden = true;
        els.codeToolbar.hidden = true;
        els.virtualKeyboard.hidden = true;
        els.playHint.textContent =
            "開始輸入後計時。完成後按 Tab 或「提交」結算；正確率達 " +
            PASS_ACCURACY +
            "% 即可通關。";
        showScreen("play");
        setPrompt(stage.texts.join(" "), "關卡 " + stage.id + "・" + stage.hint);
    }

    function beginInfinite() {
        resetSession("infinite", null);
        setInputModeForSession();
        els.playHeading.textContent = "無限隨機";
        els.endSessionBtn.hidden = false;
        els.codeToolbar.hidden = true;
        els.virtualKeyboard.hidden = true;
        els.playHint.textContent =
            "打完後按 Tab 或「提交」進入下一題。統計整場累計，可隨時「結束本場」。";
        showScreen("play");
        const pick = pickRandomPrompt();
        setPrompt(pick.text, "隨機・" + pick.kind + "・第 1 題");
    }

    function beginCodePractice() {
        resetSession("code", null);
        setInputModeForSession();
        els.playHeading.textContent = "倉頡／速成練習";
        els.endSessionBtn.hidden = false;
        els.codeToolbar.hidden = false;
        els.virtualKeyboard.hidden = false;
        setCodeMethod(state.codeMethod);
        els.playHint.textContent =
            "每個字下方顯示輸入碼，下方鍵盤會高亮對應鍵位。打出中文後按 Tab 或「提交」下一題。";
        showScreen("play");
        const pick = pickRandomPrompt();
        setPrompt(pick.text, "碼表練習・" + pick.kind + "・第 1 題");
    }

    function beginCodeDrill() {
        resetSession("drill", null);
        setInputModeForSession();
        els.playHeading.textContent = "英文字母速練";
        els.endSessionBtn.hidden = false;
        els.codeToolbar.hidden = false;
        els.virtualKeyboard.hidden = true;
        setCodeMethod(state.codeMethod);
        els.playHint.textContent =
            "顯示倉頡字根（速成 2 碼／倉頡全碼），在下方打出對應英文字母；打對自動下一題，打錯會顯示正確答案。";
        showScreen("play");
        const pick = pickRandomPrompt();
        setDrillPrompt(pick.text, "速練・單字・第 1 題");
    }

    function resetSession(mode, stageId) {
        stopTimer();
        state.mode = mode;
        state.stageId = stageId;
        state.target = "";
        state.drillChar = "";
        state.drillRevealed = false;
        state.startTime = null;
        state.composing = false;
        state.finishedCorrect = 0;
        state.finishedTyped = 0;
        state.finishedMs = 0;
        state.promptsDone = 0;
        state.lastPrompt = "";
        state.passed = null;
        els.typingInput.value = "";
        els.typingInput.disabled = false;
        els.promptDisplay.classList.remove("is-code-mode");
        updateStatsUi();
    }

    function finishPromptInfinite() {
        const typed = els.typingInput.value;
        const correct = countMatches(state.target, typed);
        state.finishedCorrect += correct;
        state.finishedTyped += Math.max(typed.length, state.drillRevealed ? state.target.length : typed.length);
        if (state.startTime != null) {
            state.finishedMs += Date.now() - state.startTime;
            state.startTime = Date.now();
        }
        state.promptsDone += 1;

        if (isDrillMode()) {
            els.playHint.textContent =
                "顯示倉頡字根（速成 2 碼／倉頡全碼），在下方打出對應英文字母；打對自動下一題，打錯會顯示正確答案。";
            const pick = pickRandomPrompt();
            setDrillPrompt(
                pick.text,
                "速練・單字・第 " + (state.promptsDone + 1) + " 題"
            );
            return;
        }

        els.playHint.textContent = isCodeMode()
            ? "每個字下方顯示輸入碼，下方鍵盤會高亮對應鍵位。打出中文後按 Tab 或「提交」下一題。"
            : "打完後按 Tab 或「提交」進入下一題。統計整場累計，可隨時「結束本場」。";

        const pick = pickRandomPrompt();
        const prefix = isCodeMode() ? "碼表練習" : "隨機";
        setPrompt(
            pick.text,
            prefix + "・" + pick.kind + "・第 " + (state.promptsDone + 1) + " 題"
        );
        updateStatsUi();
    }

    function finishStage() {
        const stats = getLiveStats();
        if (state.startTime != null) {
            state.finishedMs += Date.now() - state.startTime;
            state.startTime = null;
        }
        stopTimer();

        // Fold final prompt into totals for result
        state.finishedCorrect = stats.totalCorrect;
        state.finishedTyped = stats.totalTyped;

        const passed = stats.accuracy >= PASS_ACCURACY;
        state.passed = passed;

        if (passed && state.stageId != null) {
            const progress = loadProgress();
            if (state.stageId > progress.clearedMax) {
                saveProgress(state.stageId);
            }
        }

        els.typingInput.disabled = true;
        showResult({
            title: passed ? "關卡通關！" : "尚未通關",
            message: passed
                ? "正確率達標，已記錄進度。" +
                  (state.stageId < DATA.stages.length
                      ? "下一關已解鎖。"
                      : "你已完成全部關卡！")
                : "需要正確率至少 " +
                  PASS_ACCURACY +
                  "%（目前 " +
                  stats.accuracy +
                  "%）。可以再試一次。",
            stats: stats,
        });
    }

    function endInfiniteSession() {
        const stats = getLiveStats();
        if (state.startTime != null) {
            state.finishedMs += Date.now() - state.startTime;
            state.startTime = null;
        }
        stopTimer();
        state.finishedCorrect = stats.totalCorrect;
        state.finishedTyped = stats.totalTyped;
        state.passed = null;
        els.typingInput.disabled = true;

        const done = state.promptsDone + (stats.currentTyped > 0 ? 1 : 0);
        showResult({
            title: "本場結算",
            message:
                done > 0
                    ? "本場共練習 " + done + " 題，繼續保持！"
                    : "還沒開始輸入就結束了，再來一次吧。",
            stats: stats,
        });
    }

    function showResult(opts) {
        showScreen("result");
        els.resultHeading.textContent = opts.title;
        els.resultMessage.textContent = opts.message;
        els.resultWpm.textContent = String(opts.stats.wpm);
        els.resultAccuracy.textContent = opts.stats.accuracy + "%";
        els.resultTime.textContent = formatTime(opts.stats.elapsedMs);
        els.resultChars.textContent = String(opts.stats.totalCorrect);
    }

    function onInput() {
        if (state.composing && !isDrillMode()) return;
        if (els.playScreen.hidden) return;

        if (isDrillMode()) {
            // Keep A–Z only for code drill
            const cleaned = els.typingInput.value
                .toUpperCase()
                .replace(/[^A-Z]/g, "");
            if (cleaned !== els.typingInput.value) {
                els.typingInput.value = cleaned;
            }
        }

        const typed = els.typingInput.value;
        if (typed.length > 0) ensureTimerStarted();

        if (typed.length > state.target.length) {
            els.typingInput.value = typed.slice(0, state.target.length);
        }

        const current = els.typingInput.value;

        if (isDrillMode() && state.target) {
            for (let i = 0; i < current.length; i++) {
                if (current[i] !== state.target[i]) {
                    state.drillRevealed = true;
                    break;
                }
            }
        }

        renderPrompt();
        updateStatsUi();

        // Drill: auto-advance only when the English code matches exactly
        if (
            isDrillMode() &&
            state.target &&
            current === state.target
        ) {
            finishPromptInfinite();
        }
    }

    function submitPrompt() {
        if (els.playScreen.hidden || els.typingInput.disabled) return;
        if (state.composing && !isDrillMode()) return;

        const current = els.typingInput.value;

        // After a wrong answer is revealed, allow skipping to next drill
        if (isDrillMode() && state.drillRevealed) {
            finishPromptInfinite();
            return;
        }

        if (!state.target || current.length < state.target.length) {
            els.playHint.textContent =
                "請先打完整碼／全文，再按 Tab 或「提交」。本題進度 " +
                current.length +
                "/" +
                state.target.length +
                "。";
            els.typingInput.focus();
            return;
        }

        if (isInfiniteLike()) {
            finishPromptInfinite();
        } else {
            finishStage();
        }
    }

    function renderStageList() {
        const progress = loadProgress();
        const unlockedMax = progress.clearedMax + 1;
        els.stageList.replaceChildren();

        DATA.stages.forEach(function (stage) {
            const unlocked = stage.id <= unlockedMax;
            const cleared = stage.id <= progress.clearedMax;

            const li = document.createElement("li");
            li.className = "typing-stage-item";
            if (!unlocked) li.classList.add("is-locked");
            if (cleared) li.classList.add("is-cleared");

            const info = document.createElement("div");
            info.className = "typing-stage-info";

            const title = document.createElement("div");
            title.className = "typing-stage-title";
            if (cleared) {
                const badge = document.createElement("span");
                badge.className = "typing-stage-badge";
                badge.textContent = "已通關";
                title.appendChild(badge);
            }
            title.appendChild(document.createTextNode(stage.title));

            const hint = document.createElement("div");
            hint.className = "typing-stage-hint";
            hint.textContent = unlocked
                ? stage.hint
                : "通過上一關後解鎖";

            info.appendChild(title);
            info.appendChild(hint);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-primary";
            if (unlocked) {
                btn.textContent = cleared ? "重玩" : "開始";
                btn.addEventListener("click", function () {
                    beginStage(stage.id);
                });
            } else {
                btn.textContent = "鎖定";
                btn.disabled = true;
                btn.className = "btn btn-outline";
            }

            li.appendChild(info);
            li.appendChild(btn);
            els.stageList.appendChild(li);
        });
    }

    function goHome() {
        stopTimer();
        els.typingInput.disabled = false;
        els.codeToolbar.hidden = true;
        els.virtualKeyboard.hidden = true;
        els.typingInput.lang = "zh-Hant";
        els.typingInput.setAttribute("inputmode", "text");
        els.typingInputLabel.textContent = "在此輸入（使用系統輸入法）";
        showScreen("mode");
    }

    // Events
    els.btnStages.addEventListener("click", function () {
        renderStageList();
        showScreen("stages");
    });

    els.btnInfinite.addEventListener("click", function () {
        beginInfinite();
    });

    els.btnCodePractice.addEventListener("click", function () {
        beginCodePractice();
    });

    els.btnCodeDrill.addEventListener("click", function () {
        beginCodeDrill();
    });

    els.codeBtnSucheng.addEventListener("click", function () {
        setCodeMethod("sucheng");
    });

    els.codeBtnCangjie.addEventListener("click", function () {
        setCodeMethod("cangjie");
    });

    els.stagesBackBtn.addEventListener("click", goHome);

    els.playBackBtn.addEventListener("click", function () {
        stopTimer();
        els.typingInput.disabled = false;
        els.codeToolbar.hidden = true;
        els.virtualKeyboard.hidden = true;
        if (state.mode === "stages") {
            renderStageList();
            showScreen("stages");
        } else {
            els.typingInput.lang = "zh-Hant";
            els.typingInput.setAttribute("inputmode", "text");
            els.typingInputLabel.textContent = "在此輸入（使用系統輸入法）";
            showScreen("mode");
        }
    });

    els.endSessionBtn.addEventListener("click", function () {
        endInfiniteSession();
    });

    els.resultHomeBtn.addEventListener("click", goHome);

    els.resultRetryBtn.addEventListener("click", function () {
        if (state.mode === "stages" && state.stageId != null) {
            beginStage(state.stageId);
        } else if (state.mode === "code") {
            beginCodePractice();
        } else if (state.mode === "drill") {
            beginCodeDrill();
        } else {
            beginInfinite();
        }
    });

    els.submitBtn.addEventListener("click", function () {
        submitPrompt();
    });

    els.typingInput.addEventListener("compositionstart", function () {
        state.composing = true;
    });

    els.typingInput.addEventListener("compositionend", function () {
        state.composing = false;
        onInput();
    });

    els.typingInput.addEventListener("input", onInput);

    els.typingInput.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
            e.preventDefault();
            submitPrompt();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
        }
    });

    showScreen("mode");
    buildVirtualKeyboard();
})();
