export const CULTIVATION_BASE_EXP = 100;
export const CULTIVATION_REALM_MULTIPLIER = 1.5;

export const REALM_HIERARCHY = Object.freeze([
  Object.freeze({ id: 'qi_refining', name: 'Luyện Khí', order: 0, startLevel: 1, endLevel: 2, stages: 2 }),
  Object.freeze({ id: 'foundation', name: 'Trúc Cơ', order: 1, startLevel: 3, endLevel: 4, stages: 2 }),
  Object.freeze({ id: 'golden_core', name: 'Kim Đan', order: 2, startLevel: 5, endLevel: 6, stages: 2 }),
  Object.freeze({ id: 'nascent_soul', name: 'Nguyên Anh', order: 3, startLevel: 7, endLevel: 10, stages: 4 }),
  Object.freeze({ id: 'spirit_transformation', name: 'Hóa Thần', order: 4, startLevel: 11, endLevel: 16, stages: 6 }),
]);

export const MIN_CULTIVATION_LEVEL = 1;
export const MAX_CULTIVATION_LEVEL = 16;
const EXP_EPSILON = 1e-7;
const PRECISION = 1e6;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const stable = value => Math.round((finite(value) + Number.EPSILON) * PRECISION) / PRECISION;

export function realmForLevel(level) {
  const safeLevel = clamp(Math.trunc(finite(level, 1)), MIN_CULTIVATION_LEVEL, MAX_CULTIVATION_LEVEL);
  return REALM_HIERARCHY.find(realm => safeLevel >= realm.startLevel && safeLevel <= realm.endLevel) ?? REALM_HIERARCHY[0];
}

export function globalLevelForRealm(realmId, subStage = 1) {
  const realm = REALM_HIERARCHY.find(entry => entry.id === realmId) ?? REALM_HIERARCHY[0];
  return clamp(realm.startLevel + Math.trunc(finite(subStage, 1)) - 1, realm.startLevel, realm.endLevel);
}

export function requiredEXP(level, baseEXP = CULTIVATION_BASE_EXP, realmMultiplier = CULTIVATION_REALM_MULTIPLIER) {
  const safeLevel = clamp(Math.trunc(finite(level, 1)), MIN_CULTIVATION_LEVEL, MAX_CULTIVATION_LEVEL);
  const safeBase = Math.max(1, finite(baseEXP, CULTIVATION_BASE_EXP));
  const safeMultiplier = Math.max(1.01, finite(realmMultiplier, CULTIVATION_REALM_MULTIPLIER));
  return Math.max(1, Math.round(safeBase * Math.pow(safeMultiplier, safeLevel)));
}

export class CultivationSystem {
  constructor(state = {}, options = {}) {
    this.baseEXP = Math.max(1, finite(options.baseEXP ?? state.baseEXP, CULTIVATION_BASE_EXP));
    this.realmMultiplier = Math.max(1.01, finite(options.realmMultiplier ?? state.realmMultiplier, CULTIVATION_REALM_MULTIPLIER));
    this.level = this.resolveLevel(state);
    const legacyPercent = finite(state.cultivationProgress ?? state.progress, 0);
    const migratedExp = state.currentExp ?? state.exp ?? this.requiredEXP * clamp(legacyPercent, 0, 100) / 100;
    this.currentExp = stable(clamp(finite(migratedExp), 0, this.requiredEXP));
  }

  resolveLevel(state) {
    if (Number.isFinite(Number(state.level))) {
      return clamp(Math.trunc(Number(state.level)), MIN_CULTIVATION_LEVEL, MAX_CULTIVATION_LEVEL);
    }
    return globalLevelForRealm(state.realmId ?? state.realm, state.subStage ?? state.minorLevel ?? 1);
  }

  get realm() { return realmForLevel(this.level); }
  get realmId() { return this.realm.id; }
  get subStage() { return this.level - this.realm.startLevel + 1; }
  get requiredEXP() { return requiredEXP(this.level, this.baseEXP, this.realmMultiplier); }
  get isMaxLevel() { return this.level >= MAX_CULTIVATION_LEVEL; }
  get progress() {
    const ratio = this.requiredEXP > 0 ? this.currentExp / this.requiredEXP : 0;
    return stable(clamp(ratio * 100, 0, 100));
  }
  get displayName() { return `${this.realm.name} Tầng ${this.subStage}`; }

  addEXP(amount) {
    const gained = Math.max(0, finite(amount));
    if (gained <= 0) return { gained: 0, levels: 0, subStageUps: 0, majorRealmBreakthroughs: 0, breakthroughs: [], maxed: this.isMaxLevel };

    this.currentExp = stable(this.currentExp + gained);
    let levels = 0;
    let subStageUps = 0;
    const breakthroughs = [];
    // A bounded loop makes progression deterministic even after a large offline grant.
    while (!this.isMaxLevel && this.currentExp + EXP_EPSILON >= this.requiredEXP) {
      const previousRealm = this.realmId;
      this.currentExp = stable(Math.max(0, this.currentExp - this.requiredEXP));
      this.level += 1;
      levels += 1;
      if (this.realmId !== previousRealm) breakthroughs.push({ from: previousRealm, to: this.realmId, level: this.level });
      else subStageUps += 1;
    }
    if (this.isMaxLevel) this.currentExp = stable(Math.min(this.currentExp, this.requiredEXP));
    return { gained, levels, subStageUps, majorRealmBreakthroughs: breakthroughs.length, breakthroughs, maxed: this.isMaxLevel && this.progress >= 100 };
  }

  // Compatibility with older callers while keeping EXP as the source of truth.
  gainCultivation(amount) { return this.addEXP(amount); }

  applyDeathPenalty(rate = 0.1) {
    const safeRate = clamp(finite(rate, 0.1), 0, 1);
    const penalty = stable(this.requiredEXP * safeRate);
    const before = this.currentExp;
    this.currentExp = stable(Math.max(0, this.currentExp - penalty));
    return { requested: penalty, deducted: stable(before - this.currentExp), currentExp: this.currentExp, requiredEXP: this.requiredEXP };
  }

  sync(state = {}) {
    const next = new CultivationSystem(state, { baseEXP: state.baseEXP ?? this.baseEXP, realmMultiplier: state.realmMultiplier ?? this.realmMultiplier });
    this.baseEXP = next.baseEXP;
    this.realmMultiplier = next.realmMultiplier;
    this.level = next.level;
    this.currentExp = next.currentExp;
    return this.serialize();
  }

  serialize() {
    return {
      version: 2,
      level: this.level,
      currentExp: this.currentExp,
      requiredEXP: this.requiredEXP,
      progress: this.progress,
      realmId: this.realmId,
      subStage: this.subStage,
      baseEXP: this.baseEXP,
      realmMultiplier: this.realmMultiplier,
    };
  }
}
