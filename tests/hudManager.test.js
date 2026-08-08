import test from 'node:test';
import assert from 'node:assert/strict';
import { HUDManager } from '../src/game/HUDManager.js';

const overlay = () => ({ hidden: true, classList: { values: new Set(), toggle(name, active) { active ? this.values.add(name) : this.values.delete(name); } } });

test('HUD manager keeps exactly one full-screen overlay active', () => {
  const pause = overlay(), map = overlay();
  const manager = new HUDManager();
  manager.register('pause', pause); manager.register('map', map);
  manager.open('pause'); manager.open('map');
  assert.equal(pause.hidden, true);
  assert.equal(map.hidden, false);
  manager.close('map');
  assert.equal(manager.active, null);
  assert.equal(map.hidden, true);
});
