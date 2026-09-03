const SHEET_ID = "1YpAkAjBnV2-l71LaC8sF9NgaL1BexN9OJA1MbFo_9pI";
const SHEET_GID = "0";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const state = {
    headers: [],
    rows: [],
    filteredRows: [],
    sortColumnIndex: -1,
    sortDirection: "asc",
    searchText: "",
    nameFilter: "",
    locationFilter: "",
    tagFilter: "",
    ratingFilter: "",
    typeFilter: "",
    dateFrom: "",
    dateTo: "",
    nameColumnIndex: -1,
    locationColumnIndex: -1,
    tagColumnIndex: -1,
    ratingColumnIndex: -1,
    typeColumnIndex: -1,
    dateColumnIndex: -1,
    availableLocations: [],
    availableTags: [],
    availableRatings: [],
    availableTypes: [],
    loadFailed: false
};

function setStatus(message, type = "") {
    const status = document.getElementById("sheetStatus");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.remove("success", "error");
    if (type) {
        status.classList.add(type);
    }
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    const source = String(text ?? "").replace(/^\uFEFF/, "");

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        const nextCharacter = source[index + 1];

        if (inQuotes) {
            if (character === '"') {
                if (nextCharacter === '"') {
                    value += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                value += character;
            }
            continue;
        }

        if (character === '"') {
            inQuotes = true;
            continue;
        }

        if (character === ",") {
            row.push(value);
            value = "";
            continue;
        }

        if (character === "\n") {
            row.push(value);
            rows.push(row);
            row = [];
            value = "";
            continue;
        }

        if (character !== "\r") {
            value += character;
        }
    }

    row.push(value);
    rows.push(row);

    return rows.filter((currentRow) => currentRow.some((cell) => String(cell).trim() !== ""));
}

function normalizeHeaders(rawHeaders, rows) {
    const maxColumns = Math.max(rawHeaders.length, ...rows.map((row) => row.length), 0);
    const seen = new Map();

    return Array.from({ length: maxColumns }, (_, index) => {
        const fallback = `Column ${index + 1}`;
        const base = String(rawHeaders[index] ?? "").trim() || fallback;
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base} (${count})`;
    });
}

function setSourceLinks() {
    const sourceLink = document.getElementById("sheetSourceLink");
    const openBtn = document.getElementById("openSheetBtn");

    if (sourceLink) {
        sourceLink.href = SHEET_URL;
    }

    if (openBtn) {
        openBtn.href = SHEET_URL;
    }
}

function normalizeCellValue(value) {
    return String(value ?? "").trim();
}

function splitMultiValueCell(value) {
    return normalizeCellValue(value)
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeTextForSearch(value) {
    return normalizeCellValue(value).toLowerCase();
}

function parseSheetDate(value) {
    const match = normalizeCellValue(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);

    return Number.isNaN(timestamp) ? null : timestamp;
}

function countRatingStars(value) {
    return (normalizeCellValue(value).match(/★/g) ?? []).length;
}

function formatDateInputValue(value) {
    const match = normalizeCellValue(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
        return "";
    }

    const year = match[1];
    const month = match[2].padStart(2, "0");
    const day = match[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getColumnIndex(columnName) {
    const target = columnName.trim().toLowerCase();
    return state.headers.findIndex((header) => header.trim().toLowerCase() === target);
}

function populateSelectOptions(filterId, values, placeholder, enabled) {
    const filter = document.getElementById(filterId);
    if (!filter) {
        return;
    }

    filter.innerHTML = `<option value="">${placeholder}</option>`;

    values.forEach((typeValue) => {
        const option = document.createElement("option");
        option.value = typeValue;
        option.textContent = typeValue;
        filter.appendChild(option);
    });

    filter.disabled = !enabled;
}

function populateFilterOptions() {
    populateSelectOptions("typeFilter", state.availableTypes, "All types", state.typeColumnIndex >= 0);
    populateSelectOptions("locationFilter", state.availableLocations, "All locations", state.locationColumnIndex >= 0);
    populateSelectOptions("tagFilter", state.availableTags, "All tags", state.tagColumnIndex >= 0);
    populateSelectOptions("ratingFilter", state.availableRatings, "All ratings", state.ratingColumnIndex >= 0);

    const dateFrom = document.getElementById("dateFromFilter");
    const dateTo = document.getElementById("dateToFilter");
    const nameFilter = document.getElementById("nameFilter");
    const locationFilter = document.getElementById("locationFilter");
    const tagFilter = document.getElementById("tagFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const typeFilter = document.getElementById("typeFilter");

    if (nameFilter) {
        nameFilter.value = state.nameFilter;
    }
    if (locationFilter) {
        locationFilter.value = state.locationFilter;
    }
    if (tagFilter) {
        tagFilter.value = state.tagFilter;
    }
    if (ratingFilter) {
        ratingFilter.value = state.ratingFilter;
    }
    if (typeFilter) {
        typeFilter.value = state.typeFilter;
    }
    if (dateFrom) {
        dateFrom.disabled = state.dateColumnIndex < 0;
        dateFrom.value = state.dateFrom;
    }
    if (dateTo) {
        dateTo.disabled = state.dateColumnIndex < 0;
        dateTo.value = state.dateTo;
    }
}

function renderSummary() {
    const summary = document.getElementById("sheetSummary");
    if (!summary) {
        return;
    }

    const totalRows = state.rows.length;
    const visibleRows = state.filteredRows.length;

    summary.textContent = totalRows === visibleRows
        ? `Loaded ${totalRows} comment${totalRows === 1 ? "" : "s"}.`
        : `${visibleRows} of ${totalRows} comment${totalRows === 1 ? "" : "s"} match your filters.`;
}

function getSortValue(row, columnIndex) {
    const header = normalizeCellValue(state.headers[columnIndex]).toLowerCase();
    const cellValue = row[columnIndex];

    if (header === "date") {
        const parsedDate = parseSheetDate(cellValue);
        return parsedDate === null ? null : parsedDate;
    }

    if (header === "rating") {
        return countRatingStars(cellValue);
    }

    return normalizeTextForSearch(cellValue);
}

function compareRows(leftRow, rightRow) {
    const columnIndex = state.sortColumnIndex;

    if (columnIndex < 0) {
        return (leftRow.__sourceIndex ?? 0) - (rightRow.__sourceIndex ?? 0);
    }

    const leftValue = getSortValue(leftRow, columnIndex);
    const rightValue = getSortValue(rightRow, columnIndex);

    let comparison = 0;

    if (leftValue === null && rightValue === null) {
        comparison = 0;
    } else if (leftValue === null) {
        comparison = 1;
    } else if (rightValue === null) {
        comparison = -1;
    } else if (typeof leftValue === "number" && typeof rightValue === "number") {
        comparison = leftValue - rightValue;
    } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: "base"
        });
    }

    if (comparison === 0) {
        comparison = (leftRow.__sourceIndex ?? 0) - (rightRow.__sourceIndex ?? 0);
    }

    return state.sortDirection === "desc" ? -comparison : comparison;
}

function getSortIndicator(columnIndex) {
    if (state.sortColumnIndex !== columnIndex) {
        return "";
    }

    return state.sortDirection === "asc" ? "▲" : "▼";
}

function setSort(columnIndex) {
    if (state.sortColumnIndex === columnIndex) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
        state.sortColumnIndex = columnIndex;
        state.sortDirection = "asc";
    }

    renderTable();
}

function updateEmptyState() {
    const empty = document.getElementById("sheetEmpty");
    if (!empty) {
        return;
    }

    if (state.loadFailed) {
        empty.hidden = true;
        return;
    }

    if (state.rows.length === 0) {
        empty.textContent = "The comment list has no data rows.";
        empty.hidden = false;
        return;
    }

    if (state.filteredRows.length === 0) {
        empty.textContent = (state.searchText.trim() || state.nameFilter || state.locationFilter || state.tagFilter || state.ratingFilter || state.typeFilter || state.dateFrom || state.dateTo)
            ? "No comments match your filters."
            : "The comment list has no visible rows.";
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
}

function renderTable() {
    const head = document.getElementById("sheetHead");
    const body = document.getElementById("sheetBody");

    if (!head || !body) {
        return;
    }

    head.innerHTML = "";
    body.innerHTML = "";

    const headerRow = document.createElement("tr");
    state.headers.forEach((header, columnIndex) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.setAttribute("aria-sort", state.sortColumnIndex === columnIndex ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "sheet-sort-button";
        button.setAttribute("aria-label", `Sort by ${header}`);
        const label = document.createElement("span");
        label.className = "sheet-sort-label";
        label.textContent = header;
        const indicator = document.createElement("span");
        indicator.className = "sheet-sort-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.textContent = getSortIndicator(columnIndex);
        button.append(label, indicator);
        button.addEventListener("click", () => setSort(columnIndex));

        cell.appendChild(button);
        headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);

    const rowsToRender = [...state.filteredRows].sort(compareRows);

    rowsToRender.forEach((row, rowIndex) => {
        const tableRow = document.createElement("tr");
        tableRow.dataset.rowIndex = String(rowIndex + 1);

        state.headers.forEach((_, columnIndex) => {
            const cell = document.createElement("td");
            cell.textContent = row[columnIndex] ?? "";
            tableRow.appendChild(cell);
        });

        body.appendChild(tableRow);
    });

    updateEmptyState();
    renderSummary();
}

function applySearch() {
    const query = normalizeTextForSearch(state.searchText);
    const nameQuery = normalizeTextForSearch(state.nameFilter);
    const selectedType = state.typeFilter.trim();
    const selectedLocation = state.locationFilter.trim();
    const selectedTag = state.tagFilter.trim();
    const selectedRating = state.ratingFilter.trim();
    const fromDate = state.dateFrom ? Date.parse(`${state.dateFrom}T00:00:00Z`) : null;
    const toDate = state.dateTo ? Date.parse(`${state.dateTo}T23:59:59Z`) : null;

    state.filteredRows = state.rows.filter((row) => {
        if (nameQuery && state.nameColumnIndex >= 0) {
            if (!normalizeTextForSearch(row[state.nameColumnIndex]).includes(nameQuery)) {
                return false;
            }
        }

        if (selectedLocation && state.locationColumnIndex >= 0) {
            if (normalizeCellValue(row[state.locationColumnIndex]) !== selectedLocation) {
                return false;
            }
        }

        if (selectedTag && state.tagColumnIndex >= 0) {
            const rowTags = splitMultiValueCell(row[state.tagColumnIndex]);
            if (!rowTags.includes(selectedTag)) {
                return false;
            }
        }

        if (selectedRating && state.ratingColumnIndex >= 0) {
            if (normalizeCellValue(row[state.ratingColumnIndex]) !== selectedRating) {
                return false;
            }
        }

        if (selectedType && state.typeColumnIndex >= 0) {
            if (normalizeCellValue(row[state.typeColumnIndex]) !== selectedType) {
                return false;
            }
        }

        if ((fromDate !== null || toDate !== null) && state.dateColumnIndex >= 0) {
            const rowDate = parseSheetDate(row[state.dateColumnIndex]);
            if (rowDate === null) {
                return false;
            }

            if (fromDate !== null && rowDate < fromDate) {
                return false;
            }

            if (toDate !== null && rowDate > toDate) {
                return false;
            }
        }

        if (!query) {
            return true;
        }

        return row.some((cell) => normalizeTextForSearch(cell).includes(query));
    });

    renderTable();
}

function setFilterControlsEnabled(enabled) {
    ["sheetSearch", "nameFilter", "locationFilter", "tagFilter", "ratingFilter", "typeFilter", "dateFromFilter", "dateToFilter"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = !enabled;
        }
    });
}

async function loadSheet() {
    setStatus("Loading restaurant comment list...");
    setFilterControlsEnabled(false);
    state.loadFailed = false;

    try {
        const response = await fetch(CSV_URL, { cache: "no-store" });
        const text = await response.text();

        if (!response.ok) {
            throw new Error(`Google Sheets returned ${response.status}.`);
        }

        const trimmed = text.trim();
        if (!trimmed) {
            throw new Error("The spreadsheet export is empty.");
        }

        if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed)) {
            throw new Error("The spreadsheet is not publicly readable as CSV.");
        }

        const parsedRows = parseCsv(text);

        if (parsedRows.length === 0) {
            throw new Error("No rows were found in the spreadsheet.");
        }

        const [rawHeaders, ...dataRows] = parsedRows;
        state.headers = normalizeHeaders(rawHeaders, dataRows);
        state.nameColumnIndex = getColumnIndex("Name");
        state.locationColumnIndex = getColumnIndex("Location");
        state.tagColumnIndex = getColumnIndex("Tag");
        state.ratingColumnIndex = getColumnIndex("Rating");
        state.typeColumnIndex = getColumnIndex("Type");
        state.dateColumnIndex = getColumnIndex("Date");
        state.rows = dataRows.map((row, rowIndex) => {
            const nextRow = [...row];
            while (nextRow.length < state.headers.length) {
                nextRow.push("");
            }
            nextRow.__sourceIndex = rowIndex;
            return nextRow;
        });

        state.availableLocations = state.locationColumnIndex >= 0
            ? [...new Set(state.rows.map((row) => normalizeCellValue(row[state.locationColumnIndex])).filter((value) => value))]
                .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
            : [];
        state.availableTags = state.tagColumnIndex >= 0
            ? [...new Set(state.rows.flatMap((row) => splitMultiValueCell(row[state.tagColumnIndex])))]
                .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
            : [];
        state.availableRatings = state.ratingColumnIndex >= 0
            ? [...new Set(state.rows.map((row) => normalizeCellValue(row[state.ratingColumnIndex])).filter((value) => value))]
                .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
            : [];
        if (state.typeColumnIndex >= 0) {
            state.availableTypes = [...new Set(
                state.rows
                    .map((row) => normalizeCellValue(row[state.typeColumnIndex]))
                    .filter((value) => value)
            )].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
        } else {
            state.availableTypes = [];
        }

        state.filteredRows = [...state.rows];

        populateFilterOptions();
        renderTable();
        setFilterControlsEnabled(true);
        setStatus(`Loaded ${state.rows.length} comment${state.rows.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
        state.headers = ["Error"];
        state.rows = [];
        state.filteredRows = [];
        state.sortColumnIndex = -1;
        state.sortDirection = "asc";
        state.nameColumnIndex = -1;
        state.locationColumnIndex = -1;
        state.tagColumnIndex = -1;
        state.ratingColumnIndex = -1;
        state.typeColumnIndex = -1;
        state.dateColumnIndex = -1;
        state.availableLocations = [];
        state.availableTags = [];
        state.availableRatings = [];
        state.availableTypes = [];
        state.loadFailed = true;
        populateFilterOptions();
        renderTable();
        setStatus(error?.message || "Could not load the restaurant comment list.", "error");
    }
}

function initFilterControls() {
    const search = document.getElementById("sheetSearch");
    const nameFilter = document.getElementById("nameFilter");
    const locationFilter = document.getElementById("locationFilter");
    const tagFilter = document.getElementById("tagFilter");
    const ratingFilter = document.getElementById("ratingFilter");
    const typeFilter = document.getElementById("typeFilter");
    const dateFromFilter = document.getElementById("dateFromFilter");
    const dateToFilter = document.getElementById("dateToFilter");

    nameFilter?.addEventListener("input", () => {
        state.nameFilter = nameFilter.value;
        applySearch();
    });

    locationFilter?.addEventListener("change", () => {
        state.locationFilter = locationFilter.value;
        applySearch();
    });

    tagFilter?.addEventListener("change", () => {
        state.tagFilter = tagFilter.value;
        applySearch();
    });

    ratingFilter?.addEventListener("change", () => {
        state.ratingFilter = ratingFilter.value;
        applySearch();
    });

    typeFilter?.addEventListener("change", () => {
        state.typeFilter = typeFilter.value;
        applySearch();
    });

    dateFromFilter?.addEventListener("change", () => {
        state.dateFrom = dateFromFilter.value;
        applySearch();
    });

    dateToFilter?.addEventListener("change", () => {
        state.dateTo = dateToFilter.value;
        applySearch();
    });

    search?.addEventListener("input", () => {
        state.searchText = search.value;
        applySearch();
    });
}

function initSheetViewer() {
    setSourceLinks();

    const reloadBtn = document.getElementById("reloadSheetBtn");

    initFilterControls();

    reloadBtn?.addEventListener("click", () => {
        state.sortColumnIndex = -1;
        state.sortDirection = "asc";
        loadSheet();
    });

    loadSheet();
}

document.addEventListener("DOMContentLoaded", initSheetViewer);