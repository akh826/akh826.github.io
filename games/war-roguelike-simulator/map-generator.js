/**
 * War Roguelike — procedural map (layered DAG with branching paths).
 */
(function (global) {
    "use strict";

    const { WORLDS, ROOM_TYPES } = global.WarData;

    function mulberry32(seed) {
        return function () {
            let t = (seed += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pickWeighted(rng, weights) {
        const entries = Object.entries(weights);
        const total = entries.reduce((s, [, w]) => s + w, 0);
        let roll = rng() * total;
        for (const [key, w] of entries) {
            roll -= w;
            if (roll <= 0) return key;
        }
        return entries[entries.length - 1][0];
    }

    function roomWeightsForLayer(layer, maxLayer, worldIndex) {
        if (layer === 0) return { start: 1 };
        if (layer === maxLayer) return { boss: 1 };
        const base = {
            combat: 50,
            epic_combat: 8,
            treasure: 12,
            event: 14,
            shop: 6,
            epic: 6
        };
        if (layer < 2) {
            base.shop = 0;
            base.epic_combat = 0;
        }
        if (layer < 3) base.epic = 0;
        if (layer >= maxLayer - 2) {
            base.combat += 4;
            base.epic_combat += 5;
            base.epic += 3;
        }
        // Early layers: almost all fights to set the pace
        if (layer <= 2) {
            base.combat += 10;
            base.event = Math.max(6, base.event - 4);
        }
        if (worldIndex >= 1) {
            base.combat += 2;
            base.epic_combat += 2 + worldIndex;
            base.epic += 1 + Math.min(2, worldIndex);
        }
        return base;
    }

    /** Event rooms may secretly be traps — decided at generation, hidden until entered. */
    function resolveEventOutcome(rng, worldIndex) {
        const trapChance = 0.32 + Math.min(0.2, worldIndex * 0.06);
        return rng() < trapChance ? "trap" : "event";
    }

    function layerNodeCount(L, maxLayer, rng) {
        if (L === 0 || L === maxLayer) return 1;
        // Wider mid-map for more route choices; taper near boss
        if (L === 1 || L === maxLayer - 1) return 2 + Math.floor(rng() * 2); // 2–3
        if (L <= 2 || L >= maxLayer - 2) return 3 + Math.floor(rng() * 2); // 3–4
        return 3 + Math.floor(rng() * 3); // 3–5
    }

    function idealChildIndex(parentIndex, parentCount, childCount) {
        if (childCount <= 1) return 0;
        if (parentCount <= 1) return (childCount - 1) / 2;
        return (parentIndex / (parentCount - 1)) * (childCount - 1);
    }

    function connectLayers(parents, children, rng) {
        parents.forEach((n) => { n.edges = []; });

        // Each parent picks 1–2 nearby children (sometimes 3) — sparse branching
        parents.forEach((node, i) => {
            const ideal = idealChildIndex(i, parents.length, children.length);
            const nearby = [];
            for (let j = 0; j < children.length; j++) {
                if (Math.abs(j - ideal) <= 1.35) nearby.push(j);
            }
            if (!nearby.length) {
                nearby.push(Math.max(0, Math.min(children.length - 1, Math.round(ideal))));
            }

            const picks = new Set();
            // Always at least one edge
            picks.add(nearby[Math.floor(rng() * nearby.length)]);
            // Second branch ~60%
            if (nearby.length > 1 && rng() < 0.62) {
                picks.add(nearby[Math.floor(rng() * nearby.length)]);
            }
            // Occasional longer cross-path for planning tension
            if (rng() < 0.28) {
                const span = rng() < 0.5 ? -2 : 2;
                const j = Math.max(0, Math.min(children.length - 1, Math.round(ideal) + span));
                picks.add(j);
            }
            // Start layer fans out more aggressively
            if (parents.length === 1 && children.length > 2) {
                children.forEach((_, j) => {
                    if (rng() < 0.7) picks.add(j);
                });
                // Guarantee at least 3 exits from camp when possible
                while (picks.size < Math.min(3, children.length)) {
                    picks.add(Math.floor(rng() * children.length));
                }
            }

            picks.forEach((j) => {
                const id = children[j].id;
                if (!node.edges.includes(id)) node.edges.push(id);
            });
        });

        // Every child needs ≥1 parent (no dead orphans)
        children.forEach((child, j) => {
            const hasParent = parents.some((p) => p.edges.includes(child.id));
            if (hasParent) return;
            const ideal = idealChildIndex(j, children.length, parents.length);
            const pi = Math.max(0, Math.min(parents.length - 1, Math.round(ideal)));
            parents[pi].edges.push(child.id);
        });
    }

    /** Ensure every node is reachable from start and can reach boss. */
    function ensureFullConnectivity(nodes, layers) {
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const start = nodes.find((n) => n.layer === 0);
        const boss = nodes.find((n) => n.layer === layers);
        if (!start || !boss) return;

        function reachableFrom(rootId, forward) {
            const seen = new Set([rootId]);
            const stack = [rootId];
            while (stack.length) {
                const id = stack.pop();
                const node = byId.get(id);
                if (!node) continue;
                const nextIds = forward
                    ? node.edges
                    : nodes.filter((n) => n.edges.includes(id)).map((n) => n.id);
                nextIds.forEach((nid) => {
                    if (!seen.has(nid)) {
                        seen.add(nid);
                        stack.push(nid);
                    }
                });
            }
            return seen;
        }

        // Fix forward reachability from start
        let fromStart = reachableFrom(start.id, true);
        nodes.forEach((node) => {
            if (fromStart.has(node.id) || node.layer === 0) return;
            const prevLayer = nodes.filter((n) => n.layer === node.layer - 1 && fromStart.has(n.id));
            const pool = prevLayer.length ? prevLayer : nodes.filter((n) => n.layer === node.layer - 1);
            if (!pool.length) return;
            const parent = pool[Math.floor(pool.length / 2)];
            if (!parent.edges.includes(node.id)) parent.edges.push(node.id);
            fromStart = reachableFrom(start.id, true);
        });

        // Fix reverse reachability to boss
        let toBoss = reachableFrom(boss.id, false);
        for (let L = layers - 1; L >= 0; L--) {
            nodes.filter((n) => n.layer === L).forEach((node) => {
                if (toBoss.has(node.id)) return;
                const nextLayer = nodes.filter((n) => n.layer === L + 1 && toBoss.has(n.id));
                const pool = nextLayer.length ? nextLayer : nodes.filter((n) => n.layer === L + 1);
                if (!pool.length) return;
                const child = pool[Math.floor(pool.length / 2)];
                if (!node.edges.includes(child.id)) node.edges.push(child.id);
                toBoss = reachableFrom(boss.id, false);
            });
        }
    }

    function generateMap(worldIndex, seed) {
        const safeIndex = ((worldIndex % WORLDS.length) + WORLDS.length) % WORLDS.length;
        const world = WORLDS[safeIndex];
        const rng = mulberry32(seed);
        const layers = world.layers;
        const nodes = [];
        let nodeId = 0;

        const layerCounts = [];
        for (let L = 0; L <= layers; L++) {
            layerCounts.push(layerNodeCount(L, layers, rng));
        }

        for (let L = 0; L <= layers; L++) {
            const count = layerCounts[L];
            for (let i = 0; i < count; i++) {
                let type = pickWeighted(rng, roomWeightsForLayer(L, layers, safeIndex));
                let secretOutcome = null;
                if (type === "event" || type === "trap") {
                    type = "event";
                    secretOutcome = resolveEventOutcome(rng, safeIndex);
                }
                nodes.push({
                    id: nodeId++,
                    layer: L,
                    index: i,
                    type,
                    secretOutcome,
                    x: 0,
                    y: L,
                    edges: [],
                    visited: false,
                    cleared: false,
                    reachable: L === 0
                });
            }
        }

        for (let L = 0; L < layers; L++) {
            const current = nodes.filter((n) => n.layer === L);
            const next = nodes.filter((n) => n.layer === L + 1);
            connectLayers(current, next, rng);
        }

        ensureFullConnectivity(nodes, layers);

        const maxPerLayer = Math.max(...layerCounts);
        nodes.forEach((n) => {
            const count = layerCounts[n.layer];
            if (count <= 1 || maxPerLayer <= 1) {
                n.x = 0.5;
                return;
            }
            // Center this layer's rooms in a shared column grid so short layers
            // don't stretch to the far left/right edges every time.
            const startSlot = (maxPerLayer - count) / 2;
            const slot = startSlot + n.index;
            const base = slot / (maxPerLayer - 1);
            const jitter = (rng() - 0.5) * 0.05;
            n.x = Math.max(0.06, Math.min(0.94, base + jitter));
        });

        return {
            worldIndex: safeIndex,
            worldId: world.id,
            layers,
            nodes,
            currentNodeId: nodes[0].id,
            maxPerLayer
        };
    }

    /**
     * Endless gauntlet: start → epic_combat… → boss (linear, no shops/events).
     * @param {number} loop 1-based endless ring
     * @param {number} seed
     * @param {number} [worldIndex]
     */
    function generateEndlessMap(loop, seed, worldIndex) {
        const safeIndex = ((((worldIndex || 0) % WORLDS.length) + WORLDS.length) % WORLDS.length);
        const world = WORLDS[safeIndex];
        const rng = mulberry32(seed);
        const epicCount = Math.min(10, 2 + Math.max(1, loop | 0));
        const maxLayer = epicCount + 1;
        const nodes = [];
        let nodeId = 0;

        const pushNode = (layer, type) => {
            nodes.push({
                id: nodeId++,
                layer,
                index: 0,
                type,
                secretOutcome: null,
                x: 0.5,
                y: layer,
                edges: [],
                visited: layer === 0,
                cleared: false,
                reachable: layer === 0
            });
        };

        pushNode(0, "start");
        for (let L = 1; L <= epicCount; L++) pushNode(L, "epic_combat");
        pushNode(maxLayer, "boss");

        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].edges = [nodes[i + 1].id];
        }

        // Slight vertical jitter for readability
        nodes.forEach((n) => {
            n.x = 0.5 + (rng() - 0.5) * 0.04;
        });

        return {
            worldIndex: safeIndex,
            worldId: world.id,
            layers: maxLayer,
            nodes,
            currentNodeId: nodes[0].id,
            maxPerLayer: 1,
            endless: true
        };
    }

    function getNode(map, id) {
        return map.nodes.find((n) => n.id === id);
    }

    function getReachableNext(map) {
        const current = getNode(map, map.currentNodeId);
        if (!current) return [];
        return current.edges.map((id) => getNode(map, id)).filter(Boolean);
    }

    function moveToNode(map, nodeId) {
        const current = getNode(map, map.currentNodeId);
        const next = getNode(map, nodeId);
        if (!current || !next) return false;
        if (!current.edges.includes(nodeId)) return false;
        current.cleared = true;
        current.visited = true;
        map.currentNodeId = nodeId;
        next.reachable = true;
        next.visited = true;
        return true;
    }

    function nodeLabel(type) {
        return ROOM_TYPES[type]?.label || type;
    }

    global.WarMap = {
        generateMap,
        generateEndlessMap,
        getNode,
        getReachableNext,
        moveToNode,
        nodeLabel,
        mulberry32
    };
})(typeof window !== "undefined" ? window : globalThis);
