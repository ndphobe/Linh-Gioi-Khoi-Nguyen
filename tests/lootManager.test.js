import test from 'node:test';
import assert from 'node:assert/strict';
import { LootManager } from '../src/game/LootManager.js';

test('boss loot is transferred directly and announces gold and equipment',()=>{
  const received=[],gold=[];
  const manager=new LootManager({inventory:{addItem:id=>{received.push(id);return true;}},onGold:value=>gold.push(value),onBossReward:id=>received.push(`notice:${id}`)});
  assert.equal(manager.handle({type:'loot:granted',loot:{gold:180,bossEquipment:'thunder_guard_talisman'}}),true);
  assert.deepEqual(gold,[180]);
  assert.deepEqual(received,['thunder_guard_talisman','notice:thunder_guard_talisman']);
});
