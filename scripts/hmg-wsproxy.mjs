import net from "node:net";
import { WebSocket, WebSocketServer } from "ws";

const listenHost = "127.0.0.1";
const listenPort = Number(process.env.RAPIDEX_HMG_WS_PROXY_PORT || 9876);
const postgresHost = process.env.RAPIDEX_HMG_POSTGRES_HOST || "127.0.0.1";
const postgresPort = Number(process.env.RAPIDEX_HMG_POSTGRES_PORT || 5432);

const server = new WebSocketServer({
  host: listenHost,
  port: listenPort,
  perMessageDeflate: false,
});

server.on("connection", (socket) => {
  const upstream = net.createConnection({ host: postgresHost, port: postgresPort });
  let connected = false;
  const pending = [];

  upstream.on("connect", () => {
    connected = true;
    for (const chunk of pending.splice(0)) upstream.write(chunk);
  });

  socket.on("message", (data) => {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (connected) upstream.write(chunk);
    else pending.push(chunk);
  });

  upstream.on("data", (chunk) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(chunk, { binary: true });
  });

  const closeUpstream = () => {
    if (!upstream.destroyed) upstream.destroy();
  };
  const closeSocket = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  socket.on("close", closeUpstream);
  socket.on("error", closeUpstream);
  upstream.on("close", closeSocket);
  upstream.on("error", (error) => {
    console.error(`[hmg-wsproxy] upstream error: ${error.message}`);
    closeSocket();
  });
});

server.on("listening", () => {
  console.log(`[hmg-wsproxy] ws://${listenHost}:${listenPort} -> ${postgresHost}:${postgresPort}`);
});

server.on("error", (error) => {
  console.error(`[hmg-wsproxy] server error: ${error.message}`);
  process.exitCode = 1;
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
