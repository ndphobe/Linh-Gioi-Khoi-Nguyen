import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECT_SKILL_TREES, SkillSystemManager, cooldownVisual } from '../src/game/SkillSystem.js';
import { skillTreePanelMarkup } from '../src/game/UI/SkillTreePanel.js';

test('cooldown visual exposes sweep angle and readable timer labels',()=>{
  assert.deepEqual(cooldownVisual(5,10),{remaining:5,total:10,ratio:.5,angle:180,label:'5.0s',coolingDown:true});
  assert.equal(cooldownVisual(.84,4).label,'0.8s');
  assert.equal(cooldownVisual(0,4).coolingDown,false);
});

test('a loaded peak character remains tribulation-ready when EXP is capped',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'qi_refining',minorLevel:9,state:{faction:'orthodox',cultivationProgress:100}});
  const result=manager.gainCultivation(10);
  assert.equal(result.gained,0);
  assert.equal(result.tribulationReady,true);
});

test('three sects expose thirteen distinct skills and VFX per path', () => {
  assert.deepEqual(Object.keys(SECT_SKILL_TREES), ['orthodox', 'demonic', 'heretic']);
  const skills=Object.values(SECT_SKILL_TREES).flat();
  assert.equal(skills.length,39);
  assert.equal(new Set(skills.map((skill) => skill.id)).size,39);
  assert.equal(new Set(skills.map((skill) => skill.vfx)).size,39);
  assert.equal(new Set(skills.map((skill)=>JSON.stringify(skill.tiers))).size,39);
  const basicVfx={orthodox:'swordWave',demonic:'bloodSlash',heretic:'venomBlade'};
  for(const [faction,tree] of Object.entries(SECT_SKILL_TREES))assert.equal(tree.some(skill=>skill.vfx===basicVfx[faction]),false);
});

test('every sect starts with its entry skill equipped on Q',()=>{
  for(const faction of Object.keys(SECT_SKILL_TREES)){
    const manager=new SkillSystemManager({faction,realmId:'qi_refining',minorLevel:1});
    assert.equal(manager.hotbar.q,SECT_SKILL_TREES[faction][0].id);
    assert.equal(manager.skillForSlot('q').tier,1);
    assert.equal(manager.unlockPoints,0);
  }
});

test('restore rejects skills above the authoritative cultivation level',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'qi_refining',minorLevel:1,state:{faction:'orthodox',pointVersion:4,skillUnlockPoints:99,unlocked:{sword_intent:1,primordial_sword:3},hotbar:{q:'primordial_sword'}}});
  assert.equal(manager.unlocked.primordial_sword,undefined);
  assert.equal(manager.hotbar.q,'sword_intent');
  assert.equal(manager.canUnlock('jade_shield'),false);
});

test('skills unlock with cultivation requirements while upgrades spend upgrade points', () => {
  const manager = new SkillSystemManager({ faction: 'orthodox', realmId: 'nascent_soul', minorLevel: 1 });
  assert.equal(manager.unlock('jade_shield'), true);
  assert.equal(manager.unlockPoints, 0);
  assert.equal(manager.upgrade('jade_shield'), true);
  assert.equal(manager.unlocked.jade_shield, 2);
  assert.equal(manager.upgradePoints, 2);
  assert.equal(manager.assign('e', 'jade_shield'), true);
  assert.equal(manager.skillForSlot('e').tier, 2);
});

test('sub-stages award upgrade points and major realm breakthroughs do not gate gold unlocks', () => {
  const manager = new SkillSystemManager({ faction: 'demonic', realmId: 'qi_refining', minorLevel: 1 });
  const early=manager.applyCultivationLevel(5);
  assert.deepEqual({unlock:early.unlockAwarded,upgrade:early.upgradeAwarded},{unlock:0,upgrade:2});
  assert.equal(manager.skillUnlockPoints,0);
  const sixth=manager.applyCultivationLevel(6);
  assert.deepEqual({unlock:sixth.unlockAwarded,upgrade:sixth.upgradeAwarded},{unlock:0,upgrade:1});
  const later=manager.applyCultivationLevel(7);
  assert.deepEqual({unlock:later.unlockAwarded,upgrade:later.upgradeAwarded},{unlock:0,upgrade:0});
  assert.equal(manager.skillUpgradePoints,3);
});

test('all sixteen cultivation levels award eleven sub-stage upgrade points', () => {
  const manager = new SkillSystemManager({ faction: 'orthodox', realmId: 'qi_refining', minorLevel: 1 });
  const result = manager.applyCultivationLevel(16);
  assert.equal(result.unlockAwarded,0);
  assert.equal(result.upgradeAwarded,11);
  assert.equal(manager.realmId,'spirit_transformation');
  assert.equal(manager.minorLevel,6);
});

test('skill panel exposes gold, upgrade points, unlock actions and plus upgrades',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'golden_core',minorLevel:2});
  manager.availableGold=1234;
  let markup=skillTreePanelMarkup(manager);
  assert.match(markup,/Vàng hiện có: <b>🪙 1\.234<\/b>/);
  assert.match(markup,/Điểm Nâng Cấp Chiêu: <b>3<\/b>/);
  assert.doesNotMatch(markup,/Điểm Mở Khóa Chiêu|Mở thêm điểm ở Lv/);
  assert.match(markup,/>Mở · 🪙 180<\/button>/);
  assert.equal(manager.hotbar.q,'sword_intent');
  markup=skillTreePanelMarkup(manager);
  assert.match(markup,/class="skill-node__upgrade"[^>]*>\+<\/button>/);
});

test('onboarding lists every cultivation realm from lowest to highest',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần'];
  const positions=realms.map(name=>html.indexOf(`<strong>${name}</strong>`));
  assert.ok(positions.every(position=>position>=0));
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
  assert.match(html,/Lv 11–16/);
});

test('hotbar bindings are unique and can be removed', () => {
  const manager = new SkillSystemManager({ faction: 'heretic', realmId: 'foundation', minorLevel: 3 });
  assert.equal(manager.unassign('q'), true);
  assert.equal(manager.assign('q', 'venom_dart'), true);
  assert.equal(manager.assign('e', 'venom_dart'), false);
  assert.equal(manager.unassign('q'), true);
  assert.equal(manager.assign('e', 'venom_dart'), true);
  assert.equal(manager.hotbar.e, 'venom_dart');
  assert.equal(manager.slotForSkill('venom_dart'), 'e');
  assert.equal(manager.unassign('e'), true);
  assert.equal(manager.hotbar.e, null);
});

test('legacy duplicate bindings are deduplicated in slot order',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'foundation',minorLevel:1,state:{faction:'orthodox',unlocked:{sword_intent:1},hotbar:{q:'sword_intent',e:'sword_intent'},pointVersion:2}});
  assert.equal(manager.hotbar.q,'sword_intent');
  assert.equal(manager.hotbar.e,null);
});

test('authoritative restore clears removed slots so a skill can be rebound',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'foundation',minorLevel:1});
  manager.restore({faction:'orthodox',unlocked:{sword_intent:1,myriad_swords:1},hotbar:{q:'sword_intent',e:'myriad_swords'},pointVersion:3,lastCultivationLevel:4});
  manager.restore({faction:'orthodox',unlocked:{sword_intent:1,myriad_swords:1},hotbar:{q:'sword_intent',e:null},pointVersion:3,lastCultivationLevel:4});
  assert.equal(manager.hotbar.e,null);
  assert.equal(manager.slotForSkill('myriad_swords'),null);
  assert.equal(manager.assign('r','myriad_swords'),true);
  assert.equal(manager.hotbar.r,'myriad_swords');
});

test('skill panel distinguishes current, occupied and available slots',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'foundation',minorLevel:1});
  manager.unlock('myriad_swords');
  const markup=skillTreePanelMarkup(manager);
  assert.match(markup,/class="active"[^>]*disabled[^>]*>Q ✓<\/button>/);
  assert.match(markup,/class="occupied"[^>]*disabled[^>]*>Q 🔒<\/button>/);
  assert.match(markup,/class="available"[^>]*>E \+<\/button>/);
  assert.match(markup,/Gỡ Kiếm Ý khỏi Q/);
});
