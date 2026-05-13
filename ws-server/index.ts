import { WebSocketServer, type WebSocket, type RawData } from "ws";
import http from "node:http";

type ClientMessage =
  | { type: "subscribe"; jobId: string }
  | { type: "ping" };

const rooms = new Map<string, Set<WebSocket>>();

function safeParse(raw: RawData): ClientMessage | null {
  try {
    const msg = JSON.parse(raw.toString()) as ClientMessage;
    return msg;
  } catch {
    return null;
  }
}

function joinRoom(ws: WebSocket, jobId: string) {
  const key = jobId.trim();
  if (!key) return;
  let set = rooms.get(key);
  if (!set) {
    set = new Set();
    rooms.set(key, set);
  }
  set.add(ws);
  (ws as WebSocket & { __room?: string }).__room = key;
}

function leaveRoom(ws: WebSocket) {
  const key = (ws as WebSocket & { __room?: string }).__room;
  if (!key) return;
  const set = rooms.get(key);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(key);
}

function broadcast(jobId: string, payload: unknown) {
  const set = rooms.get(jobId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

export function createWsHttpServer(port: number, internalSecret: string) {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/internal/emit") {
      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
      if (token !== internalSecret) {
        res.writeHead(401).end("unauthorized");
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const evt = JSON.parse(body) as { type?: string; jobId?: string };
          if (!evt?.type || !evt?.jobId) {
            res.writeHead(400).end("bad event");
            return;
          }
          broadcast(evt.jobId, evt);
          res.writeHead(204).end();
        } catch {
          res.writeHead(400).end("invalid json");
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const msg = safeParse(raw);
      if (!msg) return;
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (msg.type === "subscribe") {
        leaveRoom(ws);
        joinRoom(ws, msg.jobId);
        ws.send(JSON.stringify({ type: "subscribed", jobId: msg.jobId }));
      }
    });

    ws.on("close", () => leaveRoom(ws));
  });

  server.listen(port, () => {
    process.stdout.write(`[ws-server] listening on :${port}\n`);
  });

  return { server, wss };
}

const port = Number(process.env.WS_PORT ?? 3001);
const secret = process.env.JOB_INTERNAL_SECRET ?? "dev-insecure-change-me";

createWsHttpServer(port, secret);
