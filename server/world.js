import { CULTIVATION_BASE_EXP, CULTIVATION_REALM_MULTIPLIER, CultivationSystem, progressionCapForLevel, realmForLevel, tribulationGateForLevel } from "../src/game/CultivationSystem.js";
import { monsterAttackFor } from "../src/game/Monster.js";
import { CULTIVATION_REALMS, SkillSystemManager } from "../src/game/SkillSystem.js";
import { itemForFaction } from "../src/game/ShopSystem.js";

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
export const BREAKTHROUGH_WAVES = 10;
export const TRIBULATION_PROFILES = Object.freeze({
  nascent_soul: Object.freeze({ maxHits: 3, fallbackLevel: 6, telegraphMs: 1_150, intervalMs: 550, radius: 0.13, intensity: 1 }),
  spirit_transformation: Object.freeze({ maxHits: 2, fallbackLevel: 8, telegraphMs: 850, intervalMs: 400, radius: 0.14, intensity: 1.45 }),
});
const TRIBULATION_PLAYER_RADIUS = 0.055;
const TRIBULATION_MOVE_SPEED = 1.35;

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

// Equipment bonuses are resolved from server-known IDs. The client may identify
// its equipped weapon, but it cannot submit an arbitrary attack value.
export const WEAPON_ATTACK_BONUSES = Object.freeze({
  iron_sword: 8,
  jade_sword: 22,
  blood_sabre: 48,
  heaven_blade: 95,
  celestial_path_sword: 58,
  blood_path_saber: 64,
  nether_path_twinblades: 52,
  orthodox_stream_sword:32,orthodox_dipper_sword:108,orthodox_supreme_sword:190,
  demonic_soul_saber:36,demonic_inferno_scythe:116,demonic_blood_emperor:205,
  heretic_scale_sword:29,heretic_spider_blades:98,heretic_plague_staff:174,
});

export const SHOP_CATALOG = Object.freeze({
  iron_sword: Object.freeze({ category: "weapons", price: 80, requiredOrder: 0, attack: 8, attackSpeed: .03, critRate: 0, lifeSteal: 0 }),
  jade_sword: Object.freeze({ category: "weapons", price: 260, requiredOrder: 1, attack: 22, attackSpeed: .08, critRate: .05, lifeSteal: 0 }),
  blood_sabre: Object.freeze({ category: "weapons", price: 620, requiredOrder: 2, attack: 48, attackSpeed: .12, critRate: .10, lifeSteal: .06 }),
  heaven_blade: Object.freeze({ category: "weapons", price: 1500, requiredOrder: 3, faction:"orthodox", attack: 95, attackSpeed: .20, critRate: .18, lifeSteal: .10 }),
  celestial_path_sword: Object.freeze({ category: "weapons", price: 980, requiredOrder: 2, faction: "orthodox", attack: 58, attackSpeed: .16, critRate: .12, lifeSteal: 0 }),
  blood_path_saber: Object.freeze({ category: "weapons", price: 1040, requiredOrder: 2, faction: "demonic", attack: 64, attackSpeed: .11, critRate: .09, lifeSteal: .10 }),
  nether_path_twinblades: Object.freeze({ category: "weapons", price: 920, requiredOrder: 2, faction: "heretic", attack: 52, attackSpeed: .22, critRate: .17, lifeSteal: .03 }),
  spirit_robe: Object.freeze({ category: "armor", price: 110, requiredOrder: 0, defense: 7, maxMana: 12 }),
  jade_armor: Object.freeze({ category: "armor", price: 380, requiredOrder: 1, defense: 20, maxMana: 28 }),
  dragon_armor: Object.freeze({ category: "armor", price: 900, requiredOrder: 2, defense: 45, maxMana: 50 }),
  healing_pill: Object.freeze({ category: "consumables", price: 35, requiredOrder: 0, healAmount: 45 }),
  mana_pill: Object.freeze({ category: "consumables", price: 40, requiredOrder: 0, manaAmount: 40 }),
  spirit_charm: Object.freeze({ category: "accessory", price: 120, requiredOrder: 1, defense: 5 }),
  thunder_guard_talisman: Object.freeze({ category: "accessory", price: 780, requiredOrder: 1, defense: 18, critRate: .08, bossDrop: true }),
  celestial_sword_set: Object.freeze({ category: "armor", price: 540, requiredOrder: 1, faction: "orthodox", attack: 16, defense: 18, maxMana: 24 }),
  blood_lord_set: Object.freeze({ category: "armor", price: 540, requiredOrder: 1, faction: "demonic", attack: 20, defense: 14, lifeSteal: .04 }),
  nether_venom_set: Object.freeze({ category: "armor", price: 540, requiredOrder: 1, faction: "heretic", attack: 15, defense: 15, critRate: .05 }),
  orthodox_stream_sword:Object.freeze({category:"weapons",price:420,requiredOrder:1,faction:"orthodox",attack:32,attackSpeed:.12,critRate:.07,lifeSteal:0}),
  orthodox_dipper_sword:Object.freeze({category:"weapons",price:1850,requiredOrder:3,faction:"orthodox",attack:108,attackSpeed:.22,critRate:.18,lifeSteal:0}),
  orthodox_supreme_sword:Object.freeze({category:"weapons",price:5200,requiredOrder:4,faction:"orthodox",attack:190,attackSpeed:.28,critRate:.25,lifeSteal:.04}),
  demonic_soul_saber:Object.freeze({category:"weapons",price:450,requiredOrder:1,faction:"demonic",attack:36,attackSpeed:.09,critRate:.05,lifeSteal:.06}),
  demonic_inferno_scythe:Object.freeze({category:"weapons",price:1950,requiredOrder:3,faction:"demonic",attack:116,attackSpeed:.16,critRate:.15,lifeSteal:.12}),
  demonic_blood_emperor:Object.freeze({category:"weapons",price:5500,requiredOrder:4,faction:"demonic",attack:205,attackSpeed:.20,critRate:.20,lifeSteal:.18}),
  heretic_scale_sword:Object.freeze({category:"weapons",price:400,requiredOrder:1,faction:"heretic",attack:29,attackSpeed:.15,critRate:.10,lifeSteal:.02}),
  heretic_spider_blades:Object.freeze({category:"weapons",price:1780,requiredOrder:3,faction:"heretic",attack:98,attackSpeed:.28,critRate:.24,lifeSteal:.05}),
  heretic_plague_staff:Object.freeze({category:"weapons",price:4900,requiredOrder:4,faction:"heretic",attack:174,attackSpeed:.23,critRate:.28,lifeSteal:.08}),
  orthodox_cloud_robe:Object.freeze({category:"armor",price:460,requiredOrder:1,faction:"orthodox",defense:24,maxMana:32}),
  orthodox_star_armor:Object.freeze({category:"armor",price:2100,requiredOrder:3,faction:"orthodox",attack:28,defense:68,maxMana:65}),
  orthodox_infinite_robe:Object.freeze({category:"armor",price:5800,requiredOrder:4,faction:"orthodox",attack:52,defense:118,maxMana:100}),
  demonic_blood_armor:Object.freeze({category:"armor",price:480,requiredOrder:1,faction:"demonic",defense:27,lifeSteal:.04}),
  demonic_ninehell_armor:Object.freeze({category:"armor",price:2250,requiredOrder:3,faction:"demonic",attack:34,defense:74,lifeSteal:.08}),
  demonic_emperor_robe:Object.freeze({category:"armor",price:6200,requiredOrder:4,faction:"demonic",attack:62,defense:125,lifeSteal:.12}),
  heretic_bone_robe:Object.freeze({category:"armor",price:440,requiredOrder:1,faction:"heretic",defense:22,critRate:.06,maxMana:20}),
  heretic_spider_armor:Object.freeze({category:"armor",price:1980,requiredOrder:3,faction:"heretic",attack:25,defense:62,critRate:.13}),
  heretic_saint_robe:Object.freeze({category:"armor",price:5400,requiredOrder:4,faction:"heretic",attack:47,defense:105,critRate:.20,maxMana:70}),
});

function equipmentStats(equipment = {}, faction = "orthodox") {
  const items = Object.values(equipment).map(id => {
    const catalog=SHOP_CATALOG[id];
    const variant=itemForFaction(id,faction);
    return catalog&&variant?{...catalog,...variant}:catalog;
  }).filter(Boolean);
  return items.reduce((total,item)=>({
    attack: total.attack + (item.atkBonus ?? item.attack ?? 0),
    attackSpeed: total.attackSpeed + (item.attackSpeed ?? 0),
    critRate: total.critRate + (item.critRate ?? 0),
    lifeSteal: total.lifeSteal + (item.lifeSteal ?? 0),
    defense: total.defense + (item.defense ?? 0),
    maxMana: total.maxMana + (item.maxMana ?? 0),
  }),{attack:0,attackSpeed:0,critRate:0,lifeSteal:0,defense:0,maxMana:0});
}

export function playerGrowthForLevel(level = 1) {
  const safeLevel = clamp(Math.floor(finiteNumber(level, 1)), 1, 16);
  const attackMultiplier = Math.round((1 + (safeLevel - 1) * .05) * 1000) / 1000;
  return Object.freeze({
    level: safeLevel,
    maxHp: 120 + (safeLevel - 1) * 8,
    maxMp: 100 + (safeLevel - 1) * 5,
    baseAttack: round(ABILITIES.basic.damage * attackMultiplier, 2),
    attackMultiplier,
    cultivationMultiplier: Math.round((1 + (safeLevel - 1) * .025) * 1000) / 1000,
  });
}

export const PLAYER_BASE_COMBAT_STATS = Object.freeze({
  defense: 36,
  attackSpeed: .02,
  critRate: .023,
});

const effectiveBasicDamage = (attackPower, faction) => round(attackPower * (faction === "orthodox" ? 1.38 : faction === "heretic" ? 1.12 : 1), 2);

function refreshEquipmentStats(player) {
  const previousMaxHp = player.maxHp;
  const previousMaxMp = player.maxMp;
  const stats = equipmentStats(player.equipment,player.faction);
  const growth = playerGrowthForLevel(player.cultivationSystem.level);
  player.maxHp = growth.maxHp;
  player.maxMp = growth.maxMp + stats.maxMana;
  player.baseAtk = growth.baseAttack;
  player.totalAtk = round(growth.baseAttack + stats.attack, 2);
  player.basicDamage = effectiveBasicDamage(player.totalAtk,player.faction);
  player.defense = round(PLAYER_BASE_COMBAT_STATS.defense+stats.defense,2);
  player.attackSpeed = round(Math.min(.35,PLAYER_BASE_COMBAT_STATS.attackSpeed+stats.attackSpeed),4);
  player.critRate = round(Math.min(.75,PLAYER_BASE_COMBAT_STATS.critRate+stats.critRate),4);
  player.lifeSteal = round(Math.min(.6,stats.lifeSteal+(player.faction==="demonic"?.14:0)),4);
  player.hp = clamp(player.hp + Math.max(0, player.maxHp - previousMaxHp), 0, player.maxHp);
  player.mp = clamp(player.mp + Math.max(0, player.maxMp - previousMaxMp), 0, player.maxMp);
  return stats;
}

const balanced = (value, multiplier) => Math.round(value * multiplier * 100) / 100;

export function monsterScaleForWave(wave = 1, level = 1, mapOrder = 0) {
  const round = Math.max(1, Math.floor(finiteNumber(wave, 1)));
  const stage = clamp(Math.floor(finiteNumber(level, 1)), 1, 5);
  const map = Math.max(0, Math.floor(finiteNumber(mapOrder, 0)));
  const roundStep = Math.min(24, round - 1);
  const progressionStep = roundStep * 5 + stage - 1;
  return Object.freeze({
    round,
    level: stage,
    mapOrder: map,
    combatLevel: map * 5 + roundStep * 5 + stage,
    hp: (1 + map * .9) * (1.16 ** progressionStep),
    damage: (1 + map * .58) * (1.12 ** progressionStep),
    speed: Math.min(1.75, (1 + map * .055) * (1.012 ** progressionStep)),
    reward: (1 + map * .62) * (1.1 ** progressionStep),
  });
}

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

const realmSnapshot = cultivationSystem => {
  const realm = realmForLevel(cultivationSystem.level);
  return Object.freeze({ id: realm.id, name: cultivationSystem.displayName, order: realm.order });
};

const FAST_TRAVEL_REGIONS = Object.freeze({
  sect_hall: Object.freeze({ requiredOrder: 0, requiredStage: 1, mapOrder: 0, portal: { x: 0, y: 0, z: 26 }, townGate: { x: 0, y: 0, z: 26 } }),
  luoyang: Object.freeze({ requiredOrder: 1, requiredStage: 1, mapOrder: 1, portal: { x: 28, y: 0, z: -8 }, townGate: { x: 25, y: 0, z: -5 } }),
  spirit_mine: Object.freeze({ requiredOrder: 1, requiredStage: 3, mapOrder: 2, portal: { x: 18, y: 0, z: 34 }, townGate: { x: 16, y: 0, z: 31 } }),
  heaven_sect: Object.freeze({ requiredOrder: 2, requiredStage: 1, mapOrder: 3, portal: { x: -30, y: 0, z: -18 }, townGate: { x: -27, y: 0, z: -16 } }),
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
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
  if (roomCode.length < 3) {
    throw gameError("INVALID_ROOM", "Tục Danh phải có từ 3 đến 24 ký tự tiếng Việt, chữ số hoặc khoảng trắng.");
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

function sanitizeSession(value) {
  const source = isObject(value) ? value : {};
  const inventory = Array.isArray(source.inventory)
    ? source.inventory.filter(id => typeof id === "string" && Object.hasOwn(SHOP_CATALOG, id)).slice(0, 60)
    : [];
  const equipmentSource = isObject(source.equipment) ? source.equipment : {};
  const slotFor = id => SHOP_CATALOG[id]?.category === "weapons" ? "weapon" : SHOP_CATALOG[id]?.category === "armor" ? "armor" : SHOP_CATALOG[id]?.category === "accessory" ? "accessory" : null;
  const equipment = { weapon: null, armor: null, accessory: null };
  for (const slot of Object.keys(equipment)) {
    const id = equipmentSource[slot];
    if (inventory.includes(id) && slotFor(id) === slot) equipment[slot] = id;
  }
  const resources = isObject(source.resources) ? source.resources : {};
  const currentRegion = Object.hasOwn(FAST_TRAVEL_REGIONS, source.currentRegion) ? source.currentRegion : "sect_hall";
  const position = isObject(source.position) ? clampPosition(source.position, Boolean(source.flightUnlocked)) : null;
  const breakthroughSource = isObject(source.breakthrough) ? source.breakthrough : {};
  const breakthroughStatus = ["idle", "active", "resolving", "failed"].includes(breakthroughSource.status)
    ? breakthroughSource.status
    : "idle";
  return {
    gold: clamp(Math.floor(finiteNumber(source.gold)), 0, 1_000_000_000),
    inventory,
    equipment,
    cultivationSystem: isObject(source.cultivationSystem) ? source.cultivationSystem : {},
    skillSystem: isObject(source.skillSystem) ? source.skillSystem : null,
    currentRegion,
    position,
    hp: clamp(finiteNumber(source.hp, 120), 0, 10_000),
    mp: clamp(finiteNumber(source.mp, 100), 0, 10_000),
    alive: source.alive !== false,
    flightUnlocked: Boolean(source.flightUnlocked),
    resources: {
      linhThach: clamp(Math.floor(finiteNumber(resources.linhThach)), 0, 1_000_000),
      linhThao: clamp(Math.floor(finiteNumber(resources.linhThao)), 0, 1_000_000),
      linhCot: clamp(Math.floor(finiteNumber(resources.linhCot)), 0, 1_000_000),
      hoTamDan: clamp(Math.floor(finiteNumber(resources.hoTamDan)), 0, 1_000),
    },
    breakthrough: {
      status: breakthroughStatus,
      wave: clamp(Math.floor(finiteNumber(breakthroughSource.wave)), 0, BREAKTHROUGH_WAVES),
      hits: clamp(Math.floor(finiteNumber(breakthroughSource.hits)), 0, BREAKTHROUGH_WAVES),
      maxHits: clamp(Math.floor(finiteNumber(breakthroughSource.maxHits, 3)), 0, BREAKTHROUGH_WAVES),
      dodgeX: clamp(finiteNumber(breakthroughSource.dodgeX), -1, 1),
      moveDirection: 0,
      lastMoveAt: 0,
      targetLevel: clamp(Math.floor(finiteNumber(breakthroughSource.targetLevel)), 0, 16),
      targetRealmId: Object.hasOwn(TRIBULATION_PROFILES, breakthroughSource.targetRealmId) ? breakthroughSource.targetRealmId : null,
      startedAt: Math.max(0, finiteNumber(breakthroughSource.startedAt)),
      nextAt: Math.max(0, finiteNumber(breakthroughSource.nextAt)),
      telegraph: isObject(breakthroughSource.telegraph) ? {
        strikes: Array.isArray(breakthroughSource.telegraph.strikes) ? breakthroughSource.telegraph.strikes.slice(0,6).map(strike=>({
          strikeX: clamp(finiteNumber(strike?.strikeX), -1, 1),
          radius: clamp(finiteNumber(strike?.radius, 0.13), 0.08, 0.2),
        })) : [{
          strikeX: clamp(finiteNumber(breakthroughSource.telegraph.strikeX), -1, 1),
          radius: clamp(finiteNumber(breakthroughSource.telegraph.radius, 0.13), 0.08, 0.2),
        }],
        safeX: clamp(finiteNumber(breakthroughSource.telegraph.safeX), -1, 1),
        durationMs: clamp(Math.floor(finiteNumber(breakthroughSource.telegraph.durationMs, 1_000)), 550, 1_200),
        resolveAt: Math.max(0, finiteNumber(breakthroughSource.telegraph.resolveAt)),
      } : null,
    },
  };
}

function sanitizeResumeToken(value) {
  const token = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : null;
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
  const session = sanitizeSession(identity?.session);
  const cultivationSystem = new CultivationSystem(session.cultivationSystem, { baseEXP: CULTIVATION_BASE_EXP, realmMultiplier: CULTIVATION_REALM_MULTIPLIER });
  const faction = sanitizeFaction(identity?.faction);
  const skillSystem = new SkillSystemManager({
    faction,
    realmId: cultivationSystem.realmId,
    minorLevel: cultivationSystem.subStage,
    state: session.skillSystem,
  });
  skillSystem.applyCultivationLevel(cultivationSystem.level);
  const realm = realmSnapshot(cultivationSystem);
  const gearStats = equipmentStats(session.equipment,faction);
  const growth = playerGrowthForLevel(cultivationSystem.level);
  const maxHp = growth.maxHp;
  const maxMp = growth.maxMp + gearStats.maxMana;
  const alive = session.alive && session.hp > 0;
  return {
    id,
    name: sanitizeName(identity?.name),
    faction,
    profile: sanitizeProfile(identity?.profile),
    position: copyPosition(session.position ?? spawn),
    yaw: Math.PI,
    sequence: 0,
    hp: alive ? clamp(session.hp, 1, maxHp) : 0,
    maxHp,
    mp: clamp(session.mp, 0, maxMp),
    maxMp,
    baseAtk: growth.baseAttack,
    totalAtk: round(growth.baseAttack + gearStats.attack,2),
    basicDamage: effectiveBasicDamage(growth.baseAttack + gearStats.attack,faction),
    defense: round(PLAYER_BASE_COMBAT_STATS.defense+gearStats.defense,2),
    attackSpeed: round(Math.min(.35,PLAYER_BASE_COMBAT_STATS.attackSpeed+gearStats.attackSpeed),4),
    critRate: round(Math.min(.75,PLAYER_BASE_COMBAT_STATS.critRate+gearStats.critRate),4),
    lifeSteal: round(Math.min(.6,gearStats.lifeSteal+(faction==="demonic"?.14:0)),4),
    // Legacy qi fields mirror the active EXP system. They are no longer a
    // second capped progression track.
    qi: cultivationSystem.currentExp,
    gold: session.gold,
    shopInventory: [...session.inventory],
    equipment: { ...session.equipment },
    cultivationSystem,
    skillSystem,
    currentRegion: session.currentRegion,
    maxQi: cultivationSystem.requiredEXP,
    shield: 0,
    shieldUntil: 0,
    blocking: false,
    parryUntil: 0,
    alive,
    respawnAt: 0,
    meditating: false,
    isFlying: false,
    flightUnlocked: session.flightUnlocked && realm.order >= 3,
    realm: { ...realm },
    inventory: { ...session.resources },
    cooldowns: Object.create(null),
    lastMoveAt: now,
    movementCredit: 0.65,
    invulnerableUntil: 0,
    breakthrough: session.breakthrough,
  };
}

function applyEnemyWave(enemy, defeats = 0) {
  const template = ENEMY_TEMPLATES[enemy.type];
  const killCount = Math.max(0, Math.floor(finiteNumber(defeats, 0)));
  const roundNumber = Math.floor(killCount / 5) + 1;
  const stage = killCount % 5 + 1;
  const scale = monsterScaleForWave(roundNumber, stage, enemy.mapOrder);
  const typeOffset = Object.keys(ENEMY_TEMPLATES).indexOf(enemy.type);
  enemy.defeats = killCount;
  enemy.wave = scale.round;
  enemy.level = scale.level;
  enemy.combatLevel = scale.combatLevel;
  enemy.spriteVariant = ((Math.max(0, typeOffset) + enemy.mapOrder + scale.round + scale.level - 2) % 3 + 3) % 3;
  enemy.powerScale = scale.damage;
  enemy.label = `${template.label} · Vòng ${scale.round} Cấp ${scale.level}`;
  enemy.maxHp = balanced(template.maxHp, scale.hp);
  enemy.hp = enemy.maxHp;
  enemy.speed = balanced(template.speed, scale.speed);
  enemy.damage = balanced(template.damage, scale.damage);
  enemy.attackRange = template.attackRange;
  enemy.aggroRange = template.aggroRange;
  enemy.attackCooldownMs = Math.max(700, Math.round(template.attackCooldownMs / scale.speed));
  enemy.respawnMs = Math.max(2_500, Math.round(template.respawnMs / Math.min(1.65, scale.speed)));
  enemy.reward = Object.fromEntries(Object.entries(template.reward).map(([key, value]) => [key,
    key === "qi" || key === "gold" ? Math.max(1, Math.round(value * scale.reward)) : value,
  ]));
  return enemy;
}

function createEnemy(spawn, regionId = "sect_hall", mapOrder = 0) {
  const template = ENEMY_TEMPLATES[spawn.type];
  const position = { x: spawn.x, y: spawn.y, z: spawn.z };
  return applyEnemyWave({
    id: regionId === "sect_hall" ? spawn.id : `${regionId}-${spawn.id}`,
    type: spawn.type,
    regionId,
    mapOrder,
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
    dotEffects: [],
    contributors: new Set(),
  }, 0);
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
    hits: breakthrough.hits ?? 0,
    maxHits: breakthrough.maxHits ?? 0,
    dodgeX: breakthrough.dodgeX ?? 0,
    targetRealmId: breakthrough.targetRealmId ?? null,
    startedAt: breakthrough.startedAt || null,
    nextAt: breakthrough.nextAt || null,
    telegraph: breakthrough.telegraph
      ? {
          strikes: breakthrough.telegraph.strikes.map(strike=>({...strike})),
          safeX: breakthrough.telegraph.safeX,
          durationMs: breakthrough.telegraph.durationMs,
          resolveAt: breakthrough.telegraph.resolveAt,
        }
      : null,
  };
}

function serializePublicPlayer(player, now) {
  const cultivation = player.cultivationSystem.serialize();
  const growth = playerGrowthForLevel(player.cultivationSystem.level);
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
    hp: round(player.hp,2),
    maxHp: player.maxHp,
    mp: round(player.mp,2),
    maxMp: player.maxMp,
    baseAtk: player.baseAtk,
    totalAtk: player.totalAtk,
    basicDamage: player.basicDamage,
    defense: player.defense,
    attackSpeed: player.attackSpeed,
    critRate: player.critRate,
    lifeSteal: player.lifeSteal,
    cultivationMultiplier: growth.cultivationMultiplier,
    qi: cultivation.currentExp,
    gold: Math.floor(player.gold),
    equipment: { ...player.equipment },
    cultivationSystem: cultivation,
    currentRegion: player.currentRegion,
    maxQi: cultivation.requiredEXP,
    cultivation: cultivation.currentExp,
    cultivationRequired: cultivation.requiredEXP,
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
    wave: enemy.wave,
    level: enemy.level,
    spriteVariant: enemy.spriteVariant,
    powerScale: enemy.powerScale,
    regionId: enemy.regionId,
    mapOrder: enemy.mapOrder,
    combatLevel: enemy.combatLevel,
    isBoss: enemy.isBoss,
    position: {
      x: round(enemy.position.x),
      y: round(enemy.position.y),
      z: round(enemy.position.z),
    },
    yaw: round(enemy.yaw, 3),
    hp: round(enemy.hp,2),
    maxHp: enemy.maxHp,
    alive: enemy.alive,
    respawnAt: enemy.respawnAt || null,
    targetId: enemy.targetId,
    pendingAttack: enemy.pendingAttack
      ? {
          type: enemy.pendingAttack.type,
          attack: enemy.pendingAttack.type,
          vfx: enemy.pendingAttack.vfx,
          kind: enemy.pendingAttack.kind,
          targetId: enemy.pendingAttack.targetId,
          origin: copyPosition(enemy.pendingAttack.origin),
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
    const regionEnemies = Object.entries(FAST_TRAVEL_REGIONS).flatMap(([regionId, region]) =>
      ENEMY_SPAWNS.map((spawn) => createEnemy(spawn, regionId, region.mapOrder)),
    );
    this.enemies = new Map(regionEnemies.map((enemy) => [enemy.id, enemy]));
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
    if (player.breakthrough.status !== "idle" && player.breakthrough.status !== "failed") {
      throw gameError("ACTION_BLOCKED", "Hãy dùng A/D để né thiên lôi trong màn độ kiếp.");
    }
    if (!isObject(payload) || !isObject(payload.position)) {
      throw gameError("INVALID_MOVE", "Dữ liệu di chuyển không hợp lệ.");
    }

    player.isFlying = false;
    const requested = clampPosition(payload.position, false);
    const elapsedSeconds = clamp((now - player.lastMoveAt) / 1_000, 0, 0.25);
    const baseSpeed = 7.2;
    // A capped token bucket tolerates small reconciliation corrections without
    // granting extra speed to clients that spam movement packets.
    player.movementCredit = Math.min(1, player.movementCredit + baseSpeed * elapsedSeconds);
    const maximumDistance = player.movementCredit;
    const accepted = moveTowards(player.position, requested, maximumDistance);
    const movedDistance = distance3(player.position, accepted);

    player.position = clampPosition(accepted, false);
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
    player.position = clampPosition(destination, false);
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
    let skill = null;
    let ability = ABILITIES.basic;
    if (key !== "basic") {
      const slot = key.toLowerCase();
      skill = player.skillSystem.skillForSlot(slot);
      if (!skill) throw gameError("SKILL_NOT_EQUIPPED", `Ô ${key} chưa được gán kỹ năng.`);
      if (payload.skillId && payload.skillId !== skill.id) throw gameError("SKILL_MISMATCH", "Kỹ năng client không khớp trạng thái máy chủ.");
      const legacyTargetMode = key === "G" ? "around-self"
        : key === "E" || (key === "F" && player.faction === "demonic") ? "area"
        : (skill.shield || skill.heal || skill.speed || skill.stealth) && !skill.damage ? "self"
        : "single";
      const targetMode = skill.targetMode ?? legacyTargetMode;
      ability = {
        key,
        label: skill.name,
        cooldownMs: Math.round(skill.cooldown * 1_000),
        mpCost: skill.manaCost,
        damage: Number(skill.damage) || 0,
        heal: Number(skill.heal) || 0,
        shield: Number(skill.shield) || 0,
        shieldMs: 5_000,
        range: Number.isFinite(Number(skill.range)) ? Number(skill.range) : key === "Q" ? 14 : key === "R" ? 11 : key === "F" ? 7 : 9,
        radius: Number.isFinite(Number(skill.radius)) ? Number(skill.radius) : key === "G" ? 13 : 4.3,
        targetMode,
        slowMs: Math.max(Number(skill.control) || 0, 0) * 1_000,
        controlMs: Math.max(Number(skill.control) || 0, 0) * 1_000,
        dotDamage: Math.max(Number(skill.dot) || 0, 0),
      };
    }

    const gear = equipmentStats(player.equipment,player.faction);
    ability = { ...ability, cooldownMs: Math.round(ability.cooldownMs * (1 - player.attackSpeed)) };

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
    // Equipment is server-authoritative. A client may request an attack, but it
    // cannot forge a weapon bonus in the ability payload.
    const weaponId = typeof player.equipment.weapon === "string" && player.equipment.weapon in WEAPON_ATTACK_BONUSES
      ? player.equipment.weapon
      : null;
    const equipmentAttack = Math.max(0, gear.attack);
    const attackDamage = key === "basic"
      ? player.totalAtk
      : Math.max(0, finiteNumber(ability.damage) + equipmentAttack);
    const combatAbility = { ...ability, damage: attackDamage };
    if (player.faction === "orthodox") combatAbility.range = ability.range * 1.25;
    if (player.faction === "demonic" && ability.targetMode === "area") combatAbility.radius = ability.radius * 1.35;
    if (player.faction === "heretic" && key !== "basic") combatAbility.slowMs = Math.max(ability.slowMs ?? 0, 3000);
    if (ability.targetMode === "self") {
      player.hp = Math.min(player.maxHp, player.hp + (ability.heal ?? 0));
      player.shield = Math.max(player.shield, ability.shield ?? 0);
      if (ability.shield) player.shieldUntil = now + (ability.shieldMs ?? 0);
      if (skill?.speed || skill?.stealth) {
        const direction = normalizeHorizontalDirection(payload.aim, player.yaw);
        player.position = clampPosition({
          x: player.position.x + direction.x * 3.2,
          y: player.position.y,
          z: player.position.z + direction.z * 3.2,
        }, player.isFlying);
        player.invulnerableUntil = Math.max(player.invulnerableUntil, now + Math.round((skill.stealth ?? 0.3) * 1_000));
      }
    } else {
      const targets = this.selectAbilityTargets(player, combatAbility, aim, payload.targetId);
      for (const enemy of targets) {
        const critical = player.critRate > 0 && this.random() < player.critRate;
        const resolvedDamage = attackDamage * (critical ? 1.6 : 1);
        let dealt = 0;
        if (player.faction === "orthodox" && (key === "basic" || ["sword_intent", "myriad_swords"].includes(skill?.id))) {
          for (let strike = 0; strike < 3; strike += 1) dealt += this.damageEnemy(enemy, resolvedDamage * 0.46, player, now + strike * 35, combatAbility);
        } else dealt = this.damageEnemy(enemy, player.faction === "heretic" ? resolvedDamage * 1.12 : resolvedDamage, player, now, combatAbility);
        if (combatAbility.dotDamage > 0 && enemy.alive) this.applyDamageOverTime(enemy,player,combatAbility.dotDamage,now);
        if (key === "basic" && player.lifeSteal > 0) player.hp = Math.min(player.maxHp,player.hp+dealt*player.lifeSteal);
        hitIds.push(enemy.id);
      }
    }

    this.pushEvent("ability:cast", {
      playerId: id,
      ability: key,
      skillId: skill?.id ?? "basic",
      aim,
      targetId: typeof payload.targetId === "string" ? payload.targetId : null,
      hitIds,
      faction: player.faction,
      weaponId,
      totalAtk: attackDamage,
      basicDamage: key === "basic" ? effectiveBasicDamage(attackDamage,player.faction) : undefined,
    }, now);
    return { ability: key, skillId: skill?.id ?? "basic", hitIds, player: serializePublicPlayer(player, now) };
  }

  updateSkill(id, payload = {}, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể điều chỉnh tâm pháp khi đã tử vong.");
    if (player.breakthrough.status !== "idle") throw gameError("ACTION_BLOCKED", "Không thể điều chỉnh tâm pháp trong lúc độ kiếp.");
    const action = String(payload.action ?? "");
    const skillId = typeof payload.skillId === "string" ? payload.skillId : "";
    const slot = typeof payload.slot === "string" ? payload.slot.toLowerCase() : "";
    let changed = false;
    let spentGold = 0;
    if (action === "unlock") {
      const skill = player.skillSystem.getSkill(skillId);
      if (!skill) throw gameError("INVALID_SKILL_ACTION", "Chiêu thức không tồn tại trên con đường tu hành này.");
      if (player.skillSystem.lastCultivationLevel < skill.requiredLevel) {
        throw gameError("SKILL_LEVEL_REQUIRED", `Cần đạt cấp ${skill.requiredLevel} mới có thể mở ${skill.name}.`);
      }
      const requiredRealm = CULTIVATION_REALMS.find(realm => realm.id === skill.requiredRealm) ?? realmForLevel(skill.requiredLevel);
      if (player.cultivationSystem.realm.order < requiredRealm.order) {
        throw gameError("SKILL_REALM_REQUIRED", `Cần đạt tu vi ${requiredRealm.name} mới có thể mở ${skill.name}.`);
      }
      if (!player.skillSystem.canUnlock(skillId)) throw gameError("INVALID_SKILL_ACTION", "Chiêu thức đã mở hoặc chưa đủ điều kiện tu vi.");
      spentGold = Math.max(0, Math.floor(Number(skill.unlockCost) || 0));
      if (player.gold < spentGold) throw gameError("NOT_ENOUGH_GOLD", `Cần ${spentGold} vàng để lĩnh ngộ ${skill.name}.`);
      changed = player.skillSystem.unlock(skillId);
      if (changed) player.gold -= spentGold;
    } else if (action === "upgrade") changed = player.skillSystem.upgrade(skillId);
    else if (action === "assign") changed = player.skillSystem.assign(slot, skillId);
    else if (action === "remove") changed = player.skillSystem.unassign(slot);
    if (!changed) throw gameError("INVALID_SKILL_ACTION", "Không thể thực hiện thay đổi kỹ năng này.");
    this.pushEvent("skill:updated", { playerId: id, action, skillId, slot, spentGold, gold: player.gold }, now);
    return { player: serializePublicPlayer(player, now), skillSystem: player.skillSystem.serialize(), shopSystem: this.economySnapshot(player) };
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
    const livingEnemies = [...this.enemies.values()].filter((enemy) => enemy.alive && enemy.regionId === player.currentRegion);
    const requestedTarget = typeof requestedTargetId === "string"
      ? livingEnemies.find((enemy) => enemy.id === requestedTargetId)
      : null;
    if (ability.targetMode === "around-self") {
      return livingEnemies.filter(
        (enemy) => horizontalDistance(player.position, enemy.position) <= ability.radius,
      );
    }

    if (ability.targetMode === "area") {
      const requestedDistance = requestedTarget ? horizontalDistance(player.position, requestedTarget.position) : Infinity;
      const center = requestedTarget && requestedDistance <= ability.range + ability.radius
        ? requestedTarget.position
        : pointFromAim(player.position, aim, ability.range * 0.72);
      return livingEnemies.filter(
        (enemy) =>
          horizontalDistance(player.position, enemy.position) <= ability.range + ability.radius &&
          horizontalDistance(center, enemy.position) <= ability.radius,
      );
    }

    // A deliberate target lock is authoritative as long as the enemy is in
    // range. It must not miss merely because mouse/facing packets arrived one
    // frame apart from the cast packet.
    if (requestedTarget && horizontalDistance(player.position, requestedTarget.position) <= ability.range) {
      return [requestedTarget];
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

  syncCultivationFields(player) {
    player.qi = player.cultivationSystem.currentExp;
    player.maxQi = player.cultivationSystem.requiredEXP;
    player.realm = { ...realmSnapshot(player.cultivationSystem) };
    player.skillSystem.applyCultivationLevel(player.cultivationSystem.level);
    refreshEquipmentStats(player);
    return player.cultivationSystem.serialize();
  }

  grantCultivationEXP(player, amount, source = "unknown") {
    const before = player.cultivationSystem.serialize();
    // The prototype's authored boss trial gates Trúc Cơ -> Kim Đan. EXP may
    // fill Trúc Cơ tầng 2, but only the authoritative tribulation crosses it.
    const difficulty = 1 + Math.max(0, player.cultivationSystem.level - 4) * 0.10;
    const adjustedAmount = Math.max(0, finiteNumber(amount)) / difficulty;
    const progressionCap = progressionCapForLevel(player.cultivationSystem.level);
    const result = player.cultivationSystem.addEXP(adjustedAmount, { maxLevel: progressionCap });
    const cultivationSystem = this.syncCultivationFields(player);
    return {
      ...result,
      source,
      before,
      cultivationSystem,
      awarded: result.gained,
      requested: Math.max(0, finiteNumber(amount)),
      difficulty,
    };
  }

  applyDamageOverTime(enemy, player, totalDamage, now = Date.now()) {
    const damage = Math.max(0, finiteNumber(totalDamage));
    if (!enemy?.alive || !player?.alive || damage <= 0) return false;
    enemy.dotEffects = enemy.dotEffects.filter(effect => effect.playerId !== player.id).slice(-7);
    enemy.dotEffects.push({ playerId: player.id, damagePerTick: damage / 3, ticksRemaining: 3, nextAt: now + 1_000 });
    this.pushEvent("enemy:afflicted", { enemyId: enemy.id, playerId: player.id, effect: "poison", durationMs: 3_000 }, now);
    return true;
  }

  damageEnemy(enemy, rawDamage, player, now = Date.now(), ability = {}) {
    if (!enemy?.alive || !player?.alive || !this.players.has(player.id)) return 0;
    // Overkill must not generate unlimited EXP. Only actual HP removed counts.
    const damage = Math.min(enemy.hp, clamp(finiteNumber(rawDamage), 0, 10_000));
    if (damage <= 0) return 0;
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.contributors.add(player.id);
    enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + MONSTER_BALANCE.hitStunMs);
    if (ability.slowMs) enemy.slowUntil = Math.max(enemy.slowUntil, now + ability.slowMs);
    if (ability.controlMs) enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + ability.controlMs);
    this.grantCultivationEXP(player, damage * 0.08, "combat-damage");
    this.pushEvent("enemy:damaged", {
      enemyId: enemy.id,
      playerId: player.id,
      damage: round(damage),
      hp: round(enemy.hp,2),
    }, now);
    if (enemy.hp <= 0) this.defeatEnemy(enemy, player, now);
    return damage;
  }

  defeatEnemy(enemy, killer, now = Date.now()) {
    enemy.alive = false;
    enemy.hp = 0;
    enemy.targetId = null;
    enemy.pendingAttack = null;
    enemy.dotEffects = [];
    enemy.respawnAt = now + enemy.respawnMs;

    const recipients = enemy.isBoss
      ? [...enemy.contributors].filter((id) => this.players.has(id))
      : [killer.id];
    if (recipients.length === 0 && this.players.has(killer.id)) recipients.push(killer.id);

    for (const playerId of new Set(recipients)) {
      const player = this.players.get(playerId);
      if (!player) continue;
      const granted = {};
      const overLevel = Math.max(0, player.cultivationSystem.level - enemy.combatLevel);
      const rewardFactor = 1 / (1 + overLevel * .24);
      for (const [resource, rawAmount] of Object.entries(enemy.reward)) {
        const amount = resource === "qi" || resource === "gold"
          ? Math.max(1, Math.round(rawAmount * rewardFactor))
          : rawAmount;
        if (resource === "qi") {
          const expResult = this.grantCultivationEXP(player, amount, "enemy-defeated");
          // Keep qi for older clients, while exp is the canonical reward field.
          // Both contain the full drop and never become zero because a legacy
          // meter happened to be full.
          granted.exp = round(expResult.awarded);
          granted.qi = granted.exp;
          granted.expResult = {
            levels: expResult.levels,
            breakthroughs: expResult.breakthroughs,
          };
        } else if (resource === "gold") {
          player.gold += amount;
          granted.gold = amount;
        } else if (Object.hasOwn(player.inventory, resource)) {
          player.inventory[resource] += amount;
          granted[resource] = amount;
        }
      }
      if (enemy.isBoss) {
        granted.bossEquipment = "thunder_guard_talisman";
        if (!player.shopInventory.includes(granted.bossEquipment)) player.shopInventory.push(granted.bossEquipment);
      }
      const upgradeDropChance = enemy.isBoss ? .08 : .025;
      if (this.random() < upgradeDropChance) {
        player.skillSystem.skillUpgradePoints += 1;
        granted.skillUpgradePoints = 1;
        granted.totalSkillUpgradePoints = player.skillSystem.skillUpgradePoints;
      }
      granted.totalGold = Math.floor(player.gold);
      granted.cultivationSystem = this.syncCultivationFields(player);
      granted.skillSystem = player.skillSystem.serialize();
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
    if (!["idle", "failed"].includes(player.breakthrough.status)) {
      throw gameError("BREAKTHROUGH_ACTIVE", "Đột phá đã bắt đầu.");
    }
    const gate = tribulationGateForLevel(player.cultivationSystem.level);
    if (!gate) throw gameError("REALM_REQUIRED", "Chỉ cần độ kiếp khi đột phá lên Nguyên Anh hoặc Hóa Thần.");
    if (player.qi < player.maxQi) {
      throw gameError("NOT_ENOUGH_QI", `Cần tích đủ ${player.maxQi} Chân Khí.`);
    }
    const profile = TRIBULATION_PROFILES[gate.targetRealmId];
    if (!profile) throw gameError("INVALID_TRIBULATION", "Thiên kiếp này chưa được cấu hình.");
    player.qi = 0;
    player.meditating = false;
    player.isFlying = false;
    player.hp = player.maxHp;
    player.breakthrough = {
      status: "active",
      wave: 0,
      hits: 0,
      maxHits: profile.maxHits,
      dodgeX: 0,
      moveDirection: 0,
      lastMoveAt: now,
      startedAt: now,
      nextAt: now + 700,
      telegraph: null,
      targetLevel: gate.toLevel,
      targetRealmId: gate.targetRealmId,
    };
    this.pushEvent("breakthrough:started", {
      playerId: id,
      waves: BREAKTHROUGH_WAVES,
      maxHits: profile.maxHits,
      targetRealmId: gate.targetRealmId,
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
    if (!player.alive) return;

    if (player.shield > 0 && now >= player.shieldUntil) player.shield = 0;
    player.mp = Math.min(player.maxMp, player.mp + deltaSeconds * (player.meditating ? 14 : 3.5));
    if (player.meditating) {
      player.hp = Math.min(player.maxHp, player.hp + deltaSeconds * 5);
      this.grantCultivationEXP(player, deltaSeconds * 8, "meditation");
    }
    this.tickBreakthrough(player, deltaSeconds, now);
  }

  updateBreakthroughMove(id, payload = {}, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (player.breakthrough.status !== "active") return serializeBreakthrough(player.breakthrough);
    player.breakthrough.moveDirection = clamp(finiteNumber(payload.direction), -1, 1);
    player.breakthrough.lastMoveAt = now;
    return serializeBreakthrough(player.breakthrough);
  }

  tickBreakthrough(player, deltaSeconds, now) {
    const state = player.breakthrough;
    if (state.status === "idle" || state.status === "failed") return;

    if (state.status === "resolving") {
      if (now >= state.nextAt) this.completeBreakthrough(player, now);
      return;
    }

    if (now - state.lastMoveAt > 180) state.moveDirection = 0;
    state.dodgeX = clamp(state.dodgeX + state.moveDirection * TRIBULATION_MOVE_SPEED * deltaSeconds, -1, 1);
    const profile = TRIBULATION_PROFILES[state.targetRealmId] ?? TRIBULATION_PROFILES.nascent_soul;

    if (!state.telegraph && state.wave < BREAKTHROUGH_WAVES && now >= state.nextAt) {
      state.wave += 1;
      const lanes=[-.84,-.56,-.28,0,.28,.56,.84];
      const durationMs=Math.max(600,profile.telegraphMs-(state.wave-1)*22);
      const maximumReach=TRIBULATION_MOVE_SPEED*(durationMs/1_000)*.82;
      const reachableSafeLanes=lanes.filter(lane=>Math.abs(lane-state.dodgeX)<=maximumReach);
      const safeX=reachableSafeLanes[Math.min(reachableSafeLanes.length-1,Math.floor(this.random()*reachableSafeLanes.length))]??0;
      const dangerLanes=lanes.filter(lane=>lane!==safeX);
      for(let index=dangerLanes.length-1;index>0;index-=1){const swapIndex=Math.floor(this.random()*(index+1));[dangerLanes[index],dangerLanes[swapIndex]]=[dangerLanes[swapIndex],dangerLanes[index]];}
      const strikeCount=Math.min(6,2+Math.floor((state.wave-1)/2));
      state.telegraph = {
        strikes: dangerLanes.slice(0,strikeCount).map(strikeX=>({strikeX,radius:profile.radius})),
        safeX,
        durationMs,
        resolveAt: now + durationMs,
      };
      this.pushEvent("breakthrough:telegraph", {
        playerId: player.id,
        wave: state.wave,
        hits: state.hits,
        maxHits: state.maxHits,
        targetRealmId: state.targetRealmId,
        intensity: profile.intensity,
        ...state.telegraph,
      }, now);
      return;
    }

    if (state.telegraph && now >= state.telegraph.resolveAt) {
      const telegraph = state.telegraph;
      const hitIndexes=telegraph.strikes.map((strike,index)=>Math.abs(state.dodgeX-strike.strikeX)<=strike.radius+TRIBULATION_PLAYER_RADIUS?index:-1).filter(index=>index>=0);
      const hit=hitIndexes.length>0;
      if (hit) state.hits += 1;
      this.pushEvent("breakthrough:strike", {
        playerId: player.id,
        wave: state.wave,
        strikes: telegraph.strikes.map(strike=>({...strike})),
        hitIndexes,
        hit,
        hits: state.hits,
        maxHits: state.maxHits,
        targetRealmId: state.targetRealmId,
        intensity: profile.intensity,
      }, now);
      state.telegraph = null;

      if (state.hits > state.maxHits) return this.failBreakthrough(player, "too-many-lightning-hits", now);
      if (state.wave >= BREAKTHROUGH_WAVES) {
        state.status = "resolving";
        state.nextAt = now + 550;
      } else {
        state.nextAt = now + profile.intervalMs;
      }
    }
  }

  completeBreakthrough(player, now) {
    const gate = tribulationGateForLevel(player.cultivationSystem.level);
    if (!gate) return this.failBreakthrough(player, "invalid-realm-gate", now);
    player.cultivationSystem.sync({ level: gate.toLevel, currentExp: 0, baseEXP: CULTIVATION_BASE_EXP, realmMultiplier: CULTIVATION_REALM_MULTIPLIER, version: 3 });
    refreshEquipmentStats(player);
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    this.syncCultivationFields(player);
    player.breakthrough = {
      status: "idle",
      wave: BREAKTHROUGH_WAVES,
      hits: player.breakthrough.hits,
      maxHits: player.breakthrough.maxHits,
      dodgeX: player.breakthrough.dodgeX,
      startedAt: 0,
      nextAt: 0,
      telegraph: null,
    };
    this.pushEvent("breakthrough:success", {
      playerId: player.id,
      realm: { ...player.realm },
      cultivationSystem: player.cultivationSystem.serialize(),
      skillSystem: player.skillSystem.serialize(),
      targetRealmId: gate.targetRealmId,
    }, now);
  }

  failBreakthrough(player, reason, now) {
    if (player.breakthrough.status === "idle" || player.breakthrough.status === "failed") return;
    const previous = player.breakthrough;
    const profile = TRIBULATION_PROFILES[previous.targetRealmId] ?? TRIBULATION_PROFILES.nascent_soul;
    player.cultivationSystem.sync({ level: profile.fallbackLevel, currentExp: 0, baseEXP: CULTIVATION_BASE_EXP, realmMultiplier: CULTIVATION_REALM_MULTIPLIER, version: 3 });
    this.syncCultivationFields(player);
    player.breakthrough = {
      status: "failed",
      wave: previous.wave,
      hits: previous.hits,
      maxHits: previous.maxHits,
      dodgeX: previous.dodgeX,
      targetRealmId: previous.targetRealmId,
      startedAt: previous.startedAt,
      nextAt: 0,
      telegraph: null,
    };
    this.pushEvent("breakthrough:failed", {
      playerId: player.id,
      reason,
      wave: previous.wave,
      hits: previous.hits,
      targetRealmId: previous.targetRealmId,
      fallbackLevel: profile.fallbackLevel,
      cultivationSystem: player.cultivationSystem.serialize(),
      skillSystem: player.skillSystem.serialize(),
    }, now);
  }

  tickEnemy(enemy, deltaSeconds, now) {
    const template = ENEMY_TEMPLATES[enemy.type];
    if (!enemy.alive) {
      if (now >= enemy.respawnAt) this.respawnEnemy(enemy, now);
      return;
    }
    for (const effect of [...enemy.dotEffects]) {
      while (enemy.alive && effect.ticksRemaining > 0 && now >= effect.nextAt) {
        const owner = this.players.get(effect.playerId);
        if (!owner) { effect.ticksRemaining = 0; break; }
        this.damageEnemy(enemy, effect.damagePerTick, owner, effect.nextAt, { key: "poison-dot" });
        effect.ticksRemaining -= 1;
        effect.nextAt += 1_000;
      }
    }
    enemy.dotEffects = enemy.dotEffects.filter(effect => effect.ticksRemaining > 0);
    if (!enemy.alive) return;
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
        enemy.position = moveTowards(enemy.position, enemy.spawn, enemy.speed * deltaSeconds);
      }
      return;
    }

    const distance = horizontalDistance(enemy.position, target.position);
    const dx = target.position.x - enemy.position.x;
    const dz = target.position.z - enemy.position.z;
    enemy.yaw = Math.atan2(dx, dz);
    const effectiveSpeed = enemy.speed * (enemy.slowUntil > now ? 0.52 : 1);
    if (distance > enemy.attackRange * 0.9) {
      const destination = { x: target.position.x, y: 0, z: target.position.z };
      enemy.position = clampPosition(
        moveTowards(enemy.position, destination, effectiveSpeed * deltaSeconds),
        false,
      );
    }

    if (distance <= enemy.attackRange && now >= enemy.nextAttackAt) {
      if (enemy.isBoss) {
        this.telegraphBossAttack(enemy, target, now);
      } else {
        this.telegraphEnemyAttack(enemy,target,now);
      }
    }
  }

  isEnemyTargetValid(enemy, target, template) {
    return Boolean(
      target &&
        target.alive &&
        target.currentRegion === enemy.regionId &&
        !isInSafeZone(target.position) &&
        target.breakthrough.status === "idle" &&
        horizontalDistance(enemy.spawn, target.position) <= enemy.aggroRange * 1.55,
    );
  }

  findEnemyTarget(enemy, template) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const player of this.players.values()) {
      if (!player.alive || player.currentRegion !== enemy.regionId || isInSafeZone(player.position) || player.breakthrough.status !== "idle") continue;
      const distance = horizontalDistance(enemy.position, player.position);
      if (distance <= enemy.aggroRange && distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  telegraphEnemyAttack(enemy,target,now){
    const profile=monsterAttackFor(enemy.type);
    const attack={type:profile.type,vfx:profile.vfx,kind:profile.kind,targetId:target.id,origin:copyPosition(enemy.position),position:{...copyPosition(target.position),y:0},radius:profile.radius,damage:enemy.damage,resolveAt:now+profile.windupMs};
    enemy.pendingAttack=attack;
    enemy.nextAttackAt=attack.resolveAt+enemy.attackCooldownMs;
    this.pushEvent("enemy:telegraph",{enemyId:enemy.id,targetId:target.id,attack:attack.type,vfx:attack.vfx,kind:attack.kind,origin:copyPosition(attack.origin),position:copyPosition(attack.position),radius:attack.radius,resolveAt:attack.resolveAt},now);
  }

  telegraphBossAttack(enemy, target, now) {
    enemy.attackCount += 1;
    const isNova = enemy.attackCount % 3 === 0;
    const attack = {
      type: isNova ? "thunder-nova" : "falling-blade",
      vfx: isNova ? "shockwave" : "blade-impact",
      kind: "boss",
      targetId: target.id,
      origin: copyPosition(enemy.position),
      position: isNova ? copyPosition(enemy.position) : { ...copyPosition(target.position), y: 0 },
      radius: isNova ? 5.4 : 3.1,
      damage: balanced(isNova ? 25 : 19, enemy.powerScale),
      resolveAt: now + (isNova ? 1_100 : 850),
    };
    enemy.pendingAttack = attack;
    enemy.nextAttackAt = attack.resolveAt + enemy.attackCooldownMs;
    this.pushEvent("enemy:telegraph", {
      enemyId: enemy.id,
      targetId: target.id,
      attack: attack.type,
      vfx: attack.vfx,
      kind: attack.kind,
      origin: copyPosition(attack.origin),
      position: copyPosition(attack.position),
      radius: attack.radius,
      resolveAt: attack.resolveAt,
    }, now);
  }

  resolveEnemyAttack(enemy, now) {
    const attack = enemy.pendingAttack;
    if (!attack) return;
    if(now<attack.resolveAt)return;
    const hitIds = [];
    for (const player of this.players.values()) {
      if (!player.alive || isInSafeZone(player.position)) continue;
      if (horizontalDistance(player.position, attack.position) <= attack.radius) {
        const dealt = this.damagePlayer(player, attack.damage, { kind: attack.kind, id: enemy.id }, now);
        if (dealt > 0) hitIds.push(player.id);
      }
    }
    this.pushEvent("enemy:attack", {
      enemyId: enemy.id,
      targetId: attack.targetId,
      attack: attack.type,
      vfx: attack.vfx,
      kind: attack.kind,
      origin: copyPosition(attack.origin),
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
    const defense = player.defense;
    if (defense > 0) damage *= 100 / (100 + defense);
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
      hp: round(player.hp,2),
    }, now);
    if (player.hp <= 0) {
      player.alive = false;
      player.isFlying = false;
      player.respawnAt = 0;
      const expPenalty = player.cultivationSystem.applyDeathPenalty(0.1);
      this.syncCultivationFields(player);
      this.failBreakthrough(player, "tribulation-defeat", now);
      this.pushEvent("player:defeated", {
        playerId: player.id,
        source,
        respawnAt: player.respawnAt,
        expPenalty,
        cultivationSystem: player.cultivationSystem.serialize(),
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
        hits: 0,
        maxHits: 0,
        dodgeX: 0,
        startedAt: 0,
        nextAt: 0,
        telegraph: null,
      };
    }
    this.pushEvent("player:respawned", { playerId: player.id, position: copyPosition(spawn) }, now);
    return serializePublicPlayer(player, now);
  }

  requestRespawn(id, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (player.alive) return serializePublicPlayer(player, now);
    return this.respawnPlayer(player, now);
  }

  respawnEnemy(enemy, now) {
    enemy.position = copyPosition(enemy.spawn);
    applyEnemyWave(enemy, (enemy.defeats ?? 0) + 1);
    enemy.alive = true;
    enemy.respawnAt = 0;
    enemy.targetId = null;
    enemy.nextAttackAt = now + 800;
    enemy.pendingAttack = null;
    enemy.attackCount = 0;
    enemy.slowUntil = 0;
    enemy.stunnedUntil = 0;
    enemy.dotEffects = [];
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
    const belowRequiredRealm = player.realm.order < region.requiredOrder;
    const belowRequiredStage = player.realm.order === region.requiredOrder
      && player.cultivationSystem.subStage < region.requiredStage;
    if (belowRequiredRealm || belowRequiredStage) throw gameError('REALM_REQUIRED', 'Cảnh giới hoặc cấp tu luyện chưa đủ để đến khu vực này.');
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

  economySnapshot(player) {
    return { gold: Math.floor(player.gold), inventory: [...player.shopInventory], equipment: { ...player.equipment } };
  }

  buyItem(id, itemId, now = Date.now()) {
    const player = this.requirePlayer(id), item = SHOP_CATALOG[itemId];
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể giao dịch khi đã tử vong.");
    if (!item || item.bossDrop) throw gameError("UNKNOWN_ITEM", "Vật phẩm không tồn tại trong cửa hàng.");
    if (item.faction && item.faction !== player.faction) throw gameError("FACTION_REQUIRED", "Trang bị này thuộc con đường tu hành khác.");
    if (player.cultivationSystem.realm.order < item.requiredOrder) throw gameError("REALM_REQUIRED", "Cảnh giới chưa đủ để mua vật phẩm.");
    if (player.gold < item.price) throw gameError("NOT_ENOUGH_GOLD", "Không đủ vàng.");
    if (item.category !== "consumables" && player.shopInventory.includes(itemId)) throw gameError("ALREADY_OWNED", "Đã sở hữu vật phẩm này.");
    player.gold -= item.price;
    player.shopInventory.push(itemId);
    if (item.category === "weapons" && !player.equipment.weapon) { player.equipment.weapon = itemId; refreshEquipmentStats(player); }
    this.pushEvent("shop:updated", { playerId: id, action: "buy", itemId, gold: player.gold }, now);
    return { player: serializePublicPlayer(player, now), shopSystem: this.economySnapshot(player) };
  }

  sellItem(id, itemId, now = Date.now()) {
    const player = this.requirePlayer(id), item = SHOP_CATALOG[itemId], index = player.shopInventory.indexOf(itemId);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể giao dịch khi đã tử vong.");
    if (!item || index < 0) throw gameError("ITEM_NOT_OWNED", "Không sở hữu vật phẩm này.");
    player.shopInventory.splice(index, 1);
    player.gold += Math.floor(item.price * 0.55);
    for (const slot of Object.keys(player.equipment)) if (player.equipment[slot] === itemId) player.equipment[slot] = null;
    refreshEquipmentStats(player);
    this.pushEvent("shop:updated", { playerId: id, action: "sell", itemId, gold: player.gold }, now);
    return { player: serializePublicPlayer(player, now), shopSystem: this.economySnapshot(player) };
  }

  equipItem(id, itemId, now = Date.now()) {
    const player = this.requirePlayer(id), item = SHOP_CATALOG[itemId];
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể thay trang bị khi đã tử vong.");
    if (!item || !player.shopInventory.includes(itemId)) throw gameError("ITEM_NOT_OWNED", "Không sở hữu vật phẩm này.");
    if (item.faction && item.faction !== player.faction) throw gameError("FACTION_REQUIRED", "Trang bị này không phù hợp con đường tu hành hiện tại.");
    const slot = item.category === "weapons" ? "weapon" : item.category === "armor" ? "armor" : item.category === "accessory" ? "accessory" : null;
    if (!slot) throw gameError("ITEM_NOT_EQUIPPABLE", "Vật phẩm này không thể trang bị.");
    player.equipment[slot] = itemId;
    refreshEquipmentStats(player);
    this.pushEvent("shop:updated", { playerId: id, action: "equip", itemId, gold: player.gold }, now);
    return { player: serializePublicPlayer(player, now), shopSystem: this.economySnapshot(player) };
  }

  unequipItem(id, itemId, now = Date.now()) {
    const player = this.requirePlayer(id);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể tháo trang bị khi đã tử vong.");
    const slot = Object.keys(player.equipment).find((key) => player.equipment[key] === itemId);
    if (!slot) throw gameError("ITEM_NOT_EQUIPPED", "Vật phẩm này chưa được trang bị.");
    player.equipment[slot] = null;
    refreshEquipmentStats(player);
    this.pushEvent("shop:updated", { playerId: id, action: "unequip", itemId, gold: player.gold }, now);
    return { player: serializePublicPlayer(player, now), shopSystem: this.economySnapshot(player) };
  }

  useItem(id, itemId, now = Date.now()) {
    const player = this.requirePlayer(id), item = SHOP_CATALOG[itemId], index = player.shopInventory.indexOf(itemId);
    if (!player.alive) throw gameError("PLAYER_DEAD", "Không thể dùng vật phẩm khi đã tử vong.");
    if (!item || item.category !== "consumables" || index < 0) throw gameError("ITEM_NOT_USABLE", "Không thể sử dụng vật phẩm này.");
    const hpBefore = player.hp, mpBefore = player.mp;
    if (item.healAmount) player.hp = Math.min(player.maxHp, player.hp + item.healAmount);
    if (item.manaAmount) player.mp = Math.min(player.maxMp, player.mp + item.manaAmount);
    if (player.hp === hpBefore && player.mp === mpBefore) throw gameError("NO_ITEM_EFFECT", "Khí huyết và linh lực đã đầy.");
    player.shopInventory.splice(index, 1);
    this.pushEvent("item:used", { playerId: id, itemId, hp: player.hp, mp: player.mp }, now);
    return { player: serializePublicPlayer(player, now), shopSystem: this.economySnapshot(player) };
  }

  snapshot(now = Date.now(), regionId = null) {
    const enemies = regionId
      ? [...this.enemies.values()].filter((enemy) => enemy.regionId === regionId)
      : [...this.enemies.values()];
    return {
      roomCode: this.code,
      serverTime: now,
      maxPlayers: this.maxPlayers,
      bounds: WORLD_BOUNDS,
      safeZone: SAFE_ZONE,
      breakthroughAltar: BREAKTHROUGH_ALTAR,
      players: [...this.players.values()].map((player) => serializePublicPlayer(player, now)),
      enemies: enemies.map(serializeEnemy),
    };
  }

  snapshotForPlayer(id, now = Date.now()) {
    const player = this.requirePlayer(id);
    return this.snapshot(now, player.currentRegion);
  }

  privatePlayerSnapshot(id, now = Date.now()) {
    const player = this.requirePlayer(id);
    return {
      ...serializePublicPlayer(player, now),
      inventory: { ...player.inventory },
      shopSystem: {
        gold: Math.floor(player.gold),
        inventory: [...player.shopInventory],
        equipment: { ...player.equipment },
      },
      skillSystem: player.skillSystem.serialize(),
      resources: { ...player.inventory },
    };
  }

  exportPlayerSession(id) {
    const player = this.requirePlayer(id);
    return {
      gold: player.gold,
      inventory: [...player.shopInventory],
      equipment: { ...player.equipment },
      cultivationSystem: player.cultivationSystem.serialize(),
      skillSystem: player.skillSystem.serialize(),
      currentRegion: player.currentRegion,
      position: copyPosition(player.position),
      hp: player.hp,
      mp: player.mp,
      alive: player.alive,
      flightUnlocked: player.flightUnlocked,
      resources: { ...player.inventory },
      breakthrough: serializeBreakthrough(player.breakthrough),
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
    this.allowClientSession = Boolean(options.allowClientSession);
    this.onSessionChange = typeof options.onSessionChange === "function" ? options.onSessionChange : () => {};
    this.rooms = new Map();
    this.playerRooms = new Map();
    this.tokenPlayers = new Map();
    this.sessions = new Map(Object.entries(isObject(options.sessions) ? options.sessions : {}).map(([token,entry])=>[
      token,
      { state: isObject(entry?.state) ? entry.state : entry, savedAt: Math.max(0,finiteNumber(entry?.savedAt,Date.now())) },
    ]));
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
    const resumeToken = sanitizeResumeToken(identity.resumeToken);
    const activePlayerId = resumeToken ? this.tokenPlayers.get(resumeToken) : null;
    if (activePlayerId && activePlayerId !== playerId) throw gameError("SESSION_IN_USE", "Nhân vật này đang hoạt động ở một kết nối khác.");
    const cached = resumeToken ? this.sessions.get(resumeToken)?.state : null;
    const authoritativeIdentity = {
      ...identity,
      session: cached ?? (this.allowClientSession ? identity.session : { gold: 100 }),
    };
    const player = destination.addPlayer(playerId, authoritativeIdentity, now);
    player.resumeToken = resumeToken;
    if (resumeToken) this.tokenPlayers.set(resumeToken, playerId);
    this.playerRooms.set(playerId, code);
    return { room: destination, player };
  }

  leaveRoom(playerId, expectedCode, now = Date.now()) {
    const code = this.playerRooms.get(playerId);
    if (!code || (expectedCode && code !== expectedCode)) return false;
    const room = this.rooms.get(code);
    const player = room?.players.get(playerId);
    if (player?.resumeToken) {
      this.sessions.set(player.resumeToken, { state: room.exportPlayerSession(playerId), savedAt: now });
      this.onSessionChange();
      this.tokenPlayers.delete(player.resumeToken);
    }
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

  checkpointSessions(now = Date.now()) {
    for (const room of this.rooms.values()) for (const player of room.players.values()) {
      if (player.resumeToken) this.sessions.set(player.resumeToken, { state: room.exportPlayerSession(player.id), savedAt: now });
    }
    this.onSessionChange();
  }

  serializeSessions() { return Object.fromEntries(this.sessions); }

  pruneEmptyRooms(now = Date.now(), ttlMs = EMPTY_ROOM_TTL_MS) {
    for (const [code, room] of this.rooms) {
      if (room.players.size === 0 && room.emptySince !== null && now - room.emptySince >= ttlMs) {
        this.rooms.delete(code);
      }
    }
    const sessionTtlMs = 24 * 60 * 60 * 1_000;
    let changed=false;for (const [token, session] of this.sessions) if (now - session.savedAt >= sessionTtlMs){this.sessions.delete(token);changed=true;}if(changed)this.onSessionChange();
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += room.players.size;
    return { rooms: this.rooms.size, players };
  }
}
