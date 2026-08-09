import test from "node:test";
import assert from "node:assert/strict";

import {
  ABILITIES,
  ENEMY_ARCHETYPES,
  FACTIONS,
  PROTOTYPE_SCOPE,
  QUEST_PHASES,
  REALMS,
} from "../src/game/data.js";
import {
  applyRealmSuccess,
  canStartBreakthrough,
  clamp,
  cultivationPercent,
  deserializeProfile,
  loadProfile,
  normalizeRoomCode,
  objectiveForState,
  sanitizeName,
  saveProfile,
  serializeProfile,
} from "../src/game/rules.js";

test("game data exposes the vertical-slice contract", () => {
  assert.deepEqual(Object.keys(FACTIONS), ["orthodox", "demonic", "heretic"]);
  assert.deepEqual(Object.keys(ABILITIES), ["basic", "q", "e", "r", "f", "g"]);
  for (const ability of Object.values(ABILITIES)) {
    assert.equal(typeof ability.name, "string");
    assert.equal(typeof ability.cost, "number");
    assert.equal(typeof ability.cooldown, "number");
    assert.equal(typeof ability.range, "number");
    assert.equal(typeof ability.damage, "number");
    assert.match(ability.color, /^#[0-9a-f]{6}$/i);
  }

  assert.equal(REALMS.length, 9);
  assert.equal(PROTOTYPE_SCOPE.startRealmId, "foundation");
  assert.equal(PROTOTYPE_SCOPE.breakthroughTargetId, "golden_core");
  assert.equal(QUEST_PHASES.at(-1).id, "complete");
  assert.ok(Object.values(ENEMY_ARCHETYPES).some((enemy) => enemy.boss));
});

test("sanitizeName preserves Vietnamese names and removes unsafe punctuation", () => {
  assert.equal(sanitizeName("  Lạc   Vô-Tà<script>  "), "Lạc Vô-Tàscript");
  assert.equal(sanitizeName("***"), "");
  assert.equal(sanitizeName("Một cái tên rất dài", 8), "Một cái");
});

test("normalizeRoomCode preserves a safe Vietnamese Tục Danh with spaces", () => {
  assert.equal(normalizeRoomCode("  Thái Châu 42 "), "Thái Châu 42");
  assert.equal(normalizeRoomCode("Lạc   Vô Tà", 8), "Lạc Vô T");
  assert.equal(normalizeRoomCode("Đạo Hữu✨"), "Đạo Hữu");
});

test("clamp and cultivationPercent handle boundaries", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(cultivationPercent(25, 100), 25);
  assert.equal(cultivationPercent(150, 100), 100);
  assert.equal(cultivationPercent(20, 0), 0);
  assert.throws(() => clamp(1, 10, 0), RangeError);
});

test("only a ready Trúc Cơ profile can begin the prototype breakthrough", () => {
  const ready = {
    realmId: "foundation",
    cultivation: 100,
    hp: 80,
    breakthroughActive: false,
  };

  assert.equal(canStartBreakthrough(ready), true);
  assert.equal(canStartBreakthrough({ ...ready, cultivation: 99 }), false);
  assert.equal(canStartBreakthrough({ ...ready, realmId: "qi_refining" }), false);
  assert.equal(canStartBreakthrough({ ...ready, hp: 0 }), false);
  assert.equal(canStartBreakthrough({ ...ready, breakthroughActive: true }), false);
});

test("applyRealmSuccess is immutable and advances to Kim Đan without flight", () => {
  const source = {
    realmId: "foundation",
    cultivation: 100,
    questPhase: "breakthrough",
    breakthroughActive: true,
    lightningWave: 3,
    breakthrough: { active: true, status: "running" },
  };
  const result = applyRealmSuccess(source);

  assert.notEqual(result, source);
  assert.notEqual(result.breakthrough, source.breakthrough);
  assert.equal(source.realmId, "foundation");
  assert.equal(source.breakthrough.active, true);
  assert.equal(result.realmId, "golden_core");
  assert.equal(result.cultivation, 0);
  assert.equal(result.questPhase, "complete");
  assert.equal(result.breakthrough.status, "success");
  assert.equal('unlockedFlight' in result, false);
});

test("objectiveForState exposes useful dynamic quest progress", () => {
  assert.match(
    objectiveForState({
      questPhase: "purge",
      enemiesDefeated: 2,
      enemiesRequired: 3,
    }),
    /2\/3/,
  );
  assert.match(
    objectiveForState({ questPhase: "cultivate", cultivation: 75 }),
    /75\/100/,
  );
  assert.match(
    objectiveForState({ questPhase: "breakthrough", lightningWave: 2 }),
    /2\/3/,
  );
  assert.match(objectiveForState({ realmId: "golden_core" }), /Kim Đan/);
});

test("profile serialization is versioned, sanitized and resilient", () => {
  const serialized = serializeProfile({
    name: "  Thanh<script> Vân ",
    factionId: "demonic",
    realmId: "foundation",
    cultivation: 125.9,
    questPhase: "breakthrough",
    lightningWave: 2,
    settings: { masterVolume: 4, effectsVolume: -1, mouseSensitivity: 1.4 },
    socket: { shouldNotPersist: true },
  });
  const restored = deserializeProfile(serialized);

  assert.equal(restored.version, 1);
  assert.equal(restored.name, "Thanhscript Vân");
  assert.equal(restored.factionId, "demonic");
  assert.equal(restored.cultivation, 125);
  assert.equal(restored.settings.masterVolume, 1);
  assert.equal(restored.settings.effectsVolume, 0);
  assert.equal("socket" in restored, false);
  assert.deepEqual(loadProfile(saveProfile(restored)), restored);

  const fallback = deserializeProfile("{broken json");
  assert.equal(fallback.name, "Vô Danh");
  assert.equal(fallback.realmId, "foundation");
});
