const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Character {
  constructor(profile = {}, motion = {}) {
    this.profile = profile;
    this.profile.maxHp = Math.max(1, finite(profile.maxHp, 120));
    this.profile.hp = clamp(finite(profile.hp, this.profile.maxHp), 0, this.profile.maxHp);
    this.profile.baseAtk = Math.max(0, finite(profile.baseAtk, 18));
    this.profile.totalAtk = Math.max(this.profile.baseAtk, finite(profile.totalAtk, this.profile.baseAtk));
    this.weapon = null;
    this.position = motion.position ?? { x: 0, y: 0, z: 26 };
    this.velocity = motion.velocity ?? { x: 0, z: 0 };
    this.facing = finite(motion.facing, 4);
    this.aimAngle = finite(motion.aimAngle, 0);
    this.action = motion.action ?? 'idle';
    this.actionTime = 0;
    this.hurtFlashUntil = 0;
    this.hitStopUntil = 0;
    this.shakeUntil = 0;
  }

  get hp() { return this.profile.hp; }
  set hp(value) { this.profile.hp = clamp(finite(value), 0, this.maxHp); }
  get maxHp() { return this.profile.maxHp; }
  set maxHp(value) { this.profile.maxHp = Math.max(1, finite(value, 1)); this.hp = this.hp; }
  get baseAtk() { return this.profile.baseAtk; }
  set baseAtk(value) { this.profile.baseAtk = Math.max(0, finite(value)); this.recalculateAttack(); }
  get totalAtk() { return this.profile.totalAtk; }
  set totalAtk(value) { this.profile.totalAtk = Math.max(0, finite(value)); }

  recalculateAttack() {
    const atkBonus = finite(this.weapon?.atkBonus ?? this.weapon?.damage, 0);
    this.totalAtk = this.baseAtk + Math.max(0, atkBonus);
    return this.totalAtk;
  }

  equipWeapon(weapon) {
    this.weapon = weapon ?? null;
    return this.recalculateAttack();
  }

  attackDamage(skillDamage = 0, multiplier = 1) {
    return Math.max(0, (this.totalAtk + Math.max(0, finite(skillDamage))) * Math.max(0, finite(multiplier, 1)));
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, finite(amount)));
    return this.hp - before;
  }

  applyDamage(amount, now = performance.now()) {
    const damage = Math.max(0, finite(amount));
    if (damage <= 0) return { damage: 0, hp: this.hp };
    this.hp = Math.max(0, this.hp - damage);
    return this.triggerHurt(damage, now);
  }

  syncServerDamage(nextHp, amount, now = performance.now()) {
    this.hp = nextHp;
    return this.triggerHurt(amount, now);
  }

  triggerHurt(amount, now = performance.now()) {
    const damage = Math.max(0, finite(amount));
    this.hurtFlashUntil = Math.max(this.hurtFlashUntil, now + 180);
    this.hitStopUntil = Math.max(this.hitStopUntil, now + 55);
    this.shakeUntil = Math.max(this.shakeUntil, now + 220);
    this.action = 'hurt';
    this.actionTime = 0;
    return { damage, hp: this.hp, flashMs: 180, hitStopMs: 55, shakeMs: 220 };
  }

  getFeedback(now = performance.now()) {
    return {
      flashing: now < this.hurtFlashUntil,
      hitStopped: now < this.hitStopUntil,
      shaking: now < this.shakeUntil,
      shakeStrength: now < this.shakeUntil ? (this.shakeUntil - now) / 220 : 0,
    };
  }
}
