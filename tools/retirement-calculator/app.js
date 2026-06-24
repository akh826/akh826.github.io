let lastCalculation = null;
let recalcTimer = null;
const LANGUAGE_STORAGE_KEY = "retireCalcLanguage";
let currentLanguage = "en";

const translations = {
    en: {
        pageTitle: "Retirement Calculator",
        pageIntro: "Estimate how much you may need for retirement based on your monthly income, target lifetime, and inflation-adjusted spending.",
        toolNote: "This calculator uses a simplified projection model for planning and education only. It is not financial advice.",
        inputsHeading: "Inputs",
        resultsHeading: "Results",
        projectionHeading: "Projection chart",
        breakdownHeading: "Breakdown",
        monthlyIncomeLabel: "Monthly income",
        currentAgeLabel: "Current age",
        retirementAgeLabel: "Retirement age",
        targetLifetimeLabel: "Target lifetime",
        incomeReplacementLabel: "Income replacement ratio",
        inflationRateLabel: "Inflation rate",
        annualReturnLabel: "Expected annual return",
        currentSavingsLabel: "Current savings",
        monthlyContributionLabel: "Monthly contribution",
        incomeGrowthRateLabel: "Income growth before retirement",
        returnVolatilityLabel: "Return volatility (sequence risk)",
        simulationCountLabel: "Monte Carlo simulations",
        stressScenarioLabel: "Stress test scenario",
        monthlyIncomeHelp: "Your current monthly income before retirement. The calculator uses this to estimate target retirement spending.",
        currentAgeHelp: "Your age now. Used to calculate how long your money can grow before retirement.",
        retirementAgeHelp: "The age you plan to stop working. This is when retirement withdrawals begin in the projection.",
        targetLifetimeHelp: "How long you want your savings to last, expressed as age. Example: 90 means plan until age 90.",
        incomeReplacementHelp: "Percentage of your current income you want available during retirement. Example: 70 percent means target retirement spending is 70 percent of current income.",
        inflationRateHelp: "Expected yearly increase in living costs. Higher inflation means you need more money in retirement.",
        annualReturnHelp: "Estimated average yearly investment growth before inflation. Used to project savings growth.",
        currentSavingsHelp: "Total amount already saved for retirement today.",
        monthlyContributionHelp: "How much you plan to invest each month until retirement. Increasing this usually reduces the retirement funding gap.",
        incomeGrowthRateHelp: "Expected yearly growth in your income before retirement. The tool scales future contribution amounts with this growth.",
        returnVolatilityHelp: "Annual return uncertainty used for Monte Carlo simulation. Higher values increase sequence-of-returns risk.",
        simulationCountHelp: "Number of random market simulations. More runs produce steadier probability estimates but can be slower.",
        stressScenarioHelp: "Quick stress assumptions applied to return and inflation to test plan resilience.",
        resetBtn: "Reset",
        calculateBtn: "Calculate",
        scenarioBaseline: "Baseline",
        scenarioBadDecade: "Bad decade",
        scenarioHighInflation: "High inflation",
        scenarioLowReturn: "Low return",
        legendPortfolio: "Projected portfolio",
        legendTarget: "Required corpus",
        statusDone: "Calculation complete.",
        statusReset: "Inputs reset to defaults.",
        requiredCorpus: "Required retirement corpus",
        projectedPortfolio: "Projected portfolio at retirement",
        monthlySpendingAtRetirement: "Monthly spending at retirement",
        fundingGap: "Funding gap (or surplus)",
        yearsToRetirement: "Years to retirement",
        yearsInRetirement: "Years in retirement",
        replacementTarget: "Monthly income replacement target",
        inflationAdjustedAnnual: "Inflation-adjusted annual spending at retirement",
        realAnnualReturn: "Real annual return (after inflation)",
        additionalMonthlyNeeded: "Additional monthly savings needed",
        monteCarloSuccess: "Monte Carlo success probability",
        medianEndingBalance: "Median ending balance",
        downsideBalance: "10th percentile ending balance",
        selectedScenario: "Selected stress scenario",
        contributionAtRetirement: "Monthly contribution near retirement",
        yearsSuffix: "years",
        chartCaption: "Blue line shows projected portfolio from age {minAge} to {maxAge}. Orange dashed line is required corpus at retirement age {retirementAge}.",
        chartAge: "Age {age}",
        note1: "Inflation adjustment uses monthly spending target × (1 + inflation)^years until retirement.",
        note2: "Required corpus is the present value of monthly retirement spending using real return.",
        note3: "Income growth increases both projected pre-retirement income and contribution amount each year.",
        note4: "Monte Carlo runs random return paths to estimate sequence-of-returns risk and success probability.",
        note5: "Stress scenarios adjust return and inflation assumptions for resilience testing.",
        errorMonthlyIncome: "Monthly income must be zero or greater.",
        errorAgesRequired: "Ages are required.",
        errorRetirementAge: "Retirement age must be greater than current age.",
        errorTargetLifetime: "Target lifetime must be greater than retirement age.",
        errorIncomeReplacement: "Income replacement ratio must be greater than 0%.",
        errorInflation: "Inflation rate must be 0% or greater.",
        errorAnnualReturn: "Expected annual return must be 0% or greater.",
        errorIncomeGrowth: "Income growth rate must be between -5% and 20%.",
        errorVolatility: "Return volatility must be 0% or greater.",
        errorSimulationCount: "Simulation count must be between 100 and 5000.",
        errorCurrentSavings: "Current savings must be zero or greater.",
        errorMonthlyContribution: "Monthly contribution must be zero or greater.",
        inputsAria: "Inputs",
        resultsAria: "Results",
        chartAria: "Projection chart",
        canvasAria: "Portfolio projection chart",
        helpAriaSuffix: " help"
    },
    "zh-Hant": {
        pageTitle: "退休計算機",
        pageIntro: "根據你的每月收入、目標壽命和通脹調整後的支出，估算退休所需資金。",
        toolNote: "此計算機使用簡化模型作規劃與教育用途，不構成任何財務建議。",
        inputsHeading: "輸入",
        resultsHeading: "結果",
        projectionHeading: "預測圖表",
        breakdownHeading: "明細",
        monthlyIncomeLabel: "每月收入",
        currentAgeLabel: "目前年齡",
        retirementAgeLabel: "退休年齡",
        targetLifetimeLabel: "目標壽命",
        incomeReplacementLabel: "收入替代比率",
        inflationRateLabel: "通脹率",
        annualReturnLabel: "預期年回報率",
        currentSavingsLabel: "現有儲蓄",
        monthlyContributionLabel: "每月供款",
        incomeGrowthRateLabel: "退休前收入增長率",
        returnVolatilityLabel: "回報波動率（次序風險）",
        simulationCountLabel: "蒙地卡羅模擬次數",
        stressScenarioLabel: "壓力測試情境",
        monthlyIncomeHelp: "你退休前目前的每月收入。計算機會用它估算退休後的目標支出。",
        currentAgeHelp: "你現在的年齡，用來計算退休前還有多少時間讓資金增長。",
        retirementAgeHelp: "你計劃停止工作的年齡。模型會在這個年齡開始模擬退休提款。",
        targetLifetimeHelp: "你希望退休金可維持到的年齡。例如填 90 代表規劃到 90 歲。",
        incomeReplacementHelp: "你希望退休後仍可維持現時收入多少比例。例：70% 代表以現時收入的 70% 作為退休支出目標。",
        inflationRateHelp: "預期每年生活成本上升幅度。通脹越高，退休所需資金通常越多。",
        annualReturnHelp: "預計投資每年的平均回報率，未扣除通脹，用於估算儲蓄增長。",
        currentSavingsHelp: "你目前已為退休累積的總儲蓄。",
        monthlyContributionHelp: "你計劃每月投入的退休儲蓄金額。通常增加此金額可縮小資金缺口。",
        incomeGrowthRateHelp: "預期退休前每年的收入增長。工具會按此增幅調整未來供款金額。",
        returnVolatilityHelp: "用於蒙地卡羅模擬的年回報不確定性。數值越高，回報次序風險越大。",
        simulationCountHelp: "隨機市場模擬的次數。次數越多，成功率估算越穩定，但計算會稍慢。",
        stressScenarioHelp: "快速套用壓力假設（回報與通脹）以測試退休計劃韌性。",
        resetBtn: "重設",
        calculateBtn: "計算",
        scenarioBaseline: "基準情境",
        scenarioBadDecade: "低迷十年",
        scenarioHighInflation: "高通脹",
        scenarioLowReturn: "低回報",
        legendPortfolio: "預計投資組合",
        legendTarget: "所需退休本金",
        statusDone: "計算完成。",
        statusReset: "已重設為預設值。",
        requiredCorpus: "所需退休本金",
        projectedPortfolio: "退休時預計資產",
        monthlySpendingAtRetirement: "退休時每月支出",
        fundingGap: "資金差額（或盈餘）",
        yearsToRetirement: "距離退休年期",
        yearsInRetirement: "退休期年數",
        replacementTarget: "每月收入替代目標",
        inflationAdjustedAnnual: "退休時通脹調整後的年度支出",
        realAnnualReturn: "實質年回報率（扣除通脹後）",
        additionalMonthlyNeeded: "每月額外所需儲蓄",
        monteCarloSuccess: "蒙地卡羅成功率",
        medianEndingBalance: "期末資產中位數",
        downsideBalance: "期末資產第 10 百分位",
        selectedScenario: "已選壓力情境",
        contributionAtRetirement: "接近退休時每月供款",
        yearsSuffix: "年",
        chartCaption: "藍線顯示從 {minAge} 歲到 {maxAge} 歲的預計投資組合。橙色虛線表示在 {retirementAge} 歲退休時所需的退休本金。",
        chartAge: "{age} 歲",
        note1: "通脹調整使用：每月支出目標 × (1 + 通脹率)^退休前年數。",
        note2: "所需退休本金按實質回報率計算，代表退休期間每月支出的現值。",
        note3: "收入增長會逐年提高退休前收入預測與每月供款金額。",
        note4: "蒙地卡羅會用隨機回報路徑估算回報次序風險與成功率。",
        note5: "壓力情境會調整回報與通脹假設，用於檢查計劃韌性。",
        errorMonthlyIncome: "每月收入必須為 0 或以上。",
        errorAgesRequired: "請輸入年齡資料。",
        errorRetirementAge: "退休年齡必須大於目前年齡。",
        errorTargetLifetime: "目標壽命必須大於退休年齡。",
        errorIncomeReplacement: "收入替代比率必須大於 0%。",
        errorInflation: "通脹率必須為 0% 或以上。",
        errorAnnualReturn: "預期年回報率必須為 0% 或以上。",
        errorIncomeGrowth: "收入增長率必須介乎 -5% 至 20%。",
        errorVolatility: "回報波動率必須為 0% 或以上。",
        errorSimulationCount: "模擬次數必須介乎 100 至 5000。",
        errorCurrentSavings: "現有儲蓄必須為 0 或以上。",
        errorMonthlyContribution: "每月供款必須為 0 或以上。",
        inputsAria: "輸入",
        resultsAria: "結果",
        chartAria: "預測圖表",
        canvasAria: "投資組合預測圖表",
        helpAriaSuffix: "說明"
    }
};

function t(key, params = {}) {
    const dictionary = translations[currentLanguage] ?? translations.en;
    const fallback = translations.en[key] ?? key;
    let value = dictionary[key] ?? fallback;

    Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replaceAll(`{${paramKey}}`, String(paramValue));
    });

    return value;
}

function loadLanguage() {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored && translations[stored] ? stored : "en";
}

function formatYears(value) {
    return currentLanguage === "zh-Hant"
        ? `${number(value)}${t("yearsSuffix")}`
        : `${number(value)} ${t("yearsSuffix")}`;
}

function setLanguage(language) {
    currentLanguage = translations[language] ? language : "en";
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    document.documentElement.lang = currentLanguage;

    document.querySelectorAll("[data-i18n]").forEach((node) => {
        node.textContent = t(node.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-help]").forEach((node) => {
        const helpKey = node.dataset.i18nHelp;
        const labelNode = node.parentElement?.querySelector("[data-i18n]");
        const labelText = labelNode ? t(labelNode.dataset.i18n) : "";

        node.setAttribute("data-help", t(helpKey));
        node.setAttribute("aria-label", `${labelText}${t("helpAriaSuffix")}`);
    });

    document.getElementById("inputsSection")?.setAttribute("aria-label", t("inputsAria"));
    document.getElementById("resultsSection")?.setAttribute("aria-label", t("resultsAria"));
    document.getElementById("chartSection")?.setAttribute("aria-label", t("chartAria"));
    document.getElementById("retireChart")?.setAttribute("aria-label", t("canvasAria"));

    document.getElementById("langEn")?.classList.toggle("is-active", currentLanguage === "en");
    document.getElementById("langZh")?.classList.toggle("is-active", currentLanguage === "zh-Hant");

    if (lastCalculation) {
        render(lastCalculation);
    }
}

function currency(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }

    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 1000 ? 0 : 2
    }).format(value);
}

function percent(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }

    return `${value.toFixed(2)}%`;
}

function number(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }

    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2
    }).format(value);
}

function setStatus(message, type = "") {
    const node = document.getElementById("retireStatus");
    if (!node) {
        return;
    }

    node.textContent = message;
    node.classList.remove("success", "error");
    if (type) {
        node.classList.add(type);
    }
}

function parsePositiveNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function futureValue(principal, monthlyContribution, annualRate, years) {
    const months = Math.max(0, Math.floor(years * 12));
    const monthlyRate = annualRate / 12;

    if (months === 0) {
        return principal;
    }

    if (monthlyRate === 0) {
        return principal + monthlyContribution * months;
    }

    const growthFactor = Math.pow(1 + monthlyRate, months);
    return principal * growthFactor + monthlyContribution * ((growthFactor - 1) / monthlyRate);
}

function annuityPresentValue(monthlySpending, realAnnualRate, years) {
    const months = Math.max(0, Math.floor(years * 12));

    if (months === 0) {
        return 0;
    }

    const monthlyRealRate = realAnnualRate / 12;

    if (Math.abs(monthlyRealRate) < 1e-9) {
        return monthlySpending * months;
    }

    return monthlySpending * (1 - Math.pow(1 + monthlyRealRate, -months)) / monthlyRealRate;
}

function getInputs() {
    return {
        monthlyIncome: parsePositiveNumber(document.getElementById("monthlyIncome")?.value),
        currentAge: parsePositiveNumber(document.getElementById("currentAge")?.value),
        retirementAge: parsePositiveNumber(document.getElementById("retirementAge")?.value),
        targetLifetime: parsePositiveNumber(document.getElementById("targetLifetime")?.value),
        incomeReplacement: parsePositiveNumber(document.getElementById("incomeReplacement")?.value),
        inflationRate: parsePositiveNumber(document.getElementById("inflationRate")?.value),
        annualReturn: parsePositiveNumber(document.getElementById("annualReturn")?.value),
        currentSavings: parsePositiveNumber(document.getElementById("currentSavings")?.value),
        monthlyContribution: parsePositiveNumber(document.getElementById("monthlyContribution")?.value),
        incomeGrowthRate: parsePositiveNumber(document.getElementById("incomeGrowthRate")?.value),
        returnVolatility: parsePositiveNumber(document.getElementById("returnVolatility")?.value),
        simulationCount: parsePositiveNumber(document.getElementById("simulationCount")?.value),
        stressScenario: document.getElementById("stressScenario")?.value ?? "baseline"
    };
}

function getScenarioConfig(scenarioId, annualReturn, inflationRate) {
    const config = {
        id: scenarioId,
        annualReturn,
        inflationRate,
        firstYearShock: 0,
        badDecadePenalty: 0
    };

    if (scenarioId === "bad-decade") {
        config.firstYearShock = -0.2;
        config.badDecadePenalty = 0.04;
    } else if (scenarioId === "high-inflation") {
        config.inflationRate += 0.02;
    } else if (scenarioId === "low-return") {
        config.annualReturn -= 0.02;
    }

    config.annualReturn = Math.max(-0.5, config.annualReturn);
    config.inflationRate = Math.max(0, config.inflationRate);

    return config;
}

function getMonthlyContributionForYear(input, yearIndex) {
    if (input.monthlyIncome <= 0) {
        return input.monthlyContribution;
    }

    const savingsRate = input.monthlyContribution / input.monthlyIncome;
    const growth = Math.pow(1 + input.incomeGrowthRate / 100, yearIndex);
    return input.monthlyIncome * growth * savingsRate;
}

function normalRandom(mean, stdDev) {
    if (stdDev <= 0) {
        return mean;
    }

    const u1 = Math.max(Number.EPSILON, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
}

function annualReturnForYear(scenario, globalYear, randomVolatility = 0) {
    let expected = scenario.annualReturn;
    if (scenario.badDecadePenalty > 0 && globalYear < 10) {
        expected -= scenario.badDecadePenalty;
    }

    const sampled = normalRandom(expected, randomVolatility);
    return Math.max(-0.95, sampled);
}

function simulateDeterministicRetirement(input, scenario, yearsToRetirement, yearsInRetirement, monthlySpendingAtRetirement) {
    let portfolio = input.currentSavings;
    let globalYear = 0;

    for (let year = 0; year < yearsToRetirement; year += 1) {
        const monthlyContribution = getMonthlyContributionForYear(input, year);
        const annualReturn = annualReturnForYear(scenario, globalYear, 0);
        portfolio = futureValue(portfolio, monthlyContribution, annualReturn, 1);

        if (year === 0 && scenario.firstYearShock !== 0) {
            portfolio *= (1 + scenario.firstYearShock);
        }

        globalYear += 1;
    }

    let annualWithdrawal = monthlySpendingAtRetirement * 12;
    for (let year = 0; year < yearsInRetirement; year += 1) {
        const annualReturn = annualReturnForYear(scenario, globalYear, 0);
        portfolio = portfolio * (1 + annualReturn) - annualWithdrawal;
        annualWithdrawal *= (1 + scenario.inflationRate);
        globalYear += 1;
    }

    return portfolio;
}

function runMonteCarlo(input, scenario, yearsToRetirement, yearsInRetirement, monthlySpendingAtRetirement) {
    const simulations = Math.trunc(input.simulationCount);
    const volatility = input.returnVolatility / 100;
    const endingBalances = [];
    let successCount = 0;

    for (let i = 0; i < simulations; i += 1) {
        let portfolio = input.currentSavings;
        let globalYear = 0;
        let survived = true;

        for (let year = 0; year < yearsToRetirement; year += 1) {
            const monthlyContribution = getMonthlyContributionForYear(input, year);
            const annualReturn = annualReturnForYear(scenario, globalYear, volatility);
            portfolio = futureValue(portfolio, monthlyContribution, annualReturn, 1);

            if (year === 0 && scenario.firstYearShock !== 0) {
                portfolio *= (1 + scenario.firstYearShock);
            }

            globalYear += 1;
        }

        let annualWithdrawal = monthlySpendingAtRetirement * 12;

        for (let year = 0; year < yearsInRetirement; year += 1) {
            const annualReturn = annualReturnForYear(scenario, globalYear, volatility);
            portfolio = portfolio * (1 + annualReturn) - annualWithdrawal;
            annualWithdrawal *= (1 + scenario.inflationRate);
            globalYear += 1;

            if (portfolio <= 0) {
                survived = false;
                portfolio = 0;
                break;
            }
        }

        if (survived) {
            successCount += 1;
        }

        endingBalances.push(portfolio);
    }

    endingBalances.sort((a, b) => a - b);
    const percentile = (p) => endingBalances[Math.min(endingBalances.length - 1, Math.floor((endingBalances.length - 1) * p))];

    return {
        successProbability: simulations > 0 ? (successCount / simulations) * 100 : 0,
        p10Balance: percentile(0.1),
        medianBalance: percentile(0.5)
    };
}

function validateInputs(input) {
    if (!Number.isFinite(input.monthlyIncome) || input.monthlyIncome < 0) {
        return t("errorMonthlyIncome");
    }

    if (!Number.isFinite(input.currentAge) || !Number.isFinite(input.retirementAge) || !Number.isFinite(input.targetLifetime)) {
        return t("errorAgesRequired");
    }

    if (input.retirementAge <= input.currentAge) {
        return t("errorRetirementAge");
    }

    if (input.targetLifetime <= input.retirementAge) {
        return t("errorTargetLifetime");
    }

    if (!Number.isFinite(input.incomeReplacement) || input.incomeReplacement <= 0) {
        return t("errorIncomeReplacement");
    }

    if (!Number.isFinite(input.inflationRate) || input.inflationRate < 0) {
        return t("errorInflation");
    }

    if (!Number.isFinite(input.annualReturn) || input.annualReturn < 0) {
        return t("errorAnnualReturn");
    }

    if (!Number.isFinite(input.incomeGrowthRate) || input.incomeGrowthRate < -5 || input.incomeGrowthRate > 20) {
        return t("errorIncomeGrowth");
    }

    if (!Number.isFinite(input.returnVolatility) || input.returnVolatility < 0) {
        return t("errorVolatility");
    }

    if (!Number.isFinite(input.simulationCount) || input.simulationCount < 100 || input.simulationCount > 5000) {
        return t("errorSimulationCount");
    }

    if (!Number.isFinite(input.currentSavings) || input.currentSavings < 0) {
        return t("errorCurrentSavings");
    }

    if (!Number.isFinite(input.monthlyContribution) || input.monthlyContribution < 0) {
        return t("errorMonthlyContribution");
    }

    return "";
}

function resultCard(label, value, isPrimary = false) {
    const card = document.createElement("div");
    card.className = "invest-output-card";
    if (isPrimary) {
        card.classList.add("invest-output-primary");
    }

    const labelNode = document.createElement("p");
    labelNode.className = "invest-output-label";
    labelNode.textContent = label;

    const valueNode = document.createElement("p");
    valueNode.className = "invest-output-value";
    valueNode.textContent = value;

    card.append(labelNode, valueNode);
    return card;
}

function addBreakdownRow(body, label, value) {
    const row = document.createElement("tr");

    const head = document.createElement("th");
    head.scope = "row";
    head.textContent = label;

    const cell = document.createElement("td");
    cell.textContent = value;

    row.append(head, cell);
    body.appendChild(row);
}

function projectTimeline(input, scenario, monthlySpendingAtRetirement) {
    const points = [];
    const inflationRate = scenario.inflationRate;

    let age = input.currentAge;
    let portfolio = input.currentSavings;
    let globalYear = 0;

    points.push({ age, portfolio });

    for (let year = 0; year < input.retirementAge - input.currentAge; year += 1) {
        const monthlyContribution = getMonthlyContributionForYear(input, year);
        const annualReturn = annualReturnForYear(scenario, globalYear, 0);
        portfolio = futureValue(portfolio, monthlyContribution, annualReturn, 1);

        if (year === 0 && scenario.firstYearShock !== 0) {
            portfolio *= (1 + scenario.firstYearShock);
        }

        age += 1;
        points.push({ age, portfolio });
        globalYear += 1;
    }

    let annualWithdrawal = monthlySpendingAtRetirement * 12;

    while (age < input.targetLifetime) {
        const annualReturn = annualReturnForYear(scenario, globalYear, 0);
        portfolio = portfolio * (1 + annualReturn) - annualWithdrawal;
        age += 1;
        points.push({ age, portfolio });
        annualWithdrawal *= (1 + inflationRate);
        globalYear += 1;
    }

    return points;
}

function drawRetirementChart(calculation) {
    const canvas = document.getElementById("retireChart");
    const caption = document.getElementById("retireChartCaption");

    if (!canvas) {
        return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    const parentWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 640;
    const width = Math.max(320, Math.floor(parentWidth));
    const height = 320;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const padding = { top: 20, right: 16, bottom: 34, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const ages = calculation.timeline.map((point) => point.age);
    const values = calculation.timeline.map((point) => point.portfolio);
    values.push(calculation.requiredCorpus);

    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);

    let minValue = Math.min(0, ...values);
    let maxValue = Math.max(...values);

    if (Math.abs(maxValue - minValue) < 1e-6) {
        maxValue += 1;
        minValue -= 1;
    }

    const valuePadding = (maxValue - minValue) * 0.08;
    minValue -= valuePadding;
    maxValue += valuePadding;

    const xForAge = (age) => {
        if (maxAge === minAge) {
            return padding.left;
        }

        return padding.left + ((age - minAge) / (maxAge - minAge)) * chartWidth;
    };

    const yForValue = (value) => {
        return padding.top + ((maxValue - value) / (maxValue - minValue)) * chartHeight;
    };

    context.clearRect(0, 0, width, height);

    context.fillStyle = "rgba(148, 163, 184, 0.14)";
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (chartHeight / 4) * i;
        context.fillRect(padding.left, y, chartWidth, 1);
    }

    context.strokeStyle = "rgba(100, 116, 139, 0.5)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, padding.top);
    context.lineTo(padding.left, height - padding.bottom);
    context.lineTo(width - padding.right, height - padding.bottom);
    context.stroke();

    const targetY = yForValue(calculation.requiredCorpus);
    context.save();
    context.setLineDash([6, 4]);
    context.strokeStyle = "#f97316";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding.left, targetY);
    context.lineTo(width - padding.right, targetY);
    context.stroke();
    context.restore();

    context.strokeStyle = "#0ea5e9";
    context.lineWidth = 2.5;
    context.beginPath();

    calculation.timeline.forEach((point, index) => {
        const x = xForAge(point.age);
        const y = yForValue(point.portfolio);
        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    });

    context.stroke();

    const retirementX = xForAge(calculation.retirementAge);
    context.strokeStyle = "rgba(14, 165, 233, 0.35)";
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(retirementX, padding.top);
    context.lineTo(retirementX, height - padding.bottom);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#475569";
    context.font = "12px Inter, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let i = 0; i <= 4; i += 1) {
        const value = maxValue - ((maxValue - minValue) * i) / 4;
        const y = padding.top + (chartHeight / 4) * i;
        context.fillText(currency(value), padding.left - 8, y);
    }

    context.textAlign = "center";
    context.textBaseline = "top";
    const xTicks = [minAge, calculation.retirementAge, maxAge];
    xTicks.forEach((age) => {
        context.fillText(t("chartAge", { age: Math.round(age) }), xForAge(age), height - padding.bottom + 8);
    });

    if (caption) {
        caption.textContent = t("chartCaption", {
            minAge: Math.round(minAge),
            maxAge: Math.round(maxAge),
            retirementAge: Math.round(calculation.retirementAge)
        });
    }
}

function render(calculation) {
    const outputs = document.getElementById("retireOutputs");
    const breakdown = document.getElementById("retireBreakdown");
    const notes = document.getElementById("retireNotes");

    if (!outputs || !breakdown || !notes) {
        return;
    }

    outputs.innerHTML = "";
    breakdown.innerHTML = "";
    notes.innerHTML = "";

    outputs.appendChild(resultCard(t("requiredCorpus"), currency(calculation.requiredCorpus), true));
    outputs.appendChild(resultCard(t("projectedPortfolio"), currency(calculation.projectedPortfolio)));
    outputs.appendChild(resultCard(t("monthlySpendingAtRetirement"), currency(calculation.monthlySpendingAtRetirement)));
    outputs.appendChild(resultCard(t("fundingGap"), currency(calculation.fundingGap)));
    outputs.appendChild(resultCard(t("monteCarloSuccess"), percent(calculation.successProbability)));
    outputs.appendChild(resultCard(t("medianEndingBalance"), currency(calculation.medianBalance)));

    addBreakdownRow(breakdown, t("yearsToRetirement"), formatYears(calculation.yearsToRetirement));
    addBreakdownRow(breakdown, t("yearsInRetirement"), formatYears(calculation.yearsInRetirement));
    addBreakdownRow(breakdown, t("replacementTarget"), percent(calculation.incomeReplacementPercent));
    addBreakdownRow(breakdown, t("inflationAdjustedAnnual"), currency(calculation.annualSpendingAtRetirement));
    addBreakdownRow(breakdown, t("realAnnualReturn"), percent(calculation.realAnnualReturnPercent));
    addBreakdownRow(breakdown, t("additionalMonthlyNeeded"), currency(calculation.additionalMonthlyNeeded));
    addBreakdownRow(breakdown, t("downsideBalance"), currency(calculation.p10Balance));
    addBreakdownRow(breakdown, t("contributionAtRetirement"), currency(calculation.monthlyContributionAtRetirement));
    addBreakdownRow(breakdown, t("selectedScenario"), t(calculation.scenarioLabelKey));

    const notesData = [
        t("note1"),
        t("note2"),
        t("note3"),
        t("note4"),
        t("note5")
    ];

    notesData.forEach((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        notes.appendChild(item);
    });

    lastCalculation = calculation;
    drawRetirementChart(calculation);
}

function scenarioLabelKey(scenarioId) {
    if (scenarioId === "bad-decade") {
        return "scenarioBadDecade";
    }

    if (scenarioId === "high-inflation") {
        return "scenarioHighInflation";
    }

    if (scenarioId === "low-return") {
        return "scenarioLowReturn";
    }

    return "scenarioBaseline";
}

function calculate(event) {
    event?.preventDefault();

    const input = getInputs();
    const validationError = validateInputs(input);

    if (validationError) {
        setStatus(validationError, "error");
        return;
    }

    const yearsToRetirement = input.retirementAge - input.currentAge;
    const yearsInRetirement = input.targetLifetime - input.retirementAge;

    const baseInflationRate = input.inflationRate / 100;
    const baseAnnualReturn = input.annualReturn / 100;
    const replacementRatio = input.incomeReplacement / 100;

    const scenario = getScenarioConfig(input.stressScenario, baseAnnualReturn, baseInflationRate);
    const monthlyIncomeAtRetirement = input.monthlyIncome * Math.pow(1 + input.incomeGrowthRate / 100, yearsToRetirement);
    const monthlySpendingAtRetirement = monthlyIncomeAtRetirement * replacementRatio;

    const realAnnualReturn = (1 + scenario.annualReturn) / (1 + scenario.inflationRate) - 1;
    const requiredCorpus = annuityPresentValue(monthlySpendingAtRetirement, realAnnualReturn, yearsInRetirement);

    const projectedPortfolio = simulateDeterministicRetirement(
        input,
        scenario,
        yearsToRetirement,
        0,
        monthlySpendingAtRetirement
    );

    const fundingGap = requiredCorpus - projectedPortfolio;
    const monthlyContributionAtRetirement = getMonthlyContributionForYear(input, Math.max(0, yearsToRetirement - 1));

    let additionalMonthlyNeeded = 0;
    if (fundingGap > 0 && yearsToRetirement > 0) {
        const monthlyRate = scenario.annualReturn / 12;
        const months = Math.floor(yearsToRetirement * 12);

        if (months > 0) {
            if (Math.abs(monthlyRate) < 1e-9) {
                additionalMonthlyNeeded = fundingGap / months;
            } else {
                const contributionFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
                additionalMonthlyNeeded = fundingGap / contributionFactor;
            }
        }
    }

    const monteCarlo = runMonteCarlo(input, scenario, yearsToRetirement, yearsInRetirement, monthlySpendingAtRetirement);

    render({
        requiredCorpus,
        projectedPortfolio,
        monthlySpendingAtRetirement,
        annualSpendingAtRetirement: monthlySpendingAtRetirement * 12,
        fundingGap,
        additionalMonthlyNeeded,
        monthlyContributionAtRetirement,
        successProbability: monteCarlo.successProbability,
        medianBalance: monteCarlo.medianBalance,
        p10Balance: monteCarlo.p10Balance,
        scenarioLabelKey: scenarioLabelKey(input.stressScenario),
        yearsToRetirement,
        yearsInRetirement,
        incomeReplacementPercent: input.incomeReplacement,
        realAnnualReturnPercent: realAnnualReturn * 100,
        timeline: projectTimeline(input, scenario, monthlySpendingAtRetirement),
        retirementAge: input.retirementAge
    });

    setStatus(t("statusDone"), "success");
}

function resetForm() {
    const defaults = {
        monthlyIncome: 5000,
        currentAge: 30,
        retirementAge: 60,
        targetLifetime: 90,
        incomeReplacement: 70,
        inflationRate: 3,
        annualReturn: 7,
        currentSavings: 25000,
        monthlyContribution: 700,
        incomeGrowthRate: 2.5,
        returnVolatility: 12,
        simulationCount: 1000
    };

    Object.entries(defaults).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) {
            input.value = String(value);
        }
    });

    const scenario = document.getElementById("stressScenario");
    if (scenario) {
        scenario.value = "baseline";
    }

    calculate();
    setStatus(t("statusReset"), "success");
}

function init() {
    currentLanguage = loadLanguage();

    const form = document.getElementById("retireForm");
    form?.addEventListener("submit", calculate);
    form?.addEventListener("input", () => {
        window.clearTimeout(recalcTimer);
        recalcTimer = window.setTimeout(() => {
            calculate();
        }, 180);
    });

    document.getElementById("resetBtn")?.addEventListener("click", resetForm);
    document.getElementById("langEn")?.addEventListener("click", () => setLanguage("en"));
    document.getElementById("langZh")?.addEventListener("click", () => setLanguage("zh-Hant"));

    window.addEventListener("resize", () => {
        if (lastCalculation) {
            drawRetirementChart(lastCalculation);
        }
    });

    setLanguage(currentLanguage);
    calculate();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
