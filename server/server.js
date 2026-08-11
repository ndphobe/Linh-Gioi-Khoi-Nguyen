import http from "node:http";
import path from "node:path";
import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import express from "express";
import { Server as SocketIOServer } from "socket.io";

import {
  GameWorld,
  MAX_PLAYERS_PER_ROOM,
  SIMULATION_HZ,
  sanitizeRoomCode,
} from "./world.js";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");

/*
 * Socket protocol (all timestamps are Unix milliseconds):
 *
 * Client -> server
 * ----------------
 * room:join
 *   { roomCode: string, name: string, faction: "orthodox"|"demonic"|"heretic",
 *     profile?: { hair?: string, outfit?: string, mark?: string, accentColor?: "#rrggbb" } }
 *   Ack: { ok: true, playerId, roomCode, snapshot, player } or { ok: false, error }.
 *
 * room:leave
 *   no payload. Ack: { ok: true }.
 *
 * player:move
 *   { position: { x: number, y: number, z: number }, yaw: number,
 *     flying?: boolean, sequence?: number }
 *   The server clamps distance by elapsed time, clamps world bounds, rejects
 *   flight before Kim Đan, and echoes the accepted sequence in snapshots.
 *
 * player:dash
 *   { direction?: { x: number, z: number } }
 *   The server applies distance, i-frames, and cooldown. Ack returns player.
 *
 * combat:block
 *   { active: boolean }
 *   A 300 ms server-timed parry window negates a hit; continued blocking
 *   reduces damage and spends a small amount of MP.
 *
 * combat:ability
 *   { ability: "basic"|"Q"|"E"|"R"|"F"|"G",
 *     aim?: { x: number, z: number }, targetId?: string }
 *   Damage, hit selection, MP cost, Qi gain, loot, and cooldowns are server-owned.
 *
 * cultivation:meditate
 *   { active: boolean }
 *   Meditation is allowed only in the Tông Môn safe zone and stops on movement,
 *   damage, dash, or ability use.
 *
 * breakthrough:start
 *   {} (payload optional)
 *   Requires a full EXP bar at the Nguyên Anh or Hóa Thần gate. The server
 *   runs ten telegraphed lightning waves in the dedicated dodge arena.
 *
 * breakthrough:move
 *   { direction: -1|0|1 }
 *   Server-authoritative horizontal A/D movement used only during tribulation.
 *
 * world:request
 *   no payload. Ack: { ok: true, snapshot, player }.
 *
 * Server -> client
 * ----------------
 * room:joined
 *   { playerId, roomCode, snapshot, player }.
 *
 * world:snapshot (20 Hz, volatile)
 *   { roomCode, serverTime, bounds, safeZone, breakthroughAltar,
 *     players: PublicPlayer[], enemies: Enemy[] }.
 *
 * player:state (20 Hz, volatile, private to the owning socket)
 *   PublicPlayer plus { inventory: { linhThach, linhThao, linhCot, hoTamDan } }.
 *
 * world:event (reliable)
 *   { type: string, serverTime, ...eventData }. Types include player:joined,
 *   player:left, ability:cast, enemy:telegraph, enemy:attack, enemy:damaged,
 *   enemy:defeated, loot:granted, meditation:started/stopped,
 *   breakthrough:started/telegraph/strike/success/failed, and respawn events.
 *
 * game:error
 *   { code: string, message: string }. The same shape is returned in failed acks.
 */

function roomChannel(code) {
  return `game:${code}`;
}

function publicError(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "SERVER_ERROR",
    message:
      typeof error?.message === "string" && error.message.length <= 180
        ? error.message
        : "Máy chủ không thể xử lý yêu cầu.",
  };
}

function makeNotInRoomError() {
  const error = new Error("Hãy vào một phòng trước khi điều khiển nhân vật.");
  error.code = "NOT_IN_ROOM";
  return error;
}

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function reportSocketError(socket, error, ack, logger) {
  const payload = publicError(error);
  if (payload.code === "SERVER_ERROR") logger.error?.(error);
  socket.emit("game:error", payload);
  safeAck(ack, { ok: false, error: payload });
}

function currentRoom(world, socket) {
  return world.roomForPlayer(socket.id) ?? null;
}

function registerSocketHandlers(io, world, logger) {
  io.on("connection", (socket) => {
    socket.data.roomCode = null;
    socket.data.lastMoveHandledAt = 0;
    socket.data.lastJoinHandledAt = 0;

    socket.on("room:join", async (payload = {}, ack) => {
      try {
        const now = Date.now();
        if (now - socket.data.lastJoinHandledAt < 350) {
          const error = new Error("Đang vào phòng, vui lòng chờ một chút.");
          error.code = "RATE_LIMITED";
          throw error;
        }
        socket.data.lastJoinHandledAt = now;

        const requestedCode = sanitizeRoomCode(payload?.roomCode);
        const previousCode = socket.data.roomCode;
        const { room } = world.joinRoom(
          socket.id,
          requestedCode,
          {
            name: payload?.name,
            faction: payload?.faction,
            profile: payload?.profile,
            session: payload?.session,
            resumeToken: payload?.resumeToken,
          },
          now,
        );

        if (previousCode && previousCode !== room.code) {
          await socket.leave(roomChannel(previousCode));
        }
        await socket.join(roomChannel(room.code));
        socket.data.roomCode = room.code;

        const response = {
          ok: true,
          playerId: socket.id,
          roomCode: room.code,
          snapshot: room.snapshotForPlayer(socket.id, now),
          player: room.privatePlayerSnapshot(socket.id, now),
        };
        socket.emit("room:joined", response);
        safeAck(ack, response);
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("room:leave", async (ack) => {
      try {
        const code = socket.data.roomCode;
        if (code) {
          world.leaveRoom(socket.id, code, Date.now());
          await socket.leave(roomChannel(code));
          socket.data.roomCode = null;
        }
        safeAck(ack, { ok: true });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("player:move", (payload = {}) => {
      try {
        const now = Date.now();
        // Ignore packet floods while accepting normal 60 Hz clients. Snapshot
        // reconciliation tells the client where the server accepted the player.
        if (now - socket.data.lastMoveHandledAt < 14) return;
        socket.data.lastMoveHandledAt = now;
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        room.updatePlayerMove(socket.id, payload, now);
      } catch (error) {
        socket.emit("game:error", publicError(error));
      }
    });

    socket.on("player:dash", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const player = room.dashPlayer(socket.id, payload, Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("player:fast-travel", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const player = room.fastTravel(socket.id, payload?.regionId, Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("combat:block", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const player = room.setBlocking(socket.id, payload?.active, Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    const abilityHandler = (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const result = room.castAbility(socket.id, payload, Date.now());
        safeAck(ack, { ok: true, ...result });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    };
    socket.on("combat:ability", abilityHandler);
    // Compatibility alias for very small clients/prototypes.
    socket.on("ability:cast", abilityHandler);

    socket.on("shop:action", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const now = Date.now(), action = String(payload?.action ?? ""), itemId = String(payload?.itemId ?? "");
        const result = action === "buy" ? room.buyItem(socket.id, itemId, now)
          : action === "sell" ? room.sellItem(socket.id, itemId, now)
          : action === "equip" ? room.equipItem(socket.id, itemId, now)
          : action === "unequip" ? room.unequipItem(socket.id, itemId, now)
          : action === "use" ? room.useItem(socket.id, itemId, now)
          : null;
        if (!result) { const error = new Error("Hành động vật phẩm không hợp lệ."); error.code = "INVALID_ITEM_ACTION"; throw error; }
        safeAck(ack, { ok: true, ...result });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("skill:action", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        safeAck(ack, { ok: true, ...room.updateSkill(socket.id, payload, Date.now()) });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("player:respawn", (_payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const player = room.requestRespawn(socket.id, Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("cultivation:meditate", (payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const active = typeof payload === "boolean" ? payload : payload?.active;
        const player = room.setMeditating(socket.id, Boolean(active), Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("breakthrough:start", (_payload = {}, ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const player = room.startBreakthrough(socket.id, Date.now());
        safeAck(ack, { ok: true, player });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("breakthrough:move", (payload = {}) => {
      try {
        const now = Date.now();
        if (now - socket.data.lastMoveHandledAt < 14) return;
        socket.data.lastMoveHandledAt = now;
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        room.updateBreakthroughMove(socket.id, payload, now);
      } catch (error) {
        socket.emit("game:error", publicError(error));
      }
    });

    socket.on("world:request", (ack) => {
      try {
        const room = currentRoom(world, socket);
        if (!room) throw makeNotInRoomError();
        const now = Date.now();
        safeAck(ack, {
          ok: true,
          snapshot: room.snapshotForPlayer(socket.id, now),
          player: room.privatePlayerSnapshot(socket.id, now),
        });
      } catch (error) {
        reportSocketError(socket, error, ack, logger);
      }
    });

    socket.on("disconnect", () => {
      const code = socket.data.roomCode;
      if (code) world.leaveRoom(socket.id, code, Date.now());
      socket.data.roomCode = null;
    });
  });
}

export async function createGameServer(options = {}) {
  const logger = options.logger ?? console;
  const production =
    options.production ??
    (process.env.NODE_ENV === "production" || process.argv.includes("--production"));
  const root = path.resolve(options.root ?? projectRoot);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    // The game changes frequently during development. Stale HTML/module
    // bundles in Chrome otherwise make new UI and mechanics appear missing.
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
    next();
  });

  const sessionFile = options.sessionFile === false ? null : path.resolve(options.sessionFile ?? path.join(root, ".data", "sessions.json"));
  let storedSessions = {};
  if (sessionFile && !options.world) {
    try { storedSessions = JSON.parse(await readFile(sessionFile, "utf8")); }
    catch (error) { if (error?.code !== "ENOENT") logger.warn?.("Không thể đọc session save:", error); }
  }
  let world = options.world;
  let sessionSaveTimer = null;
  let sessionSavePromise = Promise.resolve();
  let sessionPersistenceClosing = false;
  const persistSessions = () => {
    if (!sessionFile || options.world || sessionPersistenceClosing) return;
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      const snapshot = JSON.stringify(world.serializeSessions(), null, 2);
      sessionSavePromise = sessionSavePromise.then(async () => { await mkdir(path.dirname(sessionFile), { recursive: true }); await writeFile(sessionFile, snapshot, "utf8"); }).catch(error => logger.error?.("Không thể lưu session:", error));
    }, 150);
    sessionSaveTimer.unref?.();
  };
  world ??= new GameWorld({ maxPlayers: MAX_PLAYERS_PER_ROOM, sessions: storedSessions, onSessionChange: persistSessions });
  app.get("/api/health", (_request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.json({
      ok: true,
      uptimeSeconds: Math.floor(process.uptime()),
      simulationHz: SIMULATION_HZ,
      maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM,
      ...world.stats(),
    });
  });

  let vite = null;
  if (!production) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(root, "dist");
    app.use(express.static(dist, { index: false, maxAge: 0, etag: false, lastModified: false }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || !request.accepts("html")) return next();
      response.sendFile(path.join(dist, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  // Keep the error boundary after Vite/static middleware so malformed browser
  // requests cannot tear down the simulation process.
  app.use((error, _request, response, _next) => {
    logger.error?.(error);
    if (!response.headersSent) response.status(500).json({ ok: false, error: "SERVER_ERROR" });
  });

  const httpServer = http.createServer(app);
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : null;
  const socketOptions = {
    serveClient: true,
    maxHttpBufferSize: 32 * 1024,
    pingInterval: 12_000,
    pingTimeout: 18_000,
  };
  if (allowedOrigins) socketOptions.cors = { origin: allowedOrigins, credentials: true };
  const io = new SocketIOServer(httpServer, socketOptions);
  registerSocketHandlers(io, world, logger);

  const intervalMs = Math.round(1_000 / SIMULATION_HZ);
  const simulationTimer = setInterval(() => {
    const now = Date.now();
    try {
      world.tick(now);
      for (const room of world.rooms.values()) {
        const channel = roomChannel(room.code);
        // Gameplay events carry the authored impact frame. Deliver them before
        // the resulting snapshot so VFX/SFX lands before the HP reconciliation.
        for (const event of room.drainEvents()) io.to(channel).emit("world:event", event);
        for (const playerId of room.players.keys()) {
          io.to(playerId).volatile.emit("world:snapshot", room.snapshotForPlayer(playerId, now));
          io.to(playerId).volatile.emit("player:state", room.privatePlayerSnapshot(playerId, now));
        }
      }
      world.pruneEmptyRooms(now);
      if (now-(world.lastCheckpointAt??0)>=5_000){world.lastCheckpointAt=now;world.checkpointSessions(now);}
    } catch (error) {
      logger.error?.("Simulation tick failed", error);
    }
  }, intervalMs);
  simulationTimer.unref();

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    sessionPersistenceClosing = true;
    clearInterval(simulationTimer);
    clearTimeout(sessionSaveTimer);
    world.checkpointSessions(Date.now());
    if (sessionFile && !options.world) {
      await mkdir(path.dirname(sessionFile), { recursive: true });
      await writeFile(sessionFile, JSON.stringify(world.serializeSessions(), null, 2), "utf8");
      await sessionSavePromise;
    }
    await new Promise((resolve) => io.close(resolve));
    if (httpServer.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (vite) await vite.close();
  }

  return { app, httpServer, io, world, vite, close };
}

export async function startGameServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const host = String(options.host ?? process.env.HOST ?? "0.0.0.0");
  const gameServer = await createGameServer(options);
  await new Promise((resolve, reject) => {
    gameServer.httpServer.once("error", reject);
    gameServer.httpServer.listen(port, host, () => {
      gameServer.httpServer.off("error", reject);
      resolve();
    });
  });
  (options.logger ?? console).log(`Tu Tiên server: http://${host}:${port}`);
  return gameServer;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === currentFile.toLowerCase();

if (isMainModule) {
  const server = await startGameServer();
  const shutdown = async (signal) => {
    console.log(`${signal}: đang đóng máy chủ...`);
    try {
      await server.close();
      process.exitCode = 0;
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
