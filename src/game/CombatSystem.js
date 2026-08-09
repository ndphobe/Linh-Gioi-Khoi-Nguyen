export const ATTACK_SPECS = Object.freeze({
  basic: Object.freeze({ range: 4.8, hitboxWidth: 1.15 }),
  q: Object.freeze({ range: 14, hitboxWidth: 1.1 }),
  e: Object.freeze({ range: 9, hitboxWidth: 4.3 }),
  r: Object.freeze({ range: 11, hitboxWidth: 1.35 }),
  f: Object.freeze({ range: 0, hitboxWidth: 3 }),
  g: Object.freeze({ range: 13, hitboxWidth: 13 }),
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class CombatSystem {
  constructor({ enemies = () => [] } = {}) { this.enemies = enemies; }

  specFor(slot, skill = {}) {
    const fallback = ATTACK_SPECS[slot] ?? ATTACK_SPECS.basic;
    const range = Math.max(0, finite(skill.range ?? skill.hitbox?.range, fallback.range));
    const hitboxWidth = Math.max(0.1, finite(skill.hitbox?.width ?? skill.radius, fallback.hitboxWidth));
    return { range, hitboxWidth };
  }

  createAttack({ slot, skill, origin, direction }) {
    const spec = this.specFor(slot, skill);
    return {
      ...spec,
      origin: { x: origin.x, z: origin.z },
      direction,
      target: { x: origin.x + direction.x * spec.range, z: origin.z + direction.z * spec.range },
    };
  }

  collisionAt(position, radius, ignoredIds = new Set()) {
    let closest = null;
    let closestDistance = Infinity;
    for (const enemy of this.enemies()) {
      if (enemy.alive === false || enemy.hp <= 0 || ignoredIds.has(enemy.id)) continue;
      const distance = Math.hypot(enemy.position.x - position.x, enemy.position.z - position.z);
      if (distance <= radius && distance < closestDistance) { closest = enemy; closestDistance = distance; }
    }
    return closest;
  }
}
