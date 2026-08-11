import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterManager } from '../src/game/CharacterManager.js';
import { SaveSystem } from '../src/game/SaveSystem.js';

test('each sect character keeps isolated cultivation and economy data',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const manager=new CharacterManager(new SaveSystem(storage,'characters'));
  const sword=manager.selectByFaction('orthodox','Kiếm Tu');
  assert.match(sword.resumeToken,/^[a-zA-Z0-9_-]{20,}$/);
  manager.updateActive({realm:'foundation',skillSystem:{minorLevel:3,cultivationProgress:42},shopSystem:{gold:125,inventory:['iron_sword'],equipment:{weapon:'iron_sword'}}});
  const demon=manager.selectByFaction('demonic','Ma Tu');
  assert.equal(demon.realm,'qi_refining');assert.equal(demon.currentExp,0);assert.equal(demon.gold,0);
  manager.selectByFaction('orthodox','Kiếm Tu');const restored=manager.active();
  assert.equal(restored.id,sword.id);assert.equal(restored.realm,'foundation');assert.equal(restored.minorLevel,3);assert.equal(restored.currentExp,42);assert.equal(restored.gold,125);
  assert.equal(restored.resumeToken,sword.resumeToken);
});

test('a late update from the previous character cannot overwrite active character gold',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const manager=new CharacterManager(new SaveSystem(storage,'characters'));
  const sword=manager.selectByFaction('orthodox','Kiếm Tu');
  manager.updateActive({characterId:sword.id,shopSystem:{gold:125}});
  const demon=manager.selectByFaction('demonic','Ma Tu');
  manager.updateActive({characterId:demon.id,shopSystem:{gold:40}});

  // Simulate a delayed player:state/onProfileChange callback from Kiếm Tu.
  manager.updateActive({characterId:sword.id,shopSystem:{gold:180}});

  assert.equal(manager.active().id,demon.id);
  assert.equal(manager.active().gold,40);
  manager.selectByFaction('orthodox','Kiếm Tu');
  assert.equal(manager.active().gold,180);
});

test('saving remains non-fatal when browser storage is denied',()=>{
  const storage={
    getItem:()=>{throw new Error('SecurityError');},
    setItem:()=>{throw new Error('QuotaExceededError');},
  };
  const saves=new SaveSystem(storage,'characters');
  assert.deepEqual(saves.load(),{activeCharacterId:null,characters:{}});
  assert.deepEqual(saves.save({activeCharacterId:'Character_A',characters:{}}),{activeCharacterId:'Character_A',characters:{}});
  const manager=new CharacterManager(saves);
  assert.doesNotThrow(()=>manager.selectByFaction('orthodox','Kiếm Tu'));
});
