import test from 'node:test';
import assert from 'node:assert/strict';

import { AnimationController, loopFrameForDistance, PLAYER_ANIMATION_CLIPS } from '../src/game/AnimationController.js';
import { Character } from '../src/game/Character.js';
import { CultivationSystem, REALM_HIERARCHY, requiredEXP } from '../src/game/CultivationSystem.js';
import { ItemSystem } from '../src/game/ItemSystem.js';
import { Player } from '../src/game/Player.js';
import { ShopSystem, itemById, itemForFaction } from '../src/game/ShopSystem.js';
import { VFXManager } from '../src/game/VFXManager.js';
import { Monster, monsterAttackFor } from '../src/game/Monster.js';
import { GameRoom } from '../server/world.js';
import { MapManager, REGIONS } from '../src/game/MapManager.js';

test('map unlocks require both the cultivation realm and its sub-stage',()=>{
  const manager=new MapManager({realmOrder:1,subStage:1});
  const luoyang=REGIONS.find(region=>region.id==='luoyang');
  const spiritMine=REGIONS.find(region=>region.id==='spirit_mine');
  assert.equal(manager.isUnlocked(luoyang),true);
  assert.equal(manager.isUnlocked(spiritMine),false);
  manager.setCultivation(1,2);
  assert.equal(manager.isUnlocked(spiritMine),false);
  manager.setCultivation(2,1);
  assert.equal(manager.isUnlocked(spiritMine),true);
});

test('cultivation hierarchy maps the exact sixteen levels and exponential EXP curve',()=>{
  assert.deepEqual(REALM_HIERARCHY.map(({name,stages,startLevel,endLevel})=>({name,stages,startLevel,endLevel})),[
    {name:'Luyện Khí',stages:2,startLevel:1,endLevel:2},
    {name:'Trúc Cơ',stages:2,startLevel:3,endLevel:4},
    {name:'Kim Đan',stages:2,startLevel:5,endLevel:6},
    {name:'Nguyên Anh',stages:4,startLevel:7,endLevel:10},
    {name:'Hóa Thần',stages:6,startLevel:11,endLevel:16},
  ]);
  assert.equal(requiredEXP(3,100,1.5),Math.round(100*Math.pow(1.5,3)));
  assert.ok(requiredEXP(16)>requiredEXP(10)*10);
});

test('fractional EXP crosses its threshold without a 51-percent freeze',()=>{
  const system=new CultivationSystem({level:1,currentExp:76.5},{baseEXP:100,realmMultiplier:1.5});
  assert.equal(system.progress,51);
  const result=system.addEXP(73.50000000001);
  assert.equal(result.levels,1);
  assert.equal(system.level,2);
  assert.equal(system.currentExp,0);
});

test('health pills heal immediately and equipped weapons recalculate attack',()=>{
  const profile={hp:10,maxHp:120,baseAtk:18};
  const player=new Character(profile);
  const shop=new ShopSystem({inventory:['healing_pill','iron_sword']});
  const items=new ItemSystem({player,shopSystem:shop,itemLookup:itemById});
  assert.equal(items.usePill('healing_pill'),true);
  assert.equal(player.hp,55);
  assert.equal(items.equipWeapon('iron_sword'),true);
  assert.equal(player.totalAtk,26);
  assert.equal(player.attackDamage(),26);
});

test('animation markers fire once on the authored attack keyframe',()=>{
  const animation=new AnimationController(PLAYER_ANIMATION_CLIPS);
  let markers=0,completed=0;
  animation.play('attack',{onMarker:()=>markers++,onComplete:()=>completed++},true);
  for(let index=0;index<10;index++)animation.update(.05);
  assert.equal(markers,1);
  assert.equal(completed,1);
  assert.equal(animation.finished,true);
});

test('locomotion animation phase is locked to travelled distance',()=>{
  const animation=new AnimationController(PLAYER_ANIMATION_CLIPS);
  animation.play('walk',{},true);
  assert.equal(animation.seekLoop(.25),3);
  assert.equal(animation.seekLoop(.5),6);
  assert.equal(animation.seekLoop(1.25),3);
  assert.equal(loopFrameForDistance(29,58),4);
  assert.equal(loopFrameForDistance(87,58),4);
});

test('player damage arms red flash, hit-stop and screen shake timers',()=>{
  const player=new Character({hp:100,maxHp:100});
  const hit=player.applyDamage(17,1_000);
  assert.equal(player.hp,83);
  assert.equal(hit.hitStopMs,55);
  assert.deepEqual(player.getFeedback(1_010),{flashing:true,hitStopped:true,shaking:true,shakeStrength:(1_220-1_010)/220});
});

test('authoritative monster damage includes only the server-equipped weapon bonus',()=>{
  const strike=({equipped=null,payloadWeapon=null}={})=>{const room=new GameRoom(`WEAPON-${equipped??payloadWeapon??'NONE'}`);const inventory=equipped?[equipped]:[];const player=room.addPlayer('p1',{name:'Kiếm Tu',faction:'heretic',session:{inventory,equipment:{weapon:equipped}}},1_000);const enemy=room.enemies.get('fox-1');player.position={x:-6,y:0,z:14};room.castAbility(player.id,{ability:'basic',aim:{x:0,z:-1},weaponId:payloadWeapon,totalAtk:9_999},2_000);return enemy.maxHp-enemy.hp;};
  assert.equal(strike(),18*1.12);
  assert.equal(strike({equipped:'iron_sword'}),(18+itemForFaction('iron_sword','heretic').damage)*1.12);
  assert.equal(strike({payloadWeapon:'iron_sword'}),18*1.12);
  assert.equal(strike({payloadWeapon:'forged_client_weapon'}),18*1.12);
});

test('authoritative pill use updates HP, inventory and the exact gold snapshot',()=>{
  const room=new GameRoom('ITEM-SYNC');
  const player=room.addPlayer('p1',{session:{gold:100}},1_000);
  player.hp=20;
  const bought=room.buyItem(player.id,'healing_pill',2_000);
  assert.equal(bought.shopSystem.gold,65);
  assert.deepEqual(bought.shopSystem.inventory,['healing_pill']);
  const used=room.useItem(player.id,'healing_pill',2_100);
  assert.equal(used.player.hp,65);
  assert.equal(used.shopSystem.gold,65);
  assert.deepEqual(used.shopSystem.inventory,[]);
});

test('server cultivation continues through 51 percent without a render frame',()=>{
  const room=new GameRoom('EXP-SYNC');
  const player=room.addPlayer('p1',{session:{cultivationSystem:{version:3,level:1,currentExp:154}}},1_000);
  player.meditating=true;
  room.tickPlayer(player,1,2_000);
  assert.equal(player.cultivationSystem.level,2);
  assert.equal(player.cultivationSystem.currentExp,0);
});

test('a full legacy qi meter never blocks EXP dropped by a defeated monster',()=>{
  const room=new GameRoom('EXP-DROP');
  const player=room.addPlayer('p1',{session:{cultivationSystem:{level:2,currentExp:71}}},1_000);
  player.qi=player.maxQi;
  const before=player.cultivationSystem.currentExp;
  room.damageEnemy(room.enemies.get('fox-1'),999,player,2_000);
  const loot=room.drainEvents().find(event=>event.type==='loot:granted')?.loot;
  assert.equal(loot.exp,2);
  assert.equal(loot.qi,2);
  assert.ok(player.cultivationSystem.currentExp>before);
  const snapshot=room.privatePlayerSnapshot(player.id,2_100);
  assert.equal(snapshot.qi,snapshot.cultivationSystem.currentExp);
  assert.equal(snapshot.maxQi,snapshot.cultivationSystem.requiredEXP);
});

test('successive monster kills keep awarding EXP while level requirements increase',()=>{
  const room=new GameRoom('EXP-CURVE');
  const player=room.addPlayer('p1',{},1_000);
  const requirements=[player.cultivationSystem.requiredEXP];
  let previousLevel=player.cultivationSystem.level;
  for(let kill=0;kill<35;kill++){
    const enemy=room.enemies.get('fox-1');
    if(!enemy.alive)room.respawnEnemy(enemy,2_000+kill*10);
    const before={level:player.cultivationSystem.level,exp:player.cultivationSystem.currentExp};
    room.damageEnemy(enemy,999,player,2_001+kill*10);
    assert.notDeepEqual({level:player.cultivationSystem.level,exp:player.cultivationSystem.currentExp},before);
    if(player.cultivationSystem.level!==previousLevel){requirements.push(player.cultivationSystem.requiredEXP);previousLevel=player.cultivationSystem.level;}
  }
  assert.ok(player.cultivationSystem.level>=3);
  assert.ok(requirements.length>=3);
  for(let index=1;index<requirements.length;index++)assert.ok(requirements[index]>requirements[index-1]);
});

test('a kill at the end of level two carries overflow into level three',()=>{
  const room=new GameRoom('EXP-OVERFLOW');
  const levelTwoRequired=requiredEXP(2);
  const player=room.addPlayer('p1',{session:{cultivationSystem:{version:3,level:2,currentExp:levelTwoRequired-1}}},1_000);
  assert.equal(player.cultivationSystem.requiredEXP,levelTwoRequired);
  room.damageEnemy(room.enemies.get('fox-1'),999,player,2_000);
  assert.equal(player.cultivationSystem.level,3);
  assert.ok(player.cultivationSystem.currentExp>0);
  assert.equal(player.cultivationSystem.requiredEXP,requiredEXP(3));
});

test('death deducts ten percent once and requires explicit respawn',()=>{
  const room=new GameRoom('DEATH-LOOP');
  const player=room.addPlayer('p1',{session:{cultivationSystem:{level:1,currentExp:100}}},1_000);
  player.position={x:30,y:0,z:0};
  room.damagePlayer(player,999,{kind:'monster',id:'fox-1'},2_000);
  assert.equal(player.alive,false);
  assert.equal(player.cultivationSystem.currentExp,100-requiredEXP(1)*.1);
  room.tickPlayer(player,30,32_000);
  assert.equal(player.alive,false);
  assert.equal(player.cultivationSystem.currentExp,100-requiredEXP(1)*.1);
  const respawned=room.requestRespawn(player.id,33_000);
  assert.equal(respawned.alive,true);
  assert.equal(respawned.hp,respawned.maxHp);
  assert.equal(respawned.mp,respawned.maxMp);
});

test('Player death penalty never deranks and is applied only once',()=>{
  const cultivation=new CultivationSystem({level:3,currentExp:12});
  const player=new Player({hp:100,maxHp:100},cultivation);
  player.die();
  assert.equal(player.isDead,true);
  assert.equal(player.currentEXP,0);
  player.die();
  assert.equal(player.currentEXP,0);
  player.respawn();
  assert.equal(player.canAct,true);
  assert.equal(cultivation.level,3);
});

test('projectile VFX dissipates exactly at max range and on first collision',()=>{
  const rangeVfx=new VFXManager({screen:value=>value});
  rangeVfx.cast({faction:'orthodox',slot:'basic',origin:{x:0,z:0},direction:{x:1,z:0},target:{x:2,z:0},maxRange:2,hitboxWidth:.2});
  rangeVfx.update(.1);rangeVfx.update(.1);
  assert.equal(rangeVfx.effects.some(effect=>effect.kind!=='impact'),false);
  const rangeImpact=rangeVfx.effects.find(effect=>effect.kind==='impact');
  assert.equal(rangeImpact,undefined);

  const collisionVfx=new VFXManager({screen:value=>value,collisionTest:(_effect,position)=>position.x>=.9?{id:'enemy-1'}:null});
  collisionVfx.cast({faction:'heretic',slot:'q',origin:{x:0,z:0},direction:{x:1,z:0},target:{x:10,z:0},maxRange:10,hitboxWidth:.2,confirmedHitIds:['enemy-1']});
  collisionVfx.update(.1);
  const collisionImpact=collisionVfx.effects.find(effect=>effect.kind==='impact');
  assert.equal(collisionImpact.collided,true);
  assert.ok(collisionImpact.x>=.9&&collisionImpact.x<10);

  const rejectedVfx=new VFXManager({screen:value=>value,collisionTest:()=>({id:'enemy-1'})});
  rejectedVfx.cast({faction:'heretic',slot:'q',origin:{x:0,z:0},direction:{x:1,z:0},target:{x:2,z:0},maxRange:2,hitboxWidth:.2,confirmedHitIds:[]});
  rejectedVfx.update(.1);rejectedVfx.update(.1);
  assert.equal(rejectedVfx.effects.find(effect=>effect.kind==='impact'),undefined);
});

test('monster families expose distinct claw, projectile and shockwave attacks',()=>{
  assert.equal(monsterAttackFor('spirit_fox').vfx,'claw');
  assert.equal(monsterAttackFor('flame_imp').vfx,'dark-projectile');
  assert.equal(monsterAttackFor('fallen_guardian','thunder-nova').vfx,'shockwave');
  const monster=new Monster({id:'imp-1',type:'flame_imp',position:{x:0,z:0}});
  const visual=monster.beginAttack({attack:'dark-fireball',origin:{x:0,z:0},position:{x:3,z:0},resolveAt:1_680},1_000,1_000);
  assert.equal(visual.profile.sound,'monster-magic');
  assert.equal(visual.resolveAt,1_680);
  monster.updateAttackVisual(1_681);
  assert.equal(monster.attackVisual,null);

  monster.beginAttack({attack:'dark-fireball',origin:{x:0,z:0},position:{x:3,z:0},resolveAt:2_000},1_700,1_700);
  monster.sync({position:{x:0,z:0},pendingAttack:null},1_750,1_750);
  assert.equal(monster.attackVisual,null);
});

test('monster damage resolves only at impact time and only inside the telegraphed hitbox',()=>{
  const room=new GameRoom('MONSTER-HITBOX');
  const player=room.addPlayer('p1',{},1_000),wolf=room.enemies.get('wolf-1');
  player.position={x:wolf.position.x,y:0,z:wolf.position.z+1};
  const hp=player.hp;
  room.telegraphEnemyAttack(wolf,player,2_000);
  assert.equal(player.hp,hp);
  room.resolveEnemyAttack(wolf,2_519);
  assert.equal(player.hp,hp);
  room.resolveEnemyAttack(wolf,2_520);
  assert.ok(player.hp<hp);
  assert.ok(room.drainEvents().some(event=>event.type==='enemy:attack'&&event.hitIds.includes(player.id)));

  const afterHit=player.hp;
  room.telegraphEnemyAttack(wolf,player,3_000);
  player.position={x:20,y:0,z:0};
  room.resolveEnemyAttack(wolf,3_520);
  assert.equal(player.hp,afterHit);
});
