import { FACTIONS } from './data.js';
import { CULTIVATION_REALMS, HOTBAR_SLOTS, SkillSystemManager, cooldownVisual } from './SkillSystem.js';
import { HUDManager } from './HUDManager.js';
import { MapManager, REGIONS } from './MapManager.js';
import { ShopSystem, SHOP_ITEMS, itemById } from './ShopSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { LootManager } from './LootManager.js';
import { BossController } from './BossController.js';
import { GoldDropSystem } from './GoldDropSystem.js';
import { VFXManager } from './VFXManager.js';
import { getSectCombatData } from './SectData.js';

export const PLAYER_MOTION = Object.freeze({
  walkSpeed: 6.2, acceleration: 18, deceleration: 23,
  dashDistance: 4.4, dashDuration: .18, dashCooldown: 1.2, dashIFrames: .32,
  cameraSharpness: 8.5,
});

const COLORS = Object.freeze({
  orthodox: { robe: '#dcecf0', trim: '#4fcce5', dark: '#24405b', aura: '#57e8ff' },
  demonic: { robe: '#2a202f', trim: '#e13d61', dark: '#100c17', aura: '#ff3f79' },
  heretic: { robe: '#193c36', trim: '#81e65a', dark: '#111c22', aura: '#7aff71' },
});
const KEYS_TO_SLOT = { KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyF: 'f', KeyG: 'g' };
const REGION_THEMES = Object.freeze({
  sect_hall:{base:'#17191e',tileA:'#30272a',tileB:'#292328',line:'#54383c',accent:'#c69a45',mini:'#30272a',prop:'palace'},
  luoyang:{base:'#252019',tileA:'#514638',tileB:'#453b31',line:'#6c5c47',accent:'#e5a24b',mini:'#544a38',prop:'city'},
  spirit_mine:{base:'#101821',tileA:'#25313b',tileB:'#1c2932',line:'#344e5e',accent:'#75e6ff',mini:'#182c37',prop:'crystal'},
  heaven_sect:{base:'#182533',tileA:'#365064',tileB:'#2c4355',line:'#597589',accent:'#e8e0ad',mini:'#34556a',prop:'cloud'},
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pos = (value = {}) => ({ x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 });

export class CultivationGame {
  constructor({ canvas, socket, profile, audio, onProfileChange, onExit }) {
    this.canvas = canvas; this.socket = socket; this.audio = audio;
    this.onProfileChange = onProfileChange; this.onExit = onExit;
    this.profile = { hp: 120, maxHp: 120, mp: 100, maxMp: 100, qi: 0, ...profile };
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.skillSystem = new SkillSystemManager({ faction: this.profile.faction, realmId: this.profile.realm, minorLevel: this.profile.minorLevel ?? 9, state: this.profile.skillSystem });
    this.shopSystem = new ShopSystem(this.profile.shopSystem ?? { gold: this.profile.gold });
    this.profile.currentRegion ??= 'sect_hall';
    this.player = { position: { x: 0, y: 0, z: 26 }, velocity: { x: 0, z: 0 }, facing: 4, aimAngle: 0, action: 'idle', actionTime: 0 };
    this.camera = { x: 0, z: 26 };
    this.state = { running: false, paused: false, meditation: false, dashTime: 0, dashCooldown: 0, invulnerableUntil: 0, joined: false };
    this.keys = new Set(); this.enemies = new Map(); this.remotePlayers = new Map();
    this.effects = []; this.pendingEffects = []; this.damageNumbers = []; this.cooldowns = new Map(); this.cooldownTotals = new Map(); this.lastFrame = performance.now(); this.netTime = 0;
    this.mouse = { x: 0, y: 0, active: false }; this.pointTarget = null;
    this.hudVisibleUntil = performance.now() + 10_000; this.hudHover = false; this.bossEngaged = false;
    this.tribulation = null; this.cultivationTick = 0; this.bossCombatUntil = 0;
    this.terrainProps = this.createTerrainProps();
    this.sprite = new Image(); this.sprite.src = new URL(`${import.meta.env.BASE_URL}assets/sect-character-atlas-v2.png`, document.baseURI).href;
    this.ui = this.collectUI();
    this.hudManager = new HUDManager(active => { this.state.paused = Boolean(active && active !== 'tribulation'); });
    this.hudManager.register('pause', this.ui.pauseMenu); this.hudManager.register('map', this.ui.worldMap);
    this.mapManager = new MapManager({ overlay: this.ui.worldMap, realmOrder: this.realmOrder(), currentRegion: this.profile.currentRegion, onTeleport: (target, region) => this.fastTravel(target, region), onClose: () => this.hudManager.close('map') });
    this.ensureGoldCounter(); this.ensureShopUI();
    this.ensureInventoryUI();
    this.inventorySystem=new InventorySystem(this.shopSystem,this.profile);
    this.goldDropSystem=new GoldDropSystem({screen:world=>this.screen(world),audio:this.audio,onPickup:amount=>this.collectGold(amount)});
    this.vfxManager=new VFXManager({screen:world=>this.screen(world),audio:this.audio});
    this.lootManager=new LootManager({inventory:this.inventorySystem,audio:this.audio,onGold:(amount,event)=>this.dropGoldFromEvent(amount,event),onBossReward:id=>this.toast(`Đã nhận Trang Bị Boss: ${itemById(id)?.name??id}`,'legendary'),onChange:()=>this.persistEconomy()});
    this.bossController=new BossController({onDefeated:()=>this.goldBurst()});
    this.hudManager.bindCurrency('gold',this.ui.goldCount);this.hudManager.updateCurrency('gold',this.shopSystem.gold);
    this.cleanup = [];
    this.bound = { keydown: e => this.keydown(e), keyup: e => this.keys.delete(e.code), resize: () => this.resize(), loop: t => this.loop(t) };
    this.attach(); this.attachSocket(); this.resize();
  }

  collectUI() {
    const id = value => document.getElementById(value);
    return { app: id('app'), hud: id('hud'), hpFill: id('hp-fill'), hpText: id('hp-text'), mpFill: id('mp-fill'), mpText: id('mp-text'), qiFill: id('qi-fill'), qiText: id('qi-text'), playerName: id('player-name'), realmName: id('realm-name'), sectName: id('sect-name'), onlineCount: id('online-count'), skillbar: id('skillbar'), toastStack: id('toast-stack'), pauseMenu: id('pause-menu'), worldMap: id('world-map'), interactionPrompt: id('interaction-prompt'), objectiveTitle: id('objective-title'), objectiveText: id('objective-text'), bossHud: id('boss-hud'), bossName: id('boss-name'), bossFill: id('boss-fill'), bossText: id('boss-text') };
  }

  listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    this.cleanup.push(() => target.removeEventListener(type, handler, options));
  }

  attach() {
    this.listen(window, 'keydown', this.bound.keydown); this.listen(window, 'keyup', this.bound.keyup); this.listen(window, 'resize', this.bound.resize);
    this.listen(this.canvas, 'pointermove', e => this.updatePointer(e));
    this.listen(this.canvas, 'pointerleave', () => { this.mouse.active=false;this.hudHover=false; });
    this.listen(this.canvas, 'pointerdown', e => { this.updatePointer(e); if (e.button === 0) this.cast('basic'); if (e.button === 2) this.setBlocking(true); });
    this.listen(this.canvas, 'pointerup', e => { if(e.button===2)this.setBlocking(false); });
    this.listen(this.canvas, 'pointercancel', () => this.setBlocking(false));
    this.listen(window, 'blur', () => { this.keys.clear(); this.setBlocking(false); });
    this.listen(this.canvas, 'contextmenu', e => e.preventDefault());
    this.ui.skillbar?.querySelectorAll('[data-skill]').forEach(button => { this.listen(button, 'click', () => this.cast(button.dataset.skill));this.listen(button, 'contextmenu',e=>{e.preventDefault();if(button.dataset.skill!=='basic')this.unbindSkill(button.dataset.skill);}); });
    const playerPanel=document.querySelector('.player-panel');this.listen(playerPanel, 'mouseenter',()=>{this.hudHover=true;});this.listen(playerPanel, 'mouseleave',()=>{this.hudHover=false;});
    this.listen(document.getElementById('resume-game'), 'click', () => this.togglePause(false));
    this.listen(document.getElementById('change-sect'), 'click', () => { this.destroy(); this.onExit?.(); });
    this.listen(document.getElementById('restart-game'), 'click', () => location.reload());
    this.listen(this.ui.app, 'pointerdown',event=>{if(event.target.closest('button'))this.audio?.play('ui');});
  }

  attachSocket() {
    if (!this.socket) return;
    this.socket.on('world:snapshot', data => this.snapshot(data));
    this.socket.on('player:state', data => this.mergeSelf(data));
    this.socket.on('world:event', event => { if(event?.type==='loot:granted'&&event.playerId!==this.socket.id)return;this.lootManager?.handle(event);this.bossController?.handle(event,this.enemies);if(event?.type==='enemy:respawned')this.bossController?.respawn(event.enemyId);const gameplayEvent=event?.type==='loot:granted'?{...event,loot:{...event.loot,gold:0}}:event;this.worldEvent(gameplayEvent); });
    this.socket.on('game:error', error => this.toast(error?.message ?? 'Thiên đạo từ chối hành động.', 'error'));
  }

  start() {
    this.state.running = true; this.ui.hud?.removeAttribute('hidden'); this.ui.hud?.classList.add('is-visible');
    this.updateRegionUI();
    this.join(); this.updateUI(); requestAnimationFrame(this.bound.loop);
    if(this.skillSystem.minorLevel===9&&this.skillSystem.cultivationProgress>=100)setTimeout(()=>this.beginTribulation(),450);
    this.toast('Canvas 2D · top-down 2.5D đã kích hoạt', 'success');
  }

  join() {
    this.socket?.emit('room:join', { roomCode: this.profile.roomCode, room: this.profile.roomCode, name: this.profile.name, faction: this.profile.faction, sect: this.profile.faction }, response => {
      if (response?.ok === false) return this.toast(response.error?.message ?? response.message ?? 'Không thể vào phòng.', 'error');
      this.state.joined = true; if (response?.snapshot) this.snapshot(response.snapshot); if (response?.player) this.mergeSelf(response.player);
    });
  }

  keydown(event) {
    if (!this.state.running) return;
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if(event.code==='Space'&&this.tribulation?.active){event.preventDefault();this.resolveTribulationInput();return;}
    if (event.code === 'Escape') { if(this.hudManager.active)return this.hudManager.close(); return this.togglePause(true); }
    if (event.code === 'KeyM') return this.toggleWorldMap();
    if (event.code === 'KeyK') return this.toggleSkillTree();
    if (event.code === 'KeyP') return this.toggleShop();
    if (event.code === 'KeyB') return this.toggleInventory();
    if (event.code === 'KeyC') return this.toggleMeditation();
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') return this.dash();
    if (KEYS_TO_SLOT[event.code]) this.cast(KEYS_TO_SLOT[event.code]);
  }

  input() {
    let x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let z = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    if (!x && !z && this.pointTarget) { const dx=this.pointTarget.x-this.player.position.x,dz=this.pointTarget.z-this.player.position.z,d=Math.hypot(dx,dz);if(d>.25){x=dx/d;z=dz/d;}else this.pointTarget=null; }
    else if (x || z) this.pointTarget=null;
    const length = Math.hypot(x, z); if (length > 0) { x /= length; z /= length; }
    return { x, z };
  }

  updatePointer(event) { const rect=this.canvas.getBoundingClientRect();this.mouse.x=(event.clientX-rect.left)*this.canvas.width/rect.width;this.mouse.y=(event.clientY-rect.top)*this.canvas.height/rect.height;this.mouse.active=true;const dx=this.mouse.x-this.canvas.width/2,dy=this.mouse.y-this.canvas.height/2;this.player.aimAngle=Math.atan2(dy,dx);this.hudHover=Math.hypot(dx,dy)<42;const enemyHover=[...this.enemies.values()].some(enemy=>{if(enemy.alive===false)return false;const p=this.screen(enemy.position);return Math.hypot(p.x-this.mouse.x,p.y-18-this.mouse.y)<24;});this.canvas.classList.toggle('is-enemy-hover',enemyHover); }
  setPointTarget(){this.pointTarget={x:this.camera.x+(this.mouse.x-this.canvas.width/2)/18,z:this.camera.z+(this.mouse.y-this.canvas.height/2)/12};}
  setBlocking(active){if(this.state.paused||this.tribulation?.active)return;this.state.blocking=Boolean(active);this.player.action=active?'block':'idle';this.player.actionTime=0;this.socket?.emit('combat:block',{active:Boolean(active)});}

  dash() {
    if (this.state.dashCooldown > 0 || this.state.meditation) return;
    let direction = this.input();
    if (!direction.x && !direction.z) direction = { x: Math.cos(this.player.aimAngle), z: Math.sin(this.player.aimAngle) };
    this.state.dashDirection = direction; this.state.dashTime = PLAYER_MOTION.dashDuration; this.state.dashCooldown = PLAYER_MOTION.dashCooldown;
    this.state.invulnerableUntil = performance.now() / 1000 + PLAYER_MOTION.dashIFrames;
    this.socket?.emit('player:dash', { direction }); this.audio?.play('dash');
  }

  cast(slot) {
    if (this.state.paused || this.state.meditation || this.tribulation?.active) return;
    const equipped = slot === 'basic' ? { archetype: 'basic', manaCost: 0, cooldown: .42 } : this.skillSystem.skillForSlot(slot);
    if (!equipped) return this.toast('Ô kỹ năng trống · nhấn K để gán.', 'warning');
    if ((this.cooldowns.get(slot) ?? 0) > 0 || this.profile.mp < equipped.manaCost) return;
    this.profile.mp -= equipped.manaCost; this.cooldowns.set(slot, equipped.cooldown);this.cooldownTotals.set(slot,equipped.cooldown);
    this.player.action = slot === 'basic' ? 'slash' : 'cast'; this.player.actionTime = 0;
    const angle = this.mouse.active ? this.player.aimAngle : this.player.facing*Math.PI/4-Math.PI/2; const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    this.player.facing=(Math.round((angle+Math.PI/2)/(Math.PI/4))+8)%8;
    const target={x:this.player.position.x+direction.x*5,z:this.player.position.z+direction.z*5},sect=getSectCombatData(this.profile.faction),vfxSlot=slot==='basic'?'basic':equipped.archetype??slot;
    this.vfxManager.cast({faction:this.profile.faction,slot:vfxSlot,origin:this.player.position,direction,target});
    if(slot!=='basic')this.effects.push({type:'danger',...target,radius:this.profile.faction==='demonic'?3.6:2.5,life:.3,max:.3,color:sect.primary});
    if(this.profile.faction==='demonic'&&slot!=='basic')this.profile.hp=Math.min(this.profile.maxHp,this.profile.hp+Math.max(2,(equipped.damage??20)*sect.mechanics.lifeSteal));
    if(this.profile.faction==='heretic'&&vfxSlot==='r'){this.player.position.x=clamp(this.player.position.x+direction.x*3,-48,48);this.player.position.z=clamp(this.player.position.z+direction.z*3,-48,48);this.state.invulnerableUntil=performance.now()/1000+.3;}
    this.socket?.emit('combat:ability', { ability: slot, abilityId: slot, direction, aim: direction, position: this.player.position, sectMechanics:sect.mechanics });
  }

  toggleMeditation() { this.state.meditation = !this.state.meditation; this.player.action = this.state.meditation ? 'cast' : 'idle'; this.player.actionTime = 0; this.socket?.emit('cultivation:meditate', { active: this.state.meditation }); }
  unbindSkill(slot){if(this.skillSystem.unassign(slot)){this.profile.skillSystem=this.skillSystem.serialize();this.onProfileChange?.(this.profile);this.updateUI();this.toast(`Đã gỡ kỹ năng khỏi ${slot.toUpperCase()}`,'info');}}
  togglePause(force) { if(force===false)return this.hudManager.close('pause');if(force===true)return this.hudManager.open('pause');return this.hudManager.toggle('pause'); }
  toggleWorldMap() { return this.hudManager.toggle('map'); }
  realmOrder(){return CULTIVATION_REALMS.find(r=>r.id===this.skillSystem.realmId)?.order??0;}
  fastTravel(target, region){
    const apply=player=>{const p=pos(player?.position??target);this.player.position={...this.player.position,x:p.x,z:p.z};this.player.velocity={x:0,z:0};this.camera.x=p.x;this.camera.z=p.z;this.profile.currentRegion=region.id;this.mapManager.currentRegion=region.id;this.mapManager.updateMarker();this.mapManager.bindNodes();this.updateRegionUI();this.persistEconomy();this.effects.push({type:'circle',x:p.x,z:p.z,life:1,max:1,color:REGION_THEMES[region.id]?.accent??'#ffe69a'});this.toast(`Đã dịch chuyển đến ${region.name}`,'success');};
    if(!this.socket)return apply();
    this.socket.emit('player:fast-travel',{regionId:region.id},response=>{if(response?.ok===false)return this.toast(response.error?.message??response.message??'Không thể dịch chuyển.','error');apply(response?.player);});
  }
  currentRegion(){return REGIONS.find(region=>region.id===this.profile.currentRegion)??REGIONS[0];}
  regionTheme(){return REGION_THEMES[this.profile.currentRegion]??REGION_THEMES.sect_hall;}
  updateRegionUI(){const region=this.currentRegion();const minimapName=document.querySelector('.minimap-heading span');if(minimapName)minimapName.textContent=region.name;document.body.dataset.region=region.id;}

  update(dt) {
    this.state.dashCooldown = Math.max(0, this.state.dashCooldown - dt);
    this.goldDropSystem?.update(dt,this.player.position);
    this.vfxManager?.update(dt);
    this.cooldowns.forEach((value,key)=>{const next=Math.max(0,value-dt);this.cooldowns.set(key,next);if(value>0&&next===0){const button=this.ui.skillbar?.querySelector(`[data-skill="${key}"]`);this.hudManager.pulseSkillReady(button);this.audio?.play('cooldown-ready');}});
    if(this.state.meditation&&!this.tribulation?.active){this.cultivationTick+=dt;if(this.cultivationTick>=.25){this.gainCultivation(2);this.cultivationTick=0;}}
    const direction = this.state.meditation || this.tribulation?.active || this.state.blocking ? { x: 0, z: 0 } : this.input();
    const moving = direction.x || direction.z;
    if (moving) this.player.facing = (Math.round(Math.atan2(direction.x, -direction.z) / (Math.PI / 4)) + 8) % 8;
    if(this.mouse.active&&(this.player.action!=='idle'||!moving))this.player.facing=(Math.round((this.player.aimAngle+Math.PI/2)/(Math.PI/4))+8)%8;
    if (this.state.dashTime > 0) {
      this.state.dashTime -= dt; const speed = PLAYER_MOTION.dashDistance / PLAYER_MOTION.dashDuration;
      this.player.velocity.x = this.state.dashDirection.x * speed; this.player.velocity.z = this.state.dashDirection.z * speed;
      if (Math.random() < dt * 32) this.effects.push({ type: 'afterimage', x: this.player.position.x, z: this.player.position.z, life: .28, max: .28, color: COLORS[this.profile.faction].aura });
    } else {
      const response = moving ? PLAYER_MOTION.acceleration : PLAYER_MOTION.deceleration;
      const t = 1 - Math.exp(-response * dt);
      this.player.velocity.x = lerp(this.player.velocity.x, direction.x * PLAYER_MOTION.walkSpeed, t);
      this.player.velocity.z = lerp(this.player.velocity.z, direction.z * PLAYER_MOTION.walkSpeed, t);
    }
    this.player.position.x = clamp(this.player.position.x + this.player.velocity.x * dt, -48, 48);
    this.player.position.z = clamp(this.player.position.z + this.player.velocity.z * dt, -48, 48);
    this.player.actionTime += dt;
    if (!this.state.meditation && !this.state.blocking && this.player.action !== 'idle' && this.player.actionTime > .58) this.player.action = 'idle';
    const cameraT = 1 - Math.exp(-PLAYER_MOTION.cameraSharpness * dt);
    this.camera.x = lerp(this.camera.x, this.player.position.x, cameraT); this.camera.z = lerp(this.camera.z, this.player.position.z, cameraT);
    for (let i = this.effects.length - 1; i >= 0; i--) { const effect = this.effects[i]; effect.life -= dt; if (effect.type === 'wave') { effect.x += effect.dx * 15 * dt; effect.z += effect.dz * 15 * dt; } if(effect.type==='burst'||effect.type==='spark'){effect.x+=effect.dx*5*dt;effect.z+=effect.dz*5*dt;}if(effect.type==='spirit')effect.z-=dt*.7;if (effect.life <= 0) this.effects.splice(i, 1); }
    const now=performance.now();for(let i=this.pendingEffects.length-1;i>=0;i--)if(now>=this.pendingEffects[i].at){const effect=this.pendingEffects.splice(i,1)[0];this.effects.push({...effect,life:.65,max:.65});}
    for(let i=this.damageNumbers.length-1;i>=0;i--){this.damageNumbers[i].life-=dt;this.damageNumbers[i].z-=dt*.55;if(this.damageNumbers[i].life<=0)this.damageNumbers.splice(i,1);}
    this.netTime += dt; if (this.netTime >= 1 / 20) { this.netTime = 0; this.socket?.emit('player:move', { position: this.player.position, yaw: this.player.facing * Math.PI / 4, velocity: this.player.velocity, meditating: this.state.meditation, sequence: Date.now() }); }
    const boss=[...this.enemies.values()].find(e=>e.isBoss&&e.alive!==false);if(boss){const pixels=Math.hypot((boss.position.x-this.player.position.x)*18,(boss.position.z-this.player.position.z)*12);const combat=performance.now()<this.bossCombatUntil||boss.isAttacking||boss.tookDamageRecently;if(pixels<250||combat)this.bossEngaged=true;if(pixels>300&&!combat)this.bossEngaged=false;}
    this.updateTribulation(dt);this.updateHudVisibility();
  }

  snapshot(data = {}) {
    const ownId = this.socket?.id;
    for (const player of data.players ?? []) { if (player.id === ownId) this.mergeSelf(player); else this.remotePlayers.set(player.id, { ...player, target: pos(player.position) }); }
    const seen = new Set(); for (const enemy of data.enemies ?? []) { seen.add(enemy.id); const old = this.enemies.get(enemy.id); this.enemies.set(enemy.id, { ...old, ...enemy, position: pos(enemy.position), target: pos(enemy.position), hurt: old && enemy.hp < old.hp ? .28 : Math.max(0, (old?.hurt ?? 0) - .05) }); }
    for (const id of this.enemies.keys()) if (!seen.has(id)) this.enemies.delete(id);
    if (this.ui.onlineCount) this.ui.onlineCount.textContent = String(data.players?.length ?? 1);
  }
  syncServerGold(data={}){if(!Number.isFinite(Number(data.gold)))return;const serverGold=Number(data.gold);if(this.lastServerGold===undefined){this.lastServerGold=serverGold;return;}if(serverGold>this.lastServerGold){const missed=serverGold-this.lastServerGold;this.syncedGoldAwaitingEvents=(this.syncedGoldAwaitingEvents??0)+missed;this.shopSystem.addGold(missed);this.spawnGoldPickup(missed);this.persistEconomy();}this.lastServerGold=serverGold;}
  mergeSelf(data = {}) { const oldHp=this.profile.hp;this.profile.hp = Number(data.hp ?? this.profile.hp); this.profile.maxHp = Number(data.maxHp ?? this.profile.maxHp); this.profile.mp = Number(data.mp ?? this.profile.mp); this.profile.maxMp = Number(data.maxMp ?? this.profile.maxMp); this.profile.qi = Number(data.qi ?? this.profile.qi);if(this.profile.hp<oldHp&&this.state.blocking)this.blockImpact(); if (data.position && this.state.dashTime <= 0) { const p = pos(data.position); this.player.position.x = lerp(this.player.position.x, p.x, .18); this.player.position.z = lerp(this.player.position.z, p.z, .18); } }
  worldEvent(event = {}) { if (event.type === 'enemy:damaged') { const enemy = this.enemies.get(event.enemyId); if (enemy){enemy.hurt=.34;if(enemy.isBoss){this.bossEngaged=true;this.bossCombatUntil=performance.now()+4500;enemy.tookDamageRecently=true;setTimeout(()=>{enemy.tookDamageRecently=false;},4500);}this.damageNumbers.push({x:enemy.position.x,z:enemy.position.z,value:Math.round(event.damage??0),life:.85,max:.85});} } if(event.type==='enemy:telegraph'&&event.position){this.bossEngaged=true;this.bossCombatUntil=performance.now()+4500;const p=pos(event.position);const ms=Math.max(150,(event.resolveAt??Date.now()+700)-Date.now());this.effects.push({type:'danger',x:p.x,z:p.z,radius:event.radius??3,life:ms/1000,max:ms/1000,color:'#ff243f'});this.pendingEffects.push({at:performance.now()+ms,type:'lightning',x:p.x,z:p.z,color:'#d9c4ff'});} if(event.type==='player:blocked'&&event.playerId===this.socket?.id)this.blockImpact();if(event.type==='player:parried'&&event.playerId===this.socket?.id)this.blockImpact(true);if(event.type==='loot:granted'){if(event.loot?.qi)this.gainCultivation(event.loot.qi);if(event.loot?.gold){this.shopSystem.addGold(event.loot.gold);this.persistEconomy();this.toast(`+${event.loot.gold} Vàng`,'legendary');}} }
  blockImpact(parry=false){const a=this.player.aimAngle;for(let i=0;i<10;i++)this.effects.push({type:'spark',x:this.player.position.x+Math.cos(a),z:this.player.position.z+Math.sin(a),dx:Math.cos(a)+(Math.random()-.5),dz:Math.sin(a)+(Math.random()-.5),life:.3,max:.3,color:parry?'#fff2a0':'#bff6ff'});this.audio?.play('block');}

  gainCultivation(amount){const result=this.skillSystem.gainCultivation(amount);if(result.tribulationReady&&!this.tribulation?.active)this.beginTribulation();if(!result.gained)return;const color=COLORS[this.profile.faction].aura;for(let i=0;i<5;i++)this.effects.push({type:'spirit',x:this.player.position.x+(Math.random()-.5)*1.5,z:this.player.position.z+(Math.random()-.5)*1.5,life:.7+Math.random()*.35,max:1,color});if(result.levels){this.goldBurst();this.toast(`Tiểu Cấp tăng lên Cấp ${this.skillSystem.minorLevel} · +${result.levels} Điểm Nâng Cấp`,'legendary');}this.profile.skillSystem=this.skillSystem.serialize();this.onProfileChange?.(this.profile);}
  goldBurst(){for(let i=0;i<18;i++){const a=i/18*Math.PI*2;this.effects.push({type:'burst',x:this.player.position.x,z:this.player.position.z,dx:Math.cos(a),dz:Math.sin(a),life:.8,max:.8,color:'#ffd86a'});}}
  spawnGoldPickup(amount){this.damageNumbers.push({x:this.player.position.x,z:this.player.position.z,value:`+${amount} Vàng`,gold:true,life:1.2,max:1.2});for(let i=0;i<7;i++)this.effects.push({type:'spark',x:this.player.position.x+(Math.random()-.5),z:this.player.position.z+(Math.random()-.5),dx:(Math.random()-.5)*.7,dz:-.4-Math.random(),life:.65,max:.65,color:'#ffd34f'});const popup=document.createElement('div');popup.className='gold-loot-popup';popup.innerHTML=`<i>🪙</i><strong>+${amount} Vàng</strong>`;this.ui.hud?.appendChild(popup);requestAnimationFrame(()=>popup.classList.add('is-visible'));setTimeout(()=>popup.remove(),1400);}
  dropGoldFromEvent(amount,event){const enemy=this.enemies.get(event?.enemyId),position=enemy?.position??this.player.position;this.goldDropSystem.spawnGoldLoot(position.x,position.z,amount,{boss:Boolean(enemy?.isBoss)});}
  collectGold(amount){this.shopSystem.addGold(amount);this.profile.gold=this.shopSystem.gold;this.hudManager.updateCurrency('gold',this.shopSystem.gold);this.persistEconomy();}
  beginTribulation(){if(this.tribulation?.active)return;this.state.meditation=false;this.tribulation={active:true,round:1,time:0,hits:0};this.ensureTribulationUI();this.hudManager.open('tribulation');this.toast('ĐỘ KIẾP · Nhấn SPACE khi vòng sáng hội tụ!','realm');}
  ensureTribulationUI(){if(this.tribulationUI)return;const el=document.createElement('section');el.className='screen-overlay tribulation-overlay';el.hidden=true;el.innerHTML='<div class="tribulation-card"><small>THIÊN ĐẠO GIÁNG LÂM</small><h2>Độ Kiếp</h2><div class="tribulation-timing"><i></i><b></b></div><p>Sấm sét hội tụ — nhấn <kbd>SPACE</kbd> khi vạch sáng đi qua vùng vàng.</p><strong data-wave>Thiên Lôi 1 / 3</strong></div>';this.ui.app.appendChild(el);this.tribulationUI=el;this.hudManager.register('tribulation',el);}
  updateTribulation(dt){const t=this.tribulation;if(!t?.active)return;t.time+=dt;const phase=(t.time%1.6)/1.6;const marker=this.tribulationUI?.querySelector('.tribulation-timing b');if(marker)marker.style.left=`${phase*100}%`;if(t.time>=t.round*1.6){this.profile.hp=Math.max(1,this.profile.hp-18);this.advanceTribulationRound(false);}}
  resolveTribulationInput(){const phase=(this.tribulation.time%1.6)/1.6;const success=phase>=.62&&phase<=.82;if(!success)this.profile.hp=Math.max(1,this.profile.hp-12);this.advanceTribulationRound(success);}
  advanceTribulationRound(success){const t=this.tribulation;if(!t?.active)return;const p={x:this.player.position.x,z:this.player.position.z};this.effects.push({type:'lightning',...p,life:.65,max:.65,color:success?'#fff0a0':'#d9c4ff'});t.round+=1;t.time=(t.round-1)*1.6;if(t.round>3){this.completeTribulation();return;}const wave=this.tribulationUI?.querySelector('[data-wave]');if(wave)wave.textContent=`Thiên Lôi ${t.round} / 3`;}
  completeTribulation(){const current=CULTIVATION_REALMS.find(r=>r.id===this.skillSystem.realmId);const next=CULTIVATION_REALMS.find(r=>r.order===current.order+1);const success=next&&this.skillSystem.breakthrough(next.id);this.tribulation.active=false;this.hudManager.close('tribulation');if(success){this.profile.realm=next.id;this.profile.realmName=`${next.name} Cấp 1`;this.profile.skillSystem=this.skillSystem.serialize();this.goldBurst();this.toast(`${next.name} · Đột phá thành công · +1 Điểm Mở Khóa`,'legendary');this.onProfileChange?.(this.profile);}}
  updateHudVisibility(){const panel=document.querySelector('.player-panel');const visible=performance.now()<this.hudVisibleUntil||this.hudHover;panel?.classList.toggle('is-collapsed',!visible);if(this.ui.goldCount)this.ui.goldCount.textContent=Math.floor(this.shopSystem.gold);const realm=CULTIVATION_REALMS.find(entry=>entry.id===this.skillSystem.realmId);this.profile.realmName=`${realm?.name??'Luyện Khí'} ${this.skillSystem.realmId==='qi_refining'?'Tầng':'Cấp'} ${this.skillSystem.minorLevel}`;if(this.ui.realmName)this.ui.realmName.textContent=this.profile.realmName;}

  ensureGoldCounter(){const details=document.querySelector('.player-panel .player-details');if(!details||document.getElementById('gold-count'))return;const el=document.createElement('div');el.className='gold-counter';el.innerHTML='🪙 <b id="gold-count">0</b> <span>Vàng</span>';details.appendChild(el);this.ui.goldCount=el.querySelector('b');}
  persistEconomy(){this.profile.shopSystem=this.shopSystem.serialize();this.profile.gold=this.shopSystem.gold;this.profile.currentRegion=this.mapManager?.currentRegion??this.profile.currentRegion;this.onProfileChange?.(this.profile);this.renderShop();this.renderInventory();}
  ensureShopUI(){if(this.shopUI)return;this.shopCategory='weapons';const el=document.createElement('section');el.className='screen-overlay shop-overlay';el.hidden=true;el.innerHTML='<div class="shop-card"><header><div><small>THƯƠNG NHÂN LINH KHÍ</small><h2>Vạn Bảo Các</h2></div><button class="modal-close" data-close aria-label="Đóng"><kbd>Esc</kbd> ×</button></header><div class="shop-toolbar"><div class="shop-balance">🪙 <b data-shop-gold>0</b> Vàng</div><nav class="shop-tabs"><button data-shop-tab="weapons">⚔ Vũ Khí</button><button data-shop-tab="armor">🛡 Giáp</button><button data-shop-tab="consumables">丹 Đan Dược</button></nav></div><div class="shop-grid"></div><p class="shop-hint">Nhấn <kbd>P</kbd> để đóng · Vật phẩm bán lại nhận 55% giá.</p></div>';this.ui.app.appendChild(el);this.shopUI=el;this.hudManager.register('shop',el);el.querySelector('[data-close]').onclick=()=>this.hudManager.close('shop');el.onclick=e=>{const tab=e.target.closest('[data-shop-tab]');if(tab){this.shopCategory=tab.dataset.shopTab;this.renderShop();return;}const b=e.target.closest('[data-shop-action]');if(!b)return;const action=b.dataset.shopAction,id=b.dataset.weapon;let ok=false;if(action==='buy')ok=this.shopSystem.buy(id,this.realmOrder());if(action==='sell')ok=this.shopSystem.sell(id);if(action==='equip')ok=this.shopSystem.equip(id);if(ok){this.persistEconomy();this.toast(action==='buy'?'Mua vật phẩm thành công':action==='sell'?'Đã bán vật phẩm':'Đã trang bị','success');}else this.toast('Không đủ vàng hoặc cảnh giới chưa đạt.','warning');};this.renderShop();}
  renderShop(){if(!this.shopUI)return;const gold=this.shopUI.querySelector('[data-shop-gold]');if(gold)gold.textContent=Math.floor(this.shopSystem.gold);this.shopUI.querySelectorAll('[data-shop-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.shopTab===this.shopCategory));const grid=this.shopUI.querySelector('.shop-grid');if(!grid)return;grid.innerHTML=SHOP_ITEMS.filter(item=>item.category===this.shopCategory).map(item=>{const owned=this.shopSystem.inventory.includes(item.id),equipped=Object.values(this.shopSystem.equipment).includes(item.id),locked=this.realmOrder()<item.requiredOrder;const stats=[item.damage&&`⚔ +${item.damage}`,item.defense&&`🛡 +${item.defense}`,item.attackSpeed&&`⚡ +${Math.round(item.attackSpeed*100)}%`,item.heal&&`HP +${item.heal}`,item.mana&&`MP +${item.mana}`].filter(Boolean).join(' · ');return `<article class="shop-item ${locked?'is-locked':''}"><span class="shop-item-icon">${item.icon}</span><span class="shop-tier">Bậc ${item.tier}</span><h3>${item.name}</h3><p>${stats}</p><p>${item.description}</p><small>${locked?'🔒 Cần '+item.requiredRealm:'Yêu cầu đã đạt'}</small><strong>🪙 ${item.price}</strong>${owned&&item.category!=='consumables'?`<div><button data-shop-action="equip" data-weapon="${item.id}" ${equipped?'disabled':''}>${equipped?'Đang dùng':'Trang bị'}</button><button data-shop-action="sell" data-weapon="${item.id}">Bán ${Math.floor(item.price*.55)}</button></div>`:`<button data-shop-action="buy" data-weapon="${item.id}" ${locked?'disabled':''}>Mua</button>`}</article>`;}).join('');}
  toggleShop(){this.renderShop();return this.hudManager.toggle('shop');}
  ensureInventoryUI(){if(this.inventoryUI)return;const el=document.createElement('section');el.className='screen-overlay inventory-overlay';el.hidden=true;el.innerHTML='<div class="inventory-card"><header><div><small>HÀNH TRANG TU SĨ</small><h2>Túi Đồ</h2></div><button class="modal-close" data-close><kbd>Esc</kbd> ×</button></header><div class="inventory-layout"><aside><h3>Trang Bị</h3><div class="equipment-slots"></div><div class="inventory-gold">🪙 <b data-inventory-gold>0</b> Vàng</div></aside><main><div class="inventory-grid"></div></main></div><div class="item-tooltip" hidden></div><p class="inventory-hint">Chuột phải: trang bị hoặc sử dụng · Rê chuột để xem thuộc tính</p></div>';this.ui.app.appendChild(el);this.inventoryUI=el;this.hudManager.register('inventory',el);el.querySelector('[data-close]').onclick=()=>this.hudManager.close('inventory');el.addEventListener('contextmenu',e=>{const slot=e.target.closest('[data-item-id]');if(!slot)return;e.preventDefault();const id=slot.dataset.itemId,item=itemById(id);const ok=item?.category==='consumables'&&!item.accessory?this.shopSystem.use(id,this.profile):this.shopSystem.equip(id);if(ok){this.persistEconomy();this.toast(item?.category==='consumables'?'Đã sử dụng vật phẩm':'Đã trang bị','success');}});el.addEventListener('mouseover',e=>{const slot=e.target.closest('[data-item-id]');if(!slot)return;this.showItemTooltip(slot.dataset.itemId,e);});el.addEventListener('mousemove',e=>this.positionItemTooltip(e));el.addEventListener('mouseout',e=>{if(e.target.closest('[data-item-id]'))this.inventoryUI.querySelector('.item-tooltip').hidden=true;});this.renderInventory();}
  renderInventory(){if(!this.inventoryUI)return;const gold=this.inventoryUI.querySelector('[data-inventory-gold]');if(gold)gold.textContent=Math.floor(this.shopSystem.gold);const labels={weapon:'Vũ Khí',armor:'Giáp',accessory:'Phụ Kiện'};this.inventoryUI.querySelector('.equipment-slots').innerHTML=Object.entries(labels).map(([slot,label])=>{const id=this.shopSystem.equipment[slot],item=itemById(id);return `<div class="equipment-slot ${item?'has-item':''}" ${item?`data-item-id="${item.id}"`:''}><small>${label}</small><i>${item?.icon??'◇'}</i><strong>${item?.name??'Trống'}</strong></div>`;}).join('');const entries=this.shopSystem.inventory;this.inventoryUI.querySelector('.inventory-grid').innerHTML=Array.from({length:30},(_,index)=>{const id=entries[index],item=itemById(id);return `<div class="inventory-slot ${item?'has-item':''}" ${item?`data-item-id="${id}"`:''}>${item?`<i>${item.icon}</i><span>${item.name}</span><b>III</b>`:'<i>·</i>'}</div>`;}).join('');}
  showItemTooltip(id,event){const item=itemById(id),tip=this.inventoryUI.querySelector('.item-tooltip');if(!item||!tip)return;const stats=Object.entries(item).filter(([key,value])=>['damage','defense','attackSpeed','critRate','lifeSteal','heal','mana','maxMana'].includes(key)&&value).map(([key,value])=>`<li>${key}: ${value<1?Math.round(value*100)+'%':value}</li>`).join('');tip.innerHTML=`<strong>${item.icon} ${item.name}</strong><small>Bậc ${item.tier} · ${item.requiredRealm}</small><p>${item.description}</p><ul>${stats}</ul><em>Chuột phải để ${item.category==='consumables'&&!item.accessory?'sử dụng':'trang bị'}</em>`;tip.hidden=false;this.positionItemTooltip(event);}
  positionItemTooltip(event){const tip=this.inventoryUI?.querySelector('.item-tooltip');if(!tip||tip.hidden)return;tip.style.left=`${Math.min(innerWidth-280,event.clientX+16)}px`;tip.style.top=`${Math.min(innerHeight-190,event.clientY+16)}px`;}
  toggleInventory(){this.renderInventory();return this.hudManager.toggle('inventory');}

  createTerrainProps(){const props=[];let seed=9173;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646;for(let i=0;i<75;i++){const x=random()*92-46,z=random()*92-46;if(Math.abs(x)<5)continue;props.push({x,z,type:i%7===0?'rock':i%5===0?'fence':'tree'});}return props;}

  screen(world) { return { x: this.canvas.width / 2 + (world.x - this.camera.x) * 18, y: this.canvas.height / 2 + (world.z - this.camera.z) * 12 }; }
  pixelRect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  drawWorld() {
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height, theme=this.regionTheme();
    c.fillStyle = theme.base; c.fillRect(0, 0, w, h);
    const tile = 36, ox = ((-this.camera.x * 18) % tile + tile) % tile, oy = ((-this.camera.z * 12) % 24 + 24) % 24;
    for (let y = oy - 24; y < h; y += 24) for (let x = ox - tile; x < w; x += tile) { c.fillStyle = ((x / tile + y / 24) & 1) ? theme.tileA : theme.tileB; c.fillRect(x, y, tile - 1, 23); c.fillStyle = theme.line; c.fillRect(x, y, tile - 1, 1);c.globalAlpha=.38;c.fillStyle=theme.accent;c.fillRect(x+7,y+7,13,1);c.globalAlpha=1; }
    for(const prop of this.terrainProps){const p=this.screen(prop);if(p.x<-35||p.x>w+35||p.y<-60||p.y>h+35)continue;if(theme.prop==='crystal')this.drawCrystal(p.x,p.y,theme);else if(theme.prop==='cloud')this.drawCloudPine(p.x,p.y,theme);else if(prop.type==='tree')this.drawTree(p.x,p.y,theme);else if(prop.type==='rock')this.drawRock(p.x,p.y,theme);else this.drawFence(p.x,p.y,theme);}
    this.drawRegionLandmark(theme);
  }
  drawTree(x,y,theme){this.pixelRect(x-3,y-13,6,15,theme?.prop==='city'?'#7e3c20':'#694329');this.pixelRect(x-12,y-29,24,14,theme?.prop==='city'?'#8a3d27':'#173f2c');this.pixelRect(x-9,y-39,18,14,theme?.prop==='city'?'#b04c32':'#20563a');this.pixelRect(x-5,y-47,10,12,theme?.accent??'#2e7047');}
  drawRock(x,y,theme){this.pixelRect(x-7,y-8,14,8,theme?.line??'#58666a');this.pixelRect(x-4,y-12,9,5,theme?.accent??'#798486');this.pixelRect(x-7,y-3,14,3,theme?.base??'#354649');}
  drawFence(x,y,theme){this.pixelRect(x-14,y-10,4,13,'#532a1c');this.pixelRect(x+10,y-10,4,13,'#532a1c');this.pixelRect(x-15,y-7,30,4,theme?.accent??'#9a6631');}
  drawCrystal(x,y,theme){this.ctx.save();this.ctx.globalAlpha=.75+.2*Math.sin(performance.now()*.002+x);this.pixelRect(x-8,y-18,7,18,theme.line);this.pixelRect(x-1,y-29,8,29,theme.accent);this.pixelRect(x+7,y-14,5,14,'#9c72ff');this.ctx.restore();}
  drawCloudPine(x,y,theme){this.pixelRect(x-2,y-16,4,17,'#55463a');this.pixelRect(x-15,y-25,30,5,theme.accent);this.pixelRect(x-11,y-34,22,6,'#6f9fa8');this.ctx.save();this.ctx.globalAlpha=.18;this.ctx.fillStyle='#eafaff';this.ctx.beginPath();this.ctx.ellipse(x,y,24,8,0,0,Math.PI*2);this.ctx.fill();this.ctx.restore();}
  drawRegionLandmark(theme){const p=this.screen(this.currentRegion().townGate);if(p.x<-100||p.x>this.canvas.width+100||p.y<-100||p.y>this.canvas.height+100)return;this.pixelRect(p.x-35,p.y-10,70,10,theme.line);this.pixelRect(p.x-30,p.y-52,9,43,theme.accent);this.pixelRect(p.x+21,p.y-52,9,43,theme.accent);this.pixelRect(p.x-38,p.y-58,76,8,'#58231d');this.ctx.fillStyle='#fff0b0';this.ctx.font='bold 11px serif';this.ctx.textAlign='center';this.ctx.fillText(this.currentRegion().name,p.x,p.y-66);}

  drawSprite(entity, faction, remote = false) {
    const p = this.screen(entity.position); const action = entity.action ?? 'idle'; const row={orthodox:0,demonic:1,heretic:2}[faction]??0;
    const moving=Math.hypot(entity.velocity?.x??0,entity.velocity?.z??0)>.3;const frame=action==='slash'?2:(action==='cast'||action==='block')?3:moving?1:0;
    if (this.sprite.complete && this.sprite.naturalWidth) {
      const sw = this.sprite.naturalWidth / 4, sh = this.sprite.naturalHeight / 3, size = remote ? 64 : 72;
      this.ctx.save();if((entity.facing??4)>=5){this.ctx.translate(Math.round(p.x*2),0);this.ctx.scale(-1,1);}
      this.ctx.drawImage(this.sprite, frame * sw, row * sh, sw, sh, Math.round(p.x - size / 2), Math.round(p.y - size * .78), size, size);
      this.ctx.restore();
    } else this.drawCultivatorFallback(p.x, p.y, faction, entity.facing ?? 4);
  }
  drawCultivatorFallback(x, y, faction, facing) { const col = COLORS[faction] ?? COLORS.orthodox; this.pixelRect(x - 7, y - 20, 14, 16, col.robe); this.pixelRect(x - 9, y - 8, 18, 10, col.dark); this.pixelRect(x - 4, y - 28, 8, 8, '#d4a17f'); this.pixelRect(x - 6, y - 32, 12, 5, '#171724'); const a = facing * Math.PI / 4; this.ctx.strokeStyle = col.trim; this.ctx.lineWidth = 3; this.ctx.beginPath(); this.ctx.moveTo(x, y - 12); this.ctx.lineTo(x + Math.sin(a) * 18, y - 12 - Math.cos(a) * 12); this.ctx.stroke(); }

  drawEnemy(enemy) {
    if (enemy.alive === false || enemy.hp <= 0) return; const p = this.screen(enemy.position); const imp = enemy.type === 'flame_imp', trash = imp || enemy.type === 'spirit_fox';
    this.ctx.save(); if (enemy.hurt > 0) { this.ctx.globalAlpha = .55 + Math.sin(performance.now() * .05) * .35; this.ctx.translate(Math.sin(performance.now() * .08) * 2, 0); }
    if (imp) { this.pixelRect(p.x - 6,p.y - 13,12,12,'#25162c'); this.pixelRect(p.x - 4,p.y - 19,8,8,'#dc3564'); this.pixelRect(p.x - 2,p.y - 12,2,2,'#ffd56b'); }
    else if (enemy.isBoss) { this.pixelRect(p.x-16,p.y-37,32,35,'#352839'); this.pixelRect(p.x-12,p.y-45,24,12,'#9a3046'); this.pixelRect(p.x-24,p.y-29,48,8,'#bf8b3a'); }
    else { const scale = trash ? .72 : 1; this.ctx.save(); this.ctx.translate(p.x,p.y); this.ctx.scale(scale,scale); this.pixelRect(-14,-14,28,12,'#29444b'); this.pixelRect(-12,-23,20,15,'#365b60'); this.pixelRect(-9,-20,3,3,'#9affef'); this.pixelRect(3,-20,3,3,'#9affef'); this.pixelRect(-14,-28,7,9,'#29444b'); this.pixelRect(5,-28,7,9,'#29444b'); this.ctx.restore(); }
    this.ctx.restore(); const ratio = clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1); this.pixelRect(p.x-14,p.y-(enemy.isBoss?52:32),28,3,'#180b12'); this.pixelRect(p.x-14,p.y-(enemy.isBoss?52:32),28*ratio,3,'#ef4b5c');
  }

  drawEffects() { for (const e of this.effects) { const p = this.screen(e), t=e.life/e.max;this.ctx.save();this.ctx.globalAlpha=clamp(t,0,1);this.ctx.strokeStyle=e.color;this.ctx.fillStyle=e.color;if(e.type==='danger'){this.ctx.globalAlpha=.18+Math.sin(performance.now()*.02)*.08;this.ctx.fillStyle='#ff243f';this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,(e.radius??3)*18,(e.radius??3)*12,0,0,Math.PI*2);this.ctx.fill();this.ctx.globalAlpha=.8;this.ctx.lineWidth=2;this.ctx.stroke();}else if(e.type==='wave'){this.ctx.translate(p.x,p.y);this.ctx.rotate(e.angle??0);this.ctx.lineWidth=4;this.ctx.beginPath();this.ctx.arc(0,0,18+(1-t)*18,-1.2,1.2);this.ctx.stroke();}else if(e.type==='lightning'){this.ctx.lineWidth=3;this.ctx.beginPath();this.ctx.moveTo(p.x-8,p.y-60);for(let y=-55;y<0;y+=7)this.ctx.lineTo(p.x+(Math.random()-.5)*13,p.y+y);this.ctx.lineTo(p.x,p.y);this.ctx.stroke();this.ctx.globalAlpha=t*.45;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,22*(1-t+.2),9*(1-t+.2),0,0,Math.PI*2);this.ctx.fill();}else if(e.type==='circle'){this.ctx.lineWidth=2;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,24+(1-t)*15,10+(1-t)*6,0,0,Math.PI*2);this.ctx.stroke();}else{this.ctx.beginPath();this.ctx.ellipse(p.x,p.y-12,10,17,0,0,Math.PI*2);this.ctx.fill();}this.ctx.restore();}for(const n of this.damageNumbers){const p=this.screen(n);this.ctx.save();this.ctx.globalAlpha=clamp(n.life/n.max,0,1);this.ctx.fillStyle='#ff3f4f';this.ctx.font='bold 10px monospace';this.ctx.textAlign='center';this.ctx.fillText(String(n.value),Math.round(p.x),Math.round(p.y-28-(1-n.life/n.max)*12));this.ctx.restore();} }

  render() {
    this.drawWorld();this.goldDropSystem?.render(this.ctx);this.vfxManager?.render(this.ctx); const drawables = [...this.enemies.values()].map(e => ({ z:e.position.z, fn:()=>this.drawEnemy(e) }));
    for (const remote of this.remotePlayers.values()) drawables.push({ z:remote.target.z, fn:()=>this.drawSprite({ ...remote, position:remote.target }, remote.faction, true) });
    drawables.push({ z:this.player.position.z, fn:()=>this.drawSprite(this.player, this.profile.faction) }); drawables.sort((a,b)=>a.z-b.z).forEach(d=>d.fn());if(this.state.blocking)this.drawBarrier(); this.drawEffects();this.drawMinimap();
    this.ctx.fillStyle='rgba(8,12,18,.15)'; for(let y=0;y<this.canvas.height;y+=2)this.ctx.fillRect(0,y,this.canvas.width,1);
  }
  drawBarrier(){const p=this.screen(this.player.position),a=this.player.aimAngle;this.ctx.save();this.ctx.translate(p.x,p.y-13);this.ctx.rotate(a);this.ctx.globalAlpha=.38+.12*Math.sin(performance.now()*.012);this.ctx.strokeStyle='#8eeeff';this.ctx.fillStyle='rgba(76,208,245,.18)';this.ctx.lineWidth=3;this.ctx.beginPath();this.ctx.arc(8,0,18,-1.12,1.12);this.ctx.lineTo(8,0);this.ctx.closePath();this.ctx.fill();this.ctx.stroke();this.ctx.restore();}

  drawMinimap(){const map=document.getElementById('minimap');if(!map)return;const c=map.getContext('2d'),theme=this.regionTheme();map.width=120;map.height=120;c.imageSmoothingEnabled=false;c.fillStyle=theme.mini;c.fillRect(0,0,120,120);c.globalAlpha=.28;c.strokeStyle=theme.accent;for(let i=12;i<120;i+=18){c.beginPath();c.moveTo(i,0);c.lineTo(i,120);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(120,i);c.stroke();}c.globalAlpha=1;const xy=p=>({x:60+p.x/48*55,y:60+p.z/48*55});for(const e of this.enemies.values()){if(e.alive===false)continue;const p=xy(e.position);c.fillStyle=e.isBoss?'#ff354f':'#d56565';c.fillRect(p.x-1,p.y-1,e.isBoss?4:2,e.isBoss?4:e.isBoss?4:2);}const p=xy(this.player.position);c.fillStyle=theme.accent;c.fillRect(p.x-2,p.y-2,4,4);c.strokeStyle=theme.accent;c.strokeRect(.5,.5,119,119);}

  updateUI() {
    const ratio=(v,m)=>`${clamp(v/Math.max(1,m),0,1)*100}%`; if(this.ui.hpFill)this.ui.hpFill.style.width=ratio(this.profile.hp,this.profile.maxHp); if(this.ui.mpFill)this.ui.mpFill.style.width=ratio(this.profile.mp,this.profile.maxMp); if(this.ui.qiFill)this.ui.qiFill.style.width=`${clamp(this.profile.qi,0,100)}%`;
    if(this.ui.hpText)this.ui.hpText.textContent=`${Math.ceil(this.profile.hp)} / ${this.profile.maxHp}`; if(this.ui.mpText)this.ui.mpText.textContent=`${Math.ceil(this.profile.mp)} / ${this.profile.maxMp}`; if(this.ui.qiText)this.ui.qiText.textContent=`${Math.floor(this.profile.qi)}%`; if(this.ui.playerName)this.ui.playerName.textContent=this.profile.name; if(this.ui.realmName)this.ui.realmName.textContent=this.profile.realmName; if(this.ui.sectName)this.ui.sectName.textContent=FACTIONS[this.profile.faction]?.name;
    this.ui.skillbar?.querySelectorAll('[data-skill]').forEach(button=>{const slot=button.dataset.skill,skill=slot==='basic'?{name:'Kiếm Quyết',manaCost:0}:this.skillSystem.skillForSlot(slot);button.classList.toggle('is-locked',!skill);const label=button.querySelector('strong');if(label)label.textContent=skill?.name??'Ô trống';const visual=cooldownVisual(this.cooldowns.get(slot)??0,this.cooldownTotals.get(slot)??0);this.hudManager.updateSkillCooldown(button,visual,{insufficientMana:Boolean(skill&&this.profile.mp<(skill.manaCost??0))});});
    const boss=[...this.enemies.values()].find(e=>e.isBoss&&e.alive!==false&&e.hp>0);const showBoss=Boolean(boss&&this.bossEngaged);this.ui.bossHud?.toggleAttribute('hidden',!showBoss);this.ui.bossHud?.classList.toggle('is-visible',showBoss);if(showBoss){if(this.ui.bossName)this.ui.bossName.textContent=boss.label??'Hộ Điện Khôi Lỗi';if(this.ui.bossFill)this.ui.bossFill.style.width=ratio(boss.hp,boss.maxHp);if(this.ui.bossText)this.ui.bossText.textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;}
    const cultivation=this.skillSystem.cultivationProgress;if(this.ui.qiFill)this.ui.qiFill.style.width=`${cultivation}%`;if(this.ui.qiText)this.ui.qiText.textContent=this.skillSystem.minorLevel===9&&cultivation>=100?'ĐỘ KIẾP':`Cấp ${this.skillSystem.minorLevel} · ${Math.floor(cultivation)}%`;
    if(this.ui.interactionPrompt){this.ui.interactionPrompt.textContent=this.state.meditation?'[C] Kết thúc tĩnh tọa':'[B] Túi Đồ · [P] Cửa Hàng · [K] Kỹ Năng';this.ui.interactionPrompt.classList.add('is-visible');}
  }

  ensureSkillTree() { if(this.skillTree)return; const el=document.createElement('section');el.className='screen-overlay skill-tree-overlay';el.hidden=true;el.innerHTML='<div class="skill-tree-card"><header><h2>Bảng Kỹ Năng</h2><button data-close>×</button></header><div class="skill-tree-summary"></div><div class="skill-tree-grid"></div></div>';this.ui.app.appendChild(el);this.hudManager.register('skills',el);el.querySelector('[data-close]').onclick=()=>this.hudManager.close('skills');el.onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;let ok=false;if(b.dataset.action==='unlock')ok=this.skillSystem.unlock(b.dataset.skillId);if(b.dataset.action==='upgrade')ok=this.skillSystem.upgrade(b.dataset.skillId);if(b.dataset.action==='assign')ok=this.skillSystem.assign(b.dataset.slot,b.dataset.skillId);if(b.dataset.action==='remove')ok=this.skillSystem.unassign(b.dataset.slot);if(ok){this.profile.skillSystem=this.skillSystem.serialize();this.onProfileChange?.(this.profile);this.renderSkillTree();this.updateUI();}};this.skillTree=el; }
  toggleSkillTree(force){this.ensureSkillTree();const open=force??!this.hudManager.isOpen('skills');if(open){this.renderSkillTree();return this.hudManager.open('skills');}return this.hudManager.close('skills');}
  renderSkillTree(){const s=this.skillSystem;this.skillTree.querySelector('.skill-tree-summary').innerHTML=`<span>Điểm mở khóa: <b>${s.unlockPoints}</b></span><span>Điểm nâng cấp: <b>${s.upgradePoints}</b></span>`;this.skillTree.querySelector('.skill-tree-grid').innerHTML=s.tree.map(k=>{const tier=s.unlocked[k.id]??0,assigned=s.slotForSkill(k.id);const action=tier?`<button data-action="upgrade" data-skill-id="${k.id}" ${s.canUpgrade(k.id)?'':'disabled'}>Nâng cấp</button>`:`<button data-action="unlock" data-skill-id="${k.id}" ${s.canUnlock(k.id)?'':'disabled'}>Mở khóa</button>`;return `<article class="skill-node ${tier?'unlocked':'locked'}"><i>${k.icon}</i><div><h3>${k.name}</h3><p>${k.description}</p><small>Tier ${tier}/${k.maxTier}${assigned?` · Đang ở ${assigned.toUpperCase()}`:''}</small></div>${action}${tier?`<div class="skill-assign">${HOTBAR_SLOTS.map(x=>`<button data-action="assign" data-skill-id="${k.id}" data-slot="${x}" class="${assigned===x?'active':''}">${x.toUpperCase()}</button>`).join('')}${assigned?`<button data-action="remove" data-slot="${assigned}">Gỡ</button>`:''}</div>`:''}</article>`}).join('');}
  toast(message,tone='info'){if(!message||!this.ui.toastStack)return;const el=document.createElement('div');el.className=`toast toast--${tone} is-visible`;el.textContent=message;this.ui.toastStack.appendChild(el);setTimeout(()=>el.remove(),2600);}
  resize(){const scale=Math.max(2,Math.floor(Math.min(innerWidth/480,innerHeight/270)));this.canvas.width=Math.max(320,Math.floor(innerWidth/scale));this.canvas.height=Math.max(180,Math.floor(innerHeight/scale));this.ctx.imageSmoothingEnabled=false;}
  loop(time){if(!this.state.running)return;const dt=Math.min(.05,(time-this.lastFrame)/1000);this.lastFrame=time;if(!this.state.paused)this.update(dt);this.render();this.updateUI();requestAnimationFrame(this.bound.loop);}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.state.running=false;this.keys.clear();this.mapManager?.destroy();this.goldDropSystem?.clear();this.vfxManager?.clear();this.cleanup.splice(0).forEach(remove=>remove());this.shopUI?.remove();this.inventoryUI?.remove();this.skillTree?.remove();this.tribulationUI?.remove();this.socket?.disconnect();}
}
