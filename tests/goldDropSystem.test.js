import test from 'node:test';
import assert from 'node:assert/strict';
import { GoldDropSystem } from '../src/game/GoldDropSystem.js';

test('gold drops preserve total value and magnetize into the player',()=>{
  let collected=0;
  const system=new GoldDropSystem({screen:p=>p,pickupRadius:100,onPickup:amount=>{collected+=amount;}});
  const drops=system.spawnGoldLoot(0,0,53);
  assert.equal(drops.reduce((sum,drop)=>sum+drop.amount,0),53);
  for(let frame=0;frame<300&&system.drops.length;frame++)system.update(1/60,{x:0,z:0});
  assert.equal(system.drops.length,0);
  assert.equal(collected,53);
});
