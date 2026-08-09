import test from 'node:test';
import assert from 'node:assert/strict';
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

test('three sects expose distinct five-skill trees', () => {
  assert.deepEqual(Object.keys(SECT_SKILL_TREES), ['orthodox', 'demonic', 'heretic']);
  assert.equal(new Set(Object.values(SECT_SKILL_TREES).flat().map((skill) => skill.id)).size, 15);
});

test('unlock and upgrade currencies cannot be interchanged', () => {
  const manager = new SkillSystemManager({ faction: 'orthodox', realmId: 'foundation', minorLevel: 4 });
  assert.equal(manager.unlock('jade_shield'), true);
  assert.equal(manager.unlockPoints, 0);
  assert.equal(manager.upgrade('jade_shield'), true);
  assert.equal(manager.unlocked.jade_shield, 2);
  assert.equal(manager.assign('q', 'jade_shield'), true);
  assert.equal(manager.skillForSlot('q').tier, 2);
});

test('minor levels only award upgrades and major breakthroughs only award unlocks', () => {
  const manager = new SkillSystemManager({ faction: 'demonic', realmId: 'qi_refining', minorLevel: 1 });
  const subStage=manager.applyCultivationLevel(2);
  assert.deepEqual({unlock:subStage.unlockAwarded,upgrade:subStage.upgradeAwarded},{unlock:0,upgrade:1});
  assert.equal(manager.skillUnlockPoints,0);
  assert.equal(manager.skillUpgradePoints,1);
  const breakthrough=manager.applyCultivationLevel(3);
  assert.deepEqual({unlock:breakthrough.unlockAwarded,upgrade:breakthrough.upgradeAwarded},{unlock:1,upgrade:0});
  assert.equal(manager.skillUnlockPoints,1);
  assert.equal(manager.skillUpgradePoints,1);
  assert.deepEqual(manager.applyCultivationLevel(3),{unlockAwarded:0,upgradeAwarded:0,fromLevel:3,toLevel:3});
});

test('all sixteen cultivation levels award exactly four unlocks and eleven upgrades', () => {
  const manager = new SkillSystemManager({ faction: 'orthodox', realmId: 'qi_refining', minorLevel: 1 });
  const result = manager.applyCultivationLevel(16);
  assert.equal(result.unlockAwarded,4);
  assert.equal(result.upgradeAwarded,11);
  assert.equal(manager.realmId,'spirit_transformation');
  assert.equal(manager.minorLevel,6);
});

test('skill panel exposes separate counters, unlock actions and plus upgrades',()=>{
  const manager=new SkillSystemManager({faction:'orthodox',realmId:'foundation',minorLevel:1});
  let markup=skillTreePanelMarkup(manager);
  assert.match(markup,/Điểm Mở Khóa Chiêu: <b>1<\/b>/);
  assert.match(markup,/Điểm Nâng Cấp Chiêu: <b>1<\/b>/);
  assert.match(markup,/>Mở Khóa<\/button>/);
  assert.equal(manager.unlock('sword_intent'),true);
  markup=skillTreePanelMarkup(manager);
  assert.match(markup,/class="skill-node__upgrade"[^>]*>\+<\/button>/);
});

test('hotbar bindings are unique and can be removed', () => {
  const manager = new SkillSystemManager({ faction: 'heretic', realmId: 'foundation', minorLevel: 3 });
  manager.unlock('venom_dart');
  assert.equal(manager.assign('q', 'venom_dart'), true);
  assert.equal(manager.assign('e', 'venom_dart'), true);
  assert.equal(manager.hotbar.q, null);
  assert.equal(manager.hotbar.e, 'venom_dart');
  assert.equal(manager.slotForSkill('venom_dart'), 'e');
  assert.equal(manager.unassign('e'), true);
  assert.equal(manager.hotbar.e, null);
});
