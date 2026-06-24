/**
 * Investment formula registry.
 *
 * To add a formula, push an object into INVEST_FORMULAS with:
 * - id, title, description, category
 * - inputs[]: { id, label, type, default, min?, max?, step?, unit?, options?, integer? }
 *   types: "number" | "percent" | "currency" | "select"
 * - compute(values) -> { outputs[], notes?, rows? }
 *
 * outputs[]: { id, label, value, format: "currency"|"percent"|"number"|"years"|"text" }
 */
window.INVEST_FORMULAS = [
    {
        id: "future-value",
        title: "Future Value",
        category: "Growth",
        description:
            "Project portfolio value with compound growth on an initial lump sum plus optional monthly contributions.",
        inputs: [
            {
                id: "principal",
                label: "Initial investment",
                type: "currency",
                default: 10000,
                min: 0,
                step: 100
            },
            {
                id: "annualRate",
                label: "Expected annual return",
                type: "percent",
                default: 7,
                min: -50,
                max: 100,
                step: 0.1
            },
            {
                id: "years",
                label: "Investment period",
                type: "number",
                unit: "years",
                default: 20,
                min: 1,
                max: 100,
                step: 1,
                integer: true
            },
            {
                id: "monthlyContribution",
                label: "Monthly contribution",
                type: "currency",
                default: 500,
                min: 0,
                step: 50
            }
        ],
        compute(values) {
            const principal = values.principal;
            const annualRate = values.annualRate / 100;
            const months = values.years * 12;
            const monthlyRate = annualRate / 12;
            const contribution = values.monthlyContribution;

            let futurePrincipal;
            let futureContributions;

            if (monthlyRate === 0) {
                futurePrincipal = principal;
                futureContributions = contribution * months;
            } else {
                const growthFactor = Math.pow(1 + monthlyRate, months);
                futurePrincipal = principal * growthFactor;
                futureContributions = contribution * ((growthFactor - 1) / monthlyRate);
            }

            const futureValue = futurePrincipal + futureContributions;
            const totalContributed = principal + contribution * months;
            const investmentGrowth = futureValue - totalContributed;

            return {
                outputs: [
                    { id: "futureValue", label: "Future value", value: futureValue, format: "currency" },
                    { id: "totalContributed", label: "Total contributed", value: totalContributed, format: "currency" },
                    { id: "investmentGrowth", label: "Investment growth", value: investmentGrowth, format: "currency" }
                ],
                notes: [
                    "Assumes monthly compounding and contributions at month-end.",
                    "FV = P(1+r)^n + PMT × [((1+r)^n − 1) / r], where r is the monthly rate."
                ],
                rows: [
                    { label: "From initial investment", value: futurePrincipal, format: "currency" },
                    { label: "From monthly contributions", value: futureContributions, format: "currency" }
                ]
            };
        }
    },
    {
        id: "gain-loss",
        title: "Gain / Loss",
        category: "Returns",
        description:
            "Calculate profit or loss from an initial investment, current value, and holding period.",
        inputs: [
            {
                id: "initialValue",
                label: "Initial value",
                type: "currency",
                default: 10000,
                min: 0.01,
                step: 100
            },
            {
                id: "currentValue",
                label: "Current value",
                type: "currency",
                default: 13500,
                min: 0,
                step: 100
            },
            {
                id: "holdingPeriod",
                label: "Holding period",
                type: "number",
                unit: "years",
                default: 3,
                min: 0.01,
                max: 100,
                step: 0.1
            }
        ],
        compute(values) {
            const gainLoss = values.currentValue - values.initialValue;
            const totalReturn = values.initialValue === 0 ? 0 : gainLoss / values.initialValue;
            const ratio = values.currentValue / values.initialValue;
            const cagr = Math.pow(ratio, 1 / values.holdingPeriod) - 1;
            const isGain = gainLoss >= 0;

            return {
                outputs: [
                    {
                        id: "gainLoss",
                        label: isGain ? "Gain" : "Loss",
                        value: Math.abs(gainLoss),
                        format: "currency"
                    },
                    {
                        id: "totalReturn",
                        label: "Total return",
                        value: totalReturn * 100,
                        format: "percent"
                    },
                    {
                        id: "cagr",
                        label: "Annualized return (CAGR)",
                        value: cagr * 100,
                        format: "percent"
                    }
                ],
                notes: [
                    "Gain/Loss = current value − initial value.",
                    "Total return = gain ÷ initial value.",
                    "CAGR = (current ÷ initial)^(1 ÷ holding period) − 1."
                ],
                rows: [
                    { label: "Initial value", value: values.initialValue, format: "currency" },
                    { label: "Current value", value: values.currentValue, format: "currency" },
                    { label: "Holding period", value: values.holdingPeriod, format: "years" }
                ]
            };
        }
    },
    {
        id: "cagr",
        title: "CAGR",
        category: "Returns",
        description: "Calculate the compound annual growth rate between a starting and ending value.",
        inputs: [
            {
                id: "startValue",
                label: "Starting value",
                type: "currency",
                default: 10000,
                min: 0.01,
                step: 100
            },
            {
                id: "endValue",
                label: "Ending value",
                type: "currency",
                default: 25000,
                min: 0.01,
                step: 100
            },
            {
                id: "years",
                label: "Period",
                type: "number",
                unit: "years",
                default: 10,
                min: 0.1,
                max: 100,
                step: 0.5
            }
        ],
        compute(values) {
            const ratio = values.endValue / values.startValue;
            const cagr = Math.pow(ratio, 1 / values.years) - 1;
            const totalReturn = ratio - 1;

            return {
                outputs: [
                    { id: "cagr", label: "CAGR", value: cagr * 100, format: "percent" },
                    { id: "totalReturn", label: "Total return", value: totalReturn * 100, format: "percent" },
                    {
                        id: "gain",
                        label: "Absolute gain",
                        value: values.endValue - values.startValue,
                        format: "currency"
                    }
                ],
                notes: ["CAGR = (Ending ÷ Starting)^(1 ÷ years) − 1"]
            };
        }
    },
    {
        id: "rule-of-72",
        title: "Rule of 72",
        category: "Returns",
        description: "Estimate how many years it takes for an investment to double at a given return.",
        inputs: [
            {
                id: "annualRate",
                label: "Expected annual return",
                type: "percent",
                default: 8,
                min: 0.1,
                max: 100,
                step: 0.1
            }
        ],
        compute(values) {
            const yearsToDouble = 72 / values.annualRate;
            const exactYears = Math.log(2) / Math.log(1 + values.annualRate / 100);

            return {
                outputs: [
                    { id: "rule72", label: "Years to double (Rule of 72)", value: yearsToDouble, format: "years" },
                    { id: "exact", label: "Years to double (exact)", value: exactYears, format: "years" }
                ],
                notes: ["Rule of 72 ≈ 72 ÷ annual return %. Useful for quick mental math."]
            };
        }
    },
    {
        id: "real-return",
        title: "Real Return",
        category: "Returns",
        description: "Convert a nominal return into an inflation-adjusted real return.",
        inputs: [
            {
                id: "nominalRate",
                label: "Nominal annual return",
                type: "percent",
                default: 8,
                min: -50,
                max: 100,
                step: 0.1
            },
            {
                id: "inflationRate",
                label: "Expected inflation",
                type: "percent",
                default: 3,
                min: 0,
                max: 50,
                step: 0.1
            }
        ],
        compute(values) {
            const nominal = values.nominalRate / 100;
            const inflation = values.inflationRate / 100;
            const real = (1 + nominal) / (1 + inflation) - 1;
            const approximate = nominal - inflation;

            return {
                outputs: [
                    { id: "realReturn", label: "Real return", value: real * 100, format: "percent" },
                    {
                        id: "approximate",
                        label: "Nominal − inflation (approx.)",
                        value: approximate * 100,
                        format: "percent"
                    }
                ],
                notes: ["Exact: real = (1 + nominal) ÷ (1 + inflation) − 1"]
            };
        }
    },
    {
        id: "position-size",
        title: "Position Size (Risk)",
        category: "Risk",
        description: "Size a trade so that loss to stop-loss equals a fixed percentage of account equity.",
        inputs: [
            {
                id: "accountSize",
                label: "Account size",
                type: "currency",
                default: 50000,
                min: 1,
                step: 1000
            },
            {
                id: "riskPercent",
                label: "Risk per trade",
                type: "percent",
                default: 1,
                min: 0.1,
                max: 20,
                step: 0.1
            },
            {
                id: "entryPrice",
                label: "Entry price",
                type: "currency",
                default: 100,
                min: 0.01,
                step: 0.01
            },
            {
                id: "stopLossPrice",
                label: "Stop-loss price",
                type: "currency",
                default: 92,
                min: 0.01,
                step: 0.01
            }
        ],
        compute(values) {
            const riskPerShare = values.entryPrice - values.stopLossPrice;

            if (riskPerShare <= 0) {
                return {
                    outputs: [
                        {
                            id: "error",
                            label: "Result",
                            value: "Stop-loss must be below entry price.",
                            format: "text"
                        }
                    ]
                };
            }

            const riskAmount = values.accountSize * (values.riskPercent / 100);
            const shares = riskAmount / riskPerShare;
            const positionValue = shares * values.entryPrice;
            const positionPercent = (positionValue / values.accountSize) * 100;

            return {
                outputs: [
                    { id: "shares", label: "Shares / units", value: shares, format: "number" },
                    { id: "positionValue", label: "Position value", value: positionValue, format: "currency" },
                    { id: "riskAmount", label: "Dollar risk", value: riskAmount, format: "currency" },
                    { id: "positionPercent", label: "Position vs account", value: positionPercent, format: "percent" }
                ],
                notes: ["Shares = (account × risk%) ÷ (entry − stop-loss)"]
            };
        }
    },
    {
        id: "withdrawal-plan",
        title: "Withdrawal Plan",
        category: "Planning",
        description: "Estimate annual or monthly withdrawals from a portfolio using a fixed withdrawal rate.",
        inputs: [
            {
                id: "portfolio",
                label: "Portfolio value",
                type: "currency",
                default: 1000000,
                min: 0,
                step: 10000
            },
            {
                id: "withdrawalRate",
                label: "Withdrawal rate",
                type: "percent",
                default: 4,
                min: 0.1,
                max: 20,
                step: 0.1
            }
        ],
        compute(values) {
            const annualWithdrawal = values.portfolio * (values.withdrawalRate / 100);
            const monthlyWithdrawal = annualWithdrawal / 12;

            return {
                outputs: [
                    {
                        id: "annual",
                        label: "Annual withdrawal",
                        value: annualWithdrawal,
                        format: "currency"
                    },
                    {
                        id: "monthly",
                        label: "Monthly withdrawal",
                        value: monthlyWithdrawal,
                        format: "currency"
                    }
                ],
                notes: [
                    "Withdrawal = portfolio × rate. The 4% rule is a common retirement planning heuristic, not a guarantee."
                ]
            };
        }
    }
];
