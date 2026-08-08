import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterManager } from '../src/game/CharacterManager.js';
import { SaveSystem } from '../src/game/SaveSystem.js';

test('each sect character keeps isolated cultivation and economy data',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const manager=new CharacterManager(new SaveSystem(storage,'characters'));
  const sword=manager.selectByFaction('orthodox','Kiếm Tu');
  manager.updateActive({realm:'foundation',skillSystem:{minorLevel:3,cultivationProgress:42},shopSystem:{gold:125,inventory:['iron_sword'],equipment:{weapon:'iron_sword'}}});
  const demon=manager.selectByFaction('demonic','Ma Tu');
  assert.equal(demon.realm,'qi_refining');assert.equal(demon.currentExp,0);assert.equal(demon.gold,0);
  manager.selectByFaction('orthodox','Kiếm Tu');const restored=manager.active();
  assert.equal(restored.id,sword.id);assert.equal(restored.realm,'foundation');assert.equal(restored.minorLevel,3);assert.equal(restored.currentExp,42);assert.equal(restored.gold,125);
});
