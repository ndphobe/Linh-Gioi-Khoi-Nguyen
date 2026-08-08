import test from 'node:test';
import assert from 'node:assert/strict';
import { SECT_COMBAT_DATA } from '../src/game/SectData.js';

test('sects expose distinct palettes, sounds, mechanics and VFX',()=>{
  const values=Object.values(SECT_COMBAT_DATA);
  assert.equal(new Set(values.map(value=>value.primary)).size,3);
  assert.equal(new Set(values.map(value=>value.sound)).size,3);
  assert.equal(new Set(values.map(value=>value.vfx.g)).size,3);
  assert.ok(SECT_COMBAT_DATA.orthodox.mechanics.parryShield);
  assert.ok(SECT_COMBAT_DATA.demonic.mechanics.lifeSteal);
  assert.ok(SECT_COMBAT_DATA.heretic.mechanics.poisonStacks);
});
