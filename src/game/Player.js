import { Character } from './Character.js';

export class Player extends Character {
  constructor(profile = {}, cultivationSystem, motion = {}) {
    super(profile, motion);
    this.cultivationSystem = cultivationSystem;
    this.isDead = false;
    this.deathPenaltyApplied = false;
  }

  get currentEXP() { return this.cultivationSystem?.currentExp ?? 0; }
  set currentEXP(value) { if (this.cultivationSystem) this.cultivationSystem.currentExp = Math.max(0, Number(value) || 0); }
  get maxEXP() { return this.cultivationSystem?.requiredEXP ?? 1; }
  get canAct() { return !this.isDead && this.hp > 0; }

  die({ cultivation, penalty } = {}) {
    if (cultivation) this.cultivationSystem?.sync(cultivation);
    if (this.isDead) return { applied: false, penalty };
    this.isDead = true;
    this.hp = 0;
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.action = 'death';
    const result = penalty ?? (cultivation ? { deducted: 0, currentExp: this.currentEXP, requiredEXP: this.maxEXP, authoritative: true } : this.deathPenaltyApplied ? null : this.cultivationSystem?.applyDeathPenalty(0.1));
    this.deathPenaltyApplied = true;
    return { applied: true, penalty: result };
  }

  respawn({ hp = this.maxHp, mp, position } = {}) {
    this.isDead = false;
    this.deathPenaltyApplied = false;
    this.hp = hp;
    if (Number.isFinite(Number(mp))) this.profile.mp = Number(mp);
    if (position) this.position = { ...this.position, ...position };
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.action = 'idle';
  }
}
