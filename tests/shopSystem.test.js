import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopSystem, WEAPONS } from '../src/game/ShopSystem.js';

test('weapon tiers scale upward and realm locks are enforced', () => {
  for (let index = 1; index < WEAPONS.length; index += 1) {
    assert.ok(WEAPONS[index].price > WEAPONS[index - 1].price);
    assert.ok(WEAPONS[index].damage > WEAPONS[index - 1].damage);
  }
  const shop = new ShopSystem({ gold: 2000 });
  assert.equal(shop.buy('heaven_blade', 1), false);
  assert.equal(shop.buy('iron_sword', 1), true);
  assert.equal(shop.equip('iron_sword'), true);
  assert.equal(shop.sell('iron_sword'), true);
  assert.equal(shop.inventory.length, 0);
});

test('inventory supports equipment and consumable use', () => {
  const shop = new ShopSystem({ gold: 500 });
  assert.equal(shop.buy('spirit_robe', 1), true);
  assert.equal(shop.equip('spirit_robe'), true);
  assert.equal(shop.equipment.armor, 'spirit_robe');
  assert.equal(shop.buy('healing_pill', 1), true);
  const player = { hp: 10, maxHp: 120, mp: 5, maxMp: 100 };
  assert.equal(shop.use('healing_pill', player), true);
  assert.equal(player.hp, 55);
  assert.equal(shop.inventory.includes('healing_pill'), false);
});
