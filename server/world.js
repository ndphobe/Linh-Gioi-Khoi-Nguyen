/**
 * Authoritative, renderer-agnostic simulation for the online vertical slice.
 *
 * The browser is allowed to request movement and actions, but never supplies
 * damage, health, mana, qi, loot, cooldowns, realm changes, or enemy state.
 * Keeping this module free of Socket.IO also makes the rules deterministic and
 * cheap to test.
 */

export const MAX_PLAYERS_PER_ROOM = 8;
export const SIMULATION_HZ = 20;
export const EMPTY_ROOM_TTL_MS = 60_000;

export const WORLD_BOUNDS = Object.freeze({
  minX: -48,
  maxX: 48,
  minY: 0,
  maxY: 22,
  minZ: -48,
  maxZ: 48,
});

export const SAFE_ZONE = Object.freeze({
  minX: -15,
  maxX: 15,
  minZ: 14,
  maxZ: 45,
});

export const BREAKTHROUGH_ALTAR = Object.freeze({ x: 0, y: 0, z: 23, radius: 8 });

const PLAYER_SPAWNS = Object.freeze([
  Object.freeze({ x: -4, y: 0, z: 27 }),
  Object.freeze({ x: 0, y: 0, z: 29 }),
  Object.freeze({ x: 4, y: 0, z: 27 }),
  Object.freeze({ x: -7, y: 0, z: 24 }),
  Object.freeze({ x: 7, y: 0, z: 24 }),
  Object.freeze({ x: -7, y: 0, z: 30 }),
  Object.freeze({ x: 7, y: 0, z: 30 }),
  Object.freeze({ x: 0, y: 0, z: 33 }),
]);

const FACTION_ALIASES = new Map([
  ["chinh", "orthodox"],
  ["chinh-dao", "orthodox"],
  ["orthodox", "orthodox"],
  ["ma", "demonic"],
  ["ma-dao", "demonic"],
  ["demonic", "demonic"],
  ["ta", "heretic"],
  ["ta-dao", "heretic"],
  ["heretic", "heretic"],
  ["heretical", "heretic"],
]);

export const ABILITIES = Object.freeze({
  basic: Object.freeze({
    key: "basic",
    label: "Kiếm Khí",
    cooldownMs: 420,
    mpCost: 0,
    damage: 18,
    range: 4.8,
    radius: 0,
    targetMode: "single",
  }),
  Q: Object.freeze({
    key: "Q",
    label: "Định Thân Phù",
    cooldownMs: 5_000,
    mpCost: 18,
    damage: 22,
    range: 14,
    radius: 0,
    targetMode: "single",
    slowMs: 2_500,
  }),
  E: Object.freeze({
    key: "E",
    label: "Vạn Kiếm Quy Tông",
    cooldownMs: 8_000,
    mpCost: 32,
    damage: 44,
    range: 9,
    radius: 4.3,
    targetMode: "area",
  }),
  R: Object.freeze({
    key: "R",
    label: "Trảm Tiên Trảm Địa",
    cooldownMs: 12_000,
    mpCost: 42,
    damage: 78,
    range: 11,
    radius: 0,
    targetMode: "single",
  }),
  F: Object.freeze({
    key: "F",
    label: "Khiên Linh Lực",
    cooldownMs: 14_000,
    mpCost: 28,
    heal: 24,
    shield: 32,
    shieldMs: 5_000,
    targetMode: "self",
  }),
  G: Object.freeze({
    key: "G",
    label: "Thiên Kiếm Hóa Hình",
    cooldownMs: 45_000,
    mpCost: 100,
    damage: 120,
    range: 13,
    radius: 13,
    targetMode: "around-self",
  }),
});

// Central balance knobs. Keep server authoritative and mirror presentation
// values in src/game/data.js. Multipliers are applied to the old baseline.
export const MONSTER_BALANCE = Object.freeze({
  hpMultiplier: 0.60,
  attackMultiplier: 0.65,
  movementMultiplier: 0.78,
  detectionMultiplier: 0.72,
  hitStunMs: 480,
});

const balanced = (value, multiplier) => Math.round(value * multiplier * 100) / 100;

export const ENEMY_TEMPLATES = Object.freeze({
  spirit_fox: Object.freeze({
    label: "Linh Hồ Con",
    maxHp: 38,
    speed: 2.35,
    damage: 4,
    attackRange: 1.35,
    aggroRange: 9,
    attackCooldownMs: 1_650,
    respawnMs: 5_000,
    reward: Object.freeze({ linhThach: 1, qi: 3, gold: 12 }),
    trashMob: true,
  }),
  flame_imp: Object.freeze({
    label: "Tiểu Hỏa Ma",
    maxHp: 45,
    speed: 2.1,
    damage: 5,
    attackRange: 1.5,
    aggroRange: 10,
    attackCooldownMs: 1_750,
    respawnMs: 5_500,
    reward: Object.freeze({ linhThach: 2, qi: 4, gold: 15 }),
    trashMob: true,
  }),
  spirit_wolf: Object.freeze({
    label: "Thanh Phong Yêu Lang",
    maxHp: balanced(72, MONSTER_BALANCE.hpMultiplier),
    speed: balanced(3.4, MONSTER_BALANCE.movementMultiplier),
    damage: balanced(8, MONSTER_BALANCE.attackMultiplier),
    attackRange: 1.7,
    aggroRange: balanced(19, MONSTER_BALANCE.detectionMultiplier),
    attackCooldownMs: 1_250,
    respawnMs: 7_000,
    reward: Object.freeze({ linhThach: 4, qi: 7, gold: 20 }),
  }),
  rogue_cultivator: Object.freeze({
    label: "Hắc Vụ Ma Tu",
    maxHp: balanced(94, MONSTER_BALANCE.hpMultiplier),
    speed: balanced(2.35, MONSTER_BALANCE.movementMultiplier),
    damage: balanced(10, MONSTER_BALANCE.attackMultiplier),
    attackRange: 8.5,
    aggroRange: balanced(22, MONSTER_BALANCE.detectionMultiplier),
    attackCooldownMs: 1_850,
    respawnMs: 9_000,
    reward: Object.freeze({ linhThach: 3, linhThao: 1, qi: 9, gold: 28 }),
  }),
  fallen_guardian: Object.freeze({
    label: "Lôi Linh Hộ Pháp",
    maxHp: balanced(620, MONSTER_BALANCE.hpMultiplier),
    speed: balanced(2.15, MONSTER_BALANCE.movementMultiplier),
    damage: balanced(20, MONSTER_BALANCE.attackMultiplier),
    attackRange: 3.2,
    aggroRange: balanced(34, MONSTER_BALANCE.detectionMultiplier),
    attackCooldownMs: 2_200,
    respawnMs: 30_000,
    reward: Object.freeze({ linhThach: 25, linhCot: 1, hoTamDan: 1, qi: 42, gold: 180 }),
    isBoss: true,
  }),
});

const ENEMY_SPAWNS = Object.freeze([
  Object.freeze({ id: "fox-1", type: "spirit_fox", x: -6, y: 0, z: 10 }),
  Object.freeze({ id: "fox-2", type: "spirit_fox", x: 7, y: 0, z: 8 }),
  Object.freeze({ id: "imp-1", type: "flame_imp", x: 2, y: 0, z: 3 }),
  Object.freeze({ id: "imp-2", type: "flame_imp", x: -8, y: 0, z: -2 }),
  Object.freeze({ id: "wolf-1", type: "spirit_wolf", x: -11, y: 0, z: 4 }),
  Object.freeze({ id: "wolf-2", type: "spirit_wolf", x: 10, y: 0, z: 1 }),
  Object.freeze({ id: "wolf-3", type: "spirit_wolf", x: -3, y: 0, z: -6 }),
  Object.freeze({ id: "cultivator-1", type: "rogue_cultivator", x: -14, y: 0, z: -13 }),
  Object.freeze({ id: "cultivator-2", type: "rogue_cultivator", x: 14, y: 0, z: -15 }),
  Object.freeze({ id: "boss-1", type: "fallen_guardian", x: 0, y: 0, z: -31 }),
]);

const STARTING_REALM = Object.freeze({
  id: "foundation",
  name: "Trúc Cơ hậu kỳ",
  order: 2,
});

const GOLDEN_CORE_REALM = Object.freeze({
  id: "golden_core",
  name: "Kim Đan sơ kỳ",
  order: 3,
});

const FAST_TRAVEL_REGIONS = Object.freeze({
  sect_hall: Object.freeze({ requiredOrder: 1, portal: { x: 0, y: 0, z: 26 }, townGate: { x: 0, y: 0, z: 26 } }),
  luoyang: Object.freeze({ requiredOrder: 2, portal: { x: 28, y: 0, z: -8 }, townGate: { x: 25, y: 0, z: -5 } }),
  spirit_mine: Object.freeze({ requiredOrder: 2, portal: { x: 18, y: 0, z: 34 }, townGate: { x: 16, y: 0, z: 31 } }),
  heaven_sect: Object.freeze({ requiredOrder: 3, portal: { x: -30, y: 0, z: -18 }, townGate: { x: -27, y: 0, z: -16 } }),
});

function gameError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function copyPosition(position) {
  return { x: position.x, y: position.y, z: position.z };
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normalizeYaw(yaw) {
  const twoPi = Math.PI * 2;
  let normalized = finiteNumber(yaw, 0) % twoPi;
  if (normalized > Math.PI) normalized -= twoPi;
  if (normalized < -Math.PI) normalized += twoPi;
  return normalized;
}

function normalizeHorizontalDirection(value, fallbackYaw = 0) {
  const rawX = isObject(value) ? finiteNumber(value.x, 0) : 0;
  const rawZ = isObject(value) ? finiteNumber(value.z, 0) : 0;
  const length = Math.hypot(rawX, rawZ);
  if (length > 0.001) {
    return { x: rawX / length, z: rawZ / length };
  }
  return { x: Math.sin(fallbackYaw), z: Math.cos(fallbackYaw) };
}

function pointFromAim(origin, aim, distance) {
  return {
    x: origin.x + aim.x * distance,
    y: origin.y,
    z: origin.z + aim.z * distance,
  };
}

function moveTowards(position, destination, maximumDistance) {
  const dx = destination.x - position.x;
  const dy = destination.y - position.y;
  const dz = destination.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= maximumDistance || distance < 0.0001) return copyPosition(destination);
  const scale = maximumDistance / distance;
  return {
    x: position.x + dx * scale,
    y: position.y + dy * scale,
    z: position.z + dz * scale,
  };
}

function clampPosition(position, canFly = false) {
  return {
    x: clamp(finiteNumber(position?.x), WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: canFly
      ? clamp(finiteNumber(position?.y), WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY)
      : WORLD_BOUNDS.minY,
    z: clamp(finiteNumber(position?.z), WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
  };
}

export function sanitizeRoomCode(value) {
  const roomCode = String(value ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  if (roomCode.length < 3) {
    throw gameError("INVALID_ROOM", "Mã phòng phải có từ 3 đến 12 ký tự A-Z, 0-9 hoặc dấu gạch ngang.");
  }
  return roomCode;
}

export function sanitizeName(value) {
  const name = String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  return name || "Vô Danh";
}

export function sanitizeFaction(value) {
  const key = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, "-")
    .slice(0, 24);
  return FACTION_ALIASES.get(key) ?? "orthodox";
}

export function sanitizeProfile(value) {
  const profile = isObject(value) ? value : {};
  const safeChoice = (candidate, fallback, maxLength = 24) =>
    String(candidate ?? fallback)
      .normalize("NFKC")
      .replace(/<[^>]*>/g, " ")
      .replace(/[^\p{L}\p{N} _#-]/gu, "")
      .trim()
      .slice(0, maxLength) || fallback;

  const rawColor = String(profile.accentColor ?? "#69e6ff").trim();
  const accentColor = /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : "#69e6ff";

  return Object.freeze({
    hair: safeChoice(profile.hair, "tóc dài", 20),
    outfit: safeChoice(profile.outfit, "đạo y", 24),
    mark: safeChoice(profile.mark, "không", 20),
    accentColor,
  });
}

export function isInSafeZone(position) {
  return (
    position.x >= SAFE_ZONE.minX &&
    position.x <= SAFE_ZONE.maxX &&
    position.z >= SAFE_ZONE.minZ &&
    position.z <= SAFE_ZONE.maxZ
  );
}

function isAtBreakthroughAltar(position) {
  return horizontalDistance(position, BREAKTHROUGH_ALTAR) <= BREAKTHROUGH_ALTAR.radius;
}

function createPlayer(id, identity, spawn, now) {
  return {
    id,
    name: sanitizeName(identity?.name),
    faction: sanitizeFaction(identity?.faction),
    profile: sanitizeProfile(identity?.profile),
    position: copyPosition(spawn),
    yaw: Math.PI,
    sequence: 0,
    hp: 120,
    maxHp: 120,
    mp: 100,
    maxMp: 100,
    qi: 0,
    gold: 0,
    currentRegion: 'sect_hall',
    maxQi: 100,
    shield: 0,
    shieldUntil: 0,
    blocking: false,
    parryUntil: 0,
    alive: true,
    respawnAt: 0,
    meditating: false,
    isFlying: false,
    flightUnlocked: false,
    realm: { ...STARTING_REALM },
    inventory: {
      linhThach: 0,
      linhThao: 0,
      linhCot: 0,
      hoTamDan: 0,
    },
    cooldowns: Object.create(null),
    lastMoveAt: now,
    movementCredit: 0.65,
    invulnerableUntil: 0,
    breakthrough: {
      status: "idle",
      wave: 0,
      startedAt: 0,
      nextAt: 0,
      telegraph: null,
    },
  };
}

function createEnemy(spawn) {
  const template = ENEMY_TEMPLATES[spawn.type];
  const position = { x: spawn.x, y: spawn.y, z: spawn.z };
  return {
    id: spawn.id,
    type: spawn.type,
    label: template.label,
    isBoss: Boolean(template.isBoss),
    spawn: copyPosition(position),
    position,
    yaw: 0,
    hp: template.maxHp,
    maxHp: template.maxHp,
    alive: true,
    respawnAt: 0,
    targetId: null,
    nextAttackAt: 0,
    pendingAttack: null,
    attackCount: 0,
    slowUntil: 0,
    stunnedUntil: 0,
    contributors: new Set(),
  };
}

function serializeCooldowns(cooldowns, now) {
  const result = {};
  for (const [key, readyAt] of Object.entries(cooldowns)) {
    const remainingMs = Math.max(0, readyAt - now);
    if (remainingMs > 0) result[key] = Math.ceil(remainingMs);
  }
  return result;
}

function serializeBreakthrough(breakthrough) {
  return {
    status: breakthrough.status,
    wave: breakthrough.wave,
    startedAt: breakthrough.startedAt || null,
    nextAt: breakthrough.nextAt || null,
    telegraph: breakthrough.telegraph
      ? {
          position: copyPosition(breakthrough.telegraph.position),
          radius: breakthrough.telegraph.radius,
          resolveAt: breakthrough.telegraph.resolveAt,
        }
      : null,
  };
}

function serializePublicPlayer(player, now) {
  return {
    id: player.id,
    name: player.name,
    faction: player.faction,
    factionId: player.faction,
    profile: player.profile,
    position: {
      x: round(player.position.x),
      y: round(player.position.y),
      z: round(player.position.z),
    },
    yaw: round(player.yaw, 3),
    sequence: player.sequence,
    hp: Math.ceil(player.hp),
    maxHp: player.maxHp,
    mp: Math.floor(player.mp),
    maxMp: player.maxMp,
    qi: Math.floor(player.qi),
    gold: Math.floor(player.gold),
    currentRegion: player.currentRegion,
    maxQi: player.maxQi,
    cultivation: Math.floor(player.qi),
    cultivationRequired: player.maxQi,
    shield: Math.ceil(player.shield),
    blocking: player.blocking,
    alive: player.alive,
    meditating: player.meditating,
    isFlying: player.isFlying,
    flightUnlocked: player.flightUnlocked,
    unlockedFlight: player.flightUnlocked,
    realm: { ...player.realm },
    realmId: player.realm.id,
    cooldowns: serializeCooldowns(player.cooldowns, now),
    breakthrough: serializeBreakthrough(player.breakthrough),
    breakthroughActive: !["idle", "failed"].includes(player.breakthrough.status),
    lightningWave: player.breakthrough.wave,
  };
}

function serializeEnemy(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    label: enemy.label,
    isBoss: enemy.isBoss,
    position: {
      x: round(enemy.position.x),
      y: round(enemy.position.y),
      z: round(enemy.position.z),
    },
    yaw: round(enemy.yaw, 3),
    hp: Math.ceil(enemy.hp),
    maxHp: enemy.maxHp,
    alive: enemy.alive,
    respawnAt: enemy.respawnAt || null,
    targetId: enemy.targetId,
    pendingAttack: enemy.pendingAttack
      ? {
          type: enemy.pendingAttack.type,
          position: copyPosition(enemy.pendingAttack.position),
          radius: enemy.pendingAttack.radius,
          resolveAt: enemy.pendingAttack.resolveAt,
        }
      : null,
  };
}

export class GameRoom {
  constructor(code, options = {}) {
    this.code = sanitizeRoomCode(code);
    this.maxPlayers = clamp(
      Math.floor(finiteNumber(options.maxPlayers, MAX_PLAYERS_PER_ROOM)),
      1,
      MAX_PLAYERS_PER_ROOM,
    );
    this.random = typeof options.random === "function" ? options.random : Math.random;
    this.players = new Map();
    this.enemies = new Map(ENEMY_SPAWNS.map((spawn) => [spawn.id, createEnemy(spawn)]));
    this.events = [];
    this.lastTickAt = null;
    this.emptySince = Date.now();
  }

  addPlayer(id, identity = {}, now = Date.now()) {
    if (typeof id !== "string" || id.length === 0) {
      throw gameError("INVALID_PLAYER", "Không xác định được người chơi.");
    }
    const existing = this.players.get(id);
    if (existing) return existing;
    if (this.players.size >= this.maxPlayers) {
      throw gameError("ROOM_FULL", `Phòng ${this.code} đã đủ ${this.maxPlayers} người.`);
    }

    const spawn = PLAYER_SPAWNS[this.players.size % PLAYER_SPAWNS.length];
    const player = createPlayer(id, identity, spawn, now);
    this.players.set(id, player);
    this.emptySince = null;
    this.pushEvent("player:joined", {
      playerId: id,
      name: player.name,
      faction: player.faction,
    }, now);
    return player;
  }

  removePlayer(id, now = Date.now()) {
    const player = this.players.get(id);
    if (!player) return false;
    this.players.delete(id);
    for (const enemy of this.enemies.values()) {
      if (enemy.targetId === id) enemy.targetId = null;
      enemy.contributors.delete(id);
    }
    this.pushEvent("player:left", { playerId: id, name: player.name }, now);
    if (this.players.size === 0) this.emptySince = now;
    return true;
  }

  pushEvent(type, payload = {}, now = Date.now()) {
    this.events.push({ type, serverTime: now, ...payload });
    if (this.events.length > 256) this.events.splice(0, this.events.length - 256);
  }

  drainEvents() {
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }

  updatePlayerMove(id, payload, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể di chuyển khi đang trọng thương.");
    if (!isObject(payload) || !isObject(payload.position)) {
      throw gameError("INVALID_MOVE", "Dữ liệu di chuyển không hợp lệ.");
    }

    const flightRequested = Boolean(payload.flying);
    const canFly = player.flightUnlocked && player.breakthrough.status === "idle";
    player.isFlying = flightRequested && canFly;
    const requested = clampPosition(payload.position, player.isFlying);
    const elapsedSeconds = clamp((now - player.lastMoveAt) / 1_000, 0, 0.25);
    const baseSpeed = player.isFlying ? 11 : 7.2;
    // A capped token bucket tolerates small reconciliation corrections without
    // granting extra speed to clients that spam movement packets.
    player.movementCredit = Math.min(1, player.movementCredit + baseSpeed * elapsedSeconds);
    const maximumDistance = player.movementCredit;
    const accepted = moveTowards(player.position, requested, maximumDistance);
    const movedDistance = distance3(player.position, accepted);

    player.position = clampPosition(accepted, player.isFlying);
    player.movementCredit = Math.max(0, player.movementCredit - movedDistance);
    player.yaw = normalizeYaw(payload.yaw ?? player.yaw);
    player.lastMoveAt = now;
    const sequence = Math.floor(finiteNumber(payload.sequence, player.sequence));
    player.sequence = clamp(sequence, player.sequence, Number.MAX_SAFE_INTEGER);

    if (movedDistance > 0.08) {
      if (player.meditating) {
        player.meditating = false;
        this.pushEvent("meditation:stopped", { playerId: id, reason: "moved" }, now);
      }
      player.blocking = false;
    }
    return serializePublicPlayer(player, now);
  }

  dashPlayer(id, payload = {}, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể lướt khi đang trọng thương.");
    if (player.breakthrough.status === "resolving") {
      throw gameError("ACTION_BLOCKED", "Không thể lướt khi đột phá đang kết thúc.");
    }
    const readyAt = player.cooldowns.dash ?? 0;
    if (readyAt > now) throw gameError("ON_COOLDOWN", "Khinh công chưa hồi phục.");

    const direction = normalizeHorizontalDirection(payload.direction, player.yaw);
    const destination = {
      x: player.position.x + direction.x * 4.4,
      y: player.position.y,
      z: player.position.z + direction.z * 4.4,
    };
    player.position = clampPosition(destination, player.isFlying && player.flightUnlocked);
    player.meditating = false;
    player.blocking = false;
    player.cooldowns.dash = now + 1_200;
    player.invulnerableUntil = now + 320;
    this.pushEvent("player:dash", {
      playerId: id,
      position: copyPosition(player.position),
      invulnerableUntil: player.invulnerableUntil,
    }, now);
    return serializePublicPlayer(player, now);
  }

  castAbility(id, payload = {}, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể thi triển chiêu thức lúc trọng thương.");
    if (player.breakthrough.status !== "idle") {
      throw gameError("ACTION_BLOCKED", "Hãy tập trung né lôi kiếp.");
    }

    const rawKey = String(payload.ability ?? payload.key ?? "");
    const key = rawKey.toLowerCase() === "basic" ? "basic" : rawKey.toUpperCase();
    const ability = ABILITIES[key];
    if (!ability) throw gameError("UNKNOWN_ABILITY", "Chiêu thức không tồn tại.");

    const readyAt = player.cooldowns[key] ?? 0;
    if (readyAt > now) throw gameError("ON_COOLDOWN", `${ability.label} chưa hồi chiêu.`);
    if (player.mp < ability.mpCost) throw gameError("NOT_ENOUGH_MP", "Không đủ linh lực.");

    player.meditating = false;
    player.blocking = false;
    player.mp -= ability.mpCost;
    player.cooldowns[key] = now + ability.cooldownMs;
    const aim = normalizeHorizontalDirection(payload.aim, player.yaw);
    player.yaw = Math.atan2(aim.x, aim.z);

    const hitIds = [];
    const combatAbility = { ...ability };
    if (player.faction === "orthodox") combatAbility.range = ability.range * 1.25;
    if (player.faction === "demonic" && ability.targetMode === "area") combatAbility.radius = ability.radius * 1.35;
    if (player.faction === "heretic" && key !== "basic") combatAbility.slowMs = Math.max(ability.slowMs ?? 0, 3000);
    if (ability.targetMode === "self") {
      player.hp = Math.min(player.maxHp, player.hp + ability.heal);
      player.shield = Math.max(player.shield, ability.shield);
      player.shieldUntil = now + ability.shieldMs;
    } else {
      const targets = this.selectAbilityTargets(player, combatAbility, aim, payload.targetId);
      for (const enemy of targets) {
        if (player.faction === "orthodox" && ["basic", "Q", "E"].includes(key)) {
          for (let strike = 0; strike < 3; strike += 1) this.damageEnemy(enemy, ability.damage * 0.46, player, now + strike * 35, combatAbility);
        } else this.damageEnemy(enemy, player.faction === "heretic" ? ability.damage * 1.12 : ability.damage, player, now, combatAbility);
        if (player.faction === "demonic") player.hp = Math.min(player.maxHp, player.hp + ability.damage * 0.14);
        hitIds.push(enemy.id);
      }
    }

    this.pushEvent("ability:cast", {
      playerId: id,
      ability: key,
      aim,
      targetId: typeof payload.targetId === "string" ? payload.targetId : null,
      hitIds,
      faction: player.faction,
    }, now);
    return { ability: key, hitIds, player: serializePublicPlayer(player, now) };
  }

  setBlocking(id, active, now = Date.now()) {
    const player = this.requirePlayer(id);
    const shouldBlock = Boolean(active);
    if (shouldBlock) {
      if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể đỡ đòn khi đang trọng thương.");
      if (player.breakthrough.status !== "idle") {
        throw gameError("ACTION_BLOCKED", "Hãy tập trung né lôi kiếp.");
      }
      player.meditating = false;
      player.blocking = true;
      player.parryUntil = now + 300;
    } else {
      player.blocking = false;
    }
    this.pushEvent("player:block", { playerId: id, active: player.blocking }, now);
    return serializePublicPlayer(player, now);
  }

  selectAbilityTargets(player, ability, aim, requestedTargetId) {
    const livingEnemies = [...this.enemies.values()].filter((enemy) => enemy.alive);
    if (ability.targetMode === "around-self") {
      return livingEnemies.filter(
        (enemy) => horizontalDistance(player.position, enemy.position) <= ability.radius,
      );
    }

    if (ability.targetMode === "area") {
      const center = pointFromAim(player.position, aim, ability.range * 0.72);
      return livingEnemies.filter(
        (enemy) =>
          horizontalDistance(player.position, enemy.position) <= ability.range + ability.radius &&
          horizontalDistance(center, enemy.position) <= ability.radius,
      );
    }

    const candidates = livingEnemies
      .map((enemy) => {
        const dx = enemy.position.x - player.position.x;
        const dz = enemy.position.z - player.position.z;
        const distance = Math.hypot(dx, dz);
        const dot = distance > 0.001 ? (dx / distance) * aim.x + (dz / distance) * aim.z : 1;
        return { enemy, distance, dot };
      })
      .filter(({ distance, dot }) => distance <= ability.range && dot >= 0.58)
      .sort((a, b) => {
        if (a.enemy.id === requestedTargetId) return -1;
        if (b.enemy.id === requestedTargetId) return 1;
        return a.distance - b.distance;
      });
    return candidates.length > 0 ? [candidates[0].enemy] : [];
  }

  damageEnemy(enemy, rawDamage, player, now = Date.now(), ability = {}) {
    if (!enemy?.alive || !player?.alive || !this.players.has(player.id)) return 0;
    const damage = clamp(finiteNumber(rawDamage), 0, 10_000);
    if (damage <= 0) return 0;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.contributors.add(player.id);
    enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + MONSTER_BALANCE.hitStunMs);
    if (ability.slowMs) enemy.slowUntil = Math.max(enemy.slowUntil, now + ability.slowMs);
    player.qi = Math.min(player.maxQi, player.qi + damage * 0.08);
    this.pushEvent("enemy:damaged", {
      enemyId: enemy.id,
      playerId: player.id,
      damage: round(damage),
      hp: Math.ceil(enemy.hp),
    }, now);
    if (enemy.hp <= 0) this.defeatEnemy(enemy, player, now);
    return damage;
  }

  defeatEnemy(enemy, killer, now = Date.now()) {
    const template = ENEMY_TEMPLATES[enemy.type];
    enemy.alive = false;
    enemy.hp = 0;
    enemy.targetId = null;
    enemy.pendingAttack = null;
    enemy.respawnAt = now + template.respawnMs;

    const recipients = enemy.isBoss
      ? [...enemy.contributors].filter((id) => this.players.has(id))
      : [killer.id];
    if (recipients.length === 0 && this.players.has(killer.id)) recipients.push(killer.id);

    for (const playerId of new Set(recipients)) {
      const player = this.players.get(playerId);
      if (!player) continue;
      const granted = {};
      for (const [resource, amount] of Object.entries(template.reward)) {
        if (resource === "qi") {
          const before = player.qi;
          player.qi = Math.min(player.maxQi, player.qi + amount);
          granted.qi = round(player.qi - before);
        } else if (resource === "gold") {
          player.gold += amount;
          granted.gold = amount;
        } else if (Object.hasOwn(player.inventory, resource)) {
          player.inventory[resource] += amount;
          granted[resource] = amount;
        }
      }
      if (enemy.isBoss) granted.bossEquipment = "thunder_guard_talisman";
      this.pushEvent("loot:granted", { playerId, enemyId: enemy.id, loot: granted }, now);
    }

    this.pushEvent("enemy:defeated", {
      enemyId: enemy.id,
      enemyType: enemy.type,
      killerId: killer.id,
      respawnAt: enemy.respawnAt,
    }, now);
    enemy.contributors.clear();
  }

  setMeditating(id, active, now = Date.now()) {
    const player = this.requirePlayer(id);
    const shouldMeditate = Boolean(active);
    if (shouldMeditate) {
      if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể tĩnh tọa khi đang trọng thương.");
      if (player.breakthrough.status !== "idle") {
        throw gameError("ACTION_BLOCKED", "Đang trong quá trình đột phá.");
      }
      player.isFlying = false;
    }
    player.meditating = shouldMeditate;
    this.pushEvent(shouldMeditate ? "meditation:started" : "meditation:stopped", {
      playerId: id,
    }, now);
    return serializePublicPlayer(player, now);
  }

  startBreakthrough(id, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể đột phá khi đang trọng thương.");
    if (player.breakthrough.status !== "idle") {
      throw gameError("BREAKTHROUGH_ACTIVE", "Đột phá đã bắt đầu.");
    }
    if (player.realm.id !== STARTING_REALM.id) {
      throw gameError("REALM_COMPLETE", "Nhân vật đã bước vào Kim Đan kỳ.");
    }
    if (!isAtBreakthroughAltar(player.position)) {
      throw gameError("NOT_AT_ALTAR", "Hãy đứng trong Trận Đài Đột Phá tại Tông Môn.");
    }
    if (player.qi < player.maxQi) {
      throw gameError("NOT_ENOUGH_QI", `Cần tích đủ ${player.maxQi} Chân Khí.`);
    }
    if (player.inventory.hoTamDan < 1) {
      throw gameError("MISSING_PILL", "Cần Hộ Tâm Đan rơi từ Lôi Linh Hộ Pháp.");
    }

    player.inventory.hoTamDan -= 1;
    player.qi = 0;
    player.meditating = false;
    player.isFlying = false;
    player.hp = player.maxHp;
    player.breakthrough = {
      status: "active",
      wave: 0,
      startedAt: now,
      nextAt: now + 700,
      telegraph: null,
    };
    this.pushEvent("breakthrough:started", {
      playerId: id,
      waves: 3,
      nextWaveAt: player.breakthrough.nextAt,
    }, now);
    return serializePublicPlayer(player, now);
  }

  tick(now = Date.now()) {
    const previous = this.lastTickAt ?? now - 1_000 / SIMULATION_HZ;
    const deltaSeconds = clamp((now - previous) / 1_000, 0, 0.25);
    this.lastTickAt = now;

    for (const player of this.players.values()) this.tickPlayer(player, deltaSeconds, now);
    for (const enemy of this.enemies.values()) this.tickEnemy(enemy, deltaSeconds, now);
  }

  tickPlayer(player, deltaSeconds, now) {
    if (!player.alive) {
      if (player.respawnAt > 0 && now >= player.respawnAt) this.respawnPlayer(player, now);
      return;
    }

    if (player.shield > 0 && now >= player.shieldUntil) player.shield = 0;
    player.mp = Math.min(player.maxMp, player.mp + deltaSeconds * (player.meditating ? 14 : 3.5));
    if (player.meditating) {
      player.hp = Math.min(player.maxHp, player.hp + deltaSeconds * 5);
      player.qi = Math.min(player.maxQi, player.qi + deltaSeconds * 8);
    }
    this.tickBreakthrough(player, now);
  }

  tickBreakthrough(player, now) {
    const state = player.breakthrough;
    if (state.status === "idle" || state.status === "failed") return;

    if (state.status === "resolving") {
      if (now >= state.nextAt) this.completeBreakthrough(player, now);
      return;
    }

    if (!state.telegraph && state.wave < 3 && now >= state.nextAt) {
      state.wave += 1;
      const jitterAngle = this.random() * Math.PI * 2;
      const jitterDistance = this.random() * 0.45;
      const strikePosition = {
        x: clamp(
          player.position.x + Math.cos(jitterAngle) * jitterDistance,
          WORLD_BOUNDS.minX,
          WORLD_BOUNDS.maxX,
        ),
        y: 0,
        z: clamp(
          player.position.z + Math.sin(jitterAngle) * jitterDistance,
          WORLD_BOUNDS.minZ,
          WORLD_BOUNDS.maxZ,
        ),
      };
      state.telegraph = {
        position: strikePosition,
        radius: 2.55 + state.wave * 0.2,
        resolveAt: now + 900,
      };
      this.pushEvent("breakthrough:telegraph", {
        playerId: player.id,
        wave: state.wave,
        ...state.telegraph,
      }, now);
      return;
    }

    if (state.telegraph && now >= state.telegraph.resolveAt) {
      const telegraph = state.telegraph;
      const hit = horizontalDistance(player.position, telegraph.position) <= telegraph.radius;
      if (hit) {
        this.damagePlayer(player, 34, { kind: "lightning", id: `tribulation-${state.wave}` }, now);
      }
      this.pushEvent("breakthrough:strike", {
        playerId: player.id,
        wave: state.wave,
        position: copyPosition(telegraph.position),
        radius: telegraph.radius,
        hit,
      }, now);
      state.telegraph = null;

      if (!player.alive) return;
      if (state.wave >= 3) {
        state.status = "resolving";
        state.nextAt = now + 550;
      } else {
        state.nextAt = now + 650;
      }
    }
  }

  completeBreakthrough(player, now) {
    player.realm = { ...GOLDEN_CORE_REALM };
    player.flightUnlocked = true;
    player.maxHp = 150;
    player.hp = player.maxHp;
    player.maxMp = 125;
    player.mp = player.maxMp;
    player.maxQi = 150;
    player.qi = 25;
    player.breakthrough = {
      status: "idle",
      wave: 3,
      startedAt: 0,
      nextAt: 0,
      telegraph: null,
    };
    this.pushEvent("breakthrough:success", {
      playerId: player.id,
      realm: { ...player.realm },
      flightUnlocked: true,
    }, now);
  }

  failBreakthrough(player, reason, now) {
    if (player.breakthrough.status === "idle" || player.breakthrough.status === "failed") return;
    player.breakthrough = {
      status: "failed",
      wave: player.breakthrough.wave,
      startedAt: player.breakthrough.startedAt,
      nextAt: 0,
      telegraph: null,
    };
    this.pushEvent("breakthrough:failed", { playerId: player.id, reason }, now);
  }

  tickEnemy(enemy, deltaSeconds, now) {
    const template = ENEMY_TEMPLATES[enemy.type];
    if (!enemy.alive) {
      if (now >= enemy.respawnAt) this.respawnEnemy(enemy, now);
      return;
    }
    if (this.players.size === 0) {
      enemy.targetId = null;
      enemy.pendingAttack = null;
      return;
    }
    if (enemy.stunnedUntil > now) {
      enemy.pendingAttack = null;
      return;
    }

    if (enemy.pendingAttack) {
      if (now >= enemy.pendingAttack.resolveAt) this.resolveEnemyAttack(enemy, now);
      return;
    }

    let target = enemy.targetId ? this.players.get(enemy.targetId) : null;
    if (!this.isEnemyTargetValid(enemy, target, template)) {
      target = this.findEnemyTarget(enemy, template);
      enemy.targetId = target?.id ?? null;
    }
    if (!target) {
      const homeDistance = horizontalDistance(enemy.position, enemy.spawn);
      if (homeDistance > 0.1) {
        enemy.position = moveTowards(enemy.position, enemy.spawn, template.speed * deltaSeconds);
      }
      return;
    }

    const distance = horizontalDistance(enemy.position, target.position);
    const dx = target.position.x - enemy.position.x;
    const dz = target.position.z - enemy.position.z;
    enemy.yaw = Math.atan2(dx, dz);
    const effectiveSpeed = template.speed * (enemy.slowUntil > now ? 0.52 : 1);
    if (distance > template.attackRange * 0.9) {
      const destination = { x: target.position.x, y: 0, z: target.position.z };
      enemy.position = clampPosition(
        moveTowards(enemy.position, destination, effectiveSpeed * deltaSeconds),
        false,
      );
    }

    if (distance <= template.attackRange && now >= enemy.nextAttackAt) {
      if (enemy.isBoss) {
        this.telegraphBossAttack(enemy, target, now);
      } else {
        this.damagePlayer(enemy.targetId ? target : null, template.damage, {
          kind: enemy.type === "rogue_cultivator" ? "projectile" : "melee",
          id: enemy.id,
        }, now);
        enemy.nextAttackAt = now + template.attackCooldownMs;
        this.pushEvent("enemy:attack", {
          enemyId: enemy.id,
          targetId: target.id,
          attack: enemy.type === "rogue_cultivator" ? "shadow-bolt" : "bite",
        }, now);
      }
    }
  }

  isEnemyTargetValid(enemy, target, template) {
    return Boolean(
      target &&
        target.alive &&
        !isInSafeZone(target.position) &&
        target.breakthrough.status === "idle" &&
        horizontalDistance(enemy.spawn, target.position) <= template.aggroRange * 1.55,
    );
  }

  findEnemyTarget(enemy, template) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const player of this.players.values()) {
      if (!player.alive || isInSafeZone(player.position) || player.breakthrough.status !== "idle") continue;
      const distance = horizontalDistance(enemy.position, player.position);
      if (distance <= template.aggroRange && distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  telegraphBossAttack(enemy, target, now) {
    enemy.attackCount += 1;
    const isNova = enemy.attackCount % 3 === 0;
    const attack = {
      type: isNova ? "thunder-nova" : "falling-blade",
      position: isNova ? copyPosition(enemy.position) : { ...copyPosition(target.position), y: 0 },
      radius: isNova ? 5.4 : 3.1,
      damage: isNova ? 25 : 19,
      resolveAt: now + (isNova ? 1_100 : 850),
    };
    enemy.pendingAttack = attack;
    enemy.nextAttackAt = attack.resolveAt + ENEMY_TEMPLATES[enemy.type].attackCooldownMs;
    this.pushEvent("enemy:telegraph", {
      enemyId: enemy.id,
      attack: attack.type,
      position: copyPosition(attack.position),
      radius: attack.radius,
      resolveAt: attack.resolveAt,
    }, now);
  }

  resolveEnemyAttack(enemy, now) {
    const attack = enemy.pendingAttack;
    if (!attack) return;
    const hitIds = [];
    for (const player of this.players.values()) {
      if (!player.alive || isInSafeZone(player.position)) continue;
      if (horizontalDistance(player.position, attack.position) <= attack.radius) {
        const dealt = this.damagePlayer(player, attack.damage, { kind: "boss", id: enemy.id }, now);
        if (dealt > 0) hitIds.push(player.id);
      }
    }
    this.pushEvent("enemy:attack", {
      enemyId: enemy.id,
      attack: attack.type,
      position: copyPosition(attack.position),
      radius: attack.radius,
      hitIds,
    }, now);
    enemy.pendingAttack = null;
  }

  damagePlayer(player, rawDamage, source, now = Date.now()) {
    if (!player?.alive) return 0;
    if (source?.kind !== "lightning" && isInSafeZone(player.position)) return 0;
    if (player.invulnerableUntil > now) {
      this.pushEvent("player:evaded", { playerId: player.id, source }, now);
      return 0;
    }
    let damage = clamp(finiteNumber(rawDamage), 0, 10_000);
    if (player.blocking) {
      const perfectParry = source?.kind !== "lightning" && now <= player.parryUntil;
      if (perfectParry) {
        const enemy = source?.id ? this.enemies.get(source.id) : null;
        if (enemy) enemy.nextAttackAt = Math.max(enemy.nextAttackAt, now + 1_100);
        this.pushEvent("player:parried", { playerId: player.id, source }, now);
        return 0;
      }
      damage *= 0.30;
      player.mp = Math.max(0, player.mp - 4);
      this.pushEvent("player:blocked", {
        playerId: player.id,
        source,
        reducedDamage: round(damage),
      }, now);
    }
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, damage);
      player.shield -= absorbed;
      damage -= absorbed;
    }
    if (damage <= 0) return 0;

    player.hp = Math.max(0, player.hp - damage);
    player.meditating = false;
    this.pushEvent("player:damaged", {
      playerId: player.id,
      source,
      damage: round(damage),
      hp: Math.ceil(player.hp),
    }, now);
    if (player.hp <= 0) {
      player.alive = false;
      player.isFlying = false;
      player.respawnAt = now + 4_000;
      this.failBreakthrough(player, "tribulation-defeat", now);
      this.pushEvent("player:defeated", {
        playerId: player.id,
        source,
        respawnAt: player.respawnAt,
      }, now);
    }
    return damage;
  }

  respawnPlayer(player, now) {
    const slot = [...this.players.keys()].indexOf(player.id);
    const spawn = PLAYER_SPAWNS[Math.max(0, slot) % PLAYER_SPAWNS.length];
    player.position = copyPosition(spawn);
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.shield = 0;
    player.alive = true;
    player.respawnAt = 0;
    player.meditating = false;
    player.blocking = false;
    player.isFlying = false;
    player.invulnerableUntil = now + 1_500;
    player.lastMoveAt = now;
    player.movementCredit = 0.65;
    if (player.breakthrough.status === "failed") {
      player.breakthrough = {
        status: "idle",
        wave: 0,
        startedAt: 0,
        nextAt: 0,
        telegraph: null,
      };
    }
    this.pushEvent("player:respawned", { playerId: player.id, position: copyPosition(spawn) }, now);
  }

  respawnEnemy(enemy, now) {
    const template = ENEMY_TEMPLATES[enemy.type];
    enemy.position = copyPosition(enemy.spawn);
    enemy.hp = template.maxHp;
    enemy.alive = true;
    enemy.respawnAt = 0;
    enemy.targetId = null;
    enemy.nextAttackAt = now + 800;
    enemy.pendingAttack = null;
    enemy.attackCount = 0;
    enemy.slowUntil = 0;
    enemy.stunnedUntil = 0;
    enemy.contributors.clear();
    this.pushEvent("enemy:respawned", { enemyId: enemy.id, position: copyPosition(enemy.position) }, now);
  }

  requirePlayer(id) {
    const player = this.players.get(id);
    if (!player) throw gameError("NOT_IN_ROOM", "Người chơi chưa vào phòng.");
    return player;
  }

  fastTravel(id, regionId, now = Date.now()) {
    const player = this.requirePlayer(id);
    const region = FAST_TRAVEL_REGIONS[regionId];
    if (!region) throw gameError('INVALID_REGION', 'Khu vực không tồn tại.');
    if (!player.alive || player.breakthrough.status !== 'idle') throw gameError('ACTION_BLOCKED', 'Không thể dịch chuyển lúc này.');
    if (player.realm.order < region.requiredOrder) throw gameError('REALM_REQUIRED', 'Cảnh giới chưa đủ để đến khu vực này.');
    const destination = player.currentRegion === regionId ? region.portal : region.townGate;
    player.position = copyPosition(destination);
    player.currentRegion = regionId;
    player.meditating = false;
    player.blocking = false;
    player.movementCredit = 0.65;
    player.lastMoveAt = now;
    this.pushEvent('player:fast-traveled', { playerId: id, regionId, position: copyPosition(destination) }, now);
    return serializePublicPlayer(player, now);
  }

  snapshot(now = Date.now()) {
    return {
      roomCode: this.code,
      serverTime: now,
      maxPlayers: this.maxPlayers,
      bounds: WORLD_BOUNDS,
      safeZone: SAFE_ZONE,
      breakthroughAltar: BREAKTHROUGH_ALTAR,
      players: [...this.players.values()].map((player) => serializePublicPlayer(player, now)),
      enemies: [...this.enemies.values()].map(serializeEnemy),
    };
  }

  privatePlayerSnapshot(id, now = Date.now()) {
    const player = this.requirePlayer(id);
    return {
      ...serializePublicPlayer(player, now),
      inventory: { ...player.inventory },
    };
  }
}

export class GameWorld {
  constructor(options = {}) {
    this.maxPlayers = clamp(
      Math.floor(finiteNumber(options.maxPlayers, MAX_PLAYERS_PER_ROOM)),
      1,
      MAX_PLAYERS_PER_ROOM,
    );
    this.random = typeof options.random === "function" ? options.random : Math.random;
    this.rooms = new Map();
    this.playerRooms = new Map();
  }

  getOrCreateRoom(rawCode) {
    const code = sanitizeRoomCode(rawCode);
    let room = this.rooms.get(code);
    if (!room) {
      room = new GameRoom(code, { maxPlayers: this.maxPlayers, random: this.random });
      this.rooms.set(code, room);
    }
    return room;
  }

  joinRoom(playerId, rawCode, identity = {}, now = Date.now()) {
    const code = sanitizeRoomCode(rawCode);
    let destination = this.rooms.get(code);
    if (destination && !destination.players.has(playerId) && destination.players.size >= destination.maxPlayers) {
      throw gameError("ROOM_FULL", `Phòng ${code} đã đủ ${destination.maxPlayers} người.`);
    }
    if (!destination) destination = this.getOrCreateRoom(code);

    const previousCode = this.playerRooms.get(playerId);
    if (previousCode && previousCode !== code) this.leaveRoom(playerId, previousCode, now);
    const player = destination.addPlayer(playerId, identity, now);
    this.playerRooms.set(playerId, code);
    return { room: destination, player };
  }

  leaveRoom(playerId, expectedCode, now = Date.now()) {
    const code = this.playerRooms.get(playerId);
    if (!code || (expectedCode && code !== expectedCode)) return false;
    const room = this.rooms.get(code);
    const removed = room?.removePlayer(playerId, now) ?? false;
    this.playerRooms.delete(playerId);
    return removed;
  }

  roomForPlayer(playerId) {
    const code = this.playerRooms.get(playerId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  tick(now = Date.now()) {
    for (const room of this.rooms.values()) room.tick(now);
  }

  pruneEmptyRooms(now = Date.now(), ttlMs = EMPTY_ROOM_TTL_MS) {
    for (const [code, room] of this.rooms) {
      if (room.players.size === 0 && room.emptySince !== null && now - room.emptySince >= ttlMs) {
        this.rooms.delete(code);
      }
    }
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += room.players.size;
    return { rooms: this.rooms.size, players };
  }
}
