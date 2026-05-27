#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const API_ROOT = path.join(__dirname, "..", "api-tester", "api");

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  return "application/octet-stream";
}

function toJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    ...extraHeaders
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const statusParam = requestUrl.searchParams.get("__mockStatus");
  const mockedStatus = statusParam ? Number.parseInt(statusParam, 10) : null;
  const status = Number.isInteger(mockedStatus) ? mockedStatus : 200;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
    });
    res.end();
    return;
  }

  if (!requestUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Use /api/... routes. Example: /api/health.json",
        status: 404
      }
    });
    return;
  }

  const relativePath = decodeURIComponent(requestUrl.pathname.slice("/api/".length));
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(API_ROOT, normalizedPath);

  if (["GET", "HEAD"].includes(req.method)) {
    fs.readFile(filePath, (error, content) => {
      if (error) {
        sendJson(res, 404, {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Route not found: ${requestUrl.pathname}`,
            status: 404
          }
        });
        return;
      }

      res.writeHead(status, {
        "Content-Type": getContentType(filePath),
        "Access-Control-Allow-Origin": "*",
        "X-Mock-Status": String(status)
      });
      res.end(req.method === "HEAD" ? "" : content);
    });
    return;
  }

  try {
    const rawBody = await readBody(req);
    sendJson(
      res,
      status,
      {
        success: status >= 200 && status < 300,
        data: {
          method: req.method,
          path: requestUrl.pathname,
          query: Object.fromEntries(requestUrl.searchParams.entries()),
          received: rawBody ? toJsonSafe(rawBody) : null
        }
      },
      { "X-Mock-Status": String(status) }
    );
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: {
        code: "READ_BODY_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        status: 500
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`[mock-server] Running on http://localhost:${PORT}`);
  console.log(`[mock-server] Static API root: ${API_ROOT}`);
  console.log("[mock-server] Try: http://localhost:8787/api/errors/not-found.json?__mockStatus=404");
});
