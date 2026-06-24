const STORAGE_KEY = "investCalcLastFormula";

let activeFormulaId = null;

function getFormulas() {
    return window.INVEST_FORMULAS ?? [];
}

function getFormulaById(id) {
    return getFormulas().find((formula) => formula.id === id);
}

function groupFormulasByCategory(formulas) {
    const groups = new Map();

    formulas.forEach((formula) => {
        const category = formula.category ?? "Other";
        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category).push(formula);
    });

    return groups;
}

function setStatus(message, type = "") {
    const status = document.getElementById("calcStatus");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function formatValue(value, format) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "—";
    }

    if (format === "text") {
        return String(value);
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return String(value);
    }

    switch (format) {
        case "currency":
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: value >= 1000 ? 0 : 2
            }).format(value);
        case "percent":
            return `${value.toFixed(2)}%`;
        case "years":
            return `${value.toFixed(2)} yrs`;
        case "number":
            return new Intl.NumberFormat(undefined, {
                maximumFractionDigits: value >= 100 ? 0 : 2
            }).format(value);
        default:
            return String(value);
    }
}

function parseInputValue(inputDef, rawValue) {
    if (inputDef.type === "select") {
        return rawValue;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    if (inputDef.integer) {
        return Math.trunc(parsed);
    }

    return parsed;
}

function readInputValues(formula) {
    const values = {};

    for (const inputDef of formula.inputs) {
        const field = document.getElementById(`input-${inputDef.id}`);
        if (!field) {
            continue;
        }

        values[inputDef.id] = parseInputValue(inputDef, field.value);
    }

    return values;
}

function validateInputs(formula, values) {
    for (const inputDef of formula.inputs) {
        const value = values[inputDef.id];

        if (value === null || value === undefined || value === "") {
            return `${inputDef.label} is required.`;
        }

        if (inputDef.type !== "select" && typeof value === "number") {
            if (inputDef.min !== undefined && value < inputDef.min) {
                return `${inputDef.label} must be at least ${inputDef.min}.`;
            }

            if (inputDef.max !== undefined && value > inputDef.max) {
                return `${inputDef.label} must be at most ${inputDef.max}.`;
            }
        }
    }

    return "";
}

function renderFormulaPicker() {
    const select = document.getElementById("formulaSelect");
    if (!select) {
        return;
    }

    const formulas = getFormulas();
    select.innerHTML = "";

    if (!formulas.length) {
        const option = document.createElement("option");
        option.textContent = "No formulas defined";
        select.appendChild(option);
        return;
    }

    const groups = groupFormulasByCategory(formulas);

    groups.forEach((items, category) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = category;

        items.forEach((formula) => {
            const option = document.createElement("option");
            option.value = formula.id;
            option.textContent = formula.title;
            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    const defaultId = stored && getFormulaById(stored) ? stored : formulas[0].id;
    select.value = defaultId;
    selectFormula(defaultId);
}

function renderInputField(inputDef) {
    const fieldWrap = document.createElement("div");
    fieldWrap.className = "invest-field";

    const label = document.createElement("label");
    label.className = "invest-label";
    label.htmlFor = `input-${inputDef.id}`;
    label.textContent = inputDef.label;

    if (inputDef.unit) {
        const unit = document.createElement("span");
        unit.className = "invest-label-unit";
        unit.textContent = `(${inputDef.unit})`;
        label.appendChild(document.createTextNode(" "));
        label.appendChild(unit);
    }

    fieldWrap.appendChild(label);

    let control;

    if (inputDef.type === "select") {
        control = document.createElement("select");
        control.className = "invest-select";

        (inputDef.options ?? []).forEach((optionDef) => {
            const option = document.createElement("option");
            option.value = optionDef.value;
            option.textContent = optionDef.label;
            control.appendChild(option);
        });

        control.value = String(inputDef.default ?? "");
    } else {
        control = document.createElement("input");
        control.className = "invest-input";
        control.type = "number";
        control.inputMode = inputDef.integer ? "numeric" : "decimal";
        control.value = String(inputDef.default ?? "");
        control.step = String(inputDef.step ?? (inputDef.type === "percent" ? "0.1" : "1"));

        if (inputDef.min !== undefined) {
            control.min = String(inputDef.min);
        }

        if (inputDef.max !== undefined) {
            control.max = String(inputDef.max);
        }
    }

    control.id = `input-${inputDef.id}`;
    control.dataset.inputId = inputDef.id;

    if (inputDef.type === "percent") {
        control.dataset.inputType = "percent";
        const suffix = document.createElement("span");
        suffix.className = "invest-input-suffix";
        suffix.textContent = "%";

        const inputShell = document.createElement("div");
        inputShell.className = "invest-input-shell";
        inputShell.appendChild(control);
        inputShell.appendChild(suffix);
        fieldWrap.appendChild(inputShell);
    } else if (inputDef.type === "currency") {
        control.dataset.inputType = "currency";
        const prefix = document.createElement("span");
        prefix.className = "invest-input-prefix";
        prefix.textContent = "$";

        const inputShell = document.createElement("div");
        inputShell.className = "invest-input-shell";
        inputShell.appendChild(prefix);
        inputShell.appendChild(control);
        fieldWrap.appendChild(inputShell);
    } else {
        fieldWrap.appendChild(control);
    }

    return fieldWrap;
}

function renderInputs(formula) {
    const container = document.getElementById("inputsGrid");
    const description = document.getElementById("formulaDescription");

    if (description) {
        description.textContent = formula.description ?? "";
    }

    if (!container) {
        return;
    }

    container.innerHTML = "";

    formula.inputs.forEach((inputDef) => {
        container.appendChild(renderInputField(inputDef));
    });
}

function renderOutputs(result) {
    const outputsGrid = document.getElementById("outputsGrid");
    const breakdownBody = document.getElementById("breakdownBody");
    const breakdownCard = document.getElementById("breakdownCard");
    const notesList = document.getElementById("formulaNotes");

    if (outputsGrid) {
        outputsGrid.innerHTML = "";

        (result.outputs ?? []).forEach((output, index) => {
            const card = document.createElement("div");
            card.className = "invest-output-card";
            if (index === 0) {
                card.classList.add("invest-output-primary");
            }

            card.innerHTML = `
                <p class="invest-output-label">${escapeHtml(output.label)}</p>
                <p class="invest-output-value">${escapeHtml(formatValue(output.value, output.format))}</p>
            `;

            outputsGrid.appendChild(card);
        });
    }

    if (breakdownBody && breakdownCard) {
        breakdownBody.innerHTML = "";

        if (result.rows?.length) {
            breakdownCard.hidden = false;

            result.rows.forEach((row) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <th scope="row">${escapeHtml(row.label)}</th>
                    <td>${escapeHtml(formatValue(row.value, row.format ?? "currency"))}</td>
                `;
                breakdownBody.appendChild(tr);
            });
        } else {
            breakdownCard.hidden = true;
        }
    }

    if (notesList) {
        notesList.innerHTML = "";

        (result.notes ?? []).forEach((note) => {
            const item = document.createElement("li");
            item.textContent = note;
            notesList.appendChild(item);
        });
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function runCalculation() {
    const formula = getFormulaById(activeFormulaId);
    if (!formula) {
        return;
    }

    const values = readInputValues(formula);
    const validationError = validateInputs(formula, values);

    if (validationError) {
        setStatus(validationError, "error");
        return;
    }

    try {
        const result = formula.compute(values);
        renderOutputs(result);
        setStatus(`Calculated: ${formula.title}`, "success");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Calculation failed.";
        setStatus(message, "error");
    }
}

function selectFormula(formulaId) {
    const formula = getFormulaById(formulaId);
    if (!formula) {
        return;
    }

    activeFormulaId = formulaId;
    localStorage.setItem(STORAGE_KEY, formulaId);

    const title = document.getElementById("formulaTitle");
    if (title) {
        title.textContent = formula.title;
    }

    renderInputs(formula);
    runCalculation();
}

function initInvestmentCalculator() {
    const formulas = getFormulas();

    if (!formulas.length) {
        setStatus("No formulas found. Add entries to formulas.js.", "error");
        return;
    }

    renderFormulaPicker();

    document.getElementById("formulaSelect")?.addEventListener("change", (event) => {
        selectFormula(event.target.value);
    });

    document.getElementById("calcForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        runCalculation();
    });

    document.getElementById("calcForm")?.addEventListener("input", () => {
        runCalculation();
    });

    document.getElementById("resetInputsBtn")?.addEventListener("click", () => {
        const formula = getFormulaById(activeFormulaId);
        if (!formula) {
            return;
        }

        formula.inputs.forEach((inputDef) => {
            const field = document.getElementById(`input-${inputDef.id}`);
            if (field) {
                field.value = String(inputDef.default ?? "");
            }
        });

        runCalculation();
        setStatus("Inputs reset to defaults.", "success");
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInvestmentCalculator);
} else {
    initInvestmentCalculator();
}
