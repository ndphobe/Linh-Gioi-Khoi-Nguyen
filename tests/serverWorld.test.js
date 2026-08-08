import assert from "node:assert/strict";
import test from "node:test";

import {
  BREAKTHROUGH_ALTAR,
  GameRoom,
  GameWorld,
  sanitizeFaction,
  sanitizeName,
  sanitizeRoomCode,
} from "../server/world.js";

test("join identity is sanitized and rooms never exceed eight players", () => {
  const room = new GameRoom("demo-01");
  for (let index = 0; index < 8; index += 1) {
    room.addPlayer(
      `player-${index}`,
      {
        name: `<b>  Đạo   Hữu ${index}  </b>`,
        faction: index % 2 === 0 ? "Ma Đạo" : "unknown",
        profile: { accentColor: "javascript:alert(1)", hair: "<script>tóc</script>" },
      },
      1_000,
    );
  }

  assert.equal(room.players.size, 8);
  assert.equal(room.players.get("player-0").name, "Đạo Hữu 0");
  assert.equal(room.players.get("player-0").faction, "demonic");
  assert.equal(room.players.get("player-0").profile.accentColor, "#69e6ff");
  assert.throws(
    () => room.addPlayer("player-9", { name: "Thứ Chín" }, 1_000),
    (error) => error.code === "ROOM_FULL",
  );
});

test("sanitizers preserve Vietnamese names while constraining protocol identifiers", () => {
  assert.equal(sanitizeName("  Mộ  Dung—Phục✨ "), "Mộ DungPhục");
  assert.equal(sanitizeFaction("Chính Đạo"), "orthodox");
  assert.equal(sanitizeRoomCode(" demo !! 42 "), "DEMO42");
  assert.throws(() => sanitizeRoomCode("x"), (error) => error.code === "INVALID_ROOM");
});

test("authoritative movement clamps teleport attempts and locked flight", () => {
  const room = new GameRoom("MOVE");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 10_000);
  const before = { ...player.position };
  room.updatePlayerMove(
    "p1",
    { position: { x: 9_999, y: 999, z: -9_999 }, flying: true, yaw: 99, sequence: 3 },
    10_100,
  );

  const moved = Math.hypot(player.position.x - before.x, player.position.z - before.z);
  assert.ok(moved <= 1.01, `teleport was clamped to ${moved}`);
  assert.equal(player.position.y, 0);
  assert.equal(player.isFlying, false);
  assert.equal(player.sequence, 3);
});

test("boss loot and cultivation resources are awarded by the room", () => {
  const room = new GameRoom("BOSS");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 1_000);
  const boss = room.enemies.get("boss-1");

  room.damageEnemy(boss, boss.maxHp, player, 2_000, { key: "test" });

  assert.equal(boss.alive, false);
  assert.equal(player.inventory.hoTamDan, 1);
  assert.equal(player.inventory.linhCot, 1);
  assert.equal(player.inventory.linhThach, 25);
  assert.ok(player.qi > 0);
  assert.ok(room.drainEvents().some((event) => event.type === "loot:granted"));
});

test("server-owned block reduces damage and a timed parry negates it", () => {
  const room = new GameRoom("PARRY");
  const player = room.addPlayer("p1", { name: "Hộ Pháp" }, 1_000);
  player.position = { x: 0, y: 0, z: 0 };
  const initialHp = player.hp;

  room.setBlocking(player.id, true, 1_100);
  const parried = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 1_260);
  assert.equal(parried, 0);
  assert.equal(player.hp, initialHp);
  assert.ok(room.drainEvents().some((event) => event.type === "player:parried"));

  room.setBlocking(player.id, true, 2_000);
  const reduced = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 2_500);
  assert.equal(reduced, 13.5);
  assert.equal(player.hp, initialHp - 13.5);
});

test("three server-timed lightning waves unlock Kim Đan flight on survival", () => {
  const room = new GameRoom("REALM", { random: () => 0.5 });
  const player = room.addPlayer("p1", { name: "Độ Kiếp" }, 1_000);
  player.position = { ...BREAKTHROUGH_ALTAR };
  player.position.y = 0;
  player.qi = player.maxQi;
  player.inventory.hoTamDan = 1;
  // Unit-level invulnerability isolates the lifecycle from dodge mechanics;
  // movement and dash validation are covered independently.
  player.invulnerableUntil = 20_000;

  room.startBreakthrough(player.id, 1_000);
  for (let now = 1_000; now <= 8_000; now += 50) room.tick(now);

  assert.equal(player.realm.id, "golden_core");
  assert.equal(player.flightUnlocked, true);
  assert.equal(player.breakthrough.status, "idle");
  assert.equal(player.inventory.hoTamDan, 0);
  const strikes = room.drainEvents().filter((event) => event.type === "breakthrough:strike");
  assert.equal(strikes.length, 3);
});

test("empty rooms tick safely and are pruned after their grace period", () => {
  const world = new GameWorld();
  const room = world.getOrCreateRoom("EMPTY");
  room.emptySince = 1_000;
  assert.doesNotThrow(() => world.tick(2_000));
  assert.deepEqual(room.snapshot(2_000).players, []);
  world.pruneEmptyRooms(70_000);
  assert.equal(world.rooms.has("EMPTY"), false);
});
