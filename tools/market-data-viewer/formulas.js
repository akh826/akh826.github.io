/**
 * Technical indicator registry for market charts.
 *
 * To add an indicator, push into MARKET_FORMULAS:
 * - id, title, description, category
 * - chartType: "overlay" (on price chart) | "panel" (separate chart below)
 * - params[]: { id, label, default, min?, max?, step?, integer? }
 * - compute(bars, params) -> { series[] }
 *
 * series[]: { id, label, data: number[], style?: "line"|"bar", yAxis?: "left"|"right" }
 * data aligns with bars[] by index; use null for warmup periods.
 */
(function () {
    function sma(values, period) {
        const out = new Array(values.length).fill(null);
        if (period < 1) {
            return out;
        }

        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            sum += values[i];
            if (i >= period) {
                sum -= values[i - period];
            }
            if (i >= period - 1) {
                out[i] = sum / period;
            }
        }
        return out;
    }

    function ema(values, period) {
        const out = new Array(values.length).fill(null);
        if (period < 1 || values.length < period) {
            return out;
        }

        const k = 2 / (period + 1);
        let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        out[period - 1] = prev;

        for (let i = period; i < values.length; i += 1) {
            prev = values[i] * k + prev * (1 - k);
            out[i] = prev;
        }
        return out;
    }

    function stdDev(values, period) {
        const out = new Array(values.length).fill(null);
        for (let i = period - 1; i < values.length; i += 1) {
            const slice = values.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
            out[i] = Math.sqrt(variance);
        }
        return out;
    }

    window.MARKET_FORMULAS = [
        {
            id: "sma",
            title: "SMA",
            category: "Trend",
            chartType: "overlay",
            description: "Simple moving average — arithmetic mean of the last N closes.",
            params: [
                { id: "period", label: "Period", default: 20, min: 2, max: 200, step: 1, integer: true }
            ],
            compute(bars, params) {
                const closes = bars.map((b) => b.c);
                const line = sma(closes, params.period);
                return {
                    series: [{ id: "sma", label: `SMA ${params.period}`, data: line, style: "line" }]
                };
            }
        },
        {
            id: "ema",
            title: "EMA",
            category: "Trend",
            chartType: "overlay",
            description: "Exponential moving average — weights recent prices more heavily.",
            params: [
                { id: "period", label: "Period", default: 20, min: 2, max: 200, step: 1, integer: true }
            ],
            compute(bars, params) {
                const closes = bars.map((b) => b.c);
                const line = ema(closes, params.period);
                return {
                    series: [{ id: "ema", label: `EMA ${params.period}`, data: line, style: "line" }]
                };
            }
        },
        {
            id: "bollinger",
            title: "Bollinger Bands",
            category: "Volatility",
            chartType: "overlay",
            description: "Upper and lower bands at N standard deviations around a moving average.",
            params: [
                { id: "period", label: "Period", default: 20, min: 2, max: 200, step: 1, integer: true },
                { id: "stdDev", label: "Std dev multiplier", default: 2, min: 0.5, max: 4, step: 0.1 }
            ],
            compute(bars, params) {
                const closes = bars.map((b) => b.c);
                const middle = sma(closes, params.period);
                const deviation = stdDev(closes, params.period);
                const upper = middle.map((m, i) =>
                    m === null || deviation[i] === null ? null : m + params.stdDev * deviation[i]
                );
                const lower = middle.map((m, i) =>
                    m === null || deviation[i] === null ? null : m - params.stdDev * deviation[i]
                );

                return {
                    series: [
                        { id: "bb-upper", label: "BB Upper", data: upper, style: "line" },
                        { id: "bb-middle", label: "BB Middle", data: middle, style: "line" },
                        { id: "bb-lower", label: "BB Lower", data: lower, style: "line" }
                    ]
                };
            }
        },
        {
            id: "macd",
            title: "MACD",
            category: "Momentum",
            chartType: "panel",
            description:
                "Moving Average Convergence Divergence — fast EMA minus slow EMA, with signal line and histogram.",
            params: [
                { id: "fast", label: "Fast period", default: 12, min: 2, max: 50, step: 1, integer: true },
                { id: "slow", label: "Slow period", default: 26, min: 3, max: 100, step: 1, integer: true },
                { id: "signal", label: "Signal period", default: 9, min: 2, max: 50, step: 1, integer: true }
            ],
            compute(bars, params) {
                const closes = bars.map((b) => b.c);
                const fastEma = ema(closes, params.fast);
                const slowEma = ema(closes, params.slow);
                const macdLine = fastEma.map((fast, i) => {
                    const slow = slowEma[i];
                    return fast === null || slow === null ? null : fast - slow;
                });

                const signalLine = new Array(closes.length).fill(null);
                const macdStart = Math.max(params.fast, params.slow) - 1;
                if (macdStart < closes.length) {
                    const macdValues = macdLine.slice(macdStart).map((v) => v ?? 0);
                    const signalValues = ema(macdValues, params.signal);
                    signalValues.forEach((val, i) => {
                        if (val !== null) {
                            signalLine[macdStart + i] = val;
                        }
                    });
                }

                const histogram = macdLine.map((macd, i) => {
                    const signal = signalLine[i];
                    return macd === null || signal === null ? null : macd - signal;
                });

                return {
                    series: [
                        { id: "macd-line", label: "MACD", data: macdLine, style: "line" },
                        { id: "macd-signal", label: "Signal", data: signalLine, style: "line" },
                        { id: "macd-hist", label: "Histogram", data: histogram, style: "bar" }
                    ]
                };
            }
        },
        {
            id: "rsi",
            title: "RSI",
            category: "Momentum",
            chartType: "panel",
            description: "Relative Strength Index — momentum oscillator bounded between 0 and 100.",
            params: [
                { id: "period", label: "Period", default: 14, min: 2, max: 100, step: 1, integer: true }
            ],
            compute(bars, params) {
                const closes = bars.map((b) => b.c);
                const out = new Array(closes.length).fill(null);
                if (closes.length <= params.period) {
                    return { series: [{ id: "rsi", label: `RSI ${params.period}`, data: out, style: "line" }] };
                }

                let avgGain = 0;
                let avgLoss = 0;

                for (let i = 1; i <= params.period; i += 1) {
                    const change = closes[i] - closes[i - 1];
                    if (change >= 0) {
                        avgGain += change;
                    } else {
                        avgLoss -= change;
                    }
                }
                avgGain /= params.period;
                avgLoss /= params.period;

                const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
                out[params.period] = 100 - 100 / (1 + rs);

                for (let i = params.period + 1; i < closes.length; i += 1) {
                    const change = closes[i] - closes[i - 1];
                    const gain = change > 0 ? change : 0;
                    const loss = change < 0 ? -change : 0;
                    avgGain = (avgGain * (params.period - 1) + gain) / params.period;
                    avgLoss = (avgLoss * (params.period - 1) + loss) / params.period;
                    const nextRs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
                    out[i] = 100 - 100 / (1 + nextRs);
                }

                return {
                    series: [{ id: "rsi", label: `RSI ${params.period}`, data: out, style: "line" }]
                };
            }
        }
    ];
}());
