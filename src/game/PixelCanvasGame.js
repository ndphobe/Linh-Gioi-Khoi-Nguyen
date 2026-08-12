import { FACTIONS } from './data.js';
import { CULTIVATION_REALMS, SkillSystemManager, cooldownVisual, skillThemeColor, vietnameseSkillGlyph } from './SkillSystem.js';
import { HUDManager } from './HUDManager.js';
import { MapManager, REGIONS } from './MapManager.js';
import { ShopSystem, SHOP_ITEMS, itemById, itemForFaction } from './ShopSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { LootManager } from './LootManager.js';
import { BossController } from './BossController.js';
import { GoldDropSystem } from './GoldDropSystem.js';
import { VFXManager } from './VFXManager.js';
import { getSectCombatData } from './SectData.js';
import { Player } from './Player.js';
import { CultivationSystem, tribulationGateForLevel } from './CultivationSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { AnimationController, loopFrameForDistance, MONSTER_ANIMATION_CLIPS, PLAYER_ANIMATION_CLIPS } from './AnimationController.js';
import { CombatSystem } from './CombatSystem.js';
import { UIManager } from './UIManager.js';
import { Monster, monsterAttackFor } from './Monster.js';
import { SkillTreePanel } from './UI/SkillTreePanel.js';
import { TribulationScreen } from './TribulationScreen.js';

export const PLAYER_MOTION = Object.freeze({
  walkSpeed: 5.2, runSpeed: 7, acceleration: 18, deceleration: 22,
  dashDistance: 4.4, dashDuration: .18, dashCooldown: 1.2, dashIFrames: .32,
  walkCyclePixels: 64, runCyclePixels: 48,
});

const COLORS = Object.freeze({
  orthodox: { robe: '#dcecf0', trim: '#4fcce5', dark: '#24405b', aura: '#57e8ff' },
  demonic: { robe: '#2a202f', trim: '#e13d61', dark: '#100c17', aura: '#ff3f79' },
  heretic: { robe: '#193c36', trim: '#81e65a', dark: '#111c22', aura: '#7aff71' },
});
const KEYS_TO_SLOT = { KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyF: 'f', KeyG: 'g' };
const TRIBULATION_WAVES = 10;
const MOVEMENT_FRAME_COUNT = 8;
const MONSTER_MOVEMENT_FRAME_COUNT = 8;
const MONSTER_WALK_CYCLE_PIXELS = Object.freeze({ default: 52, rogue: 62, boss: 76 });
const monsterWalkCyclePixels=enemy=>enemy.isBoss?MONSTER_WALK_CYCLE_PIXELS.boss:enemy.type==='rogue_cultivator'?MONSTER_WALK_CYCLE_PIXELS.rogue:MONSTER_WALK_CYCLE_PIXELS.default;
const skillPanelStateSignature=system=>JSON.stringify({
  faction:system.faction,
  realmId:system.realmId,
  lastCultivationLevel:system.lastCultivationLevel,
  skillUpgradePoints:system.skillUpgradePoints,
  unlocked:system.unlocked,
  hotbar:system.hotbar,
});
const REGION_THEMES = Object.freeze({
  sect_hall:{base:'#17191e',tileA:'#30272a',tileB:'#292328',line:'#54383c',accent:'#c69a45',mini:'#30272a',prop:'palace'},
  luoyang:{base:'#252019',tileA:'#514638',tileB:'#453b31',line:'#6c5c47',accent:'#e5a24b',mini:'#544a38',prop:'city'},
  spirit_mine:{base:'#101821',tileA:'#25313b',tileB:'#1c2932',line:'#344e5e',accent:'#75e6ff',mini:'#182c37',prop:'crystal'},
  heaven_sect:{base:'#182533',tileA:'#365064',tileB:'#2c4355',line:'#597589',accent:'#e8e0ad',mini:'#34556a',prop:'cloud'},
});
const WATER_FEATURES=Object.freeze({sect_hall:{x:-24,z:5,rx:4.2,rz:3.4},luoyang:{x:22,z:16,rx:3.4,rz:5},spirit_mine:{x:-20,z:-16,rx:4.1,rz:3.6},heaven_sect:{x:20,z:-18,rx:4.4,rz:3.5}});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const statValue = value => Number((Number(value)||0).toFixed(2));
const lerp = (a, b, t) => a + (b - a) * t;
const pos = (value = {}) => ({ x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 });
const loadChromaAtlas = src => {
  const image = new Image(); let cleaned = false;
  image.onload = () => {
    if (cleaned || src.startsWith('data:')) return;
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],green=g-Math.max(r,b),magenta=Math.min(r,b)-g;if(green>24){data[i+3]=clamp(255-(green-24)*5,0,255);data[i+1]=Math.min(g,Math.max(r,b)+18);}else if(magenta>24){data[i+3]=clamp(255-(magenta-24)*5,0,255);data[i]=Math.min(r,g+18);data[i+2]=Math.min(b,g+18);}}
    context.putImageData(pixels,0,0);cleaned=true;image.src=canvas.toDataURL('image/png');
  };
  image.src=src; return image;
};

export class CultivationGame {
  constructor({ canvas, socket, profile, audio, onProfileChange, onExit }) {
    this.canvas = canvas; this.socket = socket; this.audio = audio;
    this.onProfileChange = onProfileChange; this.onExit = onExit;
    this.profile = { hp: 120, maxHp: 120, mp: 100, maxMp: 100, qi: 0, ...profile, defense: 36, attackSpeed: .02, critRate: .023 };
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.ctx.imageSmoothingEnabled = false;
    this.cultivationSystem = new CultivationSystem(this.profile.cultivationSystem ?? {
      realmId: this.profile.realm,
      minorLevel: this.profile.minorLevel ?? this.profile.skillSystem?.minorLevel ?? 1,
      cultivationProgress: this.profile.skillSystem?.cultivationProgress ?? this.profile.qi ?? 0,
    });
    this.skillSystem = new SkillSystemManager({ faction: this.profile.faction, realmId: this.cultivationSystem.realmId, minorLevel: this.cultivationSystem.subStage, state: this.profile.skillSystem });
    this.shopSystem = new ShopSystem(this.profile.shopSystem ?? { gold: this.profile.gold });
    this.skillSystem.availableGold=this.shopSystem.gold;
    this.profile.currentRegion ??= 'sect_hall';
    this.player = new Player(this.profile, this.cultivationSystem, { position: { x: 0, y: 0, z: 26 }, velocity: { x: 0, z: 0 }, facing: 4, aimAngle: 0, action: 'idle' });
    this.animationController = new AnimationController(PLAYER_ANIMATION_CLIPS);
    this.camera = { x: 0, z: 26, focusX: 0, focusZ: 26 };
    this.state = { running: false, paused: false, meditation: false, dashTime: 0, dashCooldown: 0, invulnerableUntil: 0, joined: false };
    this.profile.resources = { linhThach:0, linhThao:0, linhCot:0, hoTamDan:0, ...(this.profile.resources??{}) };
    this.keys = new Set(); this.enemies = new Map(); this.remotePlayers = new Map();
    this.effects = []; this.pendingEffects = []; this.damageNumbers = []; this.cooldowns = new Map(); this.cooldownTotals = new Map(); this.pendingCasts = new Set(); this.castWarningTimes = new Map(); this.lastFrame = performance.now(); this.lastUiFrame = 0; this.netTime = 0; this.locomotionPixels = 0;
    this.mouse = { x: 0, y: 0, active: false }; this.pointTarget = null; this.lockedTargetId = null;
    this.hudVisibleUntil = performance.now() + 10_000; this.hudHover = false; this.bossEngaged = false;
    this.bossCombatUntil = 0;
    this.terrainProps = this.createTerrainProps();
    this.sprite = new Image(); this.sprite.src = '/assets/sect-character-atlas.png';
    this.walkSprite = loadChromaAtlas('/assets/sect-character-walk-atlas-v3.png');
    this.walkUpSprite = loadChromaAtlas('/assets/sect-character-walk-up-v3.png');
    this.walkDownSprite = loadChromaAtlas('/assets/sect-character-walk-down-v3.png');
    this.monsterSprite = new Image(); this.monsterSprite.src = '/assets/xianxia-monsters-atlas-v2-packed.png';
    this.monsterWalkSprite = loadChromaAtlas('/assets/xianxia-monsters-walk-atlas-v3.png');
    this.monsterWalkUpSprite = loadChromaAtlas('/assets/xianxia-monsters-walk-up-v3.png');
    this.monsterWalkDownSprite = loadChromaAtlas('/assets/xianxia-monsters-walk-down-v3.png');
    this.floorTextures=Object.fromEntries(Object.entries({sect_hall:'sect-hall-floor-v4.png',luoyang:'luoyang-floor-v4.png',spirit_mine:'spirit-mine-floor-v4.png',heaven_sect:'heaven-sect-floor-v4.png'}).map(([region,file])=>{const image=new Image();image.src=`/assets/${file}`;return [region,image];}));
    this.decorationAtlas=loadChromaAtlas('/assets/map-decoration-atlas-v1.png');
    this.gateAtlas=loadChromaAtlas('/assets/map-gates-atlas-v1.png');
    this.waterAtlas=loadChromaAtlas('/assets/map-water-features-atlas-v1.png');
    this.cleanup = [];
    this.ui = this.collectUI();
    this.sceneManager={load:scene=>{if(scene==='MainMenu'){this.destroy();this.onExit?.();}},respawnAtHall:()=>this.respawnAtHall()};
    this.uiManager=new UIManager({app:this.ui.app,onMainMenu:()=>this.sceneManager.load('MainMenu'),onRespawn:()=>this.sceneManager.respawnAtHall()});
    this.combatSystem=new CombatSystem({enemies:()=>this.enemies.values()});
    this.hudManager = new HUDManager(active => { this.state.paused = Boolean(active && active !== 'tribulation'); });
    this.hudManager.register('pause', this.ui.pauseMenu); this.hudManager.register('map', this.ui.worldMap);
    this.tribulationScreen=new TribulationScreen({app:this.ui.app,socket:this.socket,keys:this.keys,faction:this.profile.faction,spriteSrc:this.sprite.src});
    this.tribulationUI=this.tribulationScreen.element;this.hudManager.register('tribulation',this.tribulationUI);
    this.skillTreePanel=new SkillTreePanel({app:this.ui.app,hudManager:this.hudManager,skillSystem:this.skillSystem,onAction:action=>this.performSkillAction(action),onChange:({state})=>{this.profile.skillSystem=state;this.onProfileChange?.(this.profile);this.updateUI();}});
    this.mapManager = new MapManager({ overlay: this.ui.worldMap, realmOrder: this.realmOrder(), subStage: this.cultivationSystem.subStage, currentRegion: this.profile.currentRegion, onTeleport: (target, region) => this.fastTravel(target, region), onClose: () => this.hudManager.close('map') });
    this.ensureGoldCounter(); this.ensureAttackStat(); this.ensureShopUI();
    this.ensureInventoryUI(); this.ensureEquippedHud(); this.ensureTouchControls();
    this.inventorySystem=new InventorySystem(this.shopSystem,this.profile);
    this.itemSystem=new ItemSystem({player:this.player,shopSystem:this.shopSystem,itemLookup:id=>itemForFaction(id,this.profile.faction),onChange:()=>this.persistEconomy(),onHealthChange:()=>this.updateUI()});
    this.itemSystem.syncEquipment();
    this.goldDropSystem=new GoldDropSystem({screen:world=>this.screen(world),audio:this.audio,onPickup:amount=>this.collectGold(amount)});
    this.vfxManager=new VFXManager({screen:world=>this.screen(world),audio:this.audio,collisionTest:(effect,position)=>this.combatSystem.collisionAt(position,effect.hitboxWidth,effect.hitIds)});
    this.lootManager=new LootManager({inventory:this.inventorySystem,audio:this.audio,onGold:(amount,event)=>this.dropGoldFromEvent(amount,event),onBossReward:id=>this.toast(`Đã nhận Trang Bị Boss: ${itemById(id)?.name??id}`,'legendary'),onChange:()=>this.persistEconomy()});
    this.bossController=new BossController({onDefeated:()=>this.goldBurst()});
    this.hudManager.bindCurrency('gold',this.ui.goldCount);this.hudManager.updateCurrency('gold',this.shopSystem.gold);
    this.bound = { keydown: e => this.keydown(e), keyup: e => this.keys.delete(e.code), resize: () => this.resize(), loop: t => this.loop(t) };
    this.attach(); this.attachSocket(); this.resize();
  }

  collectUI() {
    const id = value => document.getElementById(value);
    return { app: id('app'), hud: id('hud'), hpFill: id('hp-fill'), hpText: id('hp-text'), mpFill: id('mp-fill'), mpText: id('mp-text'), qiFill: id('qi-fill'), qiText: id('qi-text'), playerName: id('player-name'), realmName: id('realm-name'), sectName: id('sect-name'), defenseStat:id('defense-stat'),attackSpeedStat:id('attack-speed-stat'),critRateStat:id('crit-rate-stat'),lifeStealStat:id('life-steal-stat'), onlineCount: id('online-count'), skillbar: id('skillbar'), toastStack: id('toast-stack'), pauseMenu: id('pause-menu'), worldMap: id('world-map'), interactionPrompt: id('interaction-prompt'), objectiveTitle: id('objective-title'), objectiveText: id('objective-text'), bossHud: id('boss-hud'), bossName: id('boss-name'), bossFill: id('boss-fill'), bossText: id('boss-text') };
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
    this.socket.on('disconnect',()=>{this.joinInFlight=false;if(this.state.running)this.state.joined=false;});
    this.socket.on('connect',()=>{if(this.state.running&&!this.state.joined)this.join();});
    this.socket.on('world:snapshot', data => this.snapshot(data));
    this.socket.on('player:state', data => this.mergeSelf(data));
    this.socket.on('world:event', event => { if(event?.type==='loot:granted'&&event.playerId!==this.socket.id)return;this.lootManager?.handle(event);this.bossController?.handle(event,this.enemies);if(event?.type==='enemy:respawned')this.bossController?.respawn(event.enemyId);this.worldEvent(event); });
    this.socket.on('game:error', error => this.toast(error?.message ?? 'Thiên đạo từ chối hành động.', 'error'));
  }

  start() {
    this.state.running = true; this.ui.hud?.removeAttribute('hidden'); this.ui.hud?.classList.add('is-visible');
    this.updateRegionUI();
    this.join(); this.updateUI(); requestAnimationFrame(this.bound.loop);
    this.toast('Canvas 2D · top-down 2.5D đã kích hoạt', 'success');
  }

  join() {
    if(!this.socket||this.joinInFlight)return;
    this.joinInFlight=true;
    this.socket?.emit('room:join', { roomCode: this.profile.roomCode, room: this.profile.roomCode, name: this.profile.name, faction: this.profile.faction, sect: this.profile.faction,resumeToken:this.profile.resumeToken,session:{gold:this.shopSystem.gold,inventory:this.shopSystem.inventory,equipment:this.shopSystem.equipment,cultivationSystem:this.cultivationSystem.serialize(),skillSystem:this.skillSystem.serialize(),currentRegion:this.profile.currentRegion,resources:this.profile.resources} }, response => {
      this.joinInFlight=false;
      if (response?.ok === false) return this.toast(response?.error?.message??response.message, 'error');
      this.state.joined = true; if (response?.snapshot) this.snapshot(response.snapshot); if (response?.player) this.mergeSelf(response.player);
    });
  }

  keydown(event) {
    if (!this.state.running) return;
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if(this.state.breakthroughActive){if(event.code==='KeyA'||event.code==='KeyD')this.keys.add(event.code);return;}
    if(!this.player.canAct)return;
    this.keys.add(event.code);
    if(event.code==='Space'){event.preventDefault();return this.dash();}
    if (event.code === 'Escape') { if(this.hudManager.active)return this.hudManager.close(); return this.togglePause(true); }
    if (event.code === 'KeyM') return this.toggleWorldMap();
    if (event.code === 'KeyK') return this.toggleSkillTree();
    if (event.code === 'KeyP') return this.toggleShop();
    if (event.code === 'KeyB') return this.canRequestBreakthrough() ? this.requestBreakthrough() : this.toggleInventory();
    if (event.code === 'KeyN') return this.requestBreakthrough();
    if (event.code === 'Tab') { event.preventDefault(); return this.cycleTarget(); }
    if (event.code === 'KeyC') return this.toggleMeditation();
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') return this.dash();
    if (KEYS_TO_SLOT[event.code]) this.cast(KEYS_TO_SLOT[event.code]);
  }

  input() {
    if(!this.player.canAct)return {x:0,z:0};
    let x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let z = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    if (!x && !z && this.pointTarget) { const dx=this.pointTarget.x-this.player.position.x,dz=this.pointTarget.z-this.player.position.z,d=Math.hypot(dx,dz);if(d>.25){x=dx/d;z=dz/d;}else this.pointTarget=null; }
    else if (x || z) this.pointTarget=null;
    const length = Math.hypot(x, z); if (length > 0) { x /= length; z /= length; }
    return { x, z };
  }

  updatePointer(event) { const rect=this.canvas.getBoundingClientRect();this.mouse.x=(event.clientX-rect.left)*this.canvas.width/rect.width;this.mouse.y=(event.clientY-rect.top)*this.canvas.height/rect.height;this.mouse.active=true;const dx=this.mouse.x-this.canvas.width/2,dy=this.mouse.y-this.canvas.height/2;this.player.aimAngle=Math.atan2(dy,dx);this.hudHover=Math.hypot(dx,dy)<42;const enemyHover=[...this.enemies.values()].some(enemy=>{if(enemy.alive===false)return false;const p=this.screen(enemy.position);return Math.hypot(p.x-this.mouse.x,p.y-18-this.mouse.y)<24;});this.canvas.classList.toggle('is-enemy-hover',enemyHover); }
  setPointTarget(){this.pointTarget={x:this.camera.x+(this.mouse.x-this.canvas.width/2)/18,z:this.camera.z+(this.mouse.y-this.canvas.height/2)/12};}
  setBlocking(active){if((active&&!this.player.canAct)||this.state.paused||this.state.breakthroughActive)return;this.state.blocking=Boolean(active);this.player.action=active?'block':'idle';this.player.actionTime=0;this.socket?.emit('combat:block',{active:Boolean(active)});}

  dash() {
    if (!this.player.canAct || this.state.dashCooldown > 0 || this.state.meditation) return;
    let direction = this.input();
    if (!direction.x && !direction.z) direction = { x: Math.cos(this.player.aimAngle), z: Math.sin(this.player.aimAngle) };
    this.state.dashDirection = direction; this.state.dashTime = PLAYER_MOTION.dashDuration; this.state.dashCooldown = PLAYER_MOTION.dashCooldown;
    this.state.invulnerableUntil = performance.now() / 1000 + PLAYER_MOTION.dashIFrames;
    this.socket?.emit('player:dash', { direction }); this.audio?.play('dash');
  }

  selectCombatTarget(range, direction) {
    const living = [...this.enemies.values()].filter(enemy => enemy.alive !== false && enemy.hp > 0);
    const locked = living.find(enemy => enemy.id === this.lockedTargetId);
    if (locked) return locked;
    if (this.mouse.active) {
      const hovered = living
        .map(enemy => ({ enemy, point: this.screen(enemy.position) }))
        .map(({ enemy, point }) => ({ enemy, distance: Math.hypot(point.x - this.mouse.x, point.y - 18 - this.mouse.y) }))
        .filter(entry => entry.distance <= 34)
        .sort((a, b) => a.distance - b.distance)[0]?.enemy;
      if (hovered) return hovered;
    }
    return living
      .map(enemy => {
        const dx = enemy.position.x - this.player.position.x, dz = enemy.position.z - this.player.position.z;
        const distance = Math.hypot(dx, dz);
        const dot = distance > .001 ? dx / distance * direction.x + dz / distance * direction.z : 1;
        return { enemy, distance, dot };
      })
      .filter(({ distance, dot }) => distance <= range && dot >= .35)
      .sort((a, b) => (b.dot - a.dot) * 4 + a.distance - b.distance)[0]?.enemy ?? null;
  }

  cast(slot) {
    if (!this.player.canAct || this.state.paused || this.state.meditation || this.state.breakthroughActive) return;
    const equipped = slot === 'basic' ? { archetype: 'basic', manaCost: 0, cooldown: .42 } : this.skillSystem.skillForSlot(slot);
    if (!equipped) return this.toast('Ô kỹ năng trống · nhấn K để gán.', 'warning');
    const castLabel=slot==='basic'?'Đòn đánh thường':`Chiêu ${slot.toUpperCase()}`,remaining=this.cooldowns.get(slot)??0;
    if(this.pendingCasts.has(slot))return slot==='basic'?false:this.warnCastBlocked(`${slot}:pending`,`${castLabel} đang được thi triển.`);
    if(remaining>0)return slot==='basic'?false:this.warnCastBlocked(`${slot}:cooldown`,`${castLabel} đang hồi chiêu · còn ${remaining<1?remaining.toFixed(1):Math.ceil(remaining)} giây.`);
    if(this.profile.mp<equipped.manaCost)return this.warnCastBlocked(`${slot}:mana`,`${castLabel} không đủ linh lực · cần ${Math.ceil(equipped.manaCost)}, hiện có ${Math.floor(this.profile.mp)}.`);
    this.player.action = slot === 'basic' ? 'slash' : 'cast'; this.player.actionTime = 0;
    const rawAngle = this.mouse.active ? this.player.aimAngle : this.player.facing*Math.PI/4-Math.PI/2;
    let direction = { x: Math.cos(rawAngle), z: Math.sin(rawAngle) };
    const spec=this.combatSystem.specFor(slot,equipped),combatTarget=this.selectCombatTarget(spec.range,direction);
    if(combatTarget){const dx=combatTarget.position.x-this.player.position.x,dz=combatTarget.position.z-this.player.position.z,length=Math.hypot(dx,dz)||1;direction={x:dx/length,z:dz/length};}
    const angle=Math.atan2(direction.z,direction.x);
    this.player.facing=(Math.round((angle+Math.PI/2)/(Math.PI/4))+8)%8;
    const attack=this.combatSystem.createAttack({slot,skill:equipped,origin:this.player.position,direction}),target=combatTarget?{x:combatTarget.position.x,z:combatTarget.position.z}:attack.target,sect=getSectCombatData(this.profile.faction),vfxSlot=slot==='basic'?'basic':equipped.archetype??slot;
    const commitHit=()=>{
      const showVfx=(hitIds=[])=>{const confirmed=Boolean(combatTarget&&hitIds.includes(combatTarget.id)),visualTarget=confirmed?target:attack.target,visualRange=confirmed?Math.hypot(target.x-this.player.position.x,target.z-this.player.position.z):attack.range;this.vfxManager.cast({faction:this.profile.faction,slot:vfxSlot,style:equipped.vfx,origin:this.player.position,direction,target:visualTarget,maxRange:visualRange,hitboxWidth:attack.hitboxWidth,confirmedHitIds:hitIds});if(slot!=='basic')this.effects.push({type:'danger',...visualTarget,radius:this.profile.faction==='demonic'?3.6:2.5,life:.3,max:.3,color:sect.primary});};
      if(!this.socket||!this.state.joined){this.profile.mp-=equipped.manaCost;this.cooldowns.set(slot,equipped.cooldown);this.cooldownTotals.set(slot,equipped.cooldown);showVfx(combatTarget?[combatTarget.id]:[]);return;}
      this.pendingCasts.add(slot);
      this.socket.timeout(4000).emit('combat:ability', { ability: slot, skillId:equipped.id, direction, aim: direction, targetId:combatTarget?.id??null, position: this.player.position },(error,response)=>{
        this.pendingCasts.delete(slot);
        if(error||response?.ok===false){this.toast(response?.error?.message??'Máy chủ không xác nhận chiêu thức.','warning');return;}
        showVfx(response?.hitIds??[]);
        if(response?.player)this.mergeSelf(response.player);
      });
    };
    // Send immediately. Animation markers are visual-only and can be replaced
    // by movement/hurt states; tying networking to them caused random lost casts.
    commitHit();
    this.animationController.play(slot==='basic'?'attack':'cast',{onComplete:()=>{if(!this.state.blocking)this.player.action='idle';}},true);
  }

  toggleMeditation() { if(!this.player.canAct)return;this.state.meditation = !this.state.meditation; this.player.action = this.state.meditation ? 'cast' : 'idle'; this.player.actionTime = 0; this.socket?.emit('cultivation:meditate', { active: this.state.meditation }); }
  async unbindSkill(slot){if(await this.performSkillAction({action:'remove',slot})){this.updateUI();this.toast(`Đã gỡ kỹ năng khỏi ${slot.toUpperCase()}`,'info');}}
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
  cycleTarget(){const living=[...this.enemies.values()].filter(enemy=>enemy.alive!==false).sort((a,b)=>Math.hypot(a.position.x-this.player.position.x,a.position.z-this.player.position.z)-Math.hypot(b.position.x-this.player.position.x,b.position.z-this.player.position.z));if(!living.length){this.lockedTargetId=null;return;}const index=living.findIndex(enemy=>enemy.id===this.lockedTargetId);this.lockedTargetId=living[(index+1)%living.length].id;this.toast(`Khóa mục tiêu: ${this.enemies.get(this.lockedTargetId)?.label??this.lockedTargetId}`,'info');}
  canRequestBreakthrough(){return Boolean(tribulationGateForLevel(this.cultivationSystem.level)&&this.cultivationSystem.progress>=100&&!this.state.breakthroughActive);}
  requestBreakthrough(){if(!this.socket||!this.state.joined)return this.toast('Cần kết nối máy chủ để độ kiếp.','warning');this.socket.timeout(4000).emit('breakthrough:start',{},(error,response)=>{if(error||response?.ok===false)return this.toast(response?.error?.message??'Không thể bắt đầu độ kiếp.','warning');if(response?.player)this.mergeSelf(response.player);});}
  syncBreakthrough(state={}){const wasActive=this.state.breakthroughActive,active=['active','resolving'].includes(state.status);this.state.breakthroughActive=active;if(active){this.ensureTribulationUI();this.tribulationScreen.show(state);this.hudManager.open('tribulation');}else if(wasActive){this.keys.delete('KeyA');this.keys.delete('KeyD');this.tribulationScreen.finish(state.status==='idle'?'success':'failure',state);setTimeout(()=>{if(!this.state.breakthroughActive&&this.hudManager.isOpen('tribulation'))this.hudManager.close('tribulation');},1500);}else if(this.hudManager.isOpen('tribulation')&&this.tribulationScreen.element.hidden)this.hudManager.close('tribulation');}
  performSkillAction({action,id,slot}){return new Promise(resolve=>{if(!this.socket||!this.state.joined){this.toast('Đang kết nối lại máy chủ.','warning');resolve(false);return;}this.socket.timeout(4000).emit('skill:action',{action,skillId:id,slot},(error,response)=>{if(error||response?.ok===false){this.toast(response?.error?.message??'Máy chủ không xác nhận thay đổi kỹ năng.','warning');resolve(false);return;}this.syncSkills(response.skillSystem??response.player?.skillSystem);if(response.shopSystem)this.applyShopSnapshot(response.shopSystem);if(response.player)this.mergeSelf(response.player);resolve(true);});});}
  updateObjective(){if(!this.ui.objectiveTitle||!this.ui.objectiveText)return;const level=this.cultivationSystem.level,progress=Math.round(this.cultivationSystem.progress),gate=tribulationGateForLevel(level);let title='Tích lũy tu vi',text='Đánh quái hoặc nhấn C trong khu an toàn để tĩnh tọa.';if(gate&&progress>=100){title=`Thiên kiếp ${gate.targetRealmId==='nascent_soul'?'Nguyên Anh':'Hóa Thần'}`;text='Nhấn B hoặc N ở bất kỳ đâu để bắt đầu độ kiếp.';}else if(level>=11){title='Hóa Thần chi lộ';text='Cảnh giới càng cao, EXP nhận được càng giảm và yêu cầu càng lớn.';}else if(level>=7){title='Nguyên Anh tu luyện';text=`Tiến tới Hóa Thần · ${progress}% tầng hiện tại`;}else if(level>=5){title='Kim Đan viên mãn';text=`Tiến tới Nguyên Anh · ${progress}% tầng hiện tại`;}this.ui.objectiveTitle.textContent=title;this.ui.objectiveText.textContent=text;}
  ensureTouchControls(){if(this.touchControls)return;const el=document.createElement('div');el.className='touch-controls';el.setAttribute('aria-label','Điều khiển cảm ứng');el.innerHTML='<div class="touch-move"><button data-key="KeyW">▲</button><button data-key="KeyA">◀</button><button data-key="KeyS">▼</button><button data-key="KeyD">▶</button></div><div class="touch-actions"><button data-action="basic">⚔</button><button data-action="dash">Lướt</button><button data-hold="block">Đỡ</button><button data-action="q">Q</button><button data-action="e">E</button><button data-action="r">R</button><button data-action="f">F</button><button data-action="g">G</button></div>';this.ui.app?.appendChild(el);this.touchControls=el;el.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;this.listen(button,'pointerdown',event=>{event.preventDefault();this.keys.add(key);});for(const type of ['pointerup','pointercancel','pointerleave'])this.listen(button,type,()=>this.keys.delete(key));});el.querySelectorAll('[data-action]').forEach(button=>this.listen(button,'pointerdown',event=>{event.preventDefault();const action=button.dataset.action;if(action==='dash')this.dash();else this.cast(action);}));const block=el.querySelector('[data-hold="block"]');this.listen(block,'pointerdown',event=>{event.preventDefault();this.setBlocking(true);});for(const type of ['pointerup','pointercancel','pointerleave'])this.listen(block,type,()=>this.setBlocking(false));}

  update(dt) {
    this.tribulationScreen?.update(dt);
    this.state.dashCooldown = Math.max(0, this.state.dashCooldown - dt);
    this.goldDropSystem?.update(dt,this.player.position);
    this.vfxManager?.update(dt);
    this.cooldowns.forEach((value,key)=>{const next=Math.max(0,value-dt);this.cooldowns.set(key,next);if(value>0&&next===0){const button=this.ui.skillbar?.querySelector(`[data-skill="${key}"]`);this.hudManager.pulseSkillReady(button);this.audio?.play('cooldown-ready');}});
    const direction = !this.player.canAct || this.state.meditation || this.state.blocking || this.state.breakthroughActive ? { x: 0, z: 0 } : this.input();
    const moving = direction.x || direction.z;
    const running = Boolean(moving && (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) && this.state.dashTime <= 0);
    if (moving) this.player.facing = (Math.round(Math.atan2(direction.x, -direction.z) / (Math.PI / 4)) + 8) % 8;
    if(this.mouse.active&&(this.player.action!=='idle'||!moving))this.player.facing=(Math.round((this.player.aimAngle+Math.PI/2)/(Math.PI/4))+8)%8;
    if (this.state.dashTime > 0) {
      this.state.dashTime -= dt; const speed = PLAYER_MOTION.dashDistance / PLAYER_MOTION.dashDuration;
      this.player.velocity.x = this.state.dashDirection.x * speed; this.player.velocity.z = this.state.dashDirection.z * speed;
      if (Math.random() < dt * 32) this.effects.push({ type: 'afterimage', x: this.player.position.x, z: this.player.position.z, life: .28, max: .28, color: COLORS[this.profile.faction].aura });
    } else {
      const response = moving ? PLAYER_MOTION.acceleration : PLAYER_MOTION.deceleration;
      const t = 1 - Math.exp(-response * dt);
      const movementSpeed=running?PLAYER_MOTION.runSpeed:PLAYER_MOTION.walkSpeed;
      this.player.velocity.x = lerp(this.player.velocity.x, direction.x * movementSpeed, t);
      this.player.velocity.z = lerp(this.player.velocity.z, direction.z * movementSpeed, t);
    }
    const previousX=this.player.position.x,previousZ=this.player.position.z;
    const desiredX=clamp(previousX+this.player.velocity.x*dt,-48,48),desiredZ=clamp(previousZ+this.player.velocity.z*dt,-48,48);
    const resolved=this.resolveTerrainCollision(previousX,previousZ,desiredX,desiredZ);
    this.player.position.x=resolved.x;this.player.position.z=resolved.z;
    this.player.position.y = lerp(this.player.position.y??0,0,1-Math.exp(-8*dt));
    this.player.actionTime += dt;
    if (!this.state.meditation && !this.state.blocking && this.player.action !== 'idle' && this.player.actionTime > .58) this.player.action = 'idle';
    const travelledX=this.player.position.x-previousX,travelledZ=this.player.position.z-previousZ;
    const travelledPixels=Math.hypot(travelledX*18,travelledZ*12);
    const playerSpeed=dt>0?Math.hypot(travelledX,travelledZ)/dt:0;
    this.locomotionPixels+=travelledPixels;
    this.animationController.resolve({action:this.player.action,speed:playerSpeed,running,hurt:this.player.getFeedback().flashing,blocking:this.state.blocking,dead:this.player.isDead});
    if(['walk','run'].includes(this.animationController.state)){const cycle=this.animationController.state==='run'?PLAYER_MOTION.runCyclePixels:PLAYER_MOTION.walkCyclePixels;this.animationController.seekLoop(this.locomotionPixels/cycle);}
    else this.animationController.update(dt);
    for(const enemy of this.enemies.values()){
      enemy.animator??=new AnimationController(MONSTER_ANIMATION_CLIPS);
      enemy.hurt=Math.max(0,(enemy.hurt??0)-dt);
      const smooth=1-Math.exp(-11*dt);
      const previousEnemyX=enemy.position.x,previousEnemyZ=enemy.position.z;
      enemy.position.x=lerp(enemy.position.x,enemy.target?.x??enemy.position.x,smooth);
      enemy.position.y=lerp(enemy.position.y,enemy.target?.y??enemy.position.y,smooth);
      enemy.position.z=lerp(enemy.position.z,enemy.target?.z??enemy.position.z,smooth);
      const enemyDx=enemy.position.x-previousEnemyX,enemyDz=enemy.position.z-previousEnemyZ;
      const enemyTravelPixels=Math.hypot(enemyDx*18,enemyDz*12);
      enemy.locomotionPixels=(enemy.locomotionPixels??0)+enemyTravelPixels;
      enemy.renderVelocity={x:dt>0?enemyDx/dt:0,z:dt>0?enemyDz/dt:0};
      enemy.isVisuallyMoving=enemyTravelPixels>.02;
      enemy.walkFrame=loopFrameForDistance(enemy.locomotionPixels,monsterWalkCyclePixels(enemy),MONSTER_MOVEMENT_FRAME_COUNT);
      const state=enemy.alive===false?'death':enemy.hurt>0?'hurt':enemy.pendingAttack?'attack':enemy.isVisuallyMoving?'walk':'idle';
      if(enemy.animator.state!==state||enemy.animator.finished&&state!=='death')enemy.animator.play(state,{},state==='hurt'||state==='attack');
      if(state!=='walk')enemy.animator.update(dt);
    }
    // Network snapshots arrive at 20 Hz, while rendering normally runs at
    // 60+ FPS. Interpolate remote players on every rendered frame instead of
    // displaying the raw snapshot position in visible 50 ms steps.
    const remoteSmooth=1-Math.exp(-12*dt);
    for(const remote of this.remotePlayers.values()){
      remote.position??=pos(remote.target);
      const previousRemoteX=remote.position.x,previousRemoteZ=remote.position.z;
      remote.position.x=lerp(remote.position.x,remote.target?.x??remote.position.x,remoteSmooth);
      remote.position.y=lerp(remote.position.y,remote.target?.y??remote.position.y,remoteSmooth);
      remote.position.z=lerp(remote.position.z,remote.target?.z??remote.position.z,remoteSmooth);
      const remoteDx=remote.position.x-previousRemoteX,remoteDz=remote.position.z-previousRemoteZ;
      const remoteTravelPixels=Math.hypot(remoteDx*18,remoteDz*12);
      remote.locomotionPixels=(remote.locomotionPixels??0)+remoteTravelPixels;
      remote.renderVelocity={x:dt>0?remoteDx/dt:0,z:dt>0?remoteDz/dt:0};
      remote.isVisuallyMoving=remoteTravelPixels>.02;
      remote.walkFrame=loopFrameForDistance(remote.locomotionPixels,PLAYER_MOTION.walkCyclePixels,MOVEMENT_FRAME_COUNT);
    }
    // Keep the local player and floor on one camera sample. A damped camera
    // trails the player by several world pixels and makes the feet appear to
    // slide over the map even though both use the same world coordinates.
    const cameraSpeed=Math.hypot(this.player.velocity.x,this.player.velocity.z),look=Math.min(2.8,cameraSpeed*.34);
    const targetCameraX=this.player.position.x+(cameraSpeed>.2?this.player.velocity.x/cameraSpeed*look:0);
    const targetCameraZ=this.player.position.z+(cameraSpeed>.2?this.player.velocity.z/cameraSpeed*look:0);
    const cameraBlend=1-Math.exp(-dt*10.5);
    this.camera.x=lerp(this.camera.x,targetCameraX,cameraBlend);this.camera.z=lerp(this.camera.z,targetCameraZ,cameraBlend);
    this.camera.focusX=this.player.position.x;this.camera.focusZ=this.player.position.z;
    for (let i = this.effects.length - 1; i >= 0; i--) { const effect = this.effects[i]; effect.life -= dt; if (effect.type === 'wave') { effect.x += effect.dx * 15 * dt; effect.z += effect.dz * 15 * dt; } if(effect.type==='burst'||effect.type==='spark'){effect.x+=effect.dx*5*dt;effect.z+=effect.dz*5*dt;}if(effect.type==='spirit')effect.z-=dt*.7;if (effect.life <= 0) this.effects.splice(i, 1); }
    const now=performance.now();for(let i=this.pendingEffects.length-1;i>=0;i--)if(now>=this.pendingEffects[i].at){const effect=this.pendingEffects.splice(i,1)[0];this.effects.push({...effect,life:.65,max:.65});}
    for(let i=this.damageNumbers.length-1;i>=0;i--){this.damageNumbers[i].life-=dt;this.damageNumbers[i].z-=dt*.55;if(this.damageNumbers[i].life<=0)this.damageNumbers.splice(i,1);}
    this.netTime += dt; if (this.netTime >= 1 / 20) { this.netTime = 0; if(this.player.canAct&&!this.state.breakthroughActive)this.socket?.emit('player:move', { position: this.player.position, yaw: this.player.facing * Math.PI / 4, velocity: this.player.velocity, meditating: this.state.meditation, sequence: Date.now() }); }
    const boss=[...this.enemies.values()].find(e=>e.isBoss&&e.alive!==false);if(boss){const pixels=Math.hypot((boss.position.x-this.player.position.x)*18,(boss.position.z-this.player.position.z)*12);const combat=performance.now()<this.bossCombatUntil||boss.isAttacking||boss.tookDamageRecently;if(pixels<250||combat)this.bossEngaged=true;if(pixels>300&&!combat)this.bossEngaged=false;}
    this.updateHudVisibility();
  }

  snapshot(data = {}) {
    const ownId = this.socket?.id;
    const seenPlayers=new Set();
    for (const player of data.players ?? []) {
      if (player.id === ownId) { this.mergeSelf(player); continue; }
      seenPlayers.add(player.id);
      const target=pos(player.position),old=this.remotePlayers.get(player.id);
      if(old){const displayPosition=old.position;Object.assign(old,player);old.position=displayPosition;old.target=target;}
      else this.remotePlayers.set(player.id,{...player,position:{...target},target});
    }
    for(const id of this.remotePlayers.keys())if(!seenPlayers.has(id))this.remotePlayers.delete(id);
    const seen = new Set(); for (const enemy of data.enemies ?? []) { if(enemy.regionId&&enemy.regionId!==this.profile.currentRegion)continue;seen.add(enemy.id);const old=this.enemies.get(enemy.id),nextPosition=pos(enemy.position),displayPosition=old?.position??nextPosition,moveSpeed=old?Math.hypot(nextPosition.x-(old.target?.x??old.position.x),nextPosition.z-(old.target?.z??old.position.z)):0,animator=old?.animator??new AnimationController(MONSTER_ANIMATION_CLIPS);if(old?.alive===false&&enemy.alive!==false)animator.play('idle',{},true);const monster=old instanceof Monster?old:new Monster({...enemy,position:displayPosition,target:nextPosition},animator),hurt=old&&enemy.hp<old.hp ? .28 : Math.max(0,(old?.hurt??0)-.05);monster.sync({...enemy,position:displayPosition,target:nextPosition,moveSpeed,hurt},performance.now(),Date.now());monster.animator=animator;this.enemies.set(enemy.id,monster); }
    for (const id of this.enemies.keys()) if (!seen.has(id)) this.enemies.delete(id);
    if (this.ui.onlineCount) this.ui.onlineCount.textContent = String(data.players?.length ?? 1);
  }
  syncServerGold(data={}){
    if(!Number.isFinite(Number(data.gold)))return;
    const before=this.shopSystem.gold;
    this.shopSystem.gold=Math.max(0,Number(data.gold));this.skillSystem.availableGold=this.shopSystem.gold;
    this.profile.gold=this.shopSystem.gold;this.profile.shopSystem=this.shopSystem.serialize();
    this.uiManager.updateGold(this.shopSystem.gold,this.ui.goldCount,this.shopUI?.querySelector('[data-shop-gold]'),this.inventoryUI?.querySelector('[data-inventory-gold]'));
    if(before!==this.shopSystem.gold&&this.skillTreePanel?.element)this.skillTreePanel.render();
    const now=performance.now();if(before!==this.shopSystem.gold&&now-(this.lastGoldPersistAt??0)>750){this.lastGoldPersistAt=now;this.onProfileChange?.(this.profile);}
  }

  warnCastBlocked(key,message){const now=performance.now(),last=this.castWarningTimes.get(key)??-Infinity;if(now-last<750)return false;this.castWarningTimes.set(key,now);this.toast(message,'warning');return false;}
  renderGold(){this.uiManager.updateGold(this.shopSystem.gold,this.ui.goldCount,this.shopUI?.querySelector('[data-shop-gold]'),this.inventoryUI?.querySelector('[data-inventory-gold]'));}
  syncCultivation(state,forcePersist=false){
    if(!state)return;
    const beforeLevel=this.cultivationSystem.level,beforeExp=this.cultivationSystem.currentExp;
    this.cultivationSystem.sync(state);
    const pointAwards=this.skillSystem.applyCultivationLevel(this.cultivationSystem.level);this.skillSystem.cultivationProgress=this.cultivationSystem.progress;this.mapManager?.setCultivation(this.realmOrder(),this.cultivationSystem.subStage);
    this.profile.realm=this.cultivationSystem.realmId;this.profile.realmName=this.cultivationSystem.displayName;this.profile.minorLevel=this.cultivationSystem.subStage;this.profile.qi=this.cultivationSystem.currentExp;this.profile.cultivationSystem=this.cultivationSystem.serialize();this.profile.skillSystem=this.skillSystem.serialize();
    if(this.cultivationSystem.level>beforeLevel){this.goldBurst();this.toast(`${this.cultivationSystem.displayName} · Level ${this.cultivationSystem.level}`,'legendary');if(pointAwards.unlockAwarded)this.toast(`+${pointAwards.unlockAwarded} Điểm Mở Khóa Chiêu`,'realm');if(pointAwards.upgradeAwarded)this.toast(`+${pointAwards.upgradeAwarded} Điểm Nâng Cấp Chiêu`,'success');}
    const now=performance.now();if(forcePersist||beforeExp!==this.cultivationSystem.currentExp&&(now-(this.lastProgressPersistAt??0)>750)){this.lastProgressPersistAt=now;this.onProfileChange?.(this.profile);}
  }
  syncSkills(state){if(!state)return;const before=skillPanelStateSignature(this.skillSystem);this.skillSystem.restore(state);this.profile.skillSystem=this.skillSystem.serialize();if(before!==skillPanelStateSignature(this.skillSystem)&&this.skillTreePanel?.element)this.skillTreePanel.render();}
  syncCooldowns(state={}){for(const [rawKey,remainingMs] of Object.entries(state)){const key=rawKey==='basic'?'basic':rawKey.toLowerCase();const remaining=Math.max(0,Number(remainingMs)||0)/1000;this.cooldowns.set(key,remaining);this.cooldownTotals.set(key,Math.max(this.cooldownTotals.get(key)??0,remaining));}if(Number.isFinite(Number(state.dash)))this.state.dashCooldown=Math.max(0,Number(state.dash)/1000);}
  applyShopSnapshot(shop){
    if(!shop)return;this.shopSystem.gold=Math.max(0,Number(shop.gold)||0);this.shopSystem.inventory=[...(shop.inventory??[])].filter(id=>itemById(id));this.shopSystem.equipment={weapon:null,armor:null,accessory:null,...shop.equipment};this.shopSystem.equipped=this.shopSystem.equipment.weapon;this.itemSystem.syncEquipment();this.profile.shopSystem=this.shopSystem.serialize();this.profile.gold=this.shopSystem.gold;this.syncServerGold(shop);this.renderShop();this.renderInventory();this.onProfileChange?.(this.profile);
  }
  mergeSelf(data = {}) {
    const oldHp=this.player.hp,nextHp=Number(data.hp??oldHp),serverTotalAtk=Number(data.totalAtk);this.profile.maxHp=Number(data.maxHp??this.profile.maxHp);this.profile.maxMp=Number(data.maxMp??this.profile.maxMp);this.profile.mp=Number(data.mp??this.profile.mp);this.profile.qi=Number(data.qi??this.profile.qi);for(const key of ['basicDamage','defense','attackSpeed','critRate','lifeSteal'])if(Number.isFinite(Number(data[key])))this.profile[key]=Number(data[key]);
    if(Number.isFinite(Number(data.baseAtk)))this.player.baseAtk=Number(data.baseAtk);
    if(Number.isFinite(Number(data.totalAtk)))this.player.totalAtk=Number(data.totalAtk);
    this.syncServerGold(data);this.syncCultivation(data.cultivationSystem);this.syncSkills(data.skillSystem);this.syncCooldowns(data.cooldowns);if(data.shopSystem)this.applyShopSnapshot(data.shopSystem);else if(data.equipment){this.shopSystem.equipment={...this.shopSystem.equipment,...data.equipment};this.itemSystem.syncEquipment();}if(Number.isFinite(serverTotalAtk))this.player.totalAtk=serverTotalAtk;
    if(data.resources||data.inventory&&!Array.isArray(data.inventory))this.profile.resources={...this.profile.resources,...(data.resources??data.inventory)};
    if(data.currentRegion&&REGIONS.some(region=>region.id===data.currentRegion)){this.profile.currentRegion=data.currentRegion;this.mapManager.currentRegion=data.currentRegion;this.mapManager.updateMarker();this.updateRegionUI();}
    if(data.breakthrough)this.syncBreakthrough(data.breakthrough);
    this.player.hp=nextHp;if(nextHp<oldHp){if(this.state.blocking)this.blockImpact();else this.receivePlayerDamage(oldHp-nextHp,nextHp);}
    if(data.alive===false)this.handlePlayerDeath({cultivationSystem:data.cultivationSystem});
    if(data.alive===true&&this.player.isDead)this.finishRespawn(data);
    if(data.position&&this.state.dashTime<=0){
      const p=pos(data.position),dx=p.x-this.player.position.x,dy=p.y-(this.player.position.y??0),dz=p.z-this.player.position.z,error=Math.hypot(dx,dz);
      // Normal snapshots are slightly behind local input because of latency.
      // Pulling toward every one caused a constant back-and-forth vibration.
      // Correct only meaningful divergence; large corrections remain quick.
      const correction=error > 2 ? .45 : error > .75 ? .12 : 0;
      if(correction){this.player.position.x=lerp(this.player.position.x,p.x,correction);this.player.position.y=lerp(this.player.position.y??0,p.y,correction);this.player.position.z=lerp(this.player.position.z,p.z,correction);}
    }
  }
  worldEvent(event = {}) {
    if(event.type==='enemy:damaged'){const enemy=this.enemies.get(event.enemyId);if(enemy){enemy.hurt=.34;if(enemy.isBoss){this.bossEngaged=true;this.bossCombatUntil=performance.now()+4500;enemy.tookDamageRecently=true;setTimeout(()=>{enemy.tookDamageRecently=false;},4500);}this.damageNumbers.push({x:enemy.position.x,z:enemy.position.z,value:statValue(event.damage),life:.85,max:.85});}}
    if(event.type==='enemy:telegraph'&&event.position){const enemy=this.enemies.get(event.enemyId);enemy?.beginAttack(event,performance.now(),Date.now());if(enemy?.isBoss){this.bossEngaged=true;this.bossCombatUntil=performance.now()+4500;}}
    if(event.type==='enemy:attack'&&event.position){const enemy=this.enemies.get(event.enemyId);enemy?.resolveAttack(event,performance.now());this.audio?.play(monsterAttackFor(enemy?.type,event.attack).sound);}
    if(event.type==='player:blocked'&&event.playerId===this.socket?.id)this.blockImpact();if(event.type==='player:parried'&&event.playerId===this.socket?.id)this.blockImpact(true);
    if(event.type==='player:defeated'&&event.playerId===this.socket?.id)this.handlePlayerDeath(event);
    if(event.type==='player:respawned'&&event.playerId===this.socket?.id)this.finishRespawn(event);
    if(event.type==='loot:granted'&&event.playerId===this.socket?.id){if(Number.isFinite(Number(event.loot?.totalGold)))this.syncServerGold({gold:event.loot.totalGold});if(event.loot?.cultivationSystem)this.syncCultivation(event.loot.cultivationSystem,true);if(event.loot?.skillSystem)this.syncSkills(event.loot.skillSystem);const exp=Number(event.loot?.exp??event.loot?.qi)||0;if(exp>0){this.spawnExpPickup(exp);this.toast(`+${Math.round(exp)} EXP Tu Vi`,'success');}if(event.loot?.skillUpgradePoints)this.toast('+1 Điểm Nâng Cấp Chiêu (rơi hiếm)','legendary');}
    if(event.type==='loot:granted'&&event.playerId===this.socket?.id){for(const key of ['linhThach','linhThao','linhCot','hoTamDan'])if(Number(event.loot?.[key]))this.profile.resources[key]=(this.profile.resources[key]??0)+Number(event.loot[key]);this.onProfileChange?.(this.profile);}
    if(event.type==='breakthrough:started'&&event.playerId===this.socket?.id){this.syncBreakthrough({status:'active',wave:0,hits:0,maxHits:event.maxHits,targetRealmId:event.targetRealmId,dodgeX:0});this.toast('Thiên kiếp bắt đầu · dùng A/D né khỏi HITBOX đỏ!','realm');}
    if(event.type==='breakthrough:telegraph'&&event.playerId===this.socket?.id){this.tribulationScreen?.onTelegraph(event);this.syncBreakthrough({status:'active',...event,telegraph:event});}
    if(event.type==='breakthrough:strike'&&event.playerId===this.socket?.id){this.tribulationScreen?.onStrike(event);if(event.hit)this.audio?.play('thunder');}
    if(event.type==='breakthrough:success'&&event.playerId===this.socket?.id){if(event.cultivationSystem)this.syncCultivation(event.cultivationSystem,true);if(event.skillSystem)this.syncSkills(event.skillSystem);this.syncBreakthrough({status:'idle',wave:TRIBULATION_WAVES});this.goldBurst();const realm=event.targetRealmId==='spirit_transformation'?'Hóa Thần':'Nguyên Anh';this.toast(`Đột phá ${realm} thành công!`,'legendary');this.onProfileChange?.(this.profile);}
    if(event.type==='breakthrough:failed'&&event.playerId===this.socket?.id){if(event.cultivationSystem)this.syncCultivation(event.cultivationSystem,true);if(event.skillSystem)this.syncSkills(event.skillSystem);this.syncBreakthrough({status:'failed',...event});const fallback=event.targetRealmId==='spirit_transformation'?'Nguyên Anh tầng 2':'Kim Đan tầng 2';this.toast(`Độ kiếp thất bại · tu vi trở về ${fallback}.`,'error');}
  }
  blockImpact(parry=false){const a=this.player.aimAngle;for(let i=0;i<10;i++)this.effects.push({type:'spark',x:this.player.position.x+Math.cos(a),z:this.player.position.z+Math.sin(a),dx:Math.cos(a)+(Math.random()-.5),dz:Math.sin(a)+(Math.random()-.5),life:.3,max:.3,color:parry?'#fff2a0':'#bff6ff'});this.audio?.play('block');}

  receivePlayerDamage(amount,nextHp=this.player.hp){const hit=this.player.syncServerDamage(nextHp,amount);this.damageNumbers.push({x:this.player.position.x,z:this.player.position.z,value:`-${statValue(hit.damage)}`,player:true,life:.9,max:.9});this.animationController.play('hurt',{},true);this.ui.app?.classList.remove('damage-flash');void this.ui.app?.offsetWidth;this.ui.app?.classList.add('damage-flash');setTimeout(()=>this.ui.app?.classList.remove('damage-flash'),300);this.audio?.play('hurt');}

  handlePlayerDeath(event={}){const result=this.player.die({cultivation:event.cultivationSystem,penalty:event.expPenalty});if(!result.applied)return;this.state.meditation=false;this.state.blocking=false;this.pointTarget=null;this.keys.clear();this.animationController.play('death',{},true);this.syncCultivation(event.cultivationSystem??this.cultivationSystem.serialize(),true);this.uiManager.showDeathDialog();this.toast('Tổn hại 10% tu vi hiện tại','error');}
  respawnAtHall(){return new Promise((resolve,reject)=>{if(!this.socket){this.finishRespawn({position:{x:0,y:0,z:26},hp:this.player.maxHp,mp:this.profile.maxMp,alive:true});resolve();return;}this.socket.emit('player:respawn',{},response=>{if(response?.ok===false){this.toast(response?.error?.message??'Không thể hồi sinh.','error');reject(new Error(response?.error?.message));return;}this.finishRespawn(response?.player??{});resolve(response?.player);});});}
  finishRespawn(data={}){this.player.respawn({hp:Number(data.hp??this.player.maxHp),mp:Number(data.mp??this.profile.maxMp),position:data.position?pos(data.position):undefined});this.profile.mp=this.profile.maxMp;this.state.meditation=false;this.state.blocking=false;this.state.invulnerableUntil=performance.now()/1000+1.5;this.uiManager.hideDeathDialog();this.animationController.play('idle',{},true);if(data.position){const p=pos(data.position);this.player.position={...this.player.position,...p};this.camera.x=p.x;this.camera.z=p.z;}this.updateUI();}

  goldBurst(){for(let i=0;i<18;i++){const a=i/18*Math.PI*2;this.effects.push({type:'burst',x:this.player.position.x,z:this.player.position.z,dx:Math.cos(a),dz:Math.sin(a),life:.8,max:.8,color:'#ffd86a'});}}
  spawnGoldPickup(amount){this.damageNumbers.push({x:this.player.position.x,z:this.player.position.z,value:`+${amount} Vàng`,gold:true,life:1.2,max:1.2});for(let i=0;i<7;i++)this.effects.push({type:'spark',x:this.player.position.x+(Math.random()-.5),z:this.player.position.z+(Math.random()-.5),dx:(Math.random()-.5)*.7,dz:-.4-Math.random(),life:.65,max:.65,color:'#ffd34f'});const popup=document.createElement('div');popup.className='gold-loot-popup';popup.innerHTML=`<i>🪙</i><strong>+${amount} Vàng</strong>`;this.ui.hud?.appendChild(popup);requestAnimationFrame(()=>popup.classList.add('is-visible'));setTimeout(()=>popup.remove(),1400);}
  spawnExpPickup(amount){this.damageNumbers.push({x:this.player.position.x,z:this.player.position.z,value:`+${Math.round(amount)} EXP`,exp:true,life:1.2,max:1.2});for(let i=0;i<5;i++)this.effects.push({type:'spirit',x:this.player.position.x+(Math.random()-.5),z:this.player.position.z+(Math.random()-.5),life:.7+Math.random()*.25,max:1,color:'#72eaff'});}
  dropGoldFromEvent(amount,event){const enemy=this.enemies.get(event?.enemyId),position=enemy?.position??this.player.position;this.goldDropSystem.spawnGoldLoot(position.x,position.z,amount,{boss:Boolean(enemy?.isBoss)});}
  collectGold(amount){this.spawnGoldPickup(amount);this.syncServerGold({gold:this.shopSystem.gold});}
  ensureTribulationUI(){return this.tribulationUI;}
  updateHudVisibility(){const panel=document.querySelector('.player-panel');panel?.classList.remove('is-collapsed');this.ui.hud?.removeAttribute('hidden');this.ui.hud?.classList.add('is-visible');if(this.ui.goldCount)this.ui.goldCount.textContent=Math.floor(this.shopSystem.gold);this.profile.realmName=this.cultivationSystem.displayName;if(this.ui.realmName)this.ui.realmName.textContent=this.profile.realmName;}

  ensureGoldCounter(){
    // The HUD survives when returning to character selection. A new game
    // instance must re-bind the existing counter or it will keep displaying
    // the previous character's gold while the shop shows the correct balance.
    const existing=document.getElementById('gold-count');
    if(existing){this.ui.goldCount=existing;return;}
    const details=document.querySelector('.player-panel .player-details');if(!details)return;
    const el=document.createElement('div');el.className='gold-counter';el.innerHTML='🪙 <b id="gold-count">0</b> <span>Vàng</span>';details.appendChild(el);this.ui.goldCount=el.querySelector('b');
  }
  ensureAttackStat(){
    const existing=document.getElementById('attack-power');
    if(existing){this.ui.attackPower=existing;this.ui.basicDamage=document.getElementById('basic-damage');return;}
    const tags=document.querySelector('.player-panel .player-tags');if(!tags)return;
    const el=document.createElement('span');el.className='attack-power-tag';el.innerHTML='Công <b id="attack-power">0</b> · ST thường <b id="basic-damage">0</b>';tags.appendChild(el);this.ui.attackPower=el.querySelector('#attack-power');this.ui.basicDamage=el.querySelector('#basic-damage');
  }
  performItemAction(action,id){return new Promise(resolve=>{const finish=response=>{if(response?.ok===false){this.toast(response?.error?.message??'Vật phẩm không thể sử dụng.','warning');resolve(false);return;}if(response?.shopSystem)this.applyShopSnapshot(response.shopSystem);if(response?.player)this.mergeSelf(response.player);this.updateUI();resolve(true);};if(this.socket&&this.state.joined){this.socket.timeout(4000).emit('shop:action',{action,itemId:id},(error,response)=>{if(error)return finish({ok:false,error:{message:'Máy chủ cửa hàng không phản hồi. Hãy tải lại game.'}});finish(response);});return;}if(this.socket&&!this.state.joined){finish({ok:false,error:{message:'Đang kết nối lại máy chủ, hãy thử lại sau giây lát.'}});return;}let ok=false;if(action==='buy')ok=this.shopSystem.buy(id,this.realmOrder(),this.profile.faction);if(action==='sell')ok=this.shopSystem.sell(id);if(action==='equip')ok=itemById(id)?.category==='weapons'?this.itemSystem.equipWeapon(id):this.shopSystem.equip(id,this.profile.faction);if(action==='unequip')ok=this.shopSystem.unequip(id);if(action==='use')ok=this.itemSystem.useItem(id);if(ok)this.persistEconomy();finish({ok});});}
  persistEconomy(){this.itemSystem?.syncEquipment();this.profile.shopSystem=this.shopSystem.serialize();this.profile.gold=this.shopSystem.gold;this.profile.baseAtk=this.player.baseAtk;this.profile.totalAtk=this.player.totalAtk;this.profile.cultivationSystem=this.cultivationSystem.serialize();this.profile.currentRegion=this.mapManager?.currentRegion??this.profile.currentRegion;this.onProfileChange?.(this.profile);this.updateUI();this.renderShop();this.renderInventory();}
  ensureShopUI(){if(this.shopUI)return;this.shopCategory='weapons';const el=document.createElement('section');el.className='screen-overlay shop-overlay';el.hidden=true;el.innerHTML='<div class="shop-card"><header><div><small>THƯƠNG NHÂN LINH KHÍ</small><h2>Vạn Bảo Các</h2></div><button class="modal-close" data-close aria-label="Đóng"><kbd>Esc</kbd> ×</button></header><div class="shop-toolbar"><div class="shop-balance">🪙 <b data-shop-gold>0</b> Vàng</div><nav class="shop-tabs"><button data-shop-tab="weapons">⚔ Vũ Khí</button><button data-shop-tab="armor">🛡 Giáp</button><button data-shop-tab="consumables">丹 Đan Dược</button></nav></div><div class="shop-grid"></div><p class="shop-hint">Nhấn <kbd>P</kbd> để đóng · Vật phẩm bán lại nhận 55% giá.</p></div>';this.ui.app.appendChild(el);this.shopUI=el;this.hudManager.register('shop',el);el.querySelector('[data-close]').onclick=()=>this.hudManager.close('shop');el.onclick=e=>{const tab=e.target.closest('[data-shop-tab]');if(tab){this.shopCategory=tab.dataset.shopTab;this.renderShop();return;}const b=e.target.closest('[data-shop-action]');if(!b)return;const action=b.dataset.shopAction,id=b.dataset.weapon;b.disabled=true;this.performItemAction(action,id).then(ok=>{b.disabled=false;if(ok)this.toast(action==='buy'?'Mua vật phẩm thành công':action==='sell'?'Đã bán vật phẩm':'Đã trang bị','success');});};this.renderShop();}
  renderShop(){if(!this.shopUI)return;const gold=this.shopUI.querySelector('[data-shop-gold]');if(gold)gold.textContent=Math.floor(this.shopSystem.gold);this.shopUI.querySelectorAll('[data-shop-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.shopTab===this.shopCategory));const grid=this.shopUI.querySelector('.shop-grid');if(!grid)return;grid.innerHTML=SHOP_ITEMS.filter(item=>item.category===this.shopCategory&&(!item.faction||item.faction===this.profile.faction)).sort((a,b)=>a.tier-b.tier||a.price-b.price).map(item=>{item=itemForFaction(item,this.profile.faction);const owned=this.shopSystem.inventory.includes(item.id),equipped=Object.values(this.shopSystem.equipment).includes(item.id),locked=this.realmOrder()<item.requiredOrder;const stats=[(item.damage??item.atkBonus)&&`⚔ Công +${item.damage??item.atkBonus}`,item.defense&&`🛡 Thủ +${item.defense}`,item.maxMana&&`Linh lực +${item.maxMana}`,item.attackSpeed&&`Tốc đánh +${Math.round(item.attackSpeed*100)}%`,item.critRate&&`Bạo kích +${Math.round(item.critRate*100)}%`,item.lifeSteal&&`Hút máu +${Math.round(item.lifeSteal*100)}%`,item.heal&&`HP +${item.heal}`,item.mana&&`MP +${item.mana}`].filter(Boolean).join(' · '),visual=item.asset?`<img class="equipment-art" src="${item.asset}" alt="${item.name}">`:`<span class="shop-item-icon">${item.icon}</span>`;return `<article class="shop-item ${locked?'is-locked':''}">${visual}<span class="shop-tier">Bậc ${item.tier}</span><h3>${item.name}</h3><p>${stats}</p><p>${item.description}</p><small>${locked?'🔒 Cần '+item.requiredRealm:'Yêu cầu đã đạt'}</small><strong>🪙 ${item.price}</strong>${owned&&item.category!=='consumables'?`<div><button data-shop-action="${equipped?'unequip':'equip'}" data-weapon="${item.id}">${equipped?'Tháo ra':'Trang bị'}</button><button data-shop-action="sell" data-weapon="${item.id}">Bán ${Math.floor(item.price*.55)}</button></div>`:`<button data-shop-action="buy" data-weapon="${item.id}" ${locked?'disabled':''}>Mua</button>`}</article>`;}).join('');}
  toggleShop(){this.renderShop();return this.hudManager.toggle('shop');}
  ensureInventoryUI(){if(this.inventoryUI)return;const el=document.createElement('section');el.className='screen-overlay inventory-overlay';el.hidden=true;el.innerHTML='<div class="inventory-card"><header><div><small>HÀNH TRANG TU SĨ</small><h2>Túi Đồ</h2></div><button class="modal-close" data-close><kbd>Esc</kbd> ×</button></header><div class="inventory-layout"><aside><h3>Trang Bị</h3><div class="equipment-slots"></div><div class="inventory-gold">🪙 <b data-inventory-gold>0</b> Vàng</div></aside><main><div class="inventory-grid"></div></main></div><div class="item-tooltip" hidden></div><p class="inventory-hint">Chuột phải: trang bị/dùng · Chuột phải ô đang mặc: tháo ra</p></div>';this.ui.app.appendChild(el);this.inventoryUI=el;this.hudManager.register('inventory',el);el.querySelector('[data-close]').onclick=()=>this.hudManager.close('inventory');el.addEventListener('contextmenu',e=>{const slot=e.target.closest('[data-item-id]');if(!slot)return;e.preventDefault();const id=slot.dataset.itemId,item=itemById(id),action=slot.classList.contains('equipment-slot')?'unequip':item?.category==='consumables'&&!item.accessory?'use':'equip';this.performItemAction(action,id).then(ok=>{if(ok)this.toast(action==='use'?'Đã sử dụng vật phẩm':action==='unequip'?'Đã tháo trang bị':'Đã trang bị','success');});});el.addEventListener('mouseover',e=>{const slot=e.target.closest('[data-item-id]');if(!slot)return;this.showItemTooltip(slot.dataset.itemId,e);});el.addEventListener('mousemove',e=>this.positionItemTooltip(e));el.addEventListener('mouseout',e=>{if(e.target.closest('[data-item-id]'))this.inventoryUI.querySelector('.item-tooltip').hidden=true;});this.renderInventory();}
  renderInventory(){if(!this.inventoryUI)return;const icon=item=>item?.asset?`<img class="equipment-art equipment-art--small" src="${item.asset}" alt="">`:`<i>${item?.icon??'◇'}</i>`,gold=this.inventoryUI.querySelector('[data-inventory-gold]');if(gold)gold.textContent=Math.floor(this.shopSystem.gold);const labels={weapon:'Vũ Khí',armor:'Giáp',accessory:'Phụ Kiện'};this.inventoryUI.querySelector('.equipment-slots').innerHTML=Object.entries(labels).map(([slot,label])=>{const id=this.shopSystem.equipment[slot],item=itemForFaction(id,this.profile.faction);return `<div class="equipment-slot ${item?'has-item':''}" ${item?`data-item-id="${item.id}"`:''}><small>${label}</small>${icon(item)}<strong>${item?.name??'Trống'}</strong></div>`;}).join('');const counts=new Map();for(const id of this.shopSystem.inventory)counts.set(id,(counts.get(id)??0)+1);const entries=[...counts.entries()];this.inventoryUI.querySelector('.inventory-grid').innerHTML=Array.from({length:30},(_,index)=>{const [id,count]=entries[index]??[],item=itemForFaction(id,this.profile.faction);return `<div class="inventory-slot ${item?'has-item':''}" ${item?`data-item-id="${id}"`:''}>${item?`${icon(item)}<span>${item.name}</span><b>${count>1?`×${count}`:''}</b>`:'<i>·</i>'}</div>`;}).join('');}
  ensureEquippedHud(){if(this.equippedHud)return;const existing=this.ui.hud?.querySelector('.equipped-hud');if(existing){this.equippedHud=existing;this.lastEquippedHudSignature=null;this.renderEquippedHud();return;}const panel=document.createElement('aside');panel.className='equipped-hud';panel.setAttribute('aria-label','Trang bị đang mang');panel.innerHTML='<header>TRANG BỊ ĐANG MANG</header><div data-equipped-hud></div>';const stack=this.ui.hud?.querySelector('.hud-left-stack');(stack??this.ui.hud)?.appendChild(panel);this.equippedHud=panel;this.renderEquippedHud();}
  renderEquippedHud(){if(!this.equippedHud)return;const signature=JSON.stringify(this.shopSystem.equipment);if(signature===this.lastEquippedHudSignature)return;this.lastEquippedHudSignature=signature;const labels={weapon:'Vũ Khí',armor:'Giáp',accessory:'Phụ Kiện'},content=this.equippedHud.querySelector('[data-equipped-hud]');content.innerHTML=Object.entries(labels).map(([slot,label])=>{const item=itemForFaction(this.shopSystem.equipment[slot],this.profile.faction);const visual=item?.asset?`<img src="${item.asset}" alt="">`:`<i>${item?.icon??'◇'}</i>`;return `<div class="equipped-hud__slot ${item?'has-item':''}">${visual}<span><small>${label}</small><strong title="${item?.name??'Chưa trang bị'}">${item?.name??'Chưa trang bị'}</strong></span></div>`;}).join('');}
  showItemTooltip(id,event){const item=itemForFaction(id,this.profile.faction),tip=this.inventoryUI.querySelector('.item-tooltip');if(!item||!tip)return;const stats=[['Công',item.damage??item.atkBonus],['Phòng thủ',item.defense],['Linh lực',item.maxMana],['Tốc đánh',item.attackSpeed],['Bạo kích',item.critRate],['Hút máu',item.lifeSteal],['Hồi máu',item.heal],['Hồi linh lực',item.mana]].filter(([,value])=>value).map(([label,value])=>`<li>${label}: ${value<1?Math.round(value*100)+'%':value}</li>`).join('');tip.innerHTML=`<strong>${item.icon} ${item.name}</strong><small>Bậc ${item.tier} · ${item.requiredRealm}</small><p>${item.description}</p><ul>${stats}</ul><em>Chuột phải để ${item.category==='consumables'&&!item.accessory?'sử dụng':'trang bị'}</em>`;tip.hidden=false;this.positionItemTooltip(event);}
  positionItemTooltip(event){const tip=this.inventoryUI?.querySelector('.item-tooltip');if(!tip||tip.hidden)return;tip.style.left=`${Math.min(innerWidth-280,event.clientX+16)}px`;tip.style.top=`${Math.min(innerHeight-190,event.clientY+16)}px`;}
  toggleInventory(){this.renderInventory();return this.hudManager.toggle('inventory');}

  createTerrainProps(){
    const layouts={},types={sect_hall:['pine','lotus','lantern'],luoyang:['peach','willow','lantern'],spirit_mine:['crystal','mushroom','rock'],heaven_sect:['cloudpine','lotus','cloud']};
    Object.keys(types).forEach((region,regionIndex)=>{let seed=9173+regionIndex*7919;const random=()=>((seed=seed*16807%2147483647)-1)/2147483646,water=WATER_FEATURES[region],gate=REGIONS.find(item=>item.id===region)?.townGate??{x:0,z:26};layouts[region]=[];for(let attempt=0;attempt<900&&layouts[region].length<40;attempt++){const x=random()*88-44,z=random()*88-44,tooClose=layouts[region].some(prop=>Math.hypot(prop.x-x,prop.z-z)<6.2),nearWater=((x-water.x)/(water.rx+3))**2+((z-water.z)/(water.rz+3))**2<1,nearGate=Math.hypot(x-gate.x,z-gate.z)<8,nearRoute=Math.abs(x)<5&&z>-18;if(tooClose||nearWater||nearGate||nearRoute)continue;const i=layouts[region].length;layouts[region].push({x,z,type:types[region][i%types[region].length],phase:random()*Math.PI*2,scale:.82+random()*.3});}});
    return layouts;
  }
  terrainColliders(){
    const radius={pine:1.05,peach:1.05,willow:1.15,cloudpine:1.05,crystal:.9,mushroom:.62,rock:.9,lantern:.62,lotus:.5,cloud:0},props=(this.terrainProps[this.profile.currentRegion]??[]).map(prop=>({x:prop.x,z:prop.z,r:(radius[prop.type]??.75)*prop.scale})).filter(item=>item.r>.1),gate=this.currentRegion().townGate;
    props.push({x:gate.x-2.25,z:gate.z,r:.82},{x:gate.x+2.25,z:gate.z,r:.82});return props;
  }
  resolveTerrainCollision(fromX,fromZ,toX,toZ){
    const playerRadius=.48,water=WATER_FEATURES[this.profile.currentRegion],blocked=(x,z)=>this.terrainColliders().some(item=>Math.hypot(x-item.x,z-item.z)<playerRadius+item.r)||((x-water.x)/(water.rx+playerRadius))**2+((z-water.z)/(water.rz+playerRadius))**2<1;let x=toX,z=fromZ;
    if(blocked(x,z)){x=fromX;this.player.velocity.x=0;}z=toZ;
    if(blocked(x,z)){z=fromZ;this.player.velocity.z=0;}return{x,z};
  }

  screen(world) { return { x: this.canvas.width / 2 - this.camera.x * 18 + world.x * 18, y: this.canvas.height / 2 - this.camera.z * 12 + world.z * 12-(Number(world.y)||0)*4 }; }
  pixelRect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  drawWorld() {
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height, theme=this.regionTheme();
    c.fillStyle = theme.base; c.fillRect(0, 0, w, h);
    const floorTexture=this.floorTextures[this.profile.currentRegion],texturedMap=floorTexture?.complete&&floorTexture.naturalWidth;
    if(texturedMap){
      // A broad, low-contrast authored texture replaces the dense procedural
      // checker grid. It scrolls more slowly than gameplay coordinates, which
      // keeps the background calm while the player moves.
      // Floor and entities share the exact same camera transform, so neither
      // can slide relative to the other. Smooth sampling handles sub-pixels.
      const tileSize=1024,originX=w/2-this.camera.x*18,originY=h/2-this.camera.z*12,ox=((originX%tileSize)+tileSize)%tileSize,oy=((originY%tileSize)+tileSize)%tileSize;
      c.save();c.imageSmoothingEnabled=true;c.globalAlpha=.78;for(let y=oy-tileSize;y<h;y+=tileSize)for(let x=ox-tileSize;x<w;x+=tileSize)c.drawImage(floorTexture,x,y,tileSize,tileSize);c.restore();
      c.fillStyle=this.profile.currentRegion==='heaven_sect'?'rgba(12,20,28,.24)':'rgba(5,8,13,.14)';c.fillRect(0,0,w,h);
    }else{
      const tile = 36, ox = ((-this.camera.x * 18) % tile + tile) % tile, oy = ((-this.camera.z * 12) % 24 + 24) % 24;
      for (let y = oy - 24; y < h; y += 24) for (let x = ox - tile; x < w; x += tile) { c.fillStyle = ((x / tile + y / 24) & 1) ? theme.tileA : theme.tileB; c.fillRect(x, y, tile - 1, 23); c.fillStyle = theme.line; c.fillRect(x, y, tile - 1, 1);c.globalAlpha=.38;c.fillStyle=theme.accent;c.fillRect(x+7,y+7,13,1);c.globalAlpha=1; }
    }
    this.drawWaterFeature(theme);
    for(const prop of this.terrainProps[this.profile.currentRegion]??[]){const p=this.screen(prop);if(p.x<-45||p.x>w+45||p.y<-65||p.y>h+40)continue;this.drawTerrainProp(prop,p,theme);}
  }
  drawWaterFeature(theme){const region=this.profile.currentRegion,center=WATER_FEATURES[region],p=this.screen(center),time=performance.now()*.001,atlas=this.waterAtlas,column={sect_hall:0,luoyang:1,spirit_mine:2,heaven_sect:3}[region]??0;if(p.x<-100||p.x>this.canvas.width+100||p.y<-100||p.y>this.canvas.height+100)return;if(atlas?.complete&&atlas.naturalWidth){const sw=atlas.naturalWidth/4,sourceY=Math.round(atlas.naturalHeight*.24),sourceH=Math.round(atlas.naturalHeight*.66),width=region==='luoyang'?72:92,height=region==='luoyang'?94:74;this.ctx.save();if(region==='spirit_mine')this.ctx.filter=`brightness(${1.03+Math.sin(time*2)*.12})`;this.ctx.drawImage(atlas,column*sw+4,sourceY,sw-8,sourceH,p.x-width/2,p.y-height/2,width,height);this.ctx.restore();}this.ctx.save();this.ctx.globalAlpha=.22+.08*Math.sin(time*1.8);this.ctx.strokeStyle=theme.accent;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,center.rx*9,center.rz*5.5,0,0,Math.PI*2);this.ctx.stroke();this.ctx.restore();}
  drawTerrainProp(prop,p,theme){const time=performance.now()*.001,sway=Math.sin(time*1.35+prop.phase)*2.2*prop.scale,atlas=this.decorationAtlas,regionRow={sect_hall:0,luoyang:1,spirit_mine:2,heaven_sect:3}[this.profile.currentRegion]??0,typeColumn={pine:0,lotus:1,lantern:3,peach:0,willow:1,crystal:0,mushroom:2,rock:3,cloudpine:0,cloud:1}[prop.type]??2;if(atlas?.complete&&atlas.naturalWidth){const sw=atlas.naturalWidth/4,sh=atlas.naturalHeight/4,size=prop.type==='cloud'?52:prop.type==='lotus'||prop.type==='mushroom'?44:62;this.ctx.save();this.ctx.translate(p.x+sway,p.y);this.ctx.rotate(Math.sin(time+prop.phase)*.018);this.ctx.globalAlpha=prop.type==='cloud'?.72:1;if(['crystal','mushroom','lantern'].includes(prop.type))this.ctx.filter=`brightness(${1.02+Math.sin(time*2.4+prop.phase)*.16})`;this.ctx.drawImage(atlas,typeColumn*sw,regionRow*sh,sw,sh,-size/2,-size*.82,size,size);this.ctx.restore();return;}this.drawRock(p.x,p.y,theme);}
  drawTree(x,y,theme){this.pixelRect(x-3,y-13,6,15,theme?.prop==='city'?'#7e3c20':'#694329');this.pixelRect(x-12,y-29,24,14,theme?.prop==='city'?'#8a3d27':'#173f2c');this.pixelRect(x-9,y-39,18,14,theme?.prop==='city'?'#b04c32':'#20563a');this.pixelRect(x-5,y-47,10,12,theme?.accent??'#2e7047');}
  drawRock(x,y,theme){this.pixelRect(x-7,y-8,14,8,theme?.line??'#58666a');this.pixelRect(x-4,y-12,9,5,theme?.accent??'#798486');this.pixelRect(x-7,y-3,14,3,theme?.base??'#354649');}
  drawFence(x,y,theme){this.pixelRect(x-14,y-10,4,13,'#532a1c');this.pixelRect(x+10,y-10,4,13,'#532a1c');this.pixelRect(x-15,y-7,30,4,theme?.accent??'#9a6631');}
  drawCrystal(x,y,theme){this.ctx.save();this.ctx.globalAlpha=.75+.2*Math.sin(performance.now()*.002+x);this.pixelRect(x-8,y-18,7,18,theme.line);this.pixelRect(x-1,y-29,8,29,theme.accent);this.pixelRect(x+7,y-14,5,14,'#9c72ff');this.ctx.restore();}
  drawCloudPine(x,y,theme){this.pixelRect(x-2,y-16,4,17,'#55463a');this.pixelRect(x-15,y-25,30,5,theme.accent);this.pixelRect(x-11,y-34,22,6,'#6f9fa8');this.ctx.save();this.ctx.globalAlpha=.18;this.ctx.fillStyle='#eafaff';this.ctx.beginPath();this.ctx.ellipse(x,y,24,8,0,0,Math.PI*2);this.ctx.fill();this.ctx.restore();}
  drawRegionLandmark(theme){const p=this.screen(this.currentRegion().townGate);if(p.x<-100||p.x>this.canvas.width+100||p.y<-170||p.y>this.canvas.height+100)return;const atlas=this.gateAtlas,column={sect_hall:0,luoyang:1,spirit_mine:2,heaven_sect:3}[this.profile.currentRegion]??0;if(atlas?.complete&&atlas.naturalWidth){const sw=atlas.naturalWidth/4,inset=5,sourceY=Math.round(atlas.naturalHeight*.15),sourceH=Math.round(atlas.naturalHeight*.8);this.ctx.save();if(this.profile.currentRegion==='spirit_mine')this.ctx.filter=`brightness(${1.04+Math.sin(performance.now()*.002)*.13})`;this.ctx.drawImage(atlas,column*sw+inset,sourceY,sw-inset*2,sourceH,p.x-48,p.y-142,96,150);this.ctx.restore();}else{this.pixelRect(p.x-30,p.y-52,9,43,theme.accent);this.pixelRect(p.x+21,p.y-52,9,43,theme.accent);this.pixelRect(p.x-38,p.y-58,76,8,theme.line);}this.ctx.fillStyle='#fff0b0';this.ctx.font='bold 10px serif';this.ctx.textAlign='center';this.ctx.fillText(this.currentRegion().name,p.x,p.y-148);}

  drawMovementBackdrop(p,entity,faction,size,moving){
    // Intentionally empty: shadows and motion echoes made a single sprite
    // look like multiple overlapping characters while moving.
  }

  drawSprite(entity, faction, remote = false) {
    const p = this.screen(entity.position); const action = entity.action ?? 'idle'; const row={orthodox:0,demonic:1,heretic:2}[faction]??0;
    const motion=remote?(entity.renderVelocity??entity.velocity):entity.velocity,vx=motion?.x??0,vz=motion?.z??0,localWalk=entity===this.player&&['walk','run'].includes(this.animationController.state),moving=remote?entity.isVisuallyMoving:Math.hypot(vx,vz)>.3,vertical=Math.abs(vz)>Math.abs(vx)*.72,directionalAtlas=vertical?(vz<0?this.walkUpSprite:this.walkDownSprite):this.walkSprite,useWalk=moving&&(remote||localWalk)&&directionalAtlas.complete&&directionalAtlas.naturalWidth;
    const frame=useWalk?(entity===this.player?this.animationController.frame:entity.walkFrame??0):entity===this.player?this.animationController.frame:action==='slash'?2:(action==='cast'||action==='block')?3:0;
    const atlas=useWalk?directionalAtlas:this.sprite,columns=useWalk?MOVEMENT_FRAME_COUNT:4;
    if (atlas.complete && atlas.naturalWidth) {
      const sw = atlas.naturalWidth / columns, sh = atlas.naturalHeight / 3, size = remote ? 64 : 72;
      this.drawMovementBackdrop(p,entity,faction,size,moving);
      this.ctx.save();if(entity===this.player&&this.player.getFeedback().flashing)this.ctx.filter='brightness(1.4) sepia(1) saturate(9) hue-rotate(315deg)';if(!vertical&&(entity.facing??4)>=5){this.ctx.translate(p.x*2,0);this.ctx.scale(-1,1);}
      this.ctx.drawImage(atlas, frame * sw, row * sh, sw, sh, p.x-size/2, p.y-size*.78, size, size);
      this.ctx.restore();
    } else this.drawCultivatorFallback(p.x, p.y, faction, entity.facing ?? 4);
  }
  drawCultivatorFallback(x, y, faction, facing) { const col = COLORS[faction] ?? COLORS.orthodox; this.pixelRect(x - 7, y - 20, 14, 16, col.robe); this.pixelRect(x - 9, y - 8, 18, 10, col.dark); this.pixelRect(x - 4, y - 28, 8, 8, '#d4a17f'); this.pixelRect(x - 6, y - 32, 12, 5, '#171724'); const a = facing * Math.PI / 4; this.ctx.strokeStyle = col.trim; this.ctx.lineWidth = 3; this.ctx.beginPath(); this.ctx.moveTo(x, y - 12); this.ctx.lineTo(x + Math.sin(a) * 18, y - 12 - Math.cos(a) * 12); this.ctx.stroke(); }

  drawEnemy(enemy) {
    if ((enemy.alive === false || enemy.hp <= 0) && enemy.animator?.finished) return; const p = this.screen(enemy.position); const imp = enemy.type === 'flame_imp', trash = imp || enemy.type === 'spirit_fox';
    const renderSize=enemy.isBoss?126:enemy.type==='rogue_cultivator'?96:82;
    const spriteTop=p.y-renderSize*.92,spriteBottom=p.y+renderSize*.12,spriteLeft=p.x-renderSize*.55,spriteRight=p.x+renderSize*.55;
    if(spriteRight<0||spriteLeft>this.canvas.width||spriteBottom<0||spriteTop>this.canvas.height)return;
    // Avoid showing severed sprite pieces at the canvas boundary. The minimap
    // still communicates enemies just outside the visible play area.
    if(spriteLeft<0||spriteRight>this.canvas.width||spriteTop<0||spriteBottom>this.canvas.height)return;
    if(enemy.id===this.lockedTargetId&&enemy.alive!==false){this.ctx.save();this.ctx.strokeStyle='#ffe27a';this.ctx.lineWidth=2;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y-3,18,8,0,0,Math.PI*2);this.ctx.stroke();this.ctx.restore();}
    if(this.monsterSprite.complete&&this.monsterSprite.naturalWidth&&enemy.animator){const fallbackRow=enemy.isBoss||enemy.type==='rogue_cultivator'?2:imp?1:0,row=Number.isInteger(enemy.spriteVariant)?enemy.spriteVariant:fallbackRow,dx=enemy.renderVelocity?.x??0,dz=enemy.renderVelocity?.z??0,vertical=Math.abs(dz)>Math.abs(dx)*.72,directionalAtlas=vertical?(dz<0?this.monsterWalkUpSprite:this.monsterWalkDownSprite):this.monsterWalkSprite,useWalk=enemy.animator.state==='walk'&&enemy.isVisuallyMoving&&directionalAtlas.complete&&directionalAtlas.naturalWidth,atlas=useWalk?directionalAtlas:this.monsterSprite,columns=useWalk?MONSTER_MOVEMENT_FRAME_COUNT:22,frame=useWalk?enemy.walkFrame??0:enemy.attackFrame?.(performance.now())??enemy.animator.frame,sw=atlas.naturalWidth/columns,sh=atlas.naturalHeight/3,size=renderSize,wave=Math.max(1,Number(enemy.wave)||1),hue=(wave-1)*47%360;this.ctx.save();if(enemy.alive===false||enemy.hp<=0)this.ctx.globalAlpha=clamp(1-enemy.animator.normalizedTime,0,1);if(enemy.hurt>0)this.ctx.filter='brightness(1.5) sepia(1) saturate(8) hue-rotate(315deg)';else if(wave>1)this.ctx.filter=`hue-rotate(${hue}deg) saturate(${1+Math.min(.75,wave*.06)}) brightness(${1+Math.min(.18,wave*.015)})`;if(useWalk&&!vertical&&dx<0){this.ctx.translate(p.x*2,0);this.ctx.scale(-1,1);}this.ctx.drawImage(atlas,frame*sw,row*sh,sw,sh,p.x-size/2,p.y-size*.9,size,size);this.ctx.restore();if(enemy.alive!==false){const ratio=clamp(enemy.hp/Math.max(1,enemy.maxHp),0,1),barY=p.y-(enemy.isBoss?58:38);this.pixelRect(p.x-18,barY,36,3,'#180b12');this.pixelRect(p.x-18,barY,36*ratio,3,wave>=8?'#c45cff':wave>=4?'#ff8b3d':'#ef4b5c');this.ctx.fillStyle='#ffe7a0';this.ctx.font='bold 7px monospace';this.ctx.textAlign='center';this.ctx.fillText(`Lv.${enemy.level??wave} · Vòng ${wave}`,Math.round(p.x),Math.round(barY-3));}return;}
    this.ctx.save(); if (enemy.hurt > 0) { this.ctx.globalAlpha = .55 + Math.sin(performance.now() * .05) * .35; this.ctx.translate(Math.sin(performance.now() * .08) * 2, 0); }
    if (imp) { this.pixelRect(p.x - 6,p.y - 13,12,12,'#25162c'); this.pixelRect(p.x - 4,p.y - 19,8,8,'#dc3564'); this.pixelRect(p.x - 2,p.y - 12,2,2,'#ffd56b'); }
    else if (enemy.isBoss) { this.pixelRect(p.x-16,p.y-37,32,35,'#352839'); this.pixelRect(p.x-12,p.y-45,24,12,'#9a3046'); this.pixelRect(p.x-24,p.y-29,48,8,'#bf8b3a'); }
    else { const scale = trash ? .72 : 1; this.ctx.save(); this.ctx.translate(p.x,p.y); this.ctx.scale(scale,scale); this.pixelRect(-14,-14,28,12,'#29444b'); this.pixelRect(-12,-23,20,15,'#365b60'); this.pixelRect(-9,-20,3,3,'#9affef'); this.pixelRect(3,-20,3,3,'#9affef'); this.pixelRect(-14,-28,7,9,'#29444b'); this.pixelRect(5,-28,7,9,'#29444b'); this.ctx.restore(); }
    this.ctx.restore(); const ratio = clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1); this.pixelRect(p.x-14,p.y-(enemy.isBoss?52:32),28,3,'#180b12'); this.pixelRect(p.x-14,p.y-(enemy.isBoss?52:32),28*ratio,3,'#ef4b5c');
  }

  drawEffects() { for (const e of this.effects) { const p = this.screen(e), t=e.life/e.max;this.ctx.save();this.ctx.globalAlpha=clamp(t,0,1);this.ctx.strokeStyle=e.color;this.ctx.fillStyle=e.color;if(e.type==='danger'){this.ctx.globalAlpha=.18+Math.sin(performance.now()*.02)*.08;this.ctx.fillStyle='#ff243f';this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,(e.radius??3)*18,(e.radius??3)*12,0,0,Math.PI*2);this.ctx.fill();this.ctx.globalAlpha=.8;this.ctx.lineWidth=2;this.ctx.stroke();}else if(e.type==='wave'){this.ctx.translate(p.x,p.y);this.ctx.rotate(e.angle??0);this.ctx.lineWidth=4;this.ctx.beginPath();this.ctx.arc(0,0,18+(1-t)*18,-1.2,1.2);this.ctx.stroke();}else if(e.type==='lightning'){this.ctx.lineWidth=3;this.ctx.beginPath();this.ctx.moveTo(p.x-8,p.y-60);for(let y=-55;y<0;y+=7)this.ctx.lineTo(p.x+(Math.random()-.5)*13,p.y+y);this.ctx.lineTo(p.x,p.y);this.ctx.stroke();this.ctx.globalAlpha=t*.45;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,22*(1-t+.2),9*(1-t+.2),0,0,Math.PI*2);this.ctx.fill();}else if(e.type==='circle'){this.ctx.lineWidth=2;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,24+(1-t)*15,10+(1-t)*6,0,0,Math.PI*2);this.ctx.stroke();}else{this.ctx.beginPath();this.ctx.ellipse(p.x,p.y-12,10,17,0,0,Math.PI*2);this.ctx.fill();}this.ctx.restore();}for(const n of this.damageNumbers){const p=this.screen(n);this.ctx.save();this.ctx.globalAlpha=clamp(n.life/n.max,0,1);this.ctx.fillStyle=n.exp?'#72eaff':n.gold?'#ffd34f':'#ff3f4f';this.ctx.font='bold 10px monospace';this.ctx.textAlign='center';this.ctx.fillText(String(n.value),Math.round(p.x),Math.round(p.y-28-(1-n.life/n.max)*12));this.ctx.restore();} }

  render() {
    const feedback=this.player.getFeedback(),shake=feedback.shakeStrength;this.ctx.save();if(shake>0){const now=performance.now();this.ctx.translate(Math.round(Math.sin(now*.19)*3*shake),Math.round(Math.cos(now*.23)*2*shake));}
    this.drawWorld();this.goldDropSystem?.render(this.ctx);for(const enemy of this.enemies.values())enemy.renderAttackVFX?.(this.ctx,world=>this.screen(world),performance.now());this.vfxManager?.render(this.ctx); const drawables = [...this.enemies.values()].map(e => ({ z:e.position.z, fn:()=>this.drawEnemy(e) }));
    drawables.push({z:this.currentRegion().townGate.z+.25,fn:()=>this.drawRegionLandmark(this.regionTheme())});
    for (const remote of this.remotePlayers.values()) drawables.push({ z:remote.position.z, fn:()=>this.drawSprite(remote, remote.faction, true) });
    drawables.push({ z:this.player.position.z, fn:()=>this.drawSprite(this.player, this.profile.faction) }); drawables.sort((a,b)=>a.z-b.z).forEach(d=>d.fn());if(this.state.blocking)this.drawBarrier(); this.drawEffects();this.drawMinimap();
    this.ctx.fillStyle='rgba(8,12,18,.15)'; for(let y=0;y<this.canvas.height;y+=2)this.ctx.fillRect(0,y,this.canvas.width,1);
    this.ctx.restore();
  }
  drawBarrier(){const p=this.screen(this.player.position),a=this.player.aimAngle;this.ctx.save();this.ctx.translate(p.x,p.y-13);this.ctx.rotate(a);this.ctx.globalAlpha=.38+.12*Math.sin(performance.now()*.012);this.ctx.strokeStyle='#8eeeff';this.ctx.fillStyle='rgba(76,208,245,.18)';this.ctx.lineWidth=3;this.ctx.beginPath();this.ctx.arc(8,0,18,-1.12,1.12);this.ctx.lineTo(8,0);this.ctx.closePath();this.ctx.fill();this.ctx.stroke();this.ctx.restore();}

  drawMinimap(){const map=document.getElementById('minimap');if(!map)return;const c=map.getContext('2d'),theme=this.regionTheme();map.width=120;map.height=120;c.imageSmoothingEnabled=false;c.fillStyle=theme.mini;c.fillRect(0,0,120,120);c.globalAlpha=.28;c.strokeStyle=theme.accent;for(let i=12;i<120;i+=18){c.beginPath();c.moveTo(i,0);c.lineTo(i,120);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(120,i);c.stroke();}c.globalAlpha=1;const xy=p=>({x:60+p.x/48*55,y:60+p.z/48*55});for(const e of this.enemies.values()){if(e.alive===false)continue;const p=xy(e.position);c.fillStyle=e.isBoss?'#ff354f':'#d56565';c.fillRect(p.x-1,p.y-1,e.isBoss?4:2,e.isBoss?4:e.isBoss?4:2);}const p=xy(this.player.position);c.fillStyle=theme.accent;c.fillRect(p.x-2,p.y-2,4,4);c.strokeStyle=theme.accent;c.strokeRect(.5,.5,119,119);}

  updateUI() {
    this.ui.hud?.removeAttribute('hidden');this.ui.hud?.classList.add('is-visible');document.querySelector('.player-panel')?.classList.remove('is-collapsed');
    this.renderGold();
    this.renderEquippedHud();
    const ratio=(v,m)=>`${clamp(v/Math.max(1,m),0,1)*100}%`; if(this.ui.hpFill)this.ui.hpFill.style.width=ratio(this.player.hp,this.player.maxHp); if(this.ui.mpFill)this.ui.mpFill.style.width=ratio(this.profile.mp,this.profile.maxMp);
    if(this.ui.hpText)this.ui.hpText.textContent=`${statValue(this.player.hp)} / ${statValue(this.player.maxHp)}`; if(this.ui.mpText)this.ui.mpText.textContent=`${statValue(this.profile.mp)} / ${statValue(this.profile.maxMp)}`; if(this.ui.playerName)this.ui.playerName.textContent=this.profile.name; if(this.ui.realmName)this.ui.realmName.textContent=this.cultivationSystem.displayName; if(this.ui.sectName)this.ui.sectName.textContent=FACTIONS[this.profile.faction]?.name;if(this.ui.attackPower)this.ui.attackPower.textContent=statValue(this.player.totalAtk);if(this.ui.basicDamage)this.ui.basicDamage.textContent=statValue(this.profile.basicDamage??this.player.totalAtk);if(this.ui.defenseStat)this.ui.defenseStat.textContent=statValue(this.profile.defense);if(this.ui.attackSpeedStat)this.ui.attackSpeedStat.textContent=`${statValue((this.profile.attackSpeed??0)*100)}%`;if(this.ui.critRateStat)this.ui.critRateStat.textContent=`${statValue((this.profile.critRate??0)*100)}%`;if(this.ui.lifeStealStat)this.ui.lifeStealStat.textContent=`${statValue((this.profile.lifeSteal??0)*100)}%`;
    this.ui.skillbar?.querySelectorAll('[data-skill]').forEach(button=>{const slot=button.dataset.skill,skill=slot==='basic'?{id:'basic_sword',name:'Kiếm Quyết',shortName:'Kiếm Quyết',icon:'Kiếm',manaCost:0}:this.skillSystem.skillForSlot(slot);button.classList.toggle('is-locked',!skill);button.classList.toggle('is-ready',Boolean(skill));button.style.setProperty('--skill-color',skill?skillThemeColor(skill):'#73808c');const label=button.querySelector('strong'),icon=button.querySelector('.skill-slot__icon');if(label){label.textContent=skill?.shortName??skill?.name??'Ô trống';label.title=skill?.name??'Ô trống';}if(icon){icon.textContent=skill?vietnameseSkillGlyph(skill):'Trống';icon.title=skill?.name??'Ô trống';}const visual=cooldownVisual(this.cooldowns.get(slot)??0,this.cooldownTotals.get(slot)??0);this.hudManager.updateSkillCooldown(button,visual,{insufficientMana:Boolean(skill&&this.profile.mp<(skill.manaCost??0))});});
    const boss=[...this.enemies.values()].find(e=>e.isBoss&&e.alive!==false&&e.hp>0);const showBoss=Boolean(boss&&this.bossEngaged);this.ui.bossHud?.toggleAttribute('hidden',!showBoss);this.ui.bossHud?.classList.toggle('is-visible',showBoss);if(showBoss){if(this.ui.bossName)this.ui.bossName.textContent=boss.label??'Hộ Điện Khôi Lỗi';if(this.ui.bossFill)this.ui.bossFill.style.width=ratio(boss.hp,boss.maxHp);if(this.ui.bossText)this.ui.bossText.textContent=`${Math.ceil(boss.hp)} / ${boss.maxHp}`;}
    const cultivation=this.cultivationSystem;if(this.ui.qiFill)this.ui.qiFill.style.width=`${cultivation.progress}%`;if(this.ui.qiText)this.ui.qiText.textContent=`Lv ${cultivation.level} · ${Math.round(cultivation.currentExp)} / ${cultivation.requiredEXP} EXP`;
    this.updateObjective();
    if(this.ui.interactionPrompt){this.ui.interactionPrompt.textContent=this.state.meditation?'[C] Kết thúc tĩnh tọa':this.canRequestBreakthrough()?'[B] Bắt đầu Độ Kiếp':'[B] Túi Đồ · [P] Cửa Hàng · [K] Kỹ Năng';this.ui.interactionPrompt.classList.add('is-visible');}
  }

  ensureSkillTree(){this.skillTree=this.skillTreePanel.ensure();return this.skillTree;}
  toggleSkillTree(force){return this.skillTreePanel.toggle(force);}
  renderSkillTree(){return this.skillTreePanel.render();}
  toast(message,tone='info'){if(!message||!this.ui.toastStack)return;const el=document.createElement('div');el.className=`toast toast--${tone} is-visible`;el.setAttribute('role',tone==='error'?'alert':'status');el.textContent=message;this.ui.toastStack.appendChild(el);setTimeout(()=>el.remove(),2600);}
  resize(){const scale=Math.max(2,Math.floor(Math.min(innerWidth/480,innerHeight/270)));this.canvas.width=Math.max(320,Math.floor(innerWidth/scale));this.canvas.height=Math.max(180,Math.floor(innerHeight/scale));this.ctx.imageSmoothingEnabled=false;}
  loop(time){if(!this.state.running)return;this.frameRequest=requestAnimationFrame(this.bound.loop);const elapsed=Math.max(0,(time-this.lastFrame)/1000);this.lastFrame=time;const dt=Math.min(.05,elapsed);try{if(!this.state.paused&&!this.player.getFeedback(time).hitStopped)this.update(dt);this.render();if(time-this.lastUiFrame>=50){this.updateUI();this.lastUiFrame=time;}}catch(error){console.error('Game frame recovered after an error:',error);}}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.state.running=false;this.keys.clear();if(this.frameRequest)cancelAnimationFrame(this.frameRequest);this.mapManager?.destroy();this.goldDropSystem?.clear();this.vfxManager?.clear();this.uiManager?.destroy();this.skillTreePanel?.destroy();this.tribulationScreen?.destroy();this.cleanup.splice(0).forEach(remove=>remove());for(const overlay of [this.shopUI,this.inventoryUI,this.touchControls])overlay?.remove();this.socket?.disconnect();}
}
