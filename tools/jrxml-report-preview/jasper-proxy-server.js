#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const PORT = Number.parseInt(process.env.PORT || "8790", 10);
const MAX_BODY = 8 * 1024 * 1024;
const RUNNER_JAR =
    process.env.JRXML_RUNNER_JAR ||
    path.join(__dirname, "java", "target", "jrxml-local-runner.jar");
const JAVA_BIN = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
    : "java";

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                reject(new Error("Request body too large."));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(body);
}

function fetchBuffer(url, options = {}) {
    const lib = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
        const request = lib.request(
            url,
            {
                method: options.method || "GET",
                headers: options.headers || {}
            },
            (response) => {
                const chunks = [];
                response.on("data", (chunk) => chunks.push(chunk));
                response.on("end", () => {
                    resolve({
                        status: response.statusCode || 0,
                        headers: response.headers,
                        body: Buffer.concat(chunks)
                    });
                });
            }
        );
        request.on("error", reject);
        request.end();
    });
}

function buildJasperPdfUrl(baseUrl, reportUri, params) {
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const normalizedUri = String(reportUri || "")
        .replace(/^\/+/, "")
        .replace(/\.pdf$/i, "");

    const endpoint = new URL(`${normalizedBase}/rest_v2/reports/${normalizedUri}.pdf`);

    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === "") continue;
        endpoint.searchParams.set(key, String(value));
    }

    return endpoint;
}

function buildAuthHeader(username, password) {
    if (!username) return {};
    const token = Buffer.from(`${username}:${password ?? ""}`, "utf8").toString("base64");
    return { Authorization: `Basic ${token}` };
}

function runnerJarAvailable() {
    try {
        return fs.existsSync(RUNNER_JAR);
    } catch {
        return false;
    }
}

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "jrxml-preview-"));
}

function removeDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // ignore cleanup errors
    }
}

async function runLocalCompile({ jrxml, params, jdbc }) {
    if (!runnerJarAvailable()) {
        throw new Error(
            `Local runner JAR not found at ${RUNNER_JAR}. Build it once: cd tools/jrxml-report-preview/java && mvn package`
        );
    }

    const workDir = makeTempDir();
    const jrxmlPath = path.join(workDir, "report.jrxml");
    const paramsPath = path.join(workDir, "params.json");
    const outputPath = path.join(workDir, "output.pdf");

    try {
        fs.writeFileSync(jrxmlPath, jrxml, "utf8");
        fs.writeFileSync(paramsPath, JSON.stringify(params || {}, null, 2), "utf8");

        const args = [
            "-jar",
            RUNNER_JAR,
            "--jrxml",
            jrxmlPath,
            "--params",
            paramsPath,
            "--output",
            outputPath
        ];

        if (jdbc?.url) {
            args.push("--jdbc-url", jdbc.url);
            if (jdbc.user) args.push("--jdbc-user", jdbc.user);
            if (jdbc.password) args.push("--jdbc-password", jdbc.password);
            if (jdbc.driver) args.push("--jdbc-driver", jdbc.driver);
        }

        await execFileAsync(JAVA_BIN, args, {
            maxBuffer: 4 * 1024 * 1024,
            timeout: 120000
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error("Java runner finished but PDF was not created.");
        }

        return fs.readFileSync(outputPath);
    } finally {
        removeDir(workDir);
    }
}

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
        sendJson(res, 200, {
            ok: true,
            service: "jasper-preview-proxy",
            port: PORT,
            localRunner: {
                available: runnerJarAvailable(),
                jar: RUNNER_JAR,
                java: JAVA_BIN
            }
        });
        return;
    }

    if (req.method === "POST" && req.url === "/api/local/preview") {
        try {
            const raw = await readBody(req);
            const payload = JSON.parse(raw);
            const { jrxml, params, jdbc } = payload;

            if (!jrxml || typeof jrxml !== "string") {
                sendJson(res, 400, { success: false, error: "jrxml XML string is required." });
                return;
            }

            const pdfBuffer = await runLocalCompile({ jrxml, params, jdbc });

            res.writeHead(200, {
                "Content-Type": "application/pdf",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": 'inline; filename="local-report-preview.pdf"'
            });
            res.end(pdfBuffer);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Local compile failed.";
            const stderr = error && error.stderr ? String(error.stderr).slice(0, 2000) : "";
            sendJson(res, 500, {
                success: false,
                error: message,
                details: stderr
            });
        }
        return;
    }

    if (req.method === "POST" && req.url === "/api/jasper/preview") {
        try {
            const raw = await readBody(req);
            const payload = JSON.parse(raw);
            const { baseUrl, reportUri, username, password, params } = payload;

            if (!baseUrl || !reportUri) {
                sendJson(res, 400, {
                    success: false,
                    error: "baseUrl and reportUri are required."
                });
                return;
            }

            const target = buildJasperPdfUrl(baseUrl, reportUri, params);
            const upstream = await fetchBuffer(target, {
                headers: {
                    Accept: "application/pdf",
                    ...buildAuthHeader(username, password)
                }
            });

            if (upstream.status < 200 || upstream.status >= 300) {
                sendJson(res, upstream.status || 502, {
                    success: false,
                    error: `Jasper server returned HTTP ${upstream.status}`,
                    requestUrl: target.toString(),
                    bodyPreview: upstream.body.toString("utf8", 0, 800)
                });
                return;
            }

            res.writeHead(200, {
                "Content-Type": "application/pdf",
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": 'inline; filename="report-preview.pdf"'
            });
            res.end(upstream.body);
        } catch (error) {
            sendJson(res, 500, {
                success: false,
                error: error instanceof Error ? error.message : "Preview proxy failed."
            });
        }
        return;
    }

    sendJson(res, 404, { success: false, error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`[jasper-preview] http://localhost:${PORT}`);
    console.log("[jasper-preview] POST /api/local/preview  (compile JRXML locally via Java)");
    console.log("[jasper-preview] POST /api/jasper/preview (proxy JasperReports Server)");
    console.log(`[jasper-preview] Runner JAR: ${RUNNER_JAR} (${runnerJarAvailable() ? "found" : "missing"})`);
    if (!runnerJarAvailable()) {
        console.log("[jasper-preview] Build runner: mvn -q package  (in tools/jrxml-report-preview/java)");
    }
});
