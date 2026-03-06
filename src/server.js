import http from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonlStorage } from "./storage.js";
import { ApmState } from "./state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const dataDir = path.join(rootDir, "data");

const port = Number(process.env.PORT || 9900);
const host = process.env.HOST || "127.0.0.1";
const expectedApiKey = process.env.APM_API_KEY || "";

const storage = new JsonlStorage(dataDir);
const state = new ApmState();
const sseClients = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(body);
}

function authorized(request) {
  if (!expectedApiKey) {
    return true;
  }
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const queryApiKey = url.searchParams.get("apiKey") || "";
  return request.headers["x-api-key"] === expectedApiKey || queryApiKey === expectedApiKey;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    request.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 10 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!buffer) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(buffer));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function serveStatic(request, response, pathname) {
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(targetPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      await serveStatic(request, response, path.join(targetPath, "index.html"));
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType
    });
    response.end(content);
  } catch {
    if (!path.extname(safePath)) {
      try {
        const content = await readFile(path.join(distDir, "index.html"));
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8"
        });
        response.end(content);
        return;
      } catch {
        sendText(response, 404, "Frontend build not found. Run `npm run build` first.");
        return;
      }
    }

    sendText(response, 404, "Not found");
  }
}

function broadcastSnapshot(snapshot) {
  const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function ensureArray(body, name) {
  if (!Array.isArray(body)) {
    throw new Error(`${name} payload must be an array`);
  }
  return body;
}

state.on("update", (snapshot) => {
  broadcastSnapshot(snapshot);
});

setInterval(() => {
  const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    client.write(heartbeat);
  }
}, 15_000).unref();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });
    response.end();
    return;
  }

  try {
    if (pathname === "/health") {
      sendJson(response, 200, { ok: true, timestamp: Date.now() });
      return;
    }

    if (!authorized(request) && pathname.startsWith("/api/v1/")) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    if (pathname === "/api/v1/stream" && request.method === "GET") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      response.write(`event: snapshot\ndata: ${JSON.stringify(state.snapshot())}\n\n`);
      sseClients.add(response);
      request.on("close", () => {
        sseClients.delete(response);
      });
      return;
    }

    if (pathname === "/api/v1/dashboard" && request.method === "GET") {
      sendJson(response, 200, state.snapshot());
      return;
    }

    if (pathname === "/api/v1/traces" && request.method === "GET") {
      sendJson(
        response,
        200,
        state.searchTraces({
          appName: url.searchParams.get("appName") || "",
          traceId: url.searchParams.get("traceId") || "",
          sql: url.searchParams.get("sql") || "",
          uri: url.searchParams.get("uri") || "",
          minDurationMs: url.searchParams.get("minDurationMs") || 0,
          limit: url.searchParams.get("limit") || 50
        })
      );
      return;
    }

    if (pathname.startsWith("/api/v1/traces/") && request.method === "GET") {
      const traceId = decodeURIComponent(pathname.slice("/api/v1/traces/".length));
      const appName = url.searchParams.get("appName") || "";
      const trace = state.traceDetail(appName, traceId);
      if (!trace) {
        sendJson(response, 404, { error: "Trace not found" });
        return;
      }
      sendJson(response, 200, trace);
      return;
    }

    if (pathname.startsWith("/api/v1/apps/") && pathname.includes("/traces/") && request.method === "GET") {
      const [encodedAppName, encodedTraceId] = pathname.slice("/api/v1/apps/".length).split("/traces/");
      const appName = decodeURIComponent(encodedAppName || "");
      const traceId = decodeURIComponent(encodedTraceId || "");
      const trace = state.traceDetail(appName, traceId);
      if (!trace) {
        sendJson(response, 404, { error: "Trace not found" });
        return;
      }
      sendJson(response, 200, trace);
      return;
    }

    if (pathname === "/api/v1/api-detail" && request.method === "GET") {
      const appName = url.searchParams.get("appName") || "";
      const uri = url.searchParams.get("uri") || "";
      const detail = state.apiDetail(appName, uri);
      if (!detail) {
        sendJson(response, 404, { error: "API detail not found" });
        return;
      }
      sendJson(response, 200, detail);
      return;
    }

    if (pathname === "/api/v1/apps" && request.method === "GET") {
      sendJson(
        response,
        200,
        state.snapshot().apps.map((app) => ({
          appName: app.appName,
          host: app.host,
          online: app.online,
          lastSeenAt: app.lastSeenAt
        }))
      );
      return;
    }

    if (pathname.startsWith("/api/v1/apps/") && request.method === "GET") {
      const appName = decodeURIComponent(pathname.slice("/api/v1/apps/".length));
      const snapshot = state.appSnapshot(appName);
      if (!snapshot) {
        sendJson(response, 404, { error: "App not found" });
        return;
      }
      sendJson(response, 200, snapshot);
      return;
    }

    if (pathname === "/api/v1/register" && request.method === "POST") {
      const body = await parseBody(request);
      if (!body || !body.appName) {
        sendJson(response, 400, { error: "appName is required" });
        return;
      }
      const receivedAt = Date.now();
      state.register(body, receivedAt);
      await storage.append("register", { receivedAt, data: body }, receivedAt);
      sendJson(response, 202, { ok: true });
      return;
    }

    if (pathname === "/api/v1/metrics" && request.method === "POST") {
      const receivedAt = Date.now();
      const body = ensureArray(await parseBody(request), "metrics");
      state.ingestMetrics(body, receivedAt);
      await storage.append("metrics", { receivedAt, count: body.length, data: body }, receivedAt);
      sendJson(response, 202, { ok: true, count: body.length });
      return;
    }

    if (pathname === "/api/v1/traces" && request.method === "POST") {
      const receivedAt = Date.now();
      const body = ensureArray(await parseBody(request), "traces");
      state.ingestTraces(body, receivedAt);
      await storage.append("traces", { receivedAt, count: body.length, data: body }, receivedAt);
      sendJson(response, 202, { ok: true, count: body.length });
      return;
    }

    await serveStatic(request, response, pathname);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Internal server error"
    });
  }
});

async function start() {
  await storage.init();
  server.listen(port, host, () => {
    console.log(`APM server listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exitCode = 1;
});
