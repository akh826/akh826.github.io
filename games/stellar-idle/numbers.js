(() => {
    const GROWTH_NUM = 115n;
    const GROWTH_DEN = 100n;
    const growthFactorCache = new Map([[0, { num: 1n, den: 1n }]]);

    const GENERAL_SUFFIXES = ["", "k", "M", "B", "T"];
    const CUSTOM_SUFFIX_START_GROUP = GENERAL_SUFFIXES.length;

    function toBigInt(value) {
        if (typeof value === "bigint") {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return BigInt(Math.floor(value));
        }
        if (typeof value === "string" && value.trim() !== "") {
            return BigInt(value);
        }
        return 0n;
    }

    function canAfford(balance, cost) {
        return balance >= cost;
    }

    function clampNonNegative(value) {
        return value < 0n ? 0n : value;
    }

    function powBigInt(base, exponent) {
        let result = 1n;
        let factor = base;
        let exp = Math.max(0, Math.floor(Number(exponent)));

        while (exp > 0) {
            if (exp % 2 === 1) {
                result *= factor;
            }
            exp = Math.floor(exp / 2);
            if (exp > 0) {
                factor *= factor;
            }
        }

        return result;
    }

    function getGrowthFactor(exponent) {
        const exp = Math.max(0, Math.floor(Number(exponent)));
        const cached = growthFactorCache.get(exp);
        if (cached) {
            return cached;
        }

        const factor = {
            num: powBigInt(GROWTH_NUM, exp),
            den: powBigInt(GROWTH_DEN, exp)
        };
        growthFactorCache.set(exp, factor);
        return factor;
    }

    function powGrowth(baseCost, exponent) {
        const base = toBigInt(baseCost);
        const factor = getGrowthFactor(exponent);
        return (base * factor.num) / factor.den;
    }

    function buildingCost(baseCost, owned, quantity = 1) {
        const count = Math.max(0, Math.floor(quantity));
        let total = 0n;

        for (let i = 0; i < count; i++) {
            total += powGrowth(baseCost, owned + i);
        }

        return total;
    }

    function maxAffordableQuantity(balance, baseCost, owned) {
        if (balance < powGrowth(baseCost, owned)) {
            return 0;
        }

        let low = 1;
        let high = 1;

        while (buildingCost(baseCost, owned, high) <= balance) {
            low = high;
            high *= 2;
            if (high > 1_000_000) {
                break;
            }
        }

        let result = 0;
        let left = low;
        let right = Math.min(high, 1_000_000);

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const cost = buildingCost(baseCost, owned, mid);
            if (cost <= balance) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return result;
    }

    function encodeBijectiveLetters(index1Based) {
        let n = index1Based;
        let result = "";

        while (n > 0) {
            n -= 1;
            result = String.fromCharCode(97 + (n % 26)) + result;
            n = Math.floor(n / 26);
        }

        return result;
    }

    function getSuffix(group) {
        if (group < CUSTOM_SUFFIX_START_GROUP) {
            return GENERAL_SUFFIXES[group] || "";
        }

        return encodeBijectiveLetters(group - CUSTOM_SUFFIX_START_GROUP + 1);
    }

    function trimTrailingZeros(value) {
        if (!value.includes(".")) {
            return value;
        }

        return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }

    function formatShort(value, decimals = 2) {
        const n = toBigInt(value);
        const negative = n < 0n;
        const abs = negative ? -n : n;

        if (abs < 1000n) {
            return `${negative ? "-" : ""}${abs.toString()}`;
        }

        const str = abs.toString();
        const group = Math.floor((str.length - 1) / 3);
        const suffix = getSuffix(group);
        const digitsBeforeDecimal = str.length - group * 3;
        const wholePart = str.slice(0, digitsBeforeDecimal);
        const remainder = str.slice(digitsBeforeDecimal, digitsBeforeDecimal + decimals + 2);

        let formatted = wholePart;
        if (decimals > 0 && remainder.length > 0) {
            const fractional = remainder.padEnd(decimals + 1, "0").slice(0, decimals + 1);
            const rounded = Math.round(Number(`0.${fractional}`) * 10 ** decimals);
            if (rounded >= 10 ** decimals) {
                formatted = (BigInt(wholePart) + 1n).toString();
            } else {
                const fracStr = String(rounded).padStart(decimals, "0");
                formatted = `${wholePart}.${fracStr}`;
            }
        }

        formatted = trimTrailingZeros(formatted);
        return `${negative ? "-" : ""}${formatted}${suffix}`;
    }

    function formatRate(value, decimals = 2) {
        const n = Number(value);
        if (!Number.isFinite(n) || n === 0) {
            return "0";
        }
        if (Math.abs(n) < 1000) {
            return n.toFixed(Math.abs(n) < 10 ? 1 : 0);
        }
        return formatShort(BigInt(Math.floor(n)), decimals);
    }

    function sqrtBigInt(n) {
        const value = toBigInt(n);
        if (value < 0n) {
            return 0n;
        }
        if (value < 2n) {
            return value;
        }

        let x = value;
        let y = (x + 1n) / 2n;

        while (y < x) {
            x = y;
            y = (x + value / x) / 2n;
        }

        return x;
    }

    window.IdleNumbers = {
        toBigInt,
        canAfford,
        clampNonNegative,
        buildingCost,
        powGrowth,
        maxAffordableQuantity,
        formatShort,
        formatRate,
        sqrtBigInt,
        getSuffix
    };
})();
