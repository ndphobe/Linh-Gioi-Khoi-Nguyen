import * as THREE from 'three';

export const SECT_PALETTES = {
  orthodox: {
    primary: 0x9edcff,
    secondary: 0x174c72,
    energy: 0x62d9ff,
    dark: 0x071c2c,
  },
  demonic: {
    primary: 0xc94a6b,
    secondary: 0x4a102c,
    energy: 0xff356d,
    dark: 0x220713,
  },
  heretic: {
    primary: 0x88d37a,
    secondary: 0x214d34,
    energy: 0x76ff91,
    dark: 0x071f12,
  },
};

const toonRamp = new THREE.DataTexture(
  new Uint8Array([24, 86, 164, 255]),
  4,
  1,
  THREE.RedFormat,
);
toonRamp.minFilter = THREE.NearestFilter;
toonRamp.magFilter = THREE.NearestFilter;
toonRamp.generateMipmaps = false;
toonRamp.needsUpdate = true;

function pixelMaterial(parameters = {}) {
  const {
    roughness: _roughness,
    metalness: _metalness,
    flatShading: _flatShading,
    ...toonParameters
  } = parameters;
  const material = new THREE.MeshToonMaterial({
    gradientMap: toonRamp,
    flatShading: true,
    ...toonParameters,
  });
  return material;
}

function sharedMaterial(parameters) {
  const material = pixelMaterial(parameters);
  material.userData.shared = true;
  return material;
}

const shared = {
  gold: sharedMaterial({ color: 0xc69a45 }),
  black: sharedMaterial({ color: 0x090d14 }),
  skin: sharedMaterial({ color: 0xe9b993 }),
  wood: sharedMaterial({ color: 0x4d281d }),
  redWood: sharedMaterial({ color: 0x822a2d }),
  stone: sharedMaterial({ color: 0x34444b }),
};

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, material, segments = 8) {
  return shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  ));
}

function box(w, h, d, material) {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
}

function sphere(radius, material, width = 12, height = 8) {
  return shadowed(new THREE.Mesh(new THREE.SphereGeometry(radius, width, height), material));
}

function createEnergyMaterial(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function makeNameplate(text, color = '#f8e9bd') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(9, 13, 20, .86)';
  ctx.fillRect(4, 4, 248, 36);
  ctx.strokeStyle = '#c69a45';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, 246, 34);
  ctx.fillStyle = color;
  ctx.font = '700 18px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 24), 128, 23);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(3.6, 0.68, 1);
  sprite.position.y = 3.15;
  sprite.renderOrder = 30;
  return sprite;
}

export function createCultivator({ sect = 'orthodox', name = '', remote = false } = {}) {
  const palette = SECT_PALETTES[sect] ?? SECT_PALETTES.orthodox;
  const group = new THREE.Group();
  group.name = `cultivator-${name || 'anonymous'}`;

  const cloth = pixelMaterial({
    color: palette.primary,
    roughness: 0.58,
    metalness: 0.04,
  });
  const clothDark = pixelMaterial({ color: palette.secondary, roughness: 0.65 });
  const energy = createEnergyMaterial(palette.energy, 0.82);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  shadow.scale.set(1.15, 0.62, 1);
  group.add(shadow);

  const robe = cylinder(0.36, 0.66, 1.32, cloth, 8);
  robe.position.y = 0.78;
  group.add(robe);

  const belt = cylinder(0.43, 0.43, 0.16, shared.gold, 12);
  belt.position.y = 1.31;
  group.add(belt);

  const torso = cylinder(0.42, 0.37, 0.82, clothDark, 8);
  torso.position.y = 1.62;
  group.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 6, 16, Math.PI * 1.45), shared.gold);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI * 0.78;
  collar.position.set(0, 1.93, -0.08);
  group.add(collar);

  const head = sphere(0.35, shared.skin, 8, 6);
  head.position.y = 2.15;
  group.add(head);

  const hair = sphere(0.38, shared.black, 8, 6);
  hair.scale.set(1, 0.78, 1.03);
  hair.position.set(0, 2.27, 0.035);
  group.add(hair);

  const face = sphere(0.285, shared.skin, 8, 6);
  face.scale.set(0.84, 0.9, 0.5);
  face.position.set(0, 2.12, -0.29);
  group.add(face);

  const topknot = cylinder(0.095, 0.13, 0.34, shared.black, 8);
  topknot.position.y = 2.62;
  group.add(topknot);
  const hairpin = box(0.55, 0.045, 0.045, shared.gold);
  hairpin.position.y = 2.66;
  group.add(hairpin);

  const hairTail = box(0.25, 0.82, 0.16, shared.black);
  hairTail.position.set(0, 1.78, 0.28);
  group.add(hairTail);

  for (const side of [-1, 1]) {
    const shoulderPlate = box(0.3, 0.16, 0.42, shared.gold);
    shoulderPlate.position.set(side * 0.43, 1.88, 0.02);
    shoulderPlate.rotation.z = side * 0.18;
    group.add(shoulderPlate);
  }

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(-0.43, 1.84, 0);
  rightArm.position.set(0.43, 1.84, 0);
  for (const [arm, sign] of [[leftArm, -1], [rightArm, 1]]) {
    const sleeve = cylinder(0.13, 0.2, 0.78, cloth, 7);
    sleeve.position.y = -0.34;
    sleeve.rotation.z = sign * 0.12;
    arm.add(sleeve);
    const hand = sphere(0.12, shared.skin, 10, 7);
    hand.position.set(sign * 0.04, -0.74, 0);
    arm.add(hand);
    group.add(arm);
  }

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0, -0.72, 0);
  const guard = box(0.48, 0.07, 0.08, shared.gold);
  swordPivot.add(guard);
  const grip = cylinder(0.055, 0.055, 0.36, shared.wood, 8);
  grip.position.y = 0.18;
  swordPivot.add(grip);
  const bladeMaterial = pixelMaterial({
    color: 0xe5f6ff,
    emissive: palette.energy,
    emissiveIntensity: 0.6,
    metalness: 0.92,
    roughness: 0.12,
  });
  const blade = box(0.12, 1.55, 0.035, bladeMaterial);
  blade.position.y = -0.82;
  swordPivot.add(blade);
  swordPivot.rotation.z = -0.18;
  rightArm.add(swordPivot);

  const backSword = new THREE.Group();
  const backBlade = box(0.14, 1.9, 0.07, bladeMaterial);
  backBlade.position.y = 0.46;
  backSword.add(backBlade);
  const backGuard = box(0.62, 0.11, 0.12, shared.gold);
  backGuard.position.y = -0.48;
  backSword.add(backGuard);
  backSword.position.set(-0.33, 1.14, 0.34);
  backSword.rotation.z = -0.52;
  group.add(backSword);

  const ribbons = [];
  for (const side of [-1, 1]) {
    const ribbon = box(0.14, 0.88, 0.06, cloth);
    ribbon.position.set(side * 0.28, 0.72, 0.34);
    ribbon.rotation.z = side * 0.12;
    group.add(ribbon);
    ribbons.push(ribbon);
  }

  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.055, 4, 24), energy);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.06;
  aura.visible = false;
  group.add(aura);

  const playerMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.9, 24),
    createEnergyMaterial(remote ? palette.energy : 0xffdf81, remote ? 0.16 : 0.28),
  );
  playerMarker.rotation.x = -Math.PI / 2;
  playerMarker.position.y = 0.025;
  group.add(playerMarker);

  const flightSword = new THREE.Group();
  const flightBlade = box(0.24, 0.06, 2.65, bladeMaterial);
  flightSword.add(flightBlade);
  const flightGuard = box(0.72, 0.1, 0.12, shared.gold);
  flightGuard.position.z = 0.82;
  flightSword.add(flightGuard);
  flightSword.position.y = 0.18;
  flightSword.visible = false;
  group.add(flightSword);

  if (name && remote) group.add(makeNameplate(name, '#bfedff'));

  group.userData = {
    sect,
    palette,
    parts: { robe, torso, head, leftArm, rightArm, swordPivot, backSword, ribbons, aura, flightSword, shadow, playerMarker },
    animationTime: Math.random() * 8,
    attackPulse: 0,
    hurtPulse: 0,
    meditation: false,
    flying: false,
  };
  group.scale.setScalar(remote ? 0.94 : 1);
  return group;
}

export function animateCultivator(group, delta, { speed = 0, attacking = false, meditating = false, flying = false, defeated = false } = {}) {
  if (!group?.userData?.parts) return;
  const data = group.userData;
  const parts = data.parts;
  data.animationTime += delta * (2.2 + speed * 0.65);
  data.attackPulse = attacking ? Math.min(1, data.attackPulse + delta * 10) : Math.max(0, data.attackPulse - delta * 5.5);
  data.meditation = meditating;
  data.flying = flying;

  if (defeated) {
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, Math.PI / 2, 5, delta);
    return;
  }

  group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 7, delta);
  const walk = Math.sin(data.animationTime * 4.2) * Math.min(1, speed / 4.5);
  const idle = Math.sin(data.animationTime * 1.35) * 0.018;
  parts.robe.rotation.z = walk * 0.035;
  parts.robe.scale.y = 1 + Math.abs(walk) * 0.025;
  parts.leftArm.rotation.x = walk * 0.55;
  parts.rightArm.rotation.x = -walk * 0.52 - data.attackPulse * 1.7;
  parts.rightArm.rotation.z = -data.attackPulse * 0.45;
  parts.swordPivot.rotation.x = data.attackPulse * 1.15;
  parts.head.position.y = 2.15 + idle + Math.abs(walk) * 0.025;
  parts.ribbons.forEach((ribbon, index) => {
    const side = index === 0 ? -1 : 1;
    ribbon.rotation.z = side * (0.12 + walk * 0.08) + Math.sin(data.animationTime * 1.8 + index) * 0.035;
  });

  if (meditating) {
    parts.robe.scale.y = THREE.MathUtils.damp(parts.robe.scale.y, 0.58, 8, delta);
    parts.robe.position.y = THREE.MathUtils.damp(parts.robe.position.y, 0.45, 8, delta);
    parts.leftArm.rotation.x = THREE.MathUtils.damp(parts.leftArm.rotation.x, -1.25, 8, delta);
    parts.rightArm.rotation.x = THREE.MathUtils.damp(parts.rightArm.rotation.x, -1.25, 8, delta);
    parts.aura.visible = true;
    parts.aura.rotation.z += delta * 0.8;
    parts.aura.material.opacity = 0.45 + Math.sin(data.animationTime * 2) * 0.22;
  } else {
    parts.robe.position.y = THREE.MathUtils.damp(parts.robe.position.y, 0.78, 8, delta);
    parts.aura.visible = flying || data.auraForced === true;
  }

  parts.flightSword.visible = flying;
  parts.shadow.visible = !flying;
  parts.playerMarker.visible = !flying;
  if (flying) {
    parts.flightSword.position.y = 0.08 + Math.sin(data.animationTime * 3) * 0.06;
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, -walk * 0.06, 6, delta);
  }
}

function healthBar(width = 1.8, y = 2.4) {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x180d0e, transparent: true, opacity: 0.88, depthTest: false }),
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.05, 0.075),
    new THREE.MeshBasicMaterial({ color: 0xe75151, depthTest: false }),
  );
  fill.position.z = 0.006;
  group.add(bg, fill);
  group.position.y = y;
  group.renderOrder = 20;
  group.userData.fill = fill;
  group.userData.width = width - 0.05;
  return group;
}

export function updateHealthBar(group, hp, maxHp, camera) {
  const bar = group?.userData?.healthBar;
  if (!bar) return;
  const ratio = THREE.MathUtils.clamp((Number(hp) || 0) / Math.max(1, Number(maxHp) || 1), 0, 1);
  bar.userData.fill.scale.x = Math.max(0.001, ratio);
  bar.userData.fill.position.x = -(bar.userData.width * (1 - ratio)) / 2;
  bar.visible = ratio > 0 && ratio < 1;
  if (camera) bar.quaternion.copy(camera.quaternion);
}

export function createEnemy({ type = 'spiritWolf', boss = false } = {}) {
  const normalized = String(type).toLowerCase();
  const isBoss = boss || normalized.includes('boss') || normalized.includes('guardian');
  const isCultivator = normalized.includes('cult') || normalized.includes('ranged') || normalized.includes('ma-tu');
  const group = new THREE.Group();
  group.name = `enemy-${type}`;

  if (isBoss) {
    const jade = pixelMaterial({ color: 0x43545b, roughness: 0.42, metalness: 0.55 });
    const ember = pixelMaterial({ color: 0x6b2432, emissive: 0xef3158, emissiveIntensity: 0.72 });
    const body = cylinder(0.66, 0.82, 1.75, jade, 8);
    body.position.y = 1.15;
    group.add(body);
    const head = box(0.82, 0.68, 0.72, ember);
    head.position.y = 2.28;
    group.add(head);
    for (const side of [-1, 1]) {
      const shoulder = sphere(0.38, shared.gold, 8, 6);
      shoulder.position.set(side * 0.83, 1.88, 0);
      group.add(shoulder);
      const arm = box(0.4, 1.45, 0.42, jade);
      arm.position.set(side * 0.84, 1.12, 0);
      group.add(arm);
    }
    const crown = cylinder(0.08, 0.32, 0.54, shared.gold, 6);
    crown.position.y = 2.88;
    group.add(crown);
    const eyeMaterial = createEnergyMaterial(0xff315f, 1);
    for (const x of [-0.2, 0.2]) {
      const eye = sphere(0.06, eyeMaterial, 8, 5);
      eye.position.set(x, 2.34, -0.37);
      group.add(eye);
    }
    const core = box(0.34, 0.46, 0.12, pixelMaterial({
      color: 0xffb25b,
      emissive: 0xff315f,
      emissiveIntensity: 1.35,
    }));
    core.position.set(0, 1.42, -0.72);
    group.add(core);
    for (const side of [-1, 1]) {
      const banner = box(0.22, 1.12, 0.08, ember);
      banner.position.set(side * 0.57, 1.2, 0.48);
      group.add(banner);
    }
    const weapon = box(0.18, 0.18, 3.35, pixelMaterial({ color: 0xf4ead0, emissive: 0xff254d, emissiveIntensity: 0.35, metalness: 0.9 }));
    weapon.position.set(1.05, 1.14, -0.28);
    weapon.rotation.x = 0.16;
    group.add(weapon);
    group.scale.setScalar(1.28);
    group.userData.kind = 'boss';
  } else if (isCultivator) {
    const bodyMat = pixelMaterial({ color: 0x512a5c, roughness: 0.72 });
    const robe = cylinder(0.26, 0.54, 1.25, bodyMat, 7);
    robe.position.y = 0.7;
    group.add(robe);
    const head = sphere(0.24, pixelMaterial({ color: 0xc4a1a1, roughness: 0.9 }));
    head.position.y = 1.62;
    group.add(head);
    const hat = cylinder(0.02, 0.57, 0.38, shared.black, 12);
    hat.position.y = 1.92;
    group.add(hat);
    const orb = sphere(0.16, createEnergyMaterial(0xc557ff), 10, 8);
    orb.position.set(0.52, 1.15, -0.18);
    group.add(orb);
    const talisman = box(0.24, 0.42, 0.04, pixelMaterial({ color: 0xf0c36b, emissive: 0x7b36b8, emissiveIntensity: 0.45 }));
    talisman.position.set(-0.42, 1.18, -0.34);
    talisman.rotation.z = -0.18;
    group.add(talisman);
    group.userData.kind = 'ranged';
  } else {
    const fur = pixelMaterial({ color: 0x29444b, roughness: 0.92 });
    const glow = pixelMaterial({ color: 0xb6f8ff, emissive: 0x28b9dc, emissiveIntensity: 1.25 });
    const body = sphere(0.56, fur, 10, 7);
    body.scale.set(1.5, 0.76, 0.72);
    body.position.y = 0.62;
    group.add(body);
    const head = sphere(0.43, fur, 10, 7);
    head.scale.set(0.88, 0.92, 1);
    head.position.set(0, 0.76, -0.68);
    group.add(head);
    for (const x of [-0.16, 0.16]) {
      const eye = sphere(0.075, glow, 6, 4);
      eye.position.set(x, 0.84, -1.06);
      group.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.48, 5), fur);
      ear.position.set(x * 1.55, 1.17, -0.58);
      ear.rotation.z = x * 0.8;
      group.add(ear);
    }
    for (const x of [-0.35, 0.35]) {
      for (const z of [-0.3, 0.35]) {
        const leg = cylinder(0.08, 0.105, 0.55, fur, 6);
        leg.position.set(x, 0.28, z);
        group.add(leg);
      }
    }
    const tail = cylinder(0.08, 0.18, 1.12, fur, 7);
    tail.position.set(0, 0.88, 0.72);
    tail.rotation.x = 1.08;
    group.add(tail);
    for (const [z, size] of [[-0.35, 0.2], [0.05, 0.24], [0.42, 0.18]]) {
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.8, 4), glow);
      ridge.position.set(0, 1.02, z);
      group.add(ridge);
    }
    group.userData.kind = 'melee';
  }

  const bar = healthBar(isBoss ? 2.6 : 1.55, isBoss ? 3.85 : 2.2);
  group.add(bar);
  group.userData.healthBar = bar;
  group.userData.baseY = 0;
  group.userData.phase = Math.random() * Math.PI * 2;
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

export function animateEnemy(group, delta, elapsed, speed = 0, attacking = false) {
  if (!group) return;
  const phase = group.userData.phase ?? 0;
  const pace = Math.min(1, speed / 3);
  group.position.y = (group.userData.baseY ?? 0) + Math.abs(Math.sin(elapsed * 5 + phase)) * 0.045 * pace;
  if (group.userData.kind === 'melee') {
    group.rotation.z = Math.sin(elapsed * 7 + phase) * 0.025 * pace;
  } else if (group.userData.kind === 'ranged') {
    group.rotation.z = Math.sin(elapsed * 2.2 + phase) * 0.02;
  } else if (group.userData.kind === 'boss') {
    const pulse = 1 + Math.sin(elapsed * 2.4 + phase) * 0.018;
    group.scale.setScalar((attacking ? 1.34 : 1.28) * pulse);
  }
}

function makeTileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#203940';
  ctx.fillRect(0, 0, 64, 64);
  const random = (() => {
    let seed = 4919;
    return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  })();
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const offset = y % 2 ? 3 : 0;
      const shade = 58 + Math.floor(random() * 16);
      ctx.fillStyle = `rgb(${shade}, ${shade + 12}, ${shade + 13})`;
      ctx.fillRect(x * 16 + offset + 1, y * 16 + 1, 14, 14);
      ctx.fillStyle = 'rgba(192, 174, 128, .14)';
      ctx.fillRect(x * 16 + offset + 2, y * 16 + 2, 10, 1);
      if (random() > 0.52) {
        ctx.fillStyle = '#24373d';
        ctx.fillRect(x * 16 + offset + 7, y * 16 + 7, 4, 1);
        ctx.fillRect(x * 16 + offset + 10, y * 16 + 8, 1, 3);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 15);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.anisotropy = 1;
  return texture;
}

function makeWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#6b3526';
  ctx.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 8) {
    ctx.fillStyle = '#3d211c';
    ctx.fillRect(0, y, 32, 1);
    ctx.fillStyle = '#98513a';
    ctx.fillRect(0, y + 1, 32, 1);
    const joint = (y * 3 + 11) % 32;
    ctx.fillStyle = '#46231d';
    ctx.fillRect(joint, y + 1, 1, 7);
  }
  ctx.fillStyle = 'rgba(244, 170, 89, .16)';
  ctx.fillRect(4, 4, 9, 1);
  ctx.fillRect(19, 20, 7, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.anisotropy = 1;
  return texture;
}

function createLantern() {
  const group = new THREE.Group();
  const frame = box(0.46, 0.78, 0.46, shared.wood);
  const glowMat = pixelMaterial({
    color: 0xffd789,
    emissive: 0xff8c24,
    emissiveIntensity: 2.3,
    transparent: true,
    opacity: 0.88,
  });
  const glow = box(0.35, 0.58, 0.35, glowMat);
  group.add(frame, glow);
  const tassel = cylinder(0.025, 0.025, 0.48, shared.gold, 5);
  tassel.position.y = -0.62;
  group.add(tassel);
  const light = new THREE.PointLight(0xff9a3b, 1.08, 8, 2);
  group.add(light);
  group.userData.light = light;
  return group;
}

function createPineTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = cylinder(0.16, 0.25, 3.2, shared.wood, 7);
  trunk.position.y = 1.6;
  group.add(trunk);
  const needles = pixelMaterial({ color: 0x176055, roughness: 0.88 });
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.45 - i * 0.22, 2.25, 8), needles);
    crown.position.y = 2.7 + i * 0.78;
    crown.castShadow = true;
    group.add(crown);
  }
  group.scale.setScalar(scale);
  return group;
}

function createCherryTree(scale = 1) {
  const group = new THREE.Group();
  const trunkMaterial = pixelMaterial({ color: 0x4c2928 });
  const trunk = cylinder(0.18, 0.28, 3.7, trunkMaterial, 6);
  trunk.position.y = 1.85;
  group.add(trunk);

  for (const [side, y, tilt] of [[-1, 2.6, -0.82], [1, 3.05, 0.78], [-1, 3.5, -0.58]]) {
    const branch = box(0.16, 1.9, 0.18, trunkMaterial);
    branch.position.set(side * 0.55, y, 0);
    branch.rotation.z = tilt;
    group.add(branch);
  }

  const blossomMaterials = [
    pixelMaterial({ color: 0xb74772, emissive: 0x5f1735, emissiveIntensity: 0.16 }),
    pixelMaterial({ color: 0xe46f9b, emissive: 0x6b1d3d, emissiveIntensity: 0.2 }),
    pixelMaterial({ color: 0xf5a3bd, emissive: 0x6b1d3d, emissiveIntensity: 0.2 }),
  ];
  const clusters = [
    [-1.15, 3.45, 0.1, 0], [-0.52, 4.05, -0.12, 1], [0.12, 4.38, 0.06, 2],
    [0.78, 3.72, 0.16, 1], [1.35, 3.4, -0.08, 0], [0.62, 4.35, -0.1, 2],
    [-1.42, 3.02, -0.15, 1], [-0.18, 3.36, 0.28, 2],
  ];
  clusters.forEach(([x, y, z, materialIndex], index) => {
    const blossom = box(0.78 + (index % 3) * 0.16, 0.55 + (index % 2) * 0.12, 0.7, blossomMaterials[materialIndex]);
    blossom.position.set(x, y, z);
    blossom.rotation.y = (index % 4) * 0.42;
    group.add(blossom);
  });
  group.scale.setScalar(scale);
  return group;
}

function createPixelCloud(scale = 1) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0x6c94a4,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    fog: false,
  });
  for (const [x, y, w, h] of [[-2.8, 0, 4, 0.6], [0, 0.35, 5.4, 0.9], [3.1, 0, 3.2, 0.55], [0.7, -0.35, 6.2, 0.45]]) {
    const puff = box(w, h, 0.18, material);
    puff.position.set(x, y, 0);
    puff.castShadow = false;
    puff.receiveShadow = false;
    group.add(puff);
  }
  group.scale.setScalar(scale);
  return group;
}

function createTemple() {
  const group = new THREE.Group();
  const base = box(24, 1.1, 12, pixelMaterial({ color: 0x3f332a, roughness: 0.9 }));
  base.position.y = 0.55;
  group.add(base);
  const floor = box(22.8, 0.24, 10.8, pixelMaterial({ map: makeWoodTexture(), color: 0xc07c63, roughness: 0.66 }));
  floor.position.y = 1.16;
  group.add(floor);
  for (const x of [-10, -6, -2, 2, 6, 10]) {
    for (const z of [-4.6, 4.6]) {
      const column = cylinder(0.34, 0.44, 5.5, shared.redWood, 12);
      column.position.set(x, 3.8, z);
      group.add(column);
      const cap = cylinder(0.5, 0.5, 0.18, shared.gold, 12);
      cap.position.set(x, 6.5, z);
      group.add(cap);
    }
  }
  const roofMat = pixelMaterial({ color: 0x162d35, roughness: 0.5, metalness: 0.18 });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 9.2, 4.2, 4), roofMat);
  roof.scale.set(1.55, 0.35, 0.82);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 7.08;
  roof.castShadow = true;
  group.add(roof);
  const roofTrim = box(27, 0.18, 0.22, shared.gold);
  roofTrim.position.set(0, 6.48, 5.8);
  group.add(roofTrim);
  const plaque = box(5.4, 1.12, 0.24, shared.wood);
  plaque.position.set(0, 5.65, 5.48);
  group.add(plaque);
  const facade = box(18.2, 4.3, 0.28, pixelMaterial({ color: 0x4d2426 }));
  facade.position.set(0, 3.25, 4.92);
  group.add(facade);
  const doorway = box(4.2, 3.8, 0.18, pixelMaterial({
    color: 0xc58445,
    emissive: 0xf29b45,
    emissiveIntensity: 0.54,
  }));
  doorway.position.set(0, 3.05, 5.12);
  group.add(doorway);
  const doorShadow = box(3.25, 3.25, 0.12, pixelMaterial({ color: 0x24151a }));
  doorShadow.position.set(0, 2.78, 5.24);
  group.add(doorShadow);
  for (const x of [-7.2, -5.8, -4.4, 4.4, 5.8, 7.2]) {
    const lattice = box(0.2, 3.2, 0.12, shared.gold);
    lattice.position.set(x, 3.18, 5.14);
    group.add(lattice);
  }
  for (const y of [2.2, 3.2, 4.2]) {
    const beam = box(17.4, 0.13, 0.12, shared.gold);
    beam.position.set(0, y, 5.15);
    group.add(beam);
  }
  const throne = box(3.4, 2.6, 1.1, shared.redWood);
  throne.position.set(0, 2.25, 3.15);
  group.add(throne);
  return group;
}

function createAltar() {
  const group = new THREE.Group();
  const baseMat = pixelMaterial({ color: 0x30444b, roughness: 0.7, metalness: 0.15 });
  for (let i = 0; i < 3; i += 1) {
    const disc = cylinder(3.5 - i * 0.42, 3.72 - i * 0.42, 0.24, baseMat, 48);
    disc.position.y = i * 0.18 + 0.1;
    group.add(disc);
  }
  const energy = createEnergyMaterial(0x5edfff, 0.45);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.075, 8, 72), energy);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.62;
  group.add(outer);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.055, 8, 64), energy.clone());
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.63;
  group.add(inner);
  const runes = [];
  for (let i = 0; i < 12; i += 1) {
    const rune = box(0.22, 0.035, 0.74, energy.clone());
    const angle = (i / 12) * Math.PI * 2;
    rune.position.set(Math.sin(angle) * 2.1, 0.65, Math.cos(angle) * 2.1);
    rune.rotation.y = angle;
    group.add(rune);
    runes.push(rune);
  }
  group.userData = { outer, inner, runes, active: false };
  const altarLight = new THREE.PointLight(0x5edfff, 5.2, 18, 1.7);
  altarLight.position.y = 2.6;
  group.add(altarLight);
  return group;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x102b3e);
  scene.fog = new THREE.FogExp2(0x173b46, 0.0115);

  const hemi = new THREE.HemisphereLight(0xc7edf0, 0x56303b, 2.05);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x86aeb2, 0.58));
  const moonLight = new THREE.DirectionalLight(0xe0fbf3, 3.15);
  moonLight.position.set(-18, 30, 20);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -45;
  moonLight.shadow.camera.right = 45;
  moonLight.shadow.camera.top = 45;
  moonLight.shadow.camera.bottom = -45;
  scene.add(moonLight);

  const floorMaterial = pixelMaterial({ map: makeTileTexture(), color: 0xa5b2a8, roughness: 0.88 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(78, 82), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.z = -5;
  scene.add(floor);

  const edgeMat = pixelMaterial({ color: 0x17282e, roughness: 0.9 });
  for (const [x, z, w, d] of [
    [-40, -5, 3, 84], [40, -5, 3, 84], [0, 36, 82, 3], [0, -46, 82, 3],
  ]) {
    const edge = box(w, 2.4, d, edgeMat);
    edge.position.set(x, 1.1, z);
    scene.add(edge);
  }

  const temple = createTemple();
  temple.position.set(0, 0, -32);
  scene.add(temple);

  const altar = createAltar();
  altar.position.set(0, 0, 23);
  scene.add(altar);

  const bridgeMat = pixelMaterial({ color: 0x5d3222, roughness: 0.72 });
  const carpetMat = pixelMaterial({ color: 0xa83c48, roughness: 0.66 });
  const path = box(7.6, 0.09, 48, carpetMat);
  path.position.set(0, 0.07, -8);
  scene.add(path);
  for (let z = -26; z <= 24; z += 5) {
    const rail = box(9.2, 0.12, 0.22, bridgeMat);
    rail.position.set(0, 0.16, z);
    scene.add(rail);
  }

  const lanterns = [];
  for (const z of [-24, -14, -4, 6, 16, 26]) {
    for (const x of [-8, 8]) {
      const post = cylinder(0.11, 0.16, 3.4, shared.redWood, 8);
      post.position.set(x, 1.7, z);
      scene.add(post);
      const lantern = createLantern();
      lantern.position.set(x, 3.15, z);
      scene.add(lantern);
      lanterns.push(lantern);
    }
  }

  const trees = [];
  for (const [x, z, scale, rotation] of [
    [-16, 23, 1.2, 0.2], [17, 21, 1.4, -0.5], [-21, 8, 1.05, 0.6], [23, 5, 1.22, 0.1],
    [-22, -18, 1.35, 0.4], [23, -21, 1.1, -0.2], [-31, 25, 1.7, 0], [31, 25, 1.6, 0],
  ]) {
    const tree = createPineTree(scale);
    tree.position.set(x, 0, z);
    tree.rotation.y = rotation;
    scene.add(tree);
    trees.push(tree);
  }

  for (const [x, z, scale, rotation] of [
    [-13, 28, 1.12, 0.15], [14, 27, 1.04, -0.28], [-27, -5, 1.28, 0.46],
    [28, -8, 1.22, -0.32], [-29, 18, 0.94, 0.18], [29, 16, 1.05, -0.2],
  ]) {
    const tree = createCherryTree(scale);
    tree.position.set(x, 0, z);
    tree.rotation.y = rotation;
    scene.add(tree);
    trees.push(tree);
  }

  const mountainMaterials = [
    pixelMaterial({ color: 0x173b4a }),
    pixelMaterial({ color: 0x1d4852 }),
    pixelMaterial({ color: 0x24555a }),
  ];
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = 64 + (i % 3) * 8;
    const height = 18 + (i % 5) * 3.4;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(8 + (i % 4) * 2.2, height, 5), mountainMaterials[i % mountainMaterials.length]);
    mountain.position.set(Math.sin(angle) * radius, 6, Math.cos(angle) * radius - 5);
    mountain.rotation.y = angle * 0.7;
    scene.add(mountain);
    if (i % 2 === 0) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6 + (i % 3), height * 0.22, 5), pixelMaterial({ color: 0x78999b }));
      cap.position.copy(mountain.position);
      cap.position.y += height * 0.42;
      cap.rotation.y = mountain.rotation.y;
      scene.add(cap);
    }
  }

  const clouds = [];
  for (const [x, y, z, scale] of [
    [-28, 15, -48, 1.5], [18, 19, -55, 1.1], [38, 12, -37, 1.4],
    [-42, 24, -64, 1.2], [2, 27, -72, 1.65],
  ]) {
    const cloud = createPixelCloud(scale);
    cloud.position.set(x, y, z);
    scene.add(cloud);
    clouds.push(cloud);
  }

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xdff3ef, transparent: true, opacity: 0.82, fog: false }),
  );
  moon.position.set(-30, 28, -62);
  moon.lookAt(0, 5, 0);
  scene.add(moon);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 420; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 45 + Math.random() * 55;
    starPositions.push(Math.cos(angle) * radius, 14 + Math.random() * 44, Math.sin(angle) * radius - 8);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0xd5f7ff,
    size: 0.24,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
  }));
  scene.add(stars);

  const flightRings = [];
  const ringMaterial = createEnergyMaterial(0xffd873, 0.92);
  for (const [x, y, z, tilt] of [[0, 4.2, 4, 0], [8, 6.2, -7, -0.22], [0, 8.4, -20, 0.18]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 4, 24), ringMaterial.clone());
    ring.position.set(x, y, z);
    ring.rotation.y = tilt;
    ring.visible = false;
    ring.userData.passed = false;
    scene.add(ring);
    flightRings.push(ring);
  }

  return {
    floor,
    temple,
    altar,
    lanterns,
    trees,
    clouds,
    stars,
    flightRings,
    bounds: { minX: -37, maxX: 37, minZ: -42, maxZ: 33 },
    update(delta, elapsed, state = {}) {
      stars.rotation.y += delta * 0.002;
      clouds.forEach((cloud, i) => {
        cloud.position.x += delta * (0.16 + i * 0.015);
        if (cloud.position.x > 55) cloud.position.x = -55;
      });
      for (let i = 0; i < lanterns.length; i += 1) {
        const light = lanterns[i].userData.light;
        light.intensity = 1.05 + Math.sin(elapsed * 4.4 + i) * 0.18;
      }
      altar.userData.outer.rotation.z += delta * (state.tribulation ? 1.4 : 0.22);
      altar.userData.inner.rotation.z -= delta * (state.tribulation ? 2.2 : 0.34);
      altar.userData.runes.forEach((rune, i) => {
        rune.material.opacity = 0.28 + Math.sin(elapsed * 2.5 + i * 0.42) * 0.13 + (state.tribulation ? 0.38 : 0);
      });
      flightRings.forEach((ring, i) => {
        if (!ring.visible) return;
        ring.rotation.z += delta * (0.5 + i * 0.12);
        ring.material.opacity = 0.65 + Math.sin(elapsed * 3 + i) * 0.22;
      });
    },
  };
}

export function createSlashArc(color = 0x5edfff, scale = 1) {
  const material = createEnergyMaterial(color, 0.95);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.6 * scale, 0.12 * scale, 4, 18, Math.PI * 1.25), material);
  arc.rotation.set(Math.PI / 2, 0, -Math.PI * 0.62);
  arc.userData.effect = { life: 0.34, maxLife: 0.34, kind: 'slash' };
  return arc;
}

export function createAreaRing(color = 0x5edfff, radius = 3) {
  const material = createEnergyMaterial(color, 0.82);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.76, radius, 32), material);
  ring.rotation.x = -Math.PI / 2;
  ring.userData.effect = { life: 0.72, maxLife: 0.72, kind: 'ring' };
  return ring;
}

export function createProjectile(color = 0x5edfff) {
  const material = createEnergyMaterial(color, 1);
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), material);
  core.scale.z = 3.4;
  group.add(core);
  const glow = new THREE.PointLight(color, 2.5, 5, 2);
  group.add(glow);
  group.userData.effect = { life: 0.5, maxLife: 0.5, kind: 'projectile' };
  return group;
}

export function createLightningStrike(position, color = 0x9fe9ff) {
  const group = new THREE.Group();
  group.position.copy(position);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
  for (let branch = 0; branch < 4; branch += 1) {
    const points = [];
    let x = (Math.random() - 0.5) * 0.25;
    let z = (Math.random() - 0.5) * 0.25;
    for (let i = 0; i < 13; i += 1) {
      x += (Math.random() - 0.5) * (branch ? 0.32 : 0.58);
      z += (Math.random() - 0.5) * (branch ? 0.32 : 0.58);
      points.push(new THREE.Vector3(x, 18 - i * 1.5, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, material.clone()));
  }
  const light = new THREE.PointLight(color, 18, 16, 2);
  light.position.y = 3;
  group.add(light);
  const ground = createAreaRing(color, 2.1);
  ground.position.y = 0.05;
  group.add(ground);
  group.userData.effect = { life: 0.38, maxLife: 0.38, kind: 'lightning' };
  return group;
}
