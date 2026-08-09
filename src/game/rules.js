import {
  DEFAULT_PROFILE,
  FACTIONS,
  PROFILE_VERSION,
  PROTOTYPE_SCOPE,
  QUEST_PHASES,
  REALMS,
} from "./data.js";

const MAX_NAME_LENGTH = 18;
const MAX_ROOM_CODE_LENGTH = 24;
const QUEST_PHASE_IDS = new Set(QUEST_PHASES.map((phase) => phase.id));
const REALM_IDS = new Set(REALMS.map((realm) => realm.id));

function toText(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/**
 * Keeps Vietnamese letters, numbers, spaces, underscores and hyphens while
 * removing control/punctuation characters that should not enter a player name.
 */
export function sanitizeName(value, maxLength = MAX_NAME_LENGTH) {
  const safeLength = Math.max(1, Math.floor(Number(maxLength) || MAX_NAME_LENGTH));

  return toText(value)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, safeLength)
    .trim();
}

/** Normalizes the displayed Tục Danh while preserving Vietnamese text. */
export function normalizeRoomCode(value, maxLength = MAX_ROOM_CODE_LENGTH) {
  const safeLength = Math.max(
    1,
    Math.floor(Number(maxLength) || MAX_ROOM_CODE_LENGTH),
  );

  return toText(value)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, safeLength)
    .trim();
}

export function clamp(value, min, max) {
  const lower = Number(min);
  const upper = Number(max);

  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    throw new RangeError("clamp requires finite bounds where min <= max");
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return lower;
  return Math.min(upper, Math.max(lower, numeric));
}

/** Returns a value in the inclusive range 0–100. */
export function cultivationPercent(current, required) {
  const target = Number(required);
  if (!Number.isFinite(target) || target <= 0) return 0;

  const progress = Number(current);
  if (!Number.isFinite(progress)) return progress === Infinity ? 100 : 0;
  return clamp((progress / target) * 100, 0, 100);
}

/**
 * The vertical slice deliberately permits only the Trúc Cơ → Kim Đan gate.
 * Callers may pass cultivationRequired to tune a session without changing data.
 */
export function canStartBreakthrough(state, cultivationRequired) {
  if (!state || typeof state !== "object") return false;

  const required = Number(
    cultivationRequired ??
      state.cultivationRequired ??
      PROTOTYPE_SCOPE.requiredCultivation,
  );
  const cultivation = Number(state.cultivation ?? 0);
  const isActive =
    state.breakthroughActive === true || state.breakthrough?.active === true;
  const isAlive = !Number.isFinite(Number(state.hp)) || Number(state.hp) > 0;

  return (
    state.realmId === PROTOTYPE_SCOPE.startRealmId &&
    Number.isFinite(required) &&
    required > 0 &&
    Number.isFinite(cultivation) &&
    cultivation >= required &&
    !isActive &&
    isAlive
  );
}

/**
 * Applies the one successful realm transition available in the prototype.
 * The supplied object and all of its nested objects remain untouched.
 */
export function applyRealmSuccess(state) {
  if (!state || typeof state !== "object") return state;
  if (state.realmId !== PROTOTYPE_SCOPE.startRealmId) return { ...state };

  const nextBreakthrough =
    state.breakthrough && typeof state.breakthrough === "object"
      ? { ...state.breakthrough, active: false, status: "success" }
      : undefined;

  const result = {
    ...state,
    realmId: PROTOTYPE_SCOPE.breakthroughTargetId,
    cultivation: 0,
    questPhase: "complete",
    breakthroughActive: false,
    lightningWave: PROTOTYPE_SCOPE.lightningWaves,
  };

  if (nextBreakthrough) result.breakthrough = nextBreakthrough;
  return result;
}

function integerProgress(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

/** Produces the Vietnamese HUD objective for the current quest state. */
export function objectiveForState(state = {}) {
  const phase = state.questPhase ?? state.quest?.phase ?? "arrival";

  if (
    state.realmId === PROTOTYPE_SCOPE.breakthroughTargetId ||
    phase === "complete"
  ) {
    return "Kim Đan sơ thành — đã hoàn thành bản chơi thử.";
  }

  switch (phase) {
    case "arrival":
      return "Tiến vào sân điện và làm quen với điều khiển.";
    case "purge": {
      const defeated = integerProgress(
        state.enemiesDefeated ?? state.quest?.enemiesDefeated,
      );
      const required = Math.max(
        1,
        integerProgress(
          state.enemiesRequired ?? state.quest?.enemiesRequired,
          3,
        ),
      );
      return `Thanh trừ ma ảnh (${Math.min(defeated, required)}/${required}).`;
    }
    case "boss":
      return "Đánh bại Ma Ảnh Hộ Pháp trong sân điện.";
    case "cultivate": {
      const current = Math.floor(
        clamp(Number(state.cultivation) || 0, 0, Number.MAX_SAFE_INTEGER),
      );
      const required = Math.max(
        1,
        integerProgress(
          state.cultivationRequired,
          PROTOTYPE_SCOPE.requiredCultivation,
        ),
      );
      return `Tĩnh tọa và tích tụ tu vi (${Math.min(current, required)}/${required}).`;
    }
    case "breakthrough": {
      const wave = Math.min(
        integerProgress(state.lightningWave),
        PROTOTYPE_SCOPE.lightningWaves,
      );
      return `Sống sót qua Tiểu Lôi Kiếp (${wave}/${PROTOTYPE_SCOPE.lightningWaves} đợt).`;
    }
    default: {
      const configuredPhase = QUEST_PHASES.find((entry) => entry.id === phase);
      return configuredPhase?.objective ?? QUEST_PHASES[0].objective;
    }
  }
}

function numberWithin(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, min, max) : fallback;
}

/**
 * Produces a versioned, JSON-safe profile. Only persistent fields are accepted;
 * network/session objects are intentionally excluded.
 */
export function normalizeProfile(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  const name = sanitizeName(source.name) || DEFAULT_PROFILE.name;
  const factionId = Object.hasOwn(FACTIONS, source.factionId)
    ? source.factionId
    : DEFAULT_PROFILE.factionId;
  const realmId = REALM_IDS.has(source.realmId)
    ? source.realmId
    : DEFAULT_PROFILE.realmId;
  const questPhase = QUEST_PHASE_IDS.has(source.questPhase)
    ? source.questPhase
    : DEFAULT_PROFILE.questPhase;
  const settings =
    source.settings && typeof source.settings === "object" ? source.settings : {};

  return {
    version: PROFILE_VERSION,
    name,
    factionId,
    realmId,
    cultivation: Math.floor(
      numberWithin(source.cultivation, 0, 0, Number.MAX_SAFE_INTEGER),
    ),
    questPhase,
    breakthroughActive: source.breakthroughActive === true,
    lightningWave: Math.floor(
      numberWithin(
        source.lightningWave,
        0,
        0,
        PROTOTYPE_SCOPE.lightningWaves,
      ),
    ),
    skillSystem: source.skillSystem && typeof source.skillSystem === "object"
      ? JSON.parse(JSON.stringify(source.skillSystem))
      : undefined,
    shopSystem: source.shopSystem && typeof source.shopSystem === "object"
      ? JSON.parse(JSON.stringify(source.shopSystem))
      : undefined,
    currentRegion: ["sect_hall", "luoyang", "spirit_mine", "heaven_sect"].includes(source.currentRegion)
      ? source.currentRegion
      : "sect_hall",
    settings: {
      masterVolume: numberWithin(
        settings.masterVolume,
        DEFAULT_PROFILE.settings.masterVolume,
        0,
        1,
      ),
      effectsVolume: numberWithin(
        settings.effectsVolume,
        DEFAULT_PROFILE.settings.effectsVolume,
        0,
        1,
      ),
      mouseSensitivity: numberWithin(
        settings.mouseSensitivity,
        DEFAULT_PROFILE.settings.mouseSensitivity,
        0.1,
        3,
      ),
    },
  };
}

export function serializeProfile(profile) {
  return JSON.stringify(normalizeProfile(profile));
}

export function deserializeProfile(serialized) {
  if (serialized && typeof serialized === "object") {
    return normalizeProfile(serialized);
  }

  if (typeof serialized !== "string" || serialized.trim() === "") {
    return normalizeProfile(DEFAULT_PROFILE);
  }

  try {
    return normalizeProfile(JSON.parse(serialized));
  } catch {
    return normalizeProfile(DEFAULT_PROFILE);
  }
}

// Semantic aliases for adapters that provide their own disk, database or
// localStorage boundary. These functions themselves perform no I/O.
export function saveProfile(profile) {
  return serializeProfile(profile);
}

export function loadProfile(serialized) {
  return deserializeProfile(serialized);
}
