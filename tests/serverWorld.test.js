import assert from "node:assert/strict";
import test from "node:test";

import {
  BREAKTHROUGH_ALTAR,
  ENEMY_TEMPLATES,
  GameRoom,
  GameWorld,
  MONSTER_BALANCE,
  sanitizeFaction,
  sanitizeName,
  sanitizeRoomCode,
} from "../server/world.js";

test("monster balance applies requested nerfs and trash mobs die in 2-3 basic hits", () => {
  assert.equal(MONSTER_BALANCE.hpMultiplier, 0.60);
  assert.equal(MONSTER_BALANCE.attackMultiplier, 0.65);
  assert.ok(MONSTER_BALANCE.hitStunMs >= 450);
  assert.ok(ENEMY_TEMPLATES.spirit_fox.maxHp <= 18 * 3);
  assert.ok(ENEMY_TEMPLATES.flame_imp.maxHp <= 18 * 3);
  const room = new GameRoom("TRASH");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 1_000);
  const fox = room.enemies.get("fox-1");
  room.damageEnemy(fox, 18, player, 2_000);
  assert.equal(fox.stunnedUntil, 2_000 + MONSTER_BALANCE.hitStunMs);
  room.damageEnemy(fox, 18, player, 2_500);
  room.damageEnemy(fox, 18, player, 3_000);
  assert.equal(fox.alive, false);
});

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

test("fast travel is realm-gated and uses town gates then local portals", () => {
  const room = new GameRoom("TRAVEL");
  room.addPlayer("traveler", { name: "Lữ Khách" }, 1_000);
  const first = room.fastTravel("traveler", "luoyang", 1_100);
  assert.deepEqual(first.position, { x: 25, y: 0, z: -5 });
  const second = room.fastTravel("traveler", "luoyang", 1_200);
  assert.deepEqual(second.position, { x: 28, y: 0, z: -8 });
  assert.throws(() => room.fastTravel("traveler", "heaven_sect", 1_300));
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
  assert.equal(player.gold, 180);
  assert.ok(player.qi > 0);
  const lootEvent = room.drainEvents().find((event) => event.type === "loot:granted");
  assert.equal(lootEvent.loot.bossEquipment, "thunder_guard_talisman");
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
  assert.equal(reduced, 9);
  assert.equal(player.hp, initialHp - 9);
  const heldBlock = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 2_700);
  assert.equal(heldBlock, 9);
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
