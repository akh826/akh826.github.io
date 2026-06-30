(() => {
    const SAVE_KEY = "stellarIdleSave_v1";
    const SAVE_VERSION = 1;
    const AUTOSAVE_MS = 30000;

    function createDefaultState() {
        const buildings = {};
        window.IdleData.BUILDINGS.forEach((b) => {
            buildings[b.id] = 0;
        });
        const artifacts = {};
        window.IdleData.ARTIFACTS.forEach((artifact) => {
            artifacts[artifact.id] = {
                rarity: 0,
                replacements: 0
            };
        });

        return {
            version: SAVE_VERSION,
            crystals: 0n,
            lifetimeEarned: 0n,
            shards: 0,
            artifactRarityLevel: 0,
            artifactDropLevel: 0,
            buildings,
            artifacts,
            upgrades: [],
            lastSaved: Date.now()
        };
    }

    function serialize(state) {
        return {
            version: SAVE_VERSION,
            crystals: state.crystals.toString(),
            lifetimeEarned: state.lifetimeEarned.toString(),
            shards: state.shards,
            artifactRarityLevel: Number.isFinite(state.artifactRarityLevel) ? state.artifactRarityLevel : 0,
            artifactDropLevel: Number.isFinite(state.artifactDropLevel) ? state.artifactDropLevel : 0,
            buildings: state.buildings,
            artifacts: state.artifacts,
            upgrades: [...state.upgrades],
            lastSaved: Date.now()
        };
    }

    function deserialize(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const defaults = createDefaultState();
        const buildings = { ...defaults.buildings, ...(raw.buildings || {}) };
        const artifacts = { ...defaults.artifacts, ...(raw.artifacts || {}) };

        return {
            version: raw.version || SAVE_VERSION,
            crystals: window.IdleNumbers.toBigInt(raw.crystals),
            lifetimeEarned: window.IdleNumbers.toBigInt(raw.lifetimeEarned),
            shards: Number.isFinite(raw.shards) ? raw.shards : 0,
            artifactRarityLevel: Number.isFinite(raw.artifactRarityLevel) ? Math.max(0, Math.floor(raw.artifactRarityLevel)) : 0,
            artifactDropLevel: Number.isFinite(raw.artifactDropLevel) ? Math.max(0, Math.floor(raw.artifactDropLevel)) : 0,
            buildings,
            artifacts,
            upgrades: Array.isArray(raw.upgrades) ? raw.upgrades.filter((id) => typeof id === "string") : [],
            lastSaved: Number.isFinite(raw.lastSaved) ? raw.lastSaved : Date.now()
        };
    }

    function load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (!stored) {
                return createDefaultState();
            }
            const parsed = JSON.parse(stored);
            return deserialize(parsed) || createDefaultState();
        } catch {
            return createDefaultState();
        }
    }

    function save(state) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(state)));
            state.lastSaved = Date.now();
            return true;
        } catch {
            return false;
        }
    }

    function reset() {
        localStorage.removeItem(SAVE_KEY);
        return createDefaultState();
    }

    function setupAutosave(getState) {
        const intervalId = setInterval(() => {
            save(getState());
        }, AUTOSAVE_MS);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                save(getState());
            }
        });

        window.addEventListener("beforeunload", () => {
            save(getState());
        });

        return () => clearInterval(intervalId);
    }

    window.IdleSave = {
        SAVE_KEY,
        createDefaultState,
        load,
        save,
        reset,
        setupAutosave
    };
})();
