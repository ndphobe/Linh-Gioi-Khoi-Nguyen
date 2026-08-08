import test from 'node:test';
import assert from 'node:assert/strict';
import { SECT_SKILL_TREES, SkillSystemManager, cooldownVisual } from '../src/game/SkillSystem.js';

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
  const manager = new SkillSystemManager({ faction: 'demonic', realmId: 'foundation', minorLevel: 8 });
  const unlocks = manager.unlockPoints;
  assert.equal(manager.advanceMinor(), true);
  assert.equal(manager.unlockPoints, unlocks);
  manager.cultivationProgress = 100;
  const upgrades = manager.upgradePoints;
  assert.equal(manager.breakthrough('golden_core'), true);
  assert.equal(manager.unlockPoints, unlocks + 1);
  assert.equal(manager.upgradePoints, upgrades);
});

test('cultivation advances minor realms and locks at peak for tribulation', () => {
  const manager = new SkillSystemManager({ faction: 'orthodox', realmId: 'foundation', minorLevel: 1 });
  const result = manager.gainCultivation(850);
  assert.equal(result.levels, 8);
  assert.equal(result.tribulationReady, false);
  assert.equal(manager.minorLevel, 9);
  assert.equal(manager.cultivationProgress, 50);
  manager.gainCultivation(50);
  assert.equal(manager.cultivationProgress, 100);
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
