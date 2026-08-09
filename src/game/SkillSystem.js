import { MAX_CULTIVATION_LEVEL, MIN_CULTIVATION_LEVEL, REALM_HIERARCHY, globalLevelForRealm, realmForLevel } from './CultivationSystem.js';

export const HOTBAR_SLOTS = Object.freeze(['q', 'e', 'r', 'f', 'g']);

export function cooldownVisual(remaining, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeRemaining = Math.max(0, Number(remaining) || 0);
  const ratio = safeTotal > 0 ? Math.min(1, safeRemaining / safeTotal) : 0;
  const label = safeRemaining <= 0 ? '' : safeRemaining < 1 ? `${safeRemaining.toFixed(1)}s` : safeRemaining < 10 ? `${safeRemaining.toFixed(1)}s` : `${Math.ceil(safeRemaining)}s`;
  return { remaining: safeRemaining, total: safeTotal, ratio, angle: ratio * 360, label, coolingDown: safeRemaining > 0 };
}

export const CULTIVATION_REALMS = Object.freeze(REALM_HIERARCHY.map(realm=>Object.freeze({...realm})));

const skill = (id, name, icon, description, archetype, requiredRealm, stats) => Object.freeze({
  id, name, icon, description, archetype, requiredRealm, maxTier: 3,
  tiers: Object.freeze(stats.map((entry, index) => Object.freeze({ tier: index + 1, ...entry }))),
});

export const SECT_SKILL_TREES = Object.freeze({
  orthodox: Object.freeze([
    skill('sword_intent', 'Kiếm Ý', 'Kiếm', 'Kiếm khí thuần dương gây sát thương vật lý.', 'q', 'qi_refining', [{ damage: 28, manaCost: 16, cooldown: 4.8 }, { damage: 39, manaCost: 14, cooldown: 4.3 }, { damage: 54, manaCost: 12, cooldown: 3.8 }]),
    skill('myriad_swords', 'Vạn Kiếm Quy Tông', 'Vạn', 'Kiếm trận ánh sáng quét nhiều mục tiêu.', 'e', 'foundation', [{ damage: 48, manaCost: 30, cooldown: 8 }, { damage: 65, manaCost: 27, cooldown: 7.2 }, { damage: 86, manaCost: 24, cooldown: 6.4 }]),
    skill('heaven_sever', 'Thiên Quang Trảm', 'Trảm', 'Nhát chém ánh sáng tập trung uy lực lớn.', 'r', 'foundation', [{ damage: 76, manaCost: 40, cooldown: 12 }, { damage: 101, manaCost: 36, cooldown: 10.8 }, { damage: 132, manaCost: 32, cooldown: 9.5 }]),
    skill('jade_shield', 'Hộ Thể Kiếm Cương', 'Thuẫn', 'Tạo lá chắn linh lực bảo hộ bản thân.', 'f', 'qi_refining', [{ damage: 0, shield: 34, manaCost: 25, cooldown: 14 }, { damage: 0, shield: 48, manaCost: 22, cooldown: 12.5 }, { damage: 0, shield: 65, manaCost: 19, cooldown: 11 }]),
    skill('sun_sword_domain', 'Thái Dương Kiếm Vực', 'Nhật', 'Tuyệt kỹ kiếm vực chính khí.', 'g', 'golden_core', [{ damage: 125, manaCost: 82, cooldown: 40 }, { damage: 165, manaCost: 74, cooldown: 36 }, { damage: 215, manaCost: 66, cooldown: 32 }]),
  ]),
  demonic: Object.freeze([
    skill('blood_flame', 'Huyết Diễm', 'Hỏa', 'Ma hỏa đỏ thẫm thiêu đốt mục tiêu.', 'q', 'qi_refining', [{ damage: 31, manaCost: 18, cooldown: 5 }, { damage: 44, manaCost: 16, cooldown: 4.4 }, { damage: 60, manaCost: 14, cooldown: 3.9 }]),
    skill('soul_chains', 'Tỏa Hồn Liên', 'Tỏa', 'Xiềng hồn khống chế một vùng.', 'e', 'foundation', [{ damage: 42, control: 1.4, manaCost: 32, cooldown: 9 }, { damage: 57, control: 1.8, manaCost: 29, cooldown: 8 }, { damage: 76, control: 2.2, manaCost: 26, cooldown: 7 }]),
    skill('blood_reaver', 'Huyết Sát Trảm', 'Huyết', 'Chém bóng tối và hút sinh lực.', 'r', 'foundation', [{ damage: 72, lifeSteal: .12, manaCost: 38, cooldown: 11 }, { damage: 96, lifeSteal: .16, manaCost: 34, cooldown: 10 }, { damage: 126, lifeSteal: .22, manaCost: 30, cooldown: 8.8 }]),
    skill('crimson_nova', 'Xích Viêm Bạo', 'Bạo', 'Bùng nổ ma hỏa quanh người.', 'f', 'qi_refining', [{ damage: 54, manaCost: 29, cooldown: 13 }, { damage: 73, manaCost: 26, cooldown: 11.8 }, { damage: 97, manaCost: 23, cooldown: 10.5 }]),
    skill('abyss_feast', 'Vạn Hồn Phệ Thiên', 'Ma', 'Tuyệt kỹ nuốt sinh lực mọi kẻ trong vực.', 'g', 'golden_core', [{ damage: 132, lifeSteal: .18, manaCost: 86, cooldown: 42 }, { damage: 176, lifeSteal: .23, manaCost: 77, cooldown: 38 }, { damage: 230, lifeSteal: .3, manaCost: 68, cooldown: 34 }]),
  ]),
  heretic: Object.freeze([
    skill('venom_dart', 'Đoạt Mệnh Châm', 'Độc', 'Ám khí tẩm độc gây sát thương theo thời gian.', 'q', 'qi_refining', [{ damage: 20, dot: 18, manaCost: 14, cooldown: 4.2 }, { damage: 27, dot: 27, manaCost: 12, cooldown: 3.7 }, { damage: 36, dot: 39, manaCost: 10, cooldown: 3.2 }]),
    skill('poison_mist', 'Vạn Độc Vụ', 'Vụ', 'Màn sương độc bào mòn nhiều mục tiêu.', 'e', 'foundation', [{ damage: 32, dot: 30, manaCost: 28, cooldown: 9 }, { damage: 43, dot: 44, manaCost: 25, cooldown: 8 }, { damage: 57, dot: 61, manaCost: 22, cooldown: 7 }]),
    skill('shadow_step', 'Ảnh Độn', 'Ảnh', 'Ẩn thân ngắn và tăng tốc di chuyển.', 'r', 'qi_refining', [{ damage: 0, speed: .2, stealth: 2, manaCost: 22, cooldown: 12 }, { damage: 0, speed: .3, stealth: 2.8, manaCost: 19, cooldown: 10.5 }, { damage: 0, speed: .42, stealth: 3.6, manaCost: 16, cooldown: 9 }]),
    skill('serpent_fang', 'Xà Nha Phệ', 'Xà', 'Đột kích cực nhanh, cộng dồn kịch độc.', 'f', 'foundation', [{ damage: 59, dot: 16, manaCost: 30, cooldown: 10 }, { damage: 79, dot: 24, manaCost: 27, cooldown: 9 }, { damage: 104, dot: 34, manaCost: 24, cooldown: 8 }]),
    skill('nightmare_garden', 'U Minh Độc Giới', 'Minh', 'Tuyệt kỹ biến chiến trường thành độc giới.', 'g', 'golden_core', [{ damage: 105, dot: 62, manaCost: 78, cooldown: 39 }, { damage: 140, dot: 86, manaCost: 70, cooldown: 35 }, { damage: 184, dot: 116, manaCost: 62, cooldown: 31 }]),
  ]),
});

const realmOrder = (id) => CULTIVATION_REALMS.find((realm) => realm.id === id)?.order ?? 0;

export class SkillSystemManager {
  constructor({ faction = 'orthodox', realmId = 'qi_refining', minorLevel = 1, state } = {}) {
    this.faction = SECT_SKILL_TREES[faction] ? faction : 'orthodox';
    this.realmId = CULTIVATION_REALMS.some((realm) => realm.id === realmId) ? realmId : 'qi_refining';
    const realm=CULTIVATION_REALMS.find(entry=>entry.id===this.realmId)??CULTIVATION_REALMS[0];
    this.minorLevel = Math.max(1, Math.min(realm.stages, Math.floor(minorLevel)||1));
    this.lastCultivationLevel=globalLevelForRealm(this.realmId,this.minorLevel);
    this.skillUnlockPoints=realm.order;
    this.skillUpgradePoints=Math.max(0,this.lastCultivationLevel-1-realm.order);
    this.cultivationProgress = 0;
    this.unlocked = {};
    this.hotbar = Object.fromEntries(HOTBAR_SLOTS.map((slot) => [slot, null]));
    if (state) { const targetLevel=this.lastCultivationLevel;this.restore(state);this.applyCultivationLevel(targetLevel); }
  }

  get unlockPoints(){return this.skillUnlockPoints;}
  set unlockPoints(value){this.skillUnlockPoints=Math.max(0,Math.floor(Number(value)||0));}
  get upgradePoints(){return this.skillUpgradePoints;}
  set upgradePoints(value){this.skillUpgradePoints=Math.max(0,Math.floor(Number(value)||0));}
  get tree() { return SECT_SKILL_TREES[this.faction]; }
  getSkill(id) { return this.tree.find((entry) => entry.id === id); }
  canUnlock(id) { const item = this.getSkill(id); return Boolean(item && !this.unlocked[id] && this.skillUnlockPoints > 0 && realmOrder(this.realmId) >= realmOrder(item.requiredRealm)); }
  unlock(id) { if (!this.canUnlock(id)) return false; this.unlocked[id] = 1; this.skillUnlockPoints -= 1; return true; }
  canUpgrade(id) { const item = this.getSkill(id); return Boolean(item && this.unlocked[id] && this.unlocked[id] < item.maxTier && this.skillUpgradePoints > 0); }
  upgrade(id) { if (!this.canUpgrade(id)) return false; this.unlocked[id] += 1; this.skillUpgradePoints -= 1; return true; }
  assign(slot, id) {
    if (!HOTBAR_SLOTS.includes(slot) || !this.unlocked[id] || !this.getSkill(id)) return false;
    // A skill is a unique hotbar binding. Rebinding moves it atomically.
    for (const key of HOTBAR_SLOTS) if (this.hotbar[key] === id) this.hotbar[key] = null;
    this.hotbar[slot] = id;
    return true;
  }
  unassign(slot) { if (!HOTBAR_SLOTS.includes(slot) || !this.hotbar[slot]) return false; this.hotbar[slot] = null; return true; }
  slotForSkill(id) { return HOTBAR_SLOTS.find((slot) => this.hotbar[slot] === id) ?? null; }
  skillForSlot(slot) { const item = this.getSkill(this.hotbar[slot]); return item ? { ...item, ...item.tiers[this.unlocked[item.id] - 1], manaCost: item.tiers[this.unlocked[item.id] - 1].manaCost } : null; }
  applyCultivationLevel(targetLevel){
    const target=Math.max(MIN_CULTIVATION_LEVEL,Math.min(MAX_CULTIVATION_LEVEL,Math.trunc(Number(targetLevel)||MIN_CULTIVATION_LEVEL)));
    const from=Math.max(MIN_CULTIVATION_LEVEL,this.lastCultivationLevel||target);
    if(target<from)return{unlockAwarded:0,upgradeAwarded:0,fromLevel:from,toLevel:from};
    let unlockAwarded=0,upgradeAwarded=0;
    for(let level=from+1;level<=target;level++){
      if(realmForLevel(level).id!==realmForLevel(level-1).id){this.skillUnlockPoints+=1;unlockAwarded+=1;}
      else{this.skillUpgradePoints+=1;upgradeAwarded+=1;}
    }
    const realm=realmForLevel(target);
    this.realmId=realm.id;this.minorLevel=target-realm.startLevel+1;this.lastCultivationLevel=Math.max(this.lastCultivationLevel||target,target);
    return{unlockAwarded,upgradeAwarded,fromLevel:from,toLevel:target};
  }
  advanceMinor() { const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current);if(current>=realm.endLevel)return false;this.applyCultivationLevel(current+1);return true; }
  gainCultivation(amount) {
    const gained = Math.max(0, Number(amount) || 0);
    const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current);
    if (!gained || (current===realm.endLevel && this.cultivationProgress >= 100)) return { gained: 0, levels: 0, tribulationReady: current===realm.endLevel && this.cultivationProgress >= 100 };
    this.cultivationProgress += gained;
    let levels = 0;
    while (this.cultivationProgress >= 100 && this.advanceMinor()) { this.cultivationProgress -= 100; levels += 1; }
    const nextCurrent=globalLevelForRealm(this.realmId,this.minorLevel),nextRealm=realmForLevel(nextCurrent);
    if(nextCurrent===nextRealm.endLevel)this.cultivationProgress=Math.min(100,this.cultivationProgress);
    return { gained, levels, tribulationReady: nextCurrent===nextRealm.endLevel && this.cultivationProgress >= 100 };
  }
  breakthrough(nextRealmId) { const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current),next=CULTIVATION_REALMS.find(entry=>entry.id===nextRealmId);if(current!==realm.endLevel||this.cultivationProgress<100||!next||next.order!==realm.order+1)return false;this.applyCultivationLevel(next.startLevel);this.cultivationProgress=0;return true; }
  serialize() { return { pointVersion:2,faction:this.faction,realmId:this.realmId,minorLevel:this.minorLevel,cultivationProgress:this.cultivationProgress,skillUnlockPoints:this.skillUnlockPoints,skillUpgradePoints:this.skillUpgradePoints,unlockPoints:this.skillUnlockPoints,upgradePoints:this.skillUpgradePoints,lastCultivationLevel:this.lastCultivationLevel,unlocked:{...this.unlocked},hotbar:{...this.hotbar} }; }
  restore(state) {
    if (!state || state.faction !== this.faction) return;
    this.cultivationProgress = Math.max(0, Math.min(100, Number(state.cultivationProgress) || 0));
    this.unlocked = {};
    for (const item of this.tree) if (state.unlocked?.[item.id]) this.unlocked[item.id] = Math.min(item.maxTier, Math.max(1, Math.floor(state.unlocked[item.id])));
    for (const slot of HOTBAR_SLOTS) if (this.unlocked[state.hotbar?.[slot]]) this.hotbar[slot] = state.hotbar[slot];
    if(state.pointVersion===2){
      this.skillUnlockPoints=Math.max(0,Math.floor(Number(state.skillUnlockPoints??state.unlockPoints)||0));
      this.skillUpgradePoints=Math.max(0,Math.floor(Number(state.skillUpgradePoints??state.upgradePoints)||0));
      this.lastCultivationLevel=Math.max(MIN_CULTIVATION_LEVEL,Math.min(MAX_CULTIVATION_LEVEL,Math.floor(Number(state.lastCultivationLevel)||this.lastCultivationLevel)));
    }else{
      const realm=realmForLevel(this.lastCultivationLevel),unlockSpent=Object.keys(this.unlocked).length,upgradeSpent=Object.values(this.unlocked).reduce((sum,tier)=>sum+Math.max(0,tier-1),0);
      this.skillUnlockPoints=Math.max(0,realm.order-unlockSpent);
      this.skillUpgradePoints=Math.max(0,this.lastCultivationLevel-1-realm.order-upgradeSpent);
    }
  }
}
