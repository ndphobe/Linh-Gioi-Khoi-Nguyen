import assert from "node:assert/strict";
import test from "node:test";

import {
  BREAKTHROUGH_WAVES,
  ENEMY_TEMPLATES,
  GameRoom,
  GameWorld,
  MONSTER_BALANCE,
  monsterScaleForWave,
  playerGrowthForLevel,
  sanitizeFaction,
  sanitizeName,
  sanitizeRoomCode,
} from "../server/world.js";

test("every cultivation level raises core stats and authoritative basic damage",()=>{
  const first=playerGrowthForLevel(1),sixth=playerGrowthForLevel(6);
  assert.ok(sixth.maxHp>first.maxHp);
  assert.ok(sixth.maxMp>first.maxMp);
  assert.ok(sixth.attackMultiplier>first.attackMultiplier);
  assert.ok(sixth.cultivationMultiplier>first.cultivationMultiplier);

  const strikeAt=level=>{
    const room=new GameRoom(`LEVEL-DAMAGE-${level}`);
    const player=room.addPlayer(`p-${level}`,{faction:'heretic',session:{cultivationSystem:{level,currentExp:0}}},1_000);
    const enemy=room.enemies.get('fox-1');enemy.maxHp=1_000;enemy.hp=1_000;player.position={x:-6,y:0,z:14};
    room.castAbility(player.id,{ability:'basic',aim:{x:0,z:-1},targetId:enemy.id},2_000);
    return {damage:1_000-enemy.hp,player};
  };
  const low=strikeAt(1),high=strikeAt(6);
  assert.ok(high.damage>low.damage);
  assert.equal(high.player.maxHp,sixth.maxHp);
  assert.equal(high.player.maxMp,sixth.maxMp);
});

test("monster balance applies requested nerfs and trash mobs die in 2-3 basic hits", () => {
  assert.equal(MONSTER_BALANCE.hpMultiplier, 0.60);
  assert.equal(MONSTER_BALANCE.attackMultiplier, 0.65);
  assert.ok(MONSTER_BALANCE.hitStunMs >= 450);
  assert.ok(ENEMY_TEMPLATES.spirit_fox.maxHp <= 18 * 3);
  assert.ok(ENEMY_TEMPLATES.flame_imp.maxHp <= 18 * 3);
  const room = new GameRoom("TRASH");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 1_000);
  const fox = room.enemies.get("fox-1");
  room.damageEnemy(fox, 18, player, 2_000);
  assert.equal(fox.stunnedUntil, 2_000 + MONSTER_BALANCE.hitStunMs);
  room.damageEnemy(fox, 18, player, 2_500);
  room.damageEnemy(fox, 18, player, 3_000);
  assert.equal(fox.alive, false);
});

test("join identity is sanitized and rooms never exceed eight players", () => {
  const room = new GameRoom("demo-01");
  for (let index = 0; index < 8; index += 1) {
    room.addPlayer(
      `player-${index}`,
      {
        name: `<b>  Đạo   Hữu ${index}  </b>`,
        faction: index % 2 === 0 ? "Ma Đạo" : "unknown",
        profile: { accentColor: "javascript:alert(1)", hair: "<script>tóc</script>" },
      },
      1_000,
    );
  }

  assert.equal(room.players.size, 8);
  assert.equal(room.players.get("player-0").name, "Đạo Hữu 0");
  assert.equal(room.players.get("player-0").faction, "demonic");
  assert.equal(room.players.get("player-0").profile.accentColor, "#69e6ff");
  assert.throws(
    () => room.addPlayer("player-9", { name: "Thứ Chín" }, 1_000),
    (error) => error.code === "ROOM_FULL",
  );
});

test("sanitizers preserve Vietnamese names, accents and spaces", () => {
  assert.equal(sanitizeName("  Mộ  Dung—Phục✨ "), "Mộ DungPhục");
  assert.equal(sanitizeFaction("Chính Đạo"), "orthodox");
  assert.equal(sanitizeRoomCode(" Tục   Danh Việt 42✨ "), "Tục Danh Việt 42");
  assert.throws(() => sanitizeRoomCode("x"), (error) => error.code === "INVALID_ROOM");
});

test("authoritative movement clamps teleport attempts and locked flight", () => {
  const room = new GameRoom("MOVE");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 10_000);
  const before = { ...player.position };
  room.updatePlayerMove(
    "p1",
    { position: { x: 9_999, y: 999, z: -9_999 }, flying: true, yaw: 99, sequence: 3 },
    10_100,
  );

  const moved = Math.hypot(player.position.x - before.x, player.position.z - before.z);
  assert.ok(moved <= 1.01, `teleport was clamped to ${moved}`);
  assert.equal(player.position.y, 0);
  assert.equal(player.isFlying, false);
  assert.equal(player.sequence, 3);
});

test("fast travel is realm-gated and uses town gates then local portals", () => {
  const room = new GameRoom("TRAVEL");
  const player=room.addPlayer("traveler", { name: "Lữ Khách" }, 1_000);
  assert.throws(() => room.fastTravel("traveler", "luoyang", 1_050), error=>error.code==='REALM_REQUIRED');
  player.cultivationSystem.sync({level:3,currentExp:0});
  room.syncCultivationFields(player);
  const first = room.fastTravel("traveler", "luoyang", 1_100);
  assert.deepEqual(first.position, { x: 25, y: 0, z: -5 });
  const second = room.fastTravel("traveler", "luoyang", 1_200);
  assert.deepEqual(second.position, { x: 28, y: 0, z: -8 });
  assert.throws(() => room.fastTravel("traveler", "heaven_sect", 1_300));
});

test("boss loot and cultivation resources are awarded by the room", () => {
  const room = new GameRoom("BOSS");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 1_000);
  const boss = room.enemies.get("boss-1");

  room.damageEnemy(boss, boss.maxHp, player, 2_000, { key: "test" });

  assert.equal(boss.alive, false);
  assert.equal(player.inventory.hoTamDan, 1);
  assert.equal(player.inventory.linhCot, 1);
  assert.equal(player.inventory.linhThach, 25);
  assert.equal(player.gold, 180);
  assert.ok(player.qi > 0);
  const lootEvent = room.drainEvents().find((event) => event.type === "loot:granted");
  assert.equal(lootEvent.loot.bossEquipment, "thunder_guard_talisman");
});

test("server-owned block reduces damage and a timed parry negates it", () => {
  const room = new GameRoom("PARRY");
  const player = room.addPlayer("p1", { name: "Hộ Pháp" }, 1_000);
  player.position = { x: 0, y: 0, z: 0 };
  const initialHp = player.hp;

  room.setBlocking(player.id, true, 1_100);
  const parried = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 1_260);
  assert.equal(parried, 0);
  assert.equal(player.hp, initialHp);
  assert.ok(room.drainEvents().some((event) => event.type === "player:parried"));

  room.setBlocking(player.id, true, 2_000);
  const reduced = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 2_500);
  assert.equal(reduced, 9);
  assert.equal(player.hp, initialHp - 9);
  const heldBlock = room.damagePlayer(player, 30, { kind: "melee", id: "wolf-1" }, 2_700);
  assert.equal(heldBlock, 9);
});

test("two forgiving lightning waves unlock Nguyên Anh without enabling flight", () => {
  const room = new GameRoom("REALM", { random: () => 0.5 });
  const player = room.addPlayer("p1", { name: "Độ Kiếp" }, 1_000);
  player.cultivationSystem.sync({version:3,level:6,currentExp:999_999});
  room.syncCultivationFields(player);
  player.position = { x: 35, y: 0, z: -20 };
  player.qi = player.maxQi;
  // Unit-level invulnerability isolates the lifecycle from dodge mechanics;
  // movement and dash validation are covered independently.
  player.invulnerableUntil = 20_000;

  room.startBreakthrough(player.id, 1_000);
  for (let now = 1_000; now <= 8_000; now += 50) room.tick(now);

  assert.equal(player.realm.id, "nascent_soul");
  assert.equal(player.flightUnlocked, false);
  room.updatePlayerMove(player.id, { position: { x: 36, y: 50, z: -20 }, flying: true }, 8_050);
  assert.equal(player.isFlying, false);
  assert.equal(player.position.y, 0);
  assert.equal(player.breakthrough.status, "idle");
  assert.equal(player.inventory.hoTamDan, 0);
  const strikes = room.drainEvents().filter((event) => event.type === "breakthrough:strike");
  assert.equal(strikes.length, BREAKTHROUGH_WAVES);
});

test("the second and only later tribulation unlocks Hóa Thần",()=>{
  const room=new GameRoom('SPIRIT-GATE',{random:()=>0.5});
  const player=room.addPlayer('p1',{session:{flightUnlocked:true,cultivationSystem:{version:3,level:10,currentExp:999_999}}},1_000);
  room.syncCultivationFields(player);
  player.invulnerableUntil=20_000;
  room.startBreakthrough(player.id,1_000);
  for(let now=1_000;now<=8_000;now+=50)room.tick(now);
  assert.equal(player.realm.id,'spirit_transformation');
  assert.equal(player.cultivationSystem.level,11);
  assert.equal(player.flightUnlocked,true);
  const ungated=room.addPlayer('p2',{session:{cultivationSystem:{version:3,level:4,currentExp:999_999}}},9_000);
  room.syncCultivationFields(ungated);
  assert.throws(()=>room.startBreakthrough(ungated.id,9_100),error=>error.code==='REALM_REQUIRED');
});

test("high cultivation reduces EXP efficiency",()=>{
  const room=new GameRoom('EXP-DIFFICULTY');
  const low=room.addPlayer('low',{session:{cultivationSystem:{version:3,level:4,currentExp:0}}},1_000);
  const high=room.addPlayer('high',{session:{cultivationSystem:{version:3,level:8,currentExp:0},flightUnlocked:true}},1_000);
  const lowGain=room.grantCultivationEXP(low,100,'comparison').awarded;
  const highGain=room.grantCultivationEXP(high,100,'comparison').awarded;
  assert.equal(lowGain,100);
  assert.ok(highGain<lowGain);
});

test("empty rooms tick safely and are pruned after their grace period", () => {
  const world = new GameWorld();
  const room = world.getOrCreateRoom("EMPTY");
  room.emptySince = 1_000;
  assert.doesNotThrow(() => world.tick(2_000));
  assert.deepEqual(room.snapshot(2_000).players, []);
  world.pruneEmptyRooms(70_000);
  assert.equal(world.rooms.has("EMPTY"), false);
});

test("player snapshots include only enemies in the current region", () => {
  const room = new GameRoom("REGION-SNAPSHOT");
  const player = room.addPlayer("p1", { name: "Kiếm Tu" }, 1_000);
  const fullSnapshot = room.snapshot(1_000);
  const playerSnapshot = room.snapshotForPlayer(player.id, 1_000);

  assert.ok(fullSnapshot.enemies.length > playerSnapshot.enemies.length);
  assert.ok(playerSnapshot.enemies.length > 0);
  assert.ok(playerSnapshot.enemies.every((enemy) => enemy.regionId === player.currentRegion));
});

test("public joins cannot forge gold, equipment or cultivation through the session payload",()=>{
  const world=new GameWorld();
  const {player}=world.joinRoom('socket-a','SECURE',{name:'Kẻ Gian',resumeToken:'securetoken12345678901234567890',session:{gold:999_999_999,inventory:['heaven_blade'],equipment:{weapon:'heaven_blade'},cultivationSystem:{level:16,currentExp:99_999}}},1_000);
  assert.equal(player.gold,100);
  assert.deepEqual(player.shopInventory,[]);
  assert.equal(player.equipment.weapon,null);
  assert.equal(player.cultivationSystem.level,1);
});

test("resume tokens restore authoritative economy, progression and resources after reconnect",()=>{
  const token='resumetoken123456789012345678901';
  const world=new GameWorld();
  const first=world.joinRoom('socket-a','RESUME',{name:'Lữ Khách',resumeToken:token},1_000).player;
  first.gold=321;first.inventory.hoTamDan=2;first.cultivationSystem.sync({level:3,currentExp:42});
  world.leaveRoom('socket-a','RESUME',2_000);
  const second=world.joinRoom('socket-b','RESUME',{name:'Lữ Khách',resumeToken:token,session:{gold:999_999}},2_100).player;
  assert.equal(second.gold,321);
  assert.equal(second.inventory.hoTamDan,2);
  assert.equal(second.cultivationSystem.level,3);
  assert.equal(second.cultivationSystem.currentExp,42);
});

test("one authoritative character token cannot be played by two sockets at once",()=>{
  const token='singleplayertoken12345678901234567',world=new GameWorld();
  world.joinRoom('socket-a','TOKEN',{resumeToken:token},1_000);
  assert.throws(()=>world.joinRoom('socket-b','TOKEN',{resumeToken:token},1_100),error=>error.code==='SESSION_IN_USE');
  world.leaveRoom('socket-a','TOKEN',1_200);
  assert.doesNotThrow(()=>world.joinRoom('socket-b','TOKEN',{resumeToken:token},1_300));
});

test("server skill state owns assignment, mana, cooldown and tier damage",()=>{
  const room=new GameRoom('SKILL-AUTH');
  const player=room.addPlayer('p1',{faction:'heretic',session:{cultivationSystem:{level:7,currentExp:0}}},1_000);
  assert.equal(player.skillSystem.hotbar.q,'venom_dart');
  room.updateSkill(player.id,{action:'upgrade',skillId:'venom_dart'},1_150);
  player.position={x:-6,y:0,z:14};
  const enemy=room.enemies.get('fox-1'),before=enemy.hp;
  const result=room.castAbility(player.id,{ability:'q',skillId:'venom_dart',aim:{x:0,z:-1}},2_000);
  assert.equal(result.skillId,'venom_dart');
  assert.equal(player.mp,88);
  assert.equal(player.cooldowns.Q,5_700);
  assert.ok(Math.abs((before-enemy.hp)-31.05*1.12)<1e-9);
  assert.throws(()=>room.castAbility(player.id,{ability:'q',skillId:'forged-skill',aim:{x:0,z:-1}},7_000),error=>error.code==='SKILL_MISMATCH');
});

test("skill unlocks enforce real level and gold on the server",()=>{
  const lowRoom=new GameRoom('SKILL-LEVEL');
  const low=lowRoom.addPlayer('low',{faction:'orthodox',session:{gold:999,cultivationSystem:{level:1,currentExp:0}}},1_000);
  low.skillSystem.skillUnlockPoints=9;
  assert.throws(()=>lowRoom.updateSkill(low.id,{action:'unlock',skillId:'jade_shield'},1_100),error=>error.code==='SKILL_LEVEL_REQUIRED');

  const room=new GameRoom('SKILL-PRICE');
  const player=room.addPlayer('p1',{faction:'orthodox',session:{gold:79,cultivationSystem:{level:2,currentExp:0}}},1_000);
  assert.throws(()=>room.updateSkill(player.id,{action:'unlock',skillId:'jade_shield'},1_100),error=>error.code==='NOT_ENOUGH_GOLD');
  player.gold=100;
  const result=room.updateSkill(player.id,{action:'unlock',skillId:'jade_shield'},1_200);
  assert.equal(result.player.gold,20);
  assert.equal(result.skillSystem.unlocked.jade_shield,1);
});

test("a premium skill keeps its own area behavior and real damage on any hotbar key",()=>{
  const room=new GameRoom('PREMIUM-SKILL');
  const player=room.addPlayer('p1',{faction:'demonic',session:{gold:10_000,cultivationSystem:{level:13,currentExp:0}}},1_000);
  room.updateSkill(player.id,{action:'unlock',skillId:'blood_moon'},1_100);
  room.updateSkill(player.id,{action:'assign',skillId:'blood_moon',slot:'e'},1_200);
  player.position={x:-6,y:0,z:14};
  const enemy=room.enemies.get('fox-1');enemy.maxHp=1_000;enemy.hp=1_000;const before=enemy.hp;
  const result=room.castAbility(player.id,{ability:'e',skillId:'blood_moon',aim:{x:1,z:0}},2_000);
  assert.ok(result.hitIds.includes(enemy.id));
  assert.ok(before-enemy.hp>300);
  assert.equal(player.gold,5_200);
});

test("target lock hits an in-range enemy even when the aim packet is off-axis",()=>{
  const room=new GameRoom('TARGET-LOCK');
  const player=room.addPlayer('p1',{faction:'orthodox'},1_000);
  const enemy=room.enemies.get('fox-1');
  player.position={x:-6,y:0,z:14};
  const before=enemy.hp;
  const result=room.castAbility(player.id,{ability:'basic',aim:{x:1,z:0},targetId:enemy.id},2_000);
  assert.deepEqual(result.hitIds,[enemy.id]);
  assert.ok(enemy.hp<before);
});

test("poison skills tick authoritative damage and armor mitigates incoming hits",()=>{
  const room=new GameRoom('STATUS-GEAR');
  const poisoner=room.addPlayer('poisoner',{faction:'heretic',session:{cultivationSystem:{level:3},skillSystem:{faction:'heretic'}}},1_000);
  room.applyDamageOverTime(room.enemies.get('boss-1'),poisoner,18,1_000);
  const boss=room.enemies.get('boss-1'),bossHp=boss.hp;
  room.tickEnemy(boss,0,2_000);room.tickEnemy(boss,0,3_000);room.tickEnemy(boss,0,4_000);
  assert.equal(bossHp-boss.hp,18);

  const tank=room.addPlayer('tank',{session:{inventory:['spirit_robe'],equipment:{armor:'spirit_robe'}}},5_000);
  tank.position={x:30,y:0,z:0};
  assert.equal(tank.maxMp,114);
  assert.equal(room.damagePlayer(tank,107,{kind:'monster'},6_000),100);
});

test("EXP crosses Kim Đan normally and stops only at the Nguyên Anh gate",()=>{
  const room=new GameRoom('PROGRESSION-GATE');
  const player=room.addPlayer('p1',{session:{cultivationSystem:{level:4,currentExp:500}}},1_000);
  room.grantCultivationEXP(player,10_000,'test');
  assert.equal(player.cultivationSystem.level,6);
  assert.equal(player.cultivationSystem.progress,100);
  assert.equal(player.realm.id,'golden_core');
});

test("later monster rounds change assets and scale combat stats",()=>{
  const room=new GameRoom('MONSTER-WAVES');
  const enemy=room.enemies.get('fox-1');
  const first={variant:enemy.spriteVariant,hp:enemy.maxHp,damage:enemy.damage,speed:enemy.speed};
  room.respawnEnemy(enemy,2_000);
  assert.equal(enemy.wave,1);
  assert.equal(enemy.level,2);
  assert.notEqual(enemy.spriteVariant,first.variant);
  assert.ok(enemy.maxHp>first.hp);
  assert.ok(enemy.damage>first.damage);
  assert.ok(enemy.speed>first.speed);
  assert.ok(monsterScaleForWave(12).hp>monsterScaleForWave(2).hp);
  for(let kill=1;kill<5;kill++)room.respawnEnemy(enemy,2_000+kill);
  assert.equal(enemy.wave,2);
  assert.equal(enemy.level,1);
  const laterMap=room.enemies.get('heaven_sect-fox-1');
  assert.ok(laterMap.maxHp>first.hp);
  assert.ok(laterMap.damage>first.damage);
});

test("rare monster loot grants a real skill-upgrade point",()=>{
  const room=new GameRoom('RARE-SKILL-POINT',{random:()=>0});
  const player=room.addPlayer('p1',{},1_000),before=player.skillSystem.skillUpgradePoints;
  room.damageEnemy(room.enemies.get('fox-1'),999,player,2_000);
  const loot=room.drainEvents().find(event=>event.type==='loot:granted')?.loot;
  assert.equal(player.skillSystem.skillUpgradePoints,before+1);
  assert.equal(loot.skillUpgradePoints,1);
  assert.equal(loot.skillSystem.skillUpgradePoints,before+1);
});

test("sect equipment is authoritative, visible in state and can be unequipped",()=>{
  const room=new GameRoom('SECT-EQUIPMENT');
  const player=room.addPlayer('p1',{faction:'orthodox',session:{inventory:['celestial_sword_set','blood_lord_set']}},1_000);
  room.equipItem(player.id,'celestial_sword_set',2_000);
  assert.equal(player.equipment.armor,'celestial_sword_set');
  assert.equal(room.privatePlayerSnapshot(player.id,2_100).equipment.armor,'celestial_sword_set');
  room.unequipItem(player.id,'celestial_sword_set',2_200);
  assert.equal(player.equipment.armor,null);
  assert.throws(()=>room.equipItem(player.id,'blood_lord_set',2_300),error=>error.code==='FACTION_REQUIRED');
});
