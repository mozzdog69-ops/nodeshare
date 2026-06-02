/**
 * Minimal Akash provider WebSocket proxy (browser → provider shell/logs).
 * Run: node scripts/akash-provider-proxy.mjs
 * Set NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS=ws://localhost:3040 on NodeShare.
 */
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(
  process.env.PORT || process.env.AKASH_PROVIDER_PROXY_PORT || 3040,
);
const ALLOWED_ORIGINS = (
  process.env.AKASH_PROVIDER_PROXY_ORIGINS ||
  "http://localhost:3000,https://nodesharev1.netlify.app"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsOk(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some((o) => origin === o || o === "*");
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "";
  if (corsOk(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Akash provider proxy (WebSocket upgrade only)\n");
});

const wss = new WebSocketServer({ noServer: true });
const upstream = new Map();

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin || "";
  if (!corsOk(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (clientWs) => {
  let providerWs = null;
  let providerUrl = "";

  clientWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      clientWs.send(JSON.stringify({ type: "websocket", error: "Invalid JSON" }));
      return;
    }

    if (msg.type === "ping") {
      clientWs.send(JSON.stringify({ type: "pong" }));
      return;
    }

    if (msg.type !== "websocket" || !msg.url) return;

    const targetUrl = String(msg.url).replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
    const headers = msg.auth?.token ? { Authorization: `Bearer ${msg.auth.token}` } : {};

    if (!providerWs || providerUrl !== targetUrl || providerWs.readyState > WebSocket.OPEN) {
      providerWs?.terminate();
      providerUrl = targetUrl;
      providerWs = new WebSocket(targetUrl, {
        headers,
        rejectUnauthorized: false,
      });

      providerWs.on("open", () => {
        if (msg.data) {
          const buf = msg.isBase64
            ? Buffer.from(msg.data, "base64")
            : Buffer.from(String(msg.data).split(",").map(Number));
          providerWs.send(buf);
        }
      });

      providerWs.on("message", (data, isBinary) => {
        const arr = isBinary ? [...data] : [...Buffer.from(String(data))];
        clientWs.send(JSON.stringify({ type: "websocket", message: { data: arr } }));
      });

      providerWs.on("close", () => {
        clientWs.send(JSON.stringify({ type: "websocket", closed: true }));
      });

      providerWs.on("error", (err) => {
        clientWs.send(
          JSON.stringify({
            type: "websocket",
            error: err instanceof Error ? err.message : "Provider socket error",
          }),
        );
      });

      upstream.set(clientWs, providerWs);
      return;
    }

    if (msg.data && providerWs?.readyState === WebSocket.OPEN) {
      const buf = msg.isBase64
        ? Buffer.from(msg.data, "base64")
        : Buffer.from(String(msg.data).split(",").map(Number));
      providerWs.send(buf);
    }
  });

  clientWs.on("close", () => {
    upstream.get(clientWs)?.terminate();
    upstream.delete(clientWs);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Akash provider proxy listening on 0.0.0.0:${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});
