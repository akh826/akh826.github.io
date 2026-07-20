/**
 * War Roguelike — unit visual identity (shape + color by role)
 */
(function (global) {
    "use strict";

    const ROLE_VISUAL = {
        tank: { shape: "shield", fill: "#1e3a5f", stroke: "#60a5fa", label: "坦", lineWidth: 3 },
        warrior: { shape: "circle", fill: "#7c2d12", stroke: "#fb923c", label: "戰", lineWidth: 2 },
        ranger: { shape: "ranged", fill: "#14532d", stroke: "#86efac", label: "射", lineWidth: 2 },
        caster: { shape: "diamond", fill: "#4c1d95", stroke: "#c4b5fd", label: "法", lineWidth: 2 },
        support: { shape: "circle", fill: "#134e4a", stroke: "#5eead4", label: "輔", lineWidth: 2, halo: true },
        assassin: { shape: "triangle", fill: "#3b0764", stroke: "#e879f9", label: "刺", lineWidth: 2 },
        elite: { shape: "hex", fill: "#713f12", stroke: "#fcd34d", label: "精", lineWidth: 2.5 },
        boss: { shape: "circle", fill: "#450a0a", stroke: "#fbbf24", label: "王", lineWidth: 3, doubleRing: true },
        summon: { shape: "circle", fill: "#0e7490", stroke: "#67e8f9", label: "召", lineWidth: 2, dashed: true },
        enemy: { shape: "circle", fill: "#7f1d1d", stroke: "#fca5a5", label: "", lineWidth: 2 }
    };

    const ENEMY_FILL = {
        tank: "#4c0519",
        warrior: "#7f1d1d",
        ranger: "#14532d",
        caster: "#581c87",
        support: "#115e59",
        assassin: "#581c87",
        elite: "#78350f",
        boss: "#450a0a",
        summon: "#6b21a8"
    };

    function inferRoleFromTags(def) {
        const tags = def.tags || [];
        if (tags.includes("tank") || tags.includes("guard")) return "tank";
        if (tags.includes("caster") || tags.includes("arcane")) return "caster";
        if (tags.includes("ranger")) return "ranger";
        if (tags.includes("support") || tags.includes("holy")) return "support";
        if (tags.includes("assassin") || tags.includes("shadow")) return "assassin";
        if (tags.includes("warrior") || tags.includes("melee")) return "warrior";
        const range = def.range || def.rangeType;
        if (range === "ranged") return "ranger";
        return "warrior";
    }

    function resolveVisualRole(unitOrDef) {
        const role = unitOrDef.role || "warrior";
        if (role === "boss") return "boss";
        if (role === "summon") return "summon";
        if (role === "elite") return "elite";
        if (role === "enemy") return inferRoleFromTags(unitOrDef);
        return ROLE_VISUAL[role] ? role : "warrior";
    }

    function getUnitVisual(unitOrDef, side, opts) {
        const visualRole = resolveVisualRole(unitOrDef);
        const base = Object.assign({}, ROLE_VISUAL[visualRole] || ROLE_VISUAL.warrior);
        const isEnemySide = side === "enemy";
        const isPlayerSide = side === "player";

        if (isEnemySide && visualRole !== "boss") {
            base.fill = ENEMY_FILL[visualRole] || ENEMY_FILL.warrior;
            base.stroke = opts && opts.affix ? "#fbbf24" : "#fca5a5";
        }
        if (isPlayerSide && opts && opts.selected) {
            base.stroke = "#fbbf24";
            base.lineWidth = 3;
        }
        if (opts && opts.temporary) {
            base.fill = isPlayerSide ? "#0e7490" : "#6b21a8";
            base.stroke = isPlayerSide ? "#67e8f9" : "#e9d5ff";
            base.dashed = true;
        }
        if (opts && opts.ghost) {
            base.alpha = 0.55;
        }
        base.role = visualRole;
        base.rangeType = unitOrDef.range || unitOrDef.rangeType || "melee";
        return base;
    }

    function roundRectPath(ctx, x, y, w, h, rad) {
        const r = Math.min(rad, w / 2, h / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawShapePath(ctx, shape, x, y, r) {
        ctx.beginPath();
        switch (shape) {
            case "shield": {
                const w = r * 1.55;
                const h = r * 1.7;
                roundRectPath(ctx, x - w / 2, y - h / 2, w, h, r * 0.38);
                break;
            }
            case "diamond":
                ctx.moveTo(x, y - r * 1.12);
                ctx.lineTo(x + r, y);
                ctx.lineTo(x, y + r * 1.12);
                ctx.lineTo(x - r, y);
                ctx.closePath();
                break;
            case "triangle":
                ctx.moveTo(x, y - r * 1.08);
                ctx.lineTo(x + r * 0.98, y + r * 0.78);
                ctx.lineTo(x - r * 0.98, y + r * 0.78);
                ctx.closePath();
                break;
            case "hex":
                for (let i = 0; i < 6; i += 1) {
                    const a = Math.PI / 6 + (i * Math.PI) / 3;
                    const px = x + Math.cos(a) * r * 1.05;
                    const py = y + Math.sin(a) * r * 1.05;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            case "ranged":
            case "circle":
            default:
                ctx.arc(x, y, r, 0, Math.PI * 2);
                break;
        }
    }

    function drawRangedMark(ctx, x, y, r, stroke) {
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(x, y - r * 0.15, r * 0.72, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        ctx.restore();
    }

    function drawHalo(ctx, x, y, r, stroke) {
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.globalAlpha *= 0.55;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawRoleBadge(ctx, x, y, r, visual) {
        if (!visual.label) return;
        const bx = x + r * 0.62;
        const by = y + r * 0.62;
        const br = Math.max(7, r * 0.38);
        ctx.save();
        ctx.fillStyle = "rgba(15,23,42,0.88)";
        ctx.strokeStyle = visual.stroke;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = `bold ${Math.max(8, Math.floor(br * 1.15))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(visual.label, bx, by + 0.5);
        ctx.restore();
    }

    function drawToken(ctx, options) {
        const {
            x, y, r, unitOrDef, side, icon,
            selected, ghost, hurtFlash, temporary, affix
        } = options;
        if (!unitOrDef || r <= 0) return;

        const visual = getUnitVisual(unitOrDef, side, { selected, ghost, temporary, affix });
        const alpha = visual.alpha != null ? visual.alpha : 1;

        ctx.save();
        ctx.globalAlpha *= alpha;

        let fill = visual.fill;
        if (hurtFlash > 0) {
            const t = Math.max(0, Math.min(1, hurtFlash / 0.22));
            fill = t > 0.5 ? "#f8fafc" : visual.fill;
        }

        drawShapePath(ctx, visual.shape, x, y, r);
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.strokeStyle = affix ? "#fbbf24" : visual.stroke;
        ctx.lineWidth = affix ? 3 : (visual.lineWidth || 2);
        if (visual.dashed || temporary) ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (visual.doubleRing) {
            ctx.strokeStyle = visual.stroke;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha *= 0.65;
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = alpha;
        }

        if (visual.shape === "ranged" || visual.rangeType === "ranged") {
            drawRangedMark(ctx, x, y, r, visual.stroke);
        }
        if (visual.halo) drawHalo(ctx, x, y, r, visual.stroke);

        ctx.font = `${Math.max(12, r)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(icon || unitOrDef.icon || "?", x, y);

        if (r >= 10) drawRoleBadge(ctx, x, y, r, visual);

        ctx.restore();
    }

    function roleCssClass(unitOrDef) {
        const role = resolveVisualRole(unitOrDef);
        return `war-army-chip--role-${role}`;
    }

    global.WarUnitVisual = {
        ROLE_VISUAL,
        inferRoleFromTags,
        resolveVisualRole,
        getUnitVisual,
        drawToken,
        roleCssClass
    };
}(typeof window !== "undefined" ? window : globalThis));
