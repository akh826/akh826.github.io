/**
 * Parse JasperReports JRXML and extract parameter definitions.
 */
(function (global) {
    function textContent(element, tagName) {
        const child = element.getElementsByTagName(tagName)[0];
        if (!child) return "";
        return (child.textContent ?? "").trim();
    }

    function getParameterScope(element) {
        let node = element.parentElement;
        while (node) {
            const tag = node.tagName?.toLowerCase() ?? "";
            if (tag === "jasperreport") return "report";
            if (tag === "subdataset") return "subDataset";
            if (tag === "dataset") return "dataset";
            if (tag === "chart" || tag === "crosstab") return tag;
            node = node.parentElement;
        }
        return "other";
    }

    function parseDefaultExpression(raw) {
        const trimmed = String(raw ?? "").trim();
        if (!trimmed) return "";

        const stringMatch = trimmed.match(/^"([^"]*)"$/) || trimmed.match(/^'([^']*)'$/);
        if (stringMatch) return stringMatch[1];

        if (/^new\s+java\.util\.Date\s*\(\s*\)/i.test(trimmed)) {
            return new Date().toISOString().slice(0, 10);
        }

        if (/^(true|false)$/i.test(trimmed)) {
            return trimmed.toLowerCase();
        }

        const numberMatch = trimmed.match(/^(?:\d+|Integer\.valueOf\(\s*(-?\d+)\s*\))$/);
        if (numberMatch) return numberMatch[1] ?? trimmed;

        return trimmed;
    }

    function mapJavaTypeToInput(javaClass) {
        const type = String(javaClass ?? "java.lang.String").trim();
        if (type.includes("Boolean")) return "boolean";
        if (type.includes("Integer") || type.includes("Long") || type.includes("Short")) return "integer";
        if (
            type.includes("BigDecimal") ||
            type.includes("Double") ||
            type.includes("Float") ||
            type.includes("Number")
        ) {
            return "number";
        }
        if (type.includes("Date") || type.includes("Timestamp")) return "date";
        if (type.includes("Collection") || type.includes("List") || type.includes("Map")) return "json";
        return "text";
    }

    function parseJrxml(xmlText) {
        const doc = new DOMParser().parseFromString(xmlText, "application/xml");
        const parseError = doc.querySelector("parsererror");
        if (parseError) {
            throw new Error(parseError.textContent?.trim() || "Invalid JRXML/XML.");
        }

        const reportRoot = doc.getElementsByTagName("jasperReport")[0];
        if (!reportRoot) {
            throw new Error("No <jasperReport> root element found. Is this a JRXML file?");
        }

        const reportName =
            reportRoot.getAttribute("name") ||
            reportRoot.getAttribute("uuid") ||
            "Unnamed report";

        const parameterNodes = reportRoot.getElementsByTagName("parameter");
        const seen = new Set();
        const parameters = [];

        for (const element of parameterNodes) {
            const name = element.getAttribute("name");
            if (!name || seen.has(name)) continue;

            const scope = getParameterScope(element);
            const javaClass = element.getAttribute("class") || "java.lang.String";
            const isForPrompting = element.getAttribute("isForPrompting");
            const forPrompting = isForPrompting !== "false";

            seen.add(name);
            parameters.push({
                name,
                javaClass,
                inputType: mapJavaTypeToInput(javaClass),
                scope,
                forPrompting,
                description: textContent(element, "parameterDescription"),
                defaultValue: parseDefaultExpression(textContent(element, "defaultValueExpression")),
                nestedType: element.getAttribute("nestedType") || ""
            });
        }

        parameters.sort((a, b) => {
            if (a.scope === b.scope) return a.name.localeCompare(b.name);
            const order = { report: 0, dataset: 1, subDataset: 2 };
            return (order[a.scope] ?? 9) - (order[b.scope] ?? 9);
        });

        return {
            reportName,
            parameters,
            parameterCount: parameters.length
        };
    }

    function coerceParameterValues(parameters, formData) {
        const values = {};
        for (const param of parameters) {
            const raw = formData[param.name];
            if (raw === undefined || raw === null || raw === "") continue;

            if (param.inputType === "boolean") {
                values[param.name] = raw === true || raw === "true" || raw === "on";
                continue;
            }

            values[param.name] = String(raw).trim();
        }
        return values;
    }

    global.JrxmlParser = {
        parseJrxml,
        coerceParameterValues,
        mapJavaTypeToInput
    };
})(typeof window !== "undefined" ? window : globalThis);
