import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopSystem, WEAPONS, itemForFaction } from '../src/game/ShopSystem.js';

test('common equipment resolves to distinct names, art and stats for every path',()=>{
  for(const id of ['iron_sword','jade_sword','blood_sabre','spirit_robe','jade_armor','dragon_armor']){
    const variants=['orthodox','demonic','heretic'].map(faction=>itemForFaction(id,faction));
    assert.equal(new Set(variants.map(item=>item.name)).size,3);
    assert.equal(new Set(variants.map(item=>item.asset)).size,3);
    assert.equal(new Set(variants.map(item=>JSON.stringify({damage:item.damage,defense:item.defense,maxMana:item.maxMana,attackSpeed:item.attackSpeed,critRate:item.critRate,lifeSteal:item.lifeSteal}))).size,3);
  }
});

test('weapon tiers scale upward and realm locks are enforced', () => {
  for(const faction of ['orthodox','demonic','heretic']){
    const pathWeapons=WEAPONS.filter(item=>item.faction===faction).sort((a,b)=>a.tier-b.tier);
    assert.ok(pathWeapons.length>=4);
    for(let index=1;index<pathWeapons.length;index+=1){assert.ok(pathWeapons[index].price>pathWeapons[index-1].price);assert.ok(pathWeapons[index].damage>pathWeapons[index-1].damage);}
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
