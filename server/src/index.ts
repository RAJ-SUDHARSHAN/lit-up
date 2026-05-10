/**
 * Server bootstrap. Exposes Colyseus over WebSockets and a tiny HTTP layer
 * for health checks and the Colyseus monitor.
 */

import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LiteratureRoom } from "./room.js";

const PORT = parseInt(process.env.PORT ?? "2567", 10);

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("literature", LiteratureRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[lit-up] Colyseus listening on ws://localhost:${PORT}`);
});
