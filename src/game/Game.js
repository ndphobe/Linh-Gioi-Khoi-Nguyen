import * as THREE from 'three';
import {
  animateCultivator,
  animateEnemy,
  buildWorld,
  createAreaRing,
  createCultivator,
  createEnemy,
  createLightningStrike,
  createProjectile,
  createSlashArc,
  SECT_PALETTES,
  updateHealthBar,
} from './sceneFactory.js';
import { ABILITIES, FACTIONS } from './data.js';
import { PixelRenderPipeline } from './PixelRenderPipeline.js';

const FALLBACK_ABILITIES = {
  basic: { id: 'basic', name: 'Kiếm Khí', cooldown: 0.38, manaCost: 0, range: 4, color: '#63dfff' },
  q: { id: 'q', name: 'Định Thân Phù', cooldown: 5, manaCost: 12, range: 11, color: '#9eeeff' },
  e: { id: 'e', name: 'Vạn Kiếm Quy Tông', cooldown: 8, manaCost: 22, range: 6, color: '#67dfff' },
  r: { id: 'r', name: 'Trảm Tiên', cooldown: 11, manaCost: 28, range: 8, color: '#ffd56b' },
  f: { id: 'f', name: 'Khiên Linh Lực', cooldown: 14, manaCost: 20, range: 0, color: '#7dffb0' },
  g: { id: 'g', name: 'Thiên Kiếm Giáng Thế', cooldown: 24, manaCost: 45, range: 12, color: '#ffdb78' },
};

const vec3 = (value = {}, fallback = {}) => ({
  x: Number(value.x ?? fallback.x) || 0,
  y: Number(value.y ?? fallback.y) || 0,
  z: Number(value.z ?? fallback.z) || 0,
});

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

function listFromPayload(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([id, item]) => ({ id, ...item }));
  }
  return [];
}

function cssColorToHex(color, fallback = 0x63dfff) {
  if (typeof color === 'number') return color;
  if (typeof color !== 'string') return fallback;
  const normalized = color.trim().replace('#', '');
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dampAngle(current, target, lambda, delta) {
  let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-lambda * delta));
}

export class CultivationGame {
  constructor({ canvas, socket, profile, audio, onProfileChange, onExit }) {
    this.canvas = canvas;
    this.socket = socket;
    this.profile = {
      name: profile.name,
      faction: profile.faction ?? profile.sect ?? 'orthodox',
      roomCode: profile.roomCode ?? 'THAICHU',
      realm: profile.realm ?? 'foundation',
      realmName: profile.realmName ?? 'Trúc Cơ Hậu Kỳ',
      hp: Number(profile.hp) || 180,
      maxHp: Number(profile.maxHp) || 180,
      mp: Number(profile.mp) || 120,
      maxMp: Number(profile.maxMp) || 120,
      qi: Number(profile.qi ?? profile.cultivation) || 0,
      stones: Number(profile.stones) || 0,
      hasHeartPill: Boolean(profile.hasHeartPill),
      flightUnlocked: Boolean(profile.flightUnlocked),
      kills: Number(profile.kills) || 0,
      ...profile,
    };
    this.profile.sect = this.profile.faction;
    this.audio = audio;
    this.onProfileChange = onProfileChange;
    this.onExit = onExit;
    this.ui = this.collectUI();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(57, 1, 0.08, 240);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.setPixelRatio(1);
    this.pixelPipeline = new PixelRenderPipeline(this.renderer, this.scene, this.camera);

    this.clock = new THREE.Clock();
    this.world = buildWorld(this.scene);
    this.player = createCultivator({ sect: this.profile.faction, name: this.profile.name });
    this.player.position.set(0, 0, 26);
    this.player.rotation.y = 0;
    this.scene.add(this.player);

    this.state = {
      connected: false,
      joined: false,
      running: false,
      paused: false,
      pointerLocked: false,
      yaw: 0,
      pitch: -0.08,
      velocity: new THREE.Vector3(),
      verticalVelocity: 0,
      grounded: true,
      dashRemaining: 0,
      dashCooldown: 0,
      dashDirection: new THREE.Vector3(0, 0, -1),
      attackingUntil: 0,
      blocking: false,
      meditation: false,
      flying: Boolean(this.profile.flightUnlocked && this.profile.flying),
      tribulation: null,
      boss: null,
      objectivePhase: 'training',
      ringIndex: 0,
      resultShown: false,
      flightSequenceUnlocked: false,
      lastSnapshotAt: 0,
    };

    this.keys = new Set();
    this.cooldowns = new Map();
    this.remotePlayers = new Map();
    this.enemies = new Map();
    this.effects = [];
    this.damageNumbers = [];
    this.scheduledEffects = [];
    this.networkAccumulator = 0;
    this.networkSequence = 0;
    this.uiAccumulator = 0;
    this.minimapAccumulator = 0;
    this.lastFrame = performance.now();
    this.lastSnapshot = null;
    this.camera.position.set(2.2, 3.3, 32);
    this.camera.lookAt(0, 1.6, 24);

    this.bound = {
      resize: () => this.resize(),
      keydown: (event) => this.onKeyDown(event),
      keyup: (event) => this.onKeyUp(event),
      mousemove: (event) => this.onMouseMove(event),
      mousedown: (event) => this.onMouseDown(event),
      mouseup: (event) => this.onMouseUp(event),
      contextmenu: (event) => event.preventDefault(),
      pointerlockchange: () => this.onPointerLockChange(),
      canvasClick: () => this.requestPointerLock(),
      visibility: () => {
        if (document.hidden) this.keys.clear();
      },
      loop: (time) => this.loop(time),
    };
    this.attachEvents();
    this.attachSocket();
    this.resize();
  }

  collectUI() {
    const byId = (id) => document.getElementById(id);
    return {
      app: byId('app'),
      hud: byId('hud'),
      playerName: byId('player-name'),
      realmName: byId('realm-name'),
      sectName: byId('sect-name'),
      hpFill: byId('hp-fill'),
      hpText: byId('hp-text'),
      mpFill: byId('mp-fill'),
      mpText: byId('mp-text'),
      qiFill: byId('qi-fill'),
      qiText: byId('qi-text'),
      bossHud: byId('boss-hud'),
      bossName: byId('boss-name'),
      bossFill: byId('boss-fill'),
      bossText: byId('boss-text'),
      objectiveTitle: byId('objective-title'),
      objectiveText: byId('objective-text'),
      minimap: byId('minimap'),
      skillbar: byId('skillbar'),
      interactionPrompt: byId('interaction-prompt'),
      toastStack: byId('toast-stack'),
      crosshair: byId('crosshair'),
      onlineCount: byId('online-count'),
      connectionStatus: byId('connection-status'),
      worldMap: byId('world-map'),
      pauseMenu: byId('pause-menu'),
      resultScreen: byId('result-screen'),
      resume: byId('resume-game'),
      restart: byId('restart-game'),
      changeSect: byId('change-sect'),
    };
  }

  attachEvents() {
    window.addEventListener('resize', this.bound.resize);
    window.addEventListener('keydown', this.bound.keydown);
    window.addEventListener('keyup', this.bound.keyup);
    window.addEventListener('mousemove', this.bound.mousemove);
    window.addEventListener('mousedown', this.bound.mousedown);
    window.addEventListener('mouseup', this.bound.mouseup);
    window.addEventListener('contextmenu', this.bound.contextmenu);
    document.addEventListener('pointerlockchange', this.bound.pointerlockchange);
    document.addEventListener('visibilitychange', this.bound.visibility);
    this.canvas.addEventListener('click', this.bound.canvasClick);

    this.ui.resume?.addEventListener('click', () => {
      this.togglePause(false);
      this.requestPointerLock();
    });
    this.ui.restart?.addEventListener('click', () => window.location.reload());
    this.ui.changeSect?.addEventListener('click', () => {
      this.destroy();
      this.onExit?.();
    });
    this.ui.skillbar?.querySelectorAll('[data-skill]').forEach((slot) => {
      slot.addEventListener('click', () => this.castAbility(slot.dataset.skill));
    });
  }

  attachSocket() {
    if (!this.socket) return;
    this.socket.on('connect', () => {
      this.state.connected = true;
      this.setConnectionStatus('Đã kết nối', true);
    });
    this.socket.on('disconnect', () => {
      this.state.connected = false;
      this.setConnectionStatus('Mất kết nối · đang thử lại', false);
      this.toast('Linh mạch bất ổn — đang nối lại máy chủ.', 'warning');
    });
    this.socket.on('connect_error', () => this.setConnectionStatus('Không thể kết nối', false));
    this.socket.on('world:snapshot', (snapshot) => this.applySnapshot(snapshot));
    this.socket.on('player:state', (player) => this.mergeSelfState(player));
    this.socket.on('world:event', (event) => this.handleWorldEvent(event));
    this.socket.on('game:error', (error) => {
      this.audio?.play('error');
      this.toast(error?.message ?? error?.error ?? 'Thiên đạo từ chối hành động.', 'error');
    });
  }

  async start() {
    this.ui.hud?.removeAttribute('hidden');
    this.ui.hud?.classList.add('is-visible');
    this.state.running = true;
    this.updateUI(true);
    this.animateIn();
    this.joinRoom();
    requestAnimationFrame(this.bound.loop);
    setTimeout(() => {
      this.toast(`Đã đến Sảnh Điện · Phòng ${this.profile.roomCode}`, 'info');
      this.toast('Nhấp vào chiến trường để điều khiển camera.', 'hint');
    }, 500);
  }

  joinRoom() {
    if (!this.socket) return;
    const payload = {
      roomCode: this.profile.roomCode,
      room: this.profile.roomCode,
      name: this.profile.name,
      faction: this.profile.faction,
      sect: this.profile.faction,
      profile: {
        realm: this.profile.realm,
        realmName: this.profile.realmName,
        qi: this.profile.qi,
        stones: this.profile.stones,
        hasHeartPill: this.profile.hasHeartPill,
        flightUnlocked: this.profile.flightUnlocked,
      },
    };
    const onAck = (response) => {
      if (response?.ok === false) {
        this.toast(response.message ?? 'Không thể vào phòng.', 'error');
        return;
      }
      this.state.joined = true;
      if (response?.snapshot) this.applySnapshot(response.snapshot);
      if (response?.player) this.mergeSelfState(response.player);
    };
    this.socket.emit('room:join', payload, onAck);
  }

  animateIn() {
    this.player.scale.setScalar(0.01);
    this.player.userData.spawnScale = 0.01;
    const ring = createAreaRing(SECT_PALETTES[this.profile.faction]?.energy ?? 0x63dfff, 3.5);
    ring.position.copy(this.player.position);
    ring.position.y = 0.08;
    ring.userData.effect.life = 1.2;
    ring.userData.effect.maxLife = 1.2;
    this.addEffect(ring);
  }

  setConnectionStatus(text, connected) {
    if (!this.ui.connectionStatus) return;
    this.ui.connectionStatus.textContent = text;
    this.ui.connectionStatus.dataset.state = connected ? 'online' : 'offline';
  }

  requestPointerLock() {
    if (!this.state.running || this.state.paused || this.state.resultShown) return;
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
  }

  onPointerLockChange() {
    this.state.pointerLocked = document.pointerLockElement === this.canvas;
    this.ui.crosshair?.classList.toggle('is-active', this.state.pointerLocked);
    if (!this.state.pointerLocked && this.state.running && !this.state.resultShown && !this.ui.worldMap?.classList.contains('is-open')) {
      this.togglePause(true);
    }
  }

  onKeyDown(event) {
    if (!this.state.running) return;
    const code = event.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'Tab'].includes(code)) event.preventDefault();
    if (event.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(code)) return;
    this.keys.add(code);

    if (code === 'Escape') {
      this.togglePause(!this.state.paused);
      return;
    }
    if (code === 'KeyM') {
      this.toggleWorldMap();
      return;
    }
    if (this.state.paused) return;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.beginDash();
    if (code === 'Space' && !this.state.flying && this.state.grounded && !this.state.meditation) {
      this.state.verticalVelocity = 7.3;
      this.state.grounded = false;
    }
    if (code === 'KeyQ') this.castAbility('q');
    if (code === 'KeyE') this.castAbility('e');
    if (code === 'KeyR') this.castAbility('r');
    if (code === 'KeyF') this.castAbility('f');
    if (code === 'KeyG') this.castAbility('g');
    if (code === 'KeyC') this.toggleMeditation();
    if (code === 'KeyB') this.startBreakthrough();
    if (code === 'KeyV' || code === 'KeyT') this.toggleFlight();
    if (code === 'KeyZ') this.usePotion();
    if (code === 'Tab') this.lockNearestTarget();
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onMouseMove(event) {
    if (!this.state.pointerLocked || this.state.paused) return;
    const sensitivity = 0.00215;
    this.state.yaw -= event.movementX * sensitivity;
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch - event.movementY * sensitivity, -0.58, 0.62);
  }

  onMouseDown(event) {
    if (!this.state.pointerLocked || this.state.paused) return;
    if (event.button === 0) this.castAbility('basic');
    if (event.button === 2) {
      this.state.blocking = true;
      this.socket?.emit('combat:block', { active: true, clientTime: Date.now() });
    }
  }

  onMouseUp(event) {
    if (event.button === 2) {
      this.state.blocking = false;
      this.socket?.emit('combat:block', { active: false, clientTime: Date.now() });
    }
  }

  togglePause(force) {
    const open = force ?? !this.state.paused;
    this.state.paused = open;
    this.ui.pauseMenu?.classList.toggle('is-open', open);
    this.ui.pauseMenu?.toggleAttribute('hidden', !open);
    if (open && document.pointerLockElement) document.exitPointerLock?.();
  }

  toggleWorldMap() {
    const open = !this.ui.worldMap?.classList.contains('is-open');
    this.ui.worldMap?.classList.toggle('is-open', open);
    this.ui.worldMap?.toggleAttribute('hidden', !open);
    this.state.paused = open;
    if (open && document.pointerLockElement) document.exitPointerLock?.();
    if (!open) this.requestPointerLock();
  }

  abilityData(id) {
    const source = ABILITIES?.[id] ?? (Array.isArray(ABILITIES) ? ABILITIES.find((ability) => ability.id === id || ability.key?.toLowerCase() === id) : null);
    if (!source) return FALLBACK_ABILITIES[id];
    return {
      ...FALLBACK_ABILITIES[id],
      ...source,
      manaCost: firstDefined(source.manaCost, source.cost, FALLBACK_ABILITIES[id]?.manaCost, 0),
      cooldown: firstDefined(source.cooldown, source.cooldownSeconds, FALLBACK_ABILITIES[id]?.cooldown, 1),
    };
  }

  beginDash() {
    if (this.state.dashCooldown > 0 || this.state.meditation || this.profile.hp <= 0) return;
    const direction = this.inputDirection();
    if (direction.lengthSq() < 0.01) direction.set(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
    this.state.dashDirection.copy(direction).normalize();
    this.state.dashRemaining = 0.22;
    this.state.dashCooldown = 1.05;
    this.state.meditation = false;
    this.audio?.play('dash');
    this.socket?.emit('player:dash', { direction: vec3(direction), clientTime: Date.now() });
    const color = SECT_PALETTES[this.profile.faction]?.energy ?? 0x63dfff;
    const ring = createAreaRing(color, 1.25);
    ring.position.copy(this.player.position);
    ring.position.y = 0.08;
    ring.scale.set(0.45, 0.45, 0.45);
    this.addEffect(ring);
  }

  inputDirection() {
    const forwardAmount = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const rightAmount = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const forward = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
    const right = new THREE.Vector3(Math.cos(this.state.yaw), 0, -Math.sin(this.state.yaw));
    return forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount)).normalize();
  }

  castAbility(id) {
    if (this.state.paused || this.profile.hp <= 0 || this.state.meditation) return;
    const ability = this.abilityData(id);
    if (!ability) return;
    const remaining = this.cooldowns.get(id) ?? 0;
    if (remaining > 0) {
      this.audio?.play('error');
      return;
    }
    const cost = Number(ability.manaCost) || 0;
    if (this.profile.mp < cost) {
      this.toast('Chân khí không đủ.', 'warning');
      this.audio?.play('error');
      return;
    }
    if (id === 'g' && !this.profile.flightUnlocked && this.profile.qi < 70) {
      this.toast('Tuyệt kỹ cần ít nhất 70% chân nguyên.', 'warning');
      return;
    }

    const now = performance.now() / 1000;
    this.cooldowns.set(id, Number(ability.cooldown) || 1);
    this.profile.mp = Math.max(0, this.profile.mp - cost);
    this.state.attackingUntil = now + (id === 'basic' ? 0.32 : 0.64);
    const direction = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw)).normalize();
    const target = this.findNearestEnemy(Number(ability.range) || 6);
    this.socket?.emit('combat:ability', {
      abilityId: id,
      ability: id,
      position: vec3(this.player.position),
      direction: vec3(direction),
      aim: { x: direction.x, z: direction.z },
      targetId: target?.id ?? null,
      clientTime: Date.now(),
    });
    this.playAbilityVfx(id, this.player.position, direction, this.profile.faction);
  }

  playAbilityVfx(id, origin, direction, sect = this.profile.faction) {
    const color = SECT_PALETTES[sect]?.energy ?? cssColorToHex(this.abilityData(id)?.color, 0x63dfff);
    const position = new THREE.Vector3(origin.x, origin.y, origin.z);
    const yaw = Math.atan2(-direction.x, -direction.z);
    if (id === 'basic' || id === 'r') {
      const arc = createSlashArc(id === 'r' ? 0xffd875 : color, id === 'r' ? 1.9 : 1);
      arc.position.copy(position).add(new THREE.Vector3(direction.x, 1.35, direction.z).multiplyScalar(1.1));
      arc.rotation.y = yaw;
      arc.userData.effect.life = id === 'r' ? 0.62 : 0.34;
      arc.userData.effect.maxLife = arc.userData.effect.life;
      this.addEffect(arc);
      this.audio?.play(id === 'r' ? 'skill' : 'slash');
      this.screenShake(id === 'r' ? 0.3 : 0.08);
    } else if (id === 'q') {
      const projectile = createProjectile(color);
      projectile.position.copy(position).add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(direction, 0.9);
      projectile.rotation.y = yaw;
      projectile.userData.effect.velocity = direction.clone().multiplyScalar(19);
      projectile.userData.effect.life = 0.72;
      projectile.userData.effect.maxLife = 0.72;
      this.addEffect(projectile);
      this.audio?.play('skill');
    } else if (id === 'e' || id === 'g') {
      const ring = createAreaRing(id === 'g' ? 0xffcf66 : color, id === 'g' ? 7 : 4.6);
      ring.position.copy(position);
      ring.position.y += 0.09;
      ring.userData.effect.life = id === 'g' ? 1.35 : 0.82;
      ring.userData.effect.maxLife = ring.userData.effect.life;
      this.addEffect(ring);
      const count = id === 'g' ? 16 : 8;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        const blade = createProjectile(id === 'g' ? 0xffdc7d : color);
        blade.scale.setScalar(id === 'g' ? 1.15 : 0.75);
        blade.position.copy(position).add(new THREE.Vector3(Math.sin(angle) * 2.4, 0.7 + (i % 3) * 0.42, Math.cos(angle) * 2.4));
        blade.rotation.y = angle;
        blade.userData.effect.velocity = new THREE.Vector3(Math.sin(angle), 0.04, Math.cos(angle)).multiplyScalar(id === 'g' ? 11 : 7);
        blade.userData.effect.life = id === 'g' ? 1.2 : 0.72;
        blade.userData.effect.maxLife = blade.userData.effect.life;
        this.addEffect(blade);
      }
      this.audio?.play('skill');
      this.screenShake(id === 'g' ? 0.62 : 0.22);
    } else if (id === 'f') {
      const ring = createAreaRing(0x78ffae, 2.6);
      ring.position.copy(position);
      ring.position.y += 0.1;
      ring.rotation.x = 0;
      ring.userData.effect.life = 1.15;
      ring.userData.effect.maxLife = 1.15;
      this.addEffect(ring);
      this.audio?.play('heal');
    }
  }

  findNearestEnemy(range = Infinity) {
    let nearest = null;
    let nearestDistance = range;
    this.enemies.forEach((entry, id) => {
      if ((entry.data.hp ?? 0) <= 0) return;
      const distance = this.player.position.distanceTo(entry.object.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { id, distance, entry };
      }
    });
    return nearest;
  }

  lockNearestTarget() {
    const target = this.findNearestEnemy(22);
    if (!target) {
      this.toast('Không có mục tiêu trong tầm thần thức.', 'hint');
      return;
    }
    this.state.lockedTargetId = this.state.lockedTargetId === target.id ? null : target.id;
    target.entry.object.userData.locked = this.state.lockedTargetId === target.id;
    this.toast(this.state.lockedTargetId ? 'Đã khóa mục tiêu.' : 'Đã bỏ khóa mục tiêu.', 'info');
  }

  toggleMeditation() {
    if (this.state.flying || this.state.tribulation || this.profile.hp <= 0) return;
    const inSafeZone = Math.abs(this.player.position.x) <= 15 && this.player.position.z >= 14;
    if (!inSafeZone) {
      this.toast('Chỉ có thể tĩnh tọa trong khu an toàn của Tông Môn.', 'warning');
      return;
    }
    this.state.meditation = !this.state.meditation;
    this.state.velocity.set(0, 0, 0);
    this.socket?.emit('cultivation:meditate', { active: this.state.meditation });
    this.toast(this.state.meditation ? 'Nhập định · đang hấp thụ linh khí' : 'Đã kết thúc tĩnh tọa', this.state.meditation ? 'success' : 'info');
  }

  startBreakthrough() {
    if (this.state.tribulation) return;
    const distanceToAltar = this.player.position.distanceTo(this.world.altar.position);
    if (distanceToAltar > 5.2) {
      this.toast('Hãy trở lại Trận Pháp giữa sân để đột phá.', 'warning');
      return;
    }
    if (this.profile.qi < 100) {
      this.toast(`Chân nguyên chưa viên mãn (${Math.floor(this.profile.qi)}%).`, 'warning');
      return;
    }
    if (!this.profile.hasHeartPill) {
      this.toast('Cần Hộ Tâm Đan từ Hộ Điện Khôi Lỗi.', 'warning');
      return;
    }
    this.state.meditation = false;
    this.socket?.emit('breakthrough:start', {}, (response) => {
      if (response?.ok === false) this.toast(response.message ?? 'Chưa thể đột phá.', 'error');
    });
  }

  toggleFlight() {
    if (!this.profile.flightUnlocked) {
      this.toast('Ngự Kiếm mở khóa sau khi kết Kim Đan.', 'hint');
      return;
    }
    this.state.flying = !this.state.flying;
    this.profile.flying = this.state.flying;
    this.state.meditation = false;
    this.socket?.emit('player:flight', { active: this.state.flying });
    this.toast(this.state.flying ? 'Ngự Kiếm Phi Hành' : 'Thu hồi phi kiếm', this.state.flying ? 'success' : 'info');
    if (this.state.flying) this.audio?.play('skill');
  }

  usePotion() {
    if (this.profile.hp >= this.profile.maxHp) return;
    this.socket?.emit('inventory:use', { itemId: 'healthPotion' });
    this.profile.hp = Math.min(this.profile.maxHp, this.profile.hp + 55);
    this.audio?.play('heal');
  }

  applySnapshot(snapshot = {}) {
    this.lastSnapshot = snapshot;
    this.state.lastSnapshotAt = performance.now();
    const players = listFromPayload(snapshot.players ?? snapshot.room?.players);
    const selfId = this.socket?.id;
    const seenPlayers = new Set();
    for (const playerData of players) {
      const id = String(playerData.id ?? playerData.socketId ?? '');
      if (!id) continue;
      seenPlayers.add(id);
      if (id === selfId || playerData.self) {
        this.mergeSelfState(playerData);
      } else {
        this.upsertRemotePlayer(id, playerData);
      }
    }
    this.remotePlayers.forEach((entry, id) => {
      if (!seenPlayers.has(id)) {
        this.scene.remove(entry.object);
        this.disposeObject(entry.object);
        this.remotePlayers.delete(id);
      }
    });

    const enemies = listFromPayload(snapshot.enemies ?? snapshot.world?.enemies);
    const seenEnemies = new Set();
    for (const enemy of enemies) {
      const id = String(enemy.id ?? enemy.enemyId ?? '');
      if (!id) continue;
      seenEnemies.add(id);
      this.upsertEnemy(id, enemy);
    }
    this.enemies.forEach((entry, id) => {
      if (!seenEnemies.has(id)) {
        this.scene.remove(entry.object);
        this.disposeObject(entry.object);
        this.enemies.delete(id);
      }
    });
    this.ui.onlineCount && (this.ui.onlineCount.textContent = `${Math.max(1, players.length)}`);
  }

  mergeSelfState(data = {}) {
    const previousHp = this.profile.hp;
    const previousQi = this.profile.qi;
    const previousPill = this.profile.hasHeartPill;
    const previousFlight = this.profile.flightUnlocked;
    this.profile.hp = Number(firstDefined(data.hp, data.stats?.hp, this.profile.hp));
    this.profile.maxHp = Number(firstDefined(data.maxHp, data.stats?.maxHp, this.profile.maxHp));
    this.profile.mp = Number(firstDefined(data.mp, data.mana, data.stats?.mp, this.profile.mp));
    this.profile.maxMp = Number(firstDefined(data.maxMp, data.maxMana, data.stats?.maxMp, this.profile.maxMp));
    this.profile.qi = Number(firstDefined(data.qi, data.cultivation, data.stats?.qi, this.profile.qi));
    this.profile.maxQi = Number(firstDefined(data.maxQi, data.stats?.maxQi, this.profile.maxQi, 100));
    this.profile.stones = Number(firstDefined(data.stones, data.inventory?.linhThach, data.inventory?.spiritStones, this.profile.stones));
    this.profile.hasHeartPill = Boolean(firstDefined(
      data.hasHeartPill,
      data.inventory ? Number(data.inventory.hoTamDan) > 0 : undefined,
      data.inventory?.heartPill,
      data.inventory ? Number(data.inventory.heartPills) > 0 : undefined,
      this.profile.hasHeartPill,
    ));
    this.profile.flightUnlocked = Boolean(firstDefined(data.flightUnlocked, data.unlocks?.flight, this.profile.flightUnlocked));
    this.profile.realm = firstDefined(data.realm?.id, data.realm, this.profile.realm);
    this.profile.realmName = firstDefined(data.realm?.name, data.realmName, this.profile.realmName);
    this.profile.kills = Number(firstDefined(data.kills, data.stats?.kills, this.profile.kills));
    this.state.meditation = Boolean(firstDefined(data.meditating, data.meditation, this.state.meditation));
    this.state.blocking = Boolean(firstDefined(data.blocking, this.state.blocking));
    this.state.flying = Boolean(firstDefined(data.isFlying, data.flying, this.state.flying));
    if (data.tribulation) this.state.tribulation = data.tribulation;
    if (data.breakthrough?.status && data.breakthrough.status !== 'idle') {
      this.state.tribulation = {
        wave: data.breakthrough.wave ?? 0,
        totalWaves: 3,
        status: data.breakthrough.status,
      };
    } else if (data.breakthrough?.status === 'idle' && !this.profile.flightUnlocked) {
      this.state.tribulation = null;
    }
    if (data.cooldowns && typeof data.cooldowns === 'object') {
      Object.entries(data.cooldowns).forEach(([key, remainingMs]) => {
        const id = key === 'basic' ? 'basic' : key.toLowerCase();
        this.cooldowns.set(id, Math.max(this.cooldowns.get(id) ?? 0, Number(remainingMs) / 1000));
      });
    }
    if (data.questPhase) this.state.objectivePhase = data.questPhase;

    const serverPosition = vec3(data.position ?? data.pos, this.player.position);
    const correction = this.player.position.distanceTo(new THREE.Vector3(serverPosition.x, serverPosition.y, serverPosition.z));
    if (correction > 7 || previousHp <= 0) this.player.position.set(serverPosition.x, serverPosition.y, serverPosition.z);

    if (this.profile.hp < previousHp) {
      this.flashDamage();
      this.screenShake(0.35);
      this.audio?.play('hit');
    }
    if (this.profile.qi > previousQi + 0.1) this.showGain(`+${Math.max(1, Math.round(this.profile.qi - previousQi))} Chân nguyên`);
    if (!previousPill && this.profile.hasHeartPill) {
      this.toast('Nhận được Hộ Tâm Đan!', 'legendary');
      this.audio?.play('success');
    }
    if (!previousFlight && this.profile.flightUnlocked) this.unlockFlightSequence();
    this.onProfileChange?.(this.profile);
  }

  upsertRemotePlayer(id, data) {
    const targetPosition = vec3(data.position ?? data.pos);
    let entry = this.remotePlayers.get(id);
    if (!entry) {
      const object = createCultivator({
        sect: data.faction ?? data.sect ?? 'orthodox',
        name: data.name ?? 'Đạo hữu',
        remote: true,
      });
      object.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
      this.scene.add(object);
      entry = { object, data, target: object.position.clone(), yaw: Number(data.yaw) || 0, speed: 0 };
      this.remotePlayers.set(id, entry);
      this.toast(`${data.name ?? 'Một đạo hữu'} đã nhập trận.`, 'online');
    }
    entry.data = data;
    entry.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
    entry.yaw = (Number(data.yaw) || 0) - Math.PI;
    entry.speed = Number(data.speed ?? Math.hypot(data.velocity?.x || 0, data.velocity?.z || 0));
  }

  upsertEnemy(id, data) {
    const targetPosition = vec3(data.position ?? data.pos);
    let entry = this.enemies.get(id);
    if (!entry) {
      const type = data.type ?? data.archetype ?? (data.boss ? 'guardianBoss' : 'spiritWolf');
      const object = createEnemy({ type, boss: Boolean(data.boss ?? data.isBoss) });
      object.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
      object.userData.baseY = targetPosition.y;
      this.scene.add(object);
      entry = { object, data, target: object.position.clone(), yaw: Number(data.yaw) || 0, lastHp: data.hp, speed: 0 };
      this.enemies.set(id, entry);
    }
    if (Number(data.hp) < Number(entry.lastHp)) {
      const amount = Math.max(1, Math.round(Number(entry.lastHp) - Number(data.hp)));
      this.spawnDamageNumber(entry.object.position, amount, data.boss ? 'critical' : 'damage');
      this.hitBurst(entry.object.position, data.boss ? 0xff8b6b : 0x7ce7ff);
    }
    entry.lastHp = Number(data.hp);
    entry.data = data;
    entry.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
    entry.object.userData.baseY = targetPosition.y;
    entry.yaw = (Number(data.yaw) || 0) - Math.PI;
    entry.speed = Number(data.speed ?? Math.hypot(data.velocity?.x || 0, data.velocity?.z || 0));
    updateHealthBar(entry.object, data.hp, data.maxHp, this.camera);
    entry.object.visible = data.alive !== false && Number(data.hp) > 0;
    if (data.boss || data.isBoss) this.state.boss = { id, ...data };
  }

  handleWorldEvent(event = {}) {
    const type = event.type ?? event.event;
    if (!type) return;
    const positionValue = event.position ?? event.pos ?? event.targetPosition;
    const position = new THREE.Vector3(...Object.values(vec3(positionValue ?? this.player.position)));
    if (type === 'ability' || type === 'combat:ability' || type === 'ability:cast') {
      if (event.playerId !== this.socket?.id && event.actorId !== this.socket?.id) {
        const actor = this.remotePlayers.get(event.playerId ?? event.actorId)?.object;
        const origin = actor?.position ?? position;
        const directionData = vec3(event.direction ?? event.aim, { z: -1 });
        this.playAbilityVfx(String(event.abilityId ?? event.ability ?? 'basic').toLowerCase(), origin, new THREE.Vector3(directionData.x, directionData.y, directionData.z), event.faction ?? 'orthodox');
      }
      return;
    }
    if (type === 'enemy:telegraph') {
      const delay = Math.max(120, Number(event.resolveAt) - Date.now() || 850);
      const warning = createAreaRing(0xff4d59, Number(event.radius) || 3.2);
      warning.position.copy(position);
      warning.position.y = 0.08;
      warning.userData.effect.life = delay / 1000;
      warning.userData.effect.maxLife = delay / 1000;
      warning.userData.effect.kind = 'warning';
      this.addEffect(warning);
      this.scheduledEffects.push({ at: performance.now() + delay, type: 'enemy-strike', position: position.clone() });
      return;
    }
    if (type === 'enemy:attack' && event.position) {
      this.spawnLightning(position);
      return;
    }
    if (type.includes('lightning') && type.includes('warning')) {
      this.scheduleLightning(position, Number(event.delayMs ?? event.delay ?? 900));
      return;
    }
    if (type.includes('lightning') || type === 'tribulation:strike') {
      this.spawnLightning(position);
      return;
    }
    if (type === 'breakthrough:start' || type === 'breakthrough:started' || type === 'tribulation:start') {
      this.state.tribulation = { wave: 0, totalWaves: 3, ...event };
      this.world.altar.userData.active = true;
      this.toast('TIỂU LÔI KIẾP GIÁNG LÂM', 'legendary');
      this.ui.app?.classList.add('tribulation-active');
      return;
    }
    if (type === 'breakthrough:telegraph') {
      this.state.tribulation = { ...(this.state.tribulation ?? {}), wave: Number(event.wave) || 1, totalWaves: 3 };
      const delay = Math.max(120, Number(event.resolveAt) - Date.now() || 900);
      const warningPosition = new THREE.Vector3(...Object.values(vec3(event.position ?? this.player.position)));
      const warning = createAreaRing(0xff4d59, Number(event.radius) || 2.8);
      warning.position.copy(warningPosition);
      warning.position.y = 0.08;
      warning.userData.effect.life = delay / 1000;
      warning.userData.effect.maxLife = delay / 1000;
      warning.userData.effect.kind = 'warning';
      this.addEffect(warning);
      this.toast(`Lôi kiếp · Đợt ${event.wave}/3`, 'warning');
      return;
    }
    if (type === 'breakthrough:strike') {
      this.spawnLightning(position);
      return;
    }
    if (type === 'breakthrough:wave' || type === 'tribulation:wave') {
      const wave = Number(event.wave) || 1;
      this.state.tribulation = { ...(this.state.tribulation ?? {}), wave, totalWaves: 3 };
      this.toast(`Lôi kiếp · Đợt ${wave}/3`, 'warning');
      const strikes = listFromPayload(event.strikes ?? event.targets);
      if (strikes.length) {
        strikes.forEach((strike, index) => this.scheduleLightning(new THREE.Vector3(...Object.values(vec3(strike.position ?? strike))), Number(strike.delayMs ?? 650 + index * 280)));
      } else {
        for (let i = 0; i < wave + 1; i += 1) {
          const offset = new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
          this.scheduleLightning(this.player.position.clone().add(offset), 700 + i * 360);
        }
      }
      return;
    }
    if (type === 'breakthrough:success' || type === 'tribulation:success' || type === 'realm:advanced') {
      this.profile.flightUnlocked = true;
      this.profile.realm = 'goldenCore';
      this.profile.realmName = 'Kim Đan Sơ Kỳ';
      this.state.tribulation = null;
      this.unlockFlightSequence();
      return;
    }
    if (type === 'breakthrough:failed' || type === 'tribulation:failed') {
      this.state.tribulation = null;
      this.ui.app?.classList.remove('tribulation-active');
      this.toast('Đột phá thất bại — có thể thử lại ngay.', 'error');
      return;
    }
    if (type === 'enemy:defeated' || type === 'boss:defeated') {
      this.audio?.play('success');
      this.toast(type.startsWith('boss') ? 'Hộ Điện Khôi Lỗi đã bị đánh bại!' : 'Yêu linh đã tan biến.', type.startsWith('boss') ? 'legendary' : 'success');
      return;
    }
    if (type === 'loot' || type === 'reward' || type === 'loot:granted') {
      if (event.playerId && event.playerId !== this.socket?.id) return;
      const lootNames = { linhThach: 'Linh Thạch', linhThao: 'Linh Thảo', linhCot: 'Linh Cốt', hoTamDan: 'Hộ Tâm Đan', qi: 'Chân nguyên' };
      if (event.loot && typeof event.loot === 'object') {
        const label = Object.entries(event.loot)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([item, amount]) => `${amount} ${lootNames[item] ?? item}`)
          .join(' · ');
        if (label) this.toast(`Nhận ${label}`, event.loot.hoTamDan ? 'legendary' : 'success');
      } else {
        const label = event.label ?? event.itemName ?? event.itemId ?? 'Linh vật';
        this.toast(`Nhận ${event.amount ? `${event.amount} ` : ''}${label}`, 'success');
      }
      return;
    }
    if (type === 'player:damaged') {
      this.flashDamage();
      return;
    }
    if (type === 'player:parried' && event.playerId === this.socket?.id) {
      this.toast('PHẢN ĐÒN HOÀN MỸ', 'legendary', 1400);
      this.audio?.play('success');
      this.screenShake(0.22);
      return;
    }
    if (type === 'player:blocked' && event.playerId === this.socket?.id) {
      this.toast('Pháp bảo đã giảm sát thương.', 'info', 1100);
      return;
    }
    if (event.message) this.toast(event.message, event.tone ?? 'info');
  }

  scheduleLightning(position, delayMs = 900) {
    const warning = createAreaRing(0xff4d59, 2.25);
    warning.position.copy(position);
    warning.position.y = 0.08;
    warning.userData.effect.life = delayMs / 1000;
    warning.userData.effect.maxLife = delayMs / 1000;
    warning.userData.effect.kind = 'warning';
    this.addEffect(warning);
    this.scheduledEffects.push({ at: performance.now() + delayMs, type: 'lightning', position: position.clone() });
  }

  spawnLightning(position) {
    const lightning = createLightningStrike(position);
    this.addEffect(lightning);
    this.audio?.play('thunder');
    this.screenShake(0.75);
  }

  unlockFlightSequence() {
    if (this.state.flightSequenceUnlocked) return;
    this.state.flightSequenceUnlocked = true;
    this.state.tribulation = null;
    this.ui.app?.classList.remove('tribulation-active');
    this.player.userData.auraForced = true;
    this.world.flightRings.forEach((ring) => {
      ring.visible = true;
      ring.userData.passed = false;
    });
    this.state.ringIndex = 0;
    this.audio?.play('success');
    this.toast('KIM ĐAN ĐẠI THÀNH', 'realm');
    setTimeout(() => this.toast('Đã mở khóa Ngự Kiếm Phi Hành · nhấn V', 'legendary'), 900);
    const ring = createAreaRing(0xffda72, 6.5);
    ring.position.copy(this.player.position);
    ring.position.y = 0.12;
    ring.userData.effect.life = 2.2;
    ring.userData.effect.maxLife = 2.2;
    this.addEffect(ring);
    this.onProfileChange?.(this.profile);
  }

  hitBurst(position, color) {
    for (let i = 0; i < 10; i += 1) {
      const particle = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
      );
      particle.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.7 + Math.random(), (Math.random() - 0.5) * 0.8));
      particle.userData.effect = {
        kind: 'particle',
        life: 0.42 + Math.random() * 0.28,
        maxLife: 0.7,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3.5, 1.2 + Math.random() * 3, (Math.random() - 0.5) * 3.5),
      };
      this.addEffect(particle);
    }
  }

  addEffect(object) {
    this.scene.add(object);
    this.effects.push(object);
  }

  spawnDamageNumber(worldPosition, amount, tone = 'damage') {
    if (!this.ui.app) return;
    const element = document.createElement('div');
    element.className = `floating-number ${tone}`;
    element.textContent = amount;
    this.ui.app.appendChild(element);
    this.damageNumbers.push({ element, position: worldPosition.clone().add(new THREE.Vector3(0, 1.6, 0)), life: 0.85, maxLife: 0.85 });
  }

  showGain(text) {
    this.toast(text, 'gain', 1200);
  }

  toast(message, tone = 'info', duration = 3000) {
    if (!this.ui.toastStack || !message) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.textContent = message;
    this.ui.toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  flashDamage() {
    this.ui.app?.classList.remove('damage-flash');
    requestAnimationFrame(() => this.ui.app?.classList.add('damage-flash'));
    setTimeout(() => this.ui.app?.classList.remove('damage-flash'), 280);
  }

  screenShake(amount) {
    this.state.shake = Math.max(this.state.shake ?? 0, amount);
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.pixelPipeline.resize(width, height);
  }

  updateMovement(delta) {
    const now = performance.now() / 1000;
    this.state.dashCooldown = Math.max(0, this.state.dashCooldown - delta);
    const movingAllowed = !this.state.meditation && this.profile.hp > 0;
    const direction = movingAllowed ? this.inputDirection() : new THREE.Vector3();
    const baseSpeed = this.state.flying ? 10.5 : 6.2;
    if (this.state.dashRemaining > 0) {
      this.state.dashRemaining -= delta;
      this.state.velocity.x = this.state.dashDirection.x * 19;
      this.state.velocity.z = this.state.dashDirection.z * 19;
    } else {
      const targetX = direction.x * baseSpeed;
      const targetZ = direction.z * baseSpeed;
      this.state.velocity.x = THREE.MathUtils.damp(this.state.velocity.x, targetX, direction.lengthSq() ? 12 : 18, delta);
      this.state.velocity.z = THREE.MathUtils.damp(this.state.velocity.z, targetZ, direction.lengthSq() ? 12 : 18, delta);
    }

    if (this.state.flying) {
      const ascend = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ControlLeft') || this.keys.has('ControlRight') ? 1 : 0);
      this.state.velocity.y = THREE.MathUtils.damp(this.state.velocity.y, ascend * 5.2, 8, delta);
      if (this.player.position.y < 3.2) this.state.velocity.y += (3.2 - this.player.position.y) * 4;
    } else {
      this.state.verticalVelocity -= 18 * delta;
      this.state.velocity.y = this.state.verticalVelocity;
    }

    this.player.position.addScaledVector(this.state.velocity, delta);
    if (!this.state.flying && this.player.position.y <= 0) {
      this.player.position.y = 0;
      this.state.verticalVelocity = 0;
      this.state.grounded = true;
    }
    if (this.state.flying) this.player.position.y = THREE.MathUtils.clamp(this.player.position.y, 2.7, 15);
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, this.world.bounds.minX, this.world.bounds.maxX);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, this.world.bounds.minZ, this.world.bounds.maxZ);

    const horizontalSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    if (horizontalSpeed > 0.35) {
      const facing = Math.atan2(-this.state.velocity.x, -this.state.velocity.z);
      this.player.rotation.y = dampAngle(this.player.rotation.y, facing, 14, delta);
    } else if (now < this.state.attackingUntil || this.state.blocking) {
      this.player.rotation.y = dampAngle(this.player.rotation.y, this.state.yaw, 16, delta);
    }
    const spawnScale = this.player.userData.spawnScale;
    if (spawnScale !== undefined && spawnScale < 1) {
      this.player.userData.spawnScale = THREE.MathUtils.damp(spawnScale, 1, 5.5, delta);
      this.player.scale.setScalar(this.player.userData.spawnScale);
    }
    animateCultivator(this.player, delta, {
      speed: horizontalSpeed,
      attacking: now < this.state.attackingUntil || this.state.blocking,
      meditating: this.state.meditation,
      flying: this.state.flying,
      defeated: this.profile.hp <= 0,
    });
    this.checkFlightRings();
  }

  updateCamera(delta) {
    if (this.state.lockedTargetId) {
      const target = this.enemies.get(this.state.lockedTargetId);
      if (target && target.data.hp > 0) {
        const offset = target.object.position.clone().sub(this.player.position);
        this.state.yaw = THREE.MathUtils.damp(this.state.yaw, Math.atan2(-offset.x, -offset.z), 4, delta);
      } else {
        this.state.lockedTargetId = null;
      }
    }
    const distance = this.state.flying ? 8.2 : 6.6;
    const height = this.state.flying ? 2.8 : 2.45;
    const target = this.player.position.clone().add(new THREE.Vector3(0, height, 0));
    const behind = new THREE.Vector3(Math.sin(this.state.yaw) * distance, 2.2 + Math.sin(this.state.pitch) * distance, Math.cos(this.state.yaw) * distance);
    const shoulder = new THREE.Vector3(Math.cos(this.state.yaw) * 0.92, 0, -Math.sin(this.state.yaw) * 0.92);
    const desired = target.clone().add(behind).add(shoulder);
    this.camera.position.lerp(desired, 1 - Math.exp(-10 * delta));
    const lookForward = new THREE.Vector3(-Math.sin(this.state.yaw), Math.sin(this.state.pitch) * 0.65, -Math.cos(this.state.yaw));
    const lookAt = target.clone().addScaledVector(lookForward, 4.5);
    if (this.state.shake > 0.001) {
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.state.shake, (Math.random() - 0.5) * this.state.shake, (Math.random() - 0.5) * this.state.shake));
      this.state.shake = THREE.MathUtils.damp(this.state.shake, 0, 13, delta);
    }
    this.camera.lookAt(lookAt);
  }

  updateNetworkEntities(delta, elapsed) {
    this.remotePlayers.forEach((entry) => {
      const previous = entry.object.position.clone();
      entry.object.position.lerp(entry.target, 1 - Math.exp(-12 * delta));
      entry.object.rotation.y = dampAngle(entry.object.rotation.y, entry.yaw, 11, delta);
      const speed = previous.distanceTo(entry.object.position) / Math.max(0.001, delta);
      animateCultivator(entry.object, delta, {
        speed,
        attacking: Boolean(entry.data.attacking || entry.data.blocking),
        meditating: Boolean(entry.data.meditating ?? entry.data.meditation),
        flying: Boolean(entry.data.flying),
        defeated: Number(entry.data.hp) <= 0,
      });
    });
    this.enemies.forEach((entry) => {
      const previous = entry.object.position.clone();
      entry.object.position.lerp(entry.target, 1 - Math.exp(-10 * delta));
      entry.object.rotation.y = dampAngle(entry.object.rotation.y, entry.yaw, 8, delta);
      const speed = previous.distanceTo(entry.object.position) / Math.max(0.001, delta);
      animateEnemy(entry.object, delta, elapsed, speed, Boolean(entry.data.attacking));
      updateHealthBar(entry.object, entry.data.hp, entry.data.maxHp, this.camera);
    });
  }

  updateEffects(delta) {
    const now = performance.now();
    for (let i = this.scheduledEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.scheduledEffects[i];
      if (now >= effect.at) {
        if (effect.type === 'lightning' || effect.type === 'enemy-strike') this.spawnLightning(effect.position);
        this.scheduledEffects.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const object = this.effects[i];
      const effect = object.userData.effect;
      if (!effect) continue;
      effect.life -= delta;
      const progress = 1 - effect.life / effect.maxLife;
      if (effect.velocity) object.position.addScaledVector(effect.velocity, delta);
      if (effect.kind === 'slash') {
        object.scale.setScalar(0.72 + progress * 0.72);
        if (object.material) object.material.opacity = 1 - progress;
      } else if (effect.kind === 'ring' || effect.kind === 'warning') {
        const pulse = effect.kind === 'warning' ? 0.96 + Math.sin(progress * 28) * 0.06 : 0.35 + progress * 1.05;
        object.scale.setScalar(pulse);
        if (object.material) object.material.opacity = effect.kind === 'warning' ? 0.35 + Math.sin(progress * 24) * 0.24 : (1 - progress) * 0.85;
      } else if (effect.kind === 'projectile') {
        object.rotation.z += delta * 7;
        object.scale.setScalar(0.7 + Math.sin(progress * Math.PI) * 0.55);
      } else if (effect.kind === 'particle') {
        effect.velocity.y -= delta * 6;
        object.scale.setScalar(Math.max(0.05, 1 - progress));
        object.material.opacity = 1 - progress;
      } else if (effect.kind === 'lightning') {
        object.traverse((child) => {
          if (child.material?.opacity !== undefined) child.material.opacity = 1 - progress;
          if (child.isPointLight) child.intensity = 18 * (1 - progress);
        });
      }
      if (effect.life <= 0) {
        this.scene.remove(object);
        this.disposeObject(object);
        this.effects.splice(i, 1);
      }
    }

    for (let i = this.damageNumbers.length - 1; i >= 0; i -= 1) {
      const item = this.damageNumbers[i];
      item.life -= delta;
      item.position.y += delta * 1.1;
      const projected = item.position.clone().project(this.camera);
      const visible = projected.z < 1;
      item.element.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * window.innerWidth}px, ${(-projected.y * 0.5 + 0.5) * window.innerHeight}px) scale(${0.8 + (item.life / item.maxLife) * 0.35})`;
      item.element.style.opacity = visible ? String(Math.max(0, item.life / item.maxLife)) : '0';
      if (item.life <= 0) {
        item.element.remove();
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  sendMovement(delta) {
    this.networkAccumulator += delta;
    if (this.networkAccumulator < 1 / 15 || !this.socket?.connected) return;
    this.networkAccumulator = 0;
    this.socket.emit('player:move', {
      position: vec3(this.player.position),
      pos: vec3(this.player.position),
      yaw: this.player.rotation.y + Math.PI,
      cameraYaw: this.state.yaw,
      velocity: vec3(this.state.velocity),
      speed: Math.hypot(this.state.velocity.x, this.state.velocity.z),
      animation: this.state.meditation ? 'meditate' : this.state.flying ? 'flight' : 'move',
      meditating: this.state.meditation,
      flying: this.state.flying,
      clientTime: Date.now(),
      sequence: ++this.networkSequence,
    });
  }

  checkFlightRings() {
    if (!this.profile.flightUnlocked || !this.state.flying || this.state.resultShown) return;
    const ring = this.world.flightRings[this.state.ringIndex];
    if (!ring || !ring.visible) return;
    if (this.player.position.distanceTo(ring.position) < 2.65) {
      ring.visible = false;
      ring.userData.passed = true;
      this.state.ringIndex += 1;
      this.audio?.play('success');
      this.toast(`Vượt Tiên Hoàn ${this.state.ringIndex}/3`, 'success');
      if (this.state.ringIndex >= this.world.flightRings.length) this.showResult();
    }
  }

  showResult() {
    this.state.resultShown = true;
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.ui.resultScreen?.removeAttribute('hidden');
    this.ui.resultScreen?.classList.add('is-open');
    this.audio?.play('success');
  }

  objective() {
    if (this.state.resultShown) return { title: 'Phi hành viên mãn', text: 'Bạn đã hoàn thành bản thử nghiệm.' };
    if (this.profile.flightUnlocked) {
      return this.state.flying
        ? { title: 'Ngự Kiếm Phi Hành', text: `Bay xuyên Tiên Hoàn · ${this.state.ringIndex}/3` }
        : { title: 'Kim Đan Sơ Thành', text: 'Nhấn V để triệu hồi phi kiếm.' };
    }
    if (this.state.tribulation) {
      return { title: 'Tiểu Lôi Kiếp', text: `Né vùng cảnh báo · Đợt ${this.state.tribulation.wave ?? 0}/3` };
    }
    if (!this.profile.hasHeartPill) {
      const bossAlive = [...this.enemies.values()].some((entry) => (entry.data.boss || entry.data.isBoss) && entry.data.hp > 0);
      return bossAlive
        ? { title: 'Thử Luyện Kim Đan', text: 'Đánh bại Hộ Điện Khôi Lỗi để lấy Hộ Tâm Đan.' }
        : { title: 'Tụ Khí Viên Mãn', text: 'Tiêu diệt yêu linh và hấp thụ chân nguyên.' };
    }
    if (this.profile.qi < 100) return { title: 'Tĩnh Tọa Tu Luyện', text: `Nhấn C để nhập định · ${Math.floor(this.profile.qi)}%` };
    return { title: 'Đột Phá Kim Đan', text: 'Đứng trong Trận Pháp và nhấn B.' };
  }

  updateUI(force = false) {
    const hpRatio = Math.max(0, Math.min(1, this.profile.hp / Math.max(1, this.profile.maxHp)));
    const mpRatio = Math.max(0, Math.min(1, this.profile.mp / Math.max(1, this.profile.maxMp)));
    const qiTarget = this.profile.flightUnlocked ? Math.max(1, this.profile.maxQi || 150) : 100;
    const qiRatio = Math.max(0, Math.min(1, this.profile.qi / qiTarget));
    if (this.ui.playerName) this.ui.playerName.textContent = this.profile.name;
    if (this.ui.realmName) this.ui.realmName.textContent = this.profile.realmName ?? 'Trúc Cơ Hậu Kỳ';
    if (this.ui.sectName) this.ui.sectName.textContent = FACTIONS?.[this.profile.faction]?.name ?? ({ orthodox: 'Chính Đạo', demonic: 'Ma Đạo', heretic: 'Tà Đạo' }[this.profile.faction] ?? 'Tán Tu');
    if (this.ui.hpFill) this.ui.hpFill.style.width = `${hpRatio * 100}%`;
    if (this.ui.hpText) this.ui.hpText.textContent = `${Math.ceil(this.profile.hp)} / ${this.profile.maxHp}`;
    if (this.ui.mpFill) this.ui.mpFill.style.width = `${mpRatio * 100}%`;
    if (this.ui.mpText) this.ui.mpText.textContent = `${Math.ceil(this.profile.mp)} / ${this.profile.maxMp}`;
    if (this.ui.qiFill) this.ui.qiFill.style.width = `${qiRatio * 100}%`;
    if (this.ui.qiText) this.ui.qiText.textContent = this.profile.flightUnlocked ? `${Math.floor(this.profile.qi)} / ${qiTarget}` : `${Math.floor(this.profile.qi)}%`;
    document.documentElement.style.setProperty('--sect-energy', `#${(SECT_PALETTES[this.profile.faction]?.energy ?? 0x63dfff).toString(16).padStart(6, '0')}`);

    const objective = this.objective();
    if (this.ui.objectiveTitle) this.ui.objectiveTitle.textContent = objective.title;
    if (this.ui.objectiveText) this.ui.objectiveText.textContent = objective.text;

    const bossEntry = [...this.enemies.values()].find((entry) => entry.data.boss || entry.data.isBoss);
    const showBoss = bossEntry && bossEntry.data.hp > 0;
    this.ui.bossHud?.toggleAttribute('hidden', !showBoss);
    this.ui.bossHud?.classList.toggle('is-visible', Boolean(showBoss));
    if (showBoss) {
      const ratio = Math.max(0, Math.min(1, bossEntry.data.hp / Math.max(1, bossEntry.data.maxHp)));
      if (this.ui.bossName) this.ui.bossName.textContent = bossEntry.data.name ?? bossEntry.data.label ?? 'Hộ Điện Khôi Lỗi';
      if (this.ui.bossFill) this.ui.bossFill.style.width = `${ratio * 100}%`;
      if (this.ui.bossText) this.ui.bossText.textContent = `${Math.ceil(bossEntry.data.hp)} / ${bossEntry.data.maxHp}`;
    }

    this.ui.skillbar?.querySelectorAll('[data-skill]').forEach((slot) => {
      const id = slot.dataset.skill;
      const ability = this.abilityData(id);
      const remaining = this.cooldowns.get(id) ?? 0;
      const max = Math.max(0.01, Number(ability?.cooldown) || 1);
      slot.style.setProperty('--cooldown', `${Math.min(1, remaining / max) * 100}%`);
      slot.dataset.cooldown = remaining > 0.05 ? remaining.toFixed(remaining > 2 ? 0 : 1) : '';
      slot.classList.toggle('is-cooling', remaining > 0.05);
      slot.classList.toggle('is-locked', id === 'g' && !this.profile.flightUnlocked && this.profile.qi < 70);
      const label = slot.querySelector('[data-skill-name]');
      if (label && ability?.name) label.textContent = ability.name;
    });

    const altarDistance = this.player.position.distanceTo(this.world.altar.position);
    let prompt = '';
    if (this.profile.flightUnlocked) prompt = this.state.flying ? '[V] Thu hồi phi kiếm' : '[V] Ngự Kiếm Phi Hành';
    else if (altarDistance < 5.2 && this.profile.qi >= 100 && this.profile.hasHeartPill) prompt = '[B] Kích hoạt Lôi Kiếp';
    else if (!this.state.tribulation) prompt = this.state.meditation ? '[C] Kết thúc tĩnh tọa' : '[C] Tĩnh tọa tu luyện';
    if (this.ui.interactionPrompt) {
      this.ui.interactionPrompt.textContent = prompt;
      this.ui.interactionPrompt.classList.toggle('is-visible', Boolean(prompt));
    }
    if (force) this.drawMinimap();
  }

  drawMinimap() {
    const canvas = this.ui.minimap;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(130, Math.floor(rect.width || 174));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const radius = size * 0.45;
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, '#d8c18c');
    gradient.addColorStop(1, '#8a7049');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(69, 46, 29, .36)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, center + i * 16);
      ctx.lineTo(size, center + i * 16 + Math.sin(i) * 5);
      ctx.stroke();
    }
    const scale = size / 86;
    const toMap = (position) => ({ x: center + (position.x - this.player.position.x) * scale, y: center + (position.z - this.player.position.z) * scale });
    const altarPoint = toMap(this.world.altar.position);
    ctx.fillStyle = '#e0a83e';
    ctx.beginPath();
    ctx.arc(altarPoint.x, altarPoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    this.enemies.forEach((entry) => {
      if (entry.data.hp <= 0) return;
      const point = toMap(entry.object.position);
      ctx.fillStyle = entry.data.boss || entry.data.isBoss ? '#7e101f' : '#bd3d39';
      ctx.beginPath();
      ctx.arc(point.x, point.y, entry.data.boss || entry.data.isBoss ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    this.remotePlayers.forEach((entry) => {
      const point = toMap(entry.object.position);
      ctx.fillStyle = '#4d98c4';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    ctx.strokeStyle = '#caa55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-this.state.yaw);
    ctx.fillStyle = '#72efff';
    ctx.shadowColor = '#1ac9ed';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  loop(time) {
    if (!this.state.running) return;
    const delta = Math.min(0.05, Math.max(0.001, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    const elapsed = this.clock.getElapsedTime();
    this.cooldowns.forEach((remaining, id) => this.cooldowns.set(id, Math.max(0, remaining - delta)));
    if (!this.state.paused) {
      this.updateMovement(delta);
      this.updateNetworkEntities(delta, elapsed);
      this.sendMovement(delta);
    }
    this.updateCamera(delta);
    this.updateEffects(delta);
    this.world.update(delta, elapsed, { tribulation: Boolean(this.state.tribulation) });
    this.uiAccumulator += delta;
    this.minimapAccumulator += delta;
    if (this.uiAccumulator > 0.075) {
      this.uiAccumulator = 0;
      this.updateUI();
    }
    if (this.minimapAccumulator > 0.16) {
      this.minimapAccumulator = 0;
      this.drawMinimap();
    }
    this.pixelPipeline.render();
    requestAnimationFrame(this.bound.loop);
  }

  disposeObject(object) {
    const geometries = new Set();
    const materials = new Set();
    object?.traverse((child) => {
      if (child.geometry && !geometries.has(child.geometry)) {
        geometries.add(child.geometry);
        child.geometry.dispose?.();
      }
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.filter(Boolean).forEach((material) => {
        if (material.userData?.shared || materials.has(material)) return;
        materials.add(material);
        for (const key of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap']) {
          const texture = material[key];
          if (texture && !texture.userData?.shared) texture.dispose?.();
        }
        material.dispose?.();
      });
    });
  }

  destroy() {
    this.state.running = false;
    this.keys.clear();
    window.removeEventListener('resize', this.bound.resize);
    window.removeEventListener('keydown', this.bound.keydown);
    window.removeEventListener('keyup', this.bound.keyup);
    window.removeEventListener('mousemove', this.bound.mousemove);
    window.removeEventListener('mousedown', this.bound.mousedown);
    window.removeEventListener('mouseup', this.bound.mouseup);
    window.removeEventListener('contextmenu', this.bound.contextmenu);
    document.removeEventListener('pointerlockchange', this.bound.pointerlockchange);
    document.removeEventListener('visibilitychange', this.bound.visibility);
    this.canvas.removeEventListener('click', this.bound.canvasClick);
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.socket?.disconnect();
    this.pixelPipeline.dispose();
    this.renderer.dispose();
    this.damageNumbers.forEach((item) => item.element.remove());
  }
}
