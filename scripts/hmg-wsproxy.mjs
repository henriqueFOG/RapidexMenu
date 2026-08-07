import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";

const listenHost = "127.0.0.1";
const listenPort = Number(process.env.RAPIDEX_HMG_WS_PROXY_PORT || 9876);
const postgresHost = process.env.RAPIDEX_HMG_POSTGRES_HOST || "127.0.0.1";
const postgresPort = Number(process.env.RAPIDEX_HMG_POSTGRES_PORT || 5432);
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const server = http.createServer((_request, response) => {
  response.writeHead(426, { connection: "close", "content-type": "text/plain" });
  response.end("WebSocket upgrade required");
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];
  if (!key || request.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash("sha1").update(`${key}${websocketGuid}`).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n",
  );

  const upstream = net.createConnection({ host: postgresHost, port: postgresPort });
  let upstreamReady = false;
  const pending = [];
  let wsBuffer = Buffer.alloc(0);
  let fragmentedOpcode = null;
  let fragments = [];

  upstream.on("connect", () => {
    upstreamReady = true;
    for (const payload of pending.splice(0)) upstream.write(payload);
  });

  upstream.on("data", (chunk) => {
    if (!socket.destroyed) socket.write(encodeFrame(0x2, chunk));
  });

  socket.on("data", (chunk) => {
    wsBuffer = Buffer.concat([wsBuffer, chunk]);
    while (true) {
      const decoded = decodeFrame(wsBuffer);
      if (!decoded) break;
      wsBuffer = wsBuffer.subarray(decoded.bytesConsumed);
      const { fin, opcode, payload } = decoded;

      if (opcode === 0x8) {
        if (!socket.destroyed) socket.end(encodeFrame(0x8, payload));
        if (!upstream.destroyed) upstream.destroy();
        return;
      }
      if (opcode === 0x9) {
        if (!socket.destroyed) socket.write(encodeFrame(0xa, payload));
        continue;
      }
      if (opcode === 0xa) continue;

      if (opcode === 0x0) {
        if (fragmentedOpcode === null) continue;
        fragments.push(payload);
        if (fin) {
          const complete = Buffer.concat(fragments);
          fragmentedOpcode = null;
          fragments = [];
          forward(complete);
        }
        continue;
      }

      if (opcode !== 0x1 && opcode !== 0x2) continue;
      if (!fin) {
        fragmentedOpcode = opcode;
        fragments = [payload];
        continue;
      }
      forward(payload);
    }
  });

  socket.on("error", () => {
    if (!upstream.destroyed) upstream.destroy();
  });
  socket.on("close", () => {
    if (!upstream.destroyed) upstream.destroy();
  });
  upstream.on("close", () => {
    if (!socket.destroyed) socket.end();
  });
  upstream.on("error", (error) => {
    console.error(`[hmg-wsproxy] upstream error: ${error.message}`);
    if (!socket.destroyed) socket.destroy();
  });

  function forward(payload) {
    if (upstreamReady) upstream.write(payload);
    else pending.push(payload);
  }
});

server.listen(listenPort, listenHost, () => {
  console.log(`[hmg-wsproxy] ws://${listenHost}:${listenPort} -> ${postgresHost}:${postgresPort}`);
});

server.on("error", (error) => {
  console.error(`[hmg-wsproxy] server error: ${error.message}`);
  process.exitCode = 1;
});

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  const fin = Boolean(first & 0x80);
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    const bigLength = buffer.readBigUInt64BE(2);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("WebSocket frame too large");
    length = Number(bigLength);
    offset = 10;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) return null;

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return { fin, opcode, payload, bytesConsumed: offset + length };
}

function encodeFrame(opcode, payloadInput) {
  const payload = Buffer.isBuffer(payloadInput) ? payloadInput : Buffer.from(payloadInput || []);
  let header;
  if (payload.length < 126) {
    header = Buffer.allocUnsafe(2);
    header[1] = payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
