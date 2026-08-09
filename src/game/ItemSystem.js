const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class ItemSystem {
  constructor({ player, shopSystem, itemLookup, onChange = () => {}, onHealthChange = () => {} } = {}) {
    this.player = player;
    this.shopSystem = shopSystem;
    this.itemLookup = itemLookup ?? (() => null);
    this.onChange = onChange;
    this.onHealthChange = onHealthChange;
  }

  usePill(pillOrId) {
    const pill = typeof pillOrId === 'string' ? this.itemLookup(pillOrId) : pillOrId;
    const id = typeof pillOrId === 'string' ? pillOrId : pill?.id;
    const index = this.shopSystem?.inventory?.indexOf(id) ?? -1;
    const healAmount = Math.max(0, finite(pill?.healAmount ?? pill?.heal));
    if (!pill || index < 0 || pill.category !== 'consumables' || pill.accessory || healAmount <= 0) return false;

    // Update the model synchronously so Chrome paints the new HUD value on this frame.
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
    this.shopSystem.inventory.splice(index, 1);
    this.onHealthChange(this.player.hp, this.player.maxHp);
    this.onChange();
    return true;
  }

  useItem(id) {
    const item = this.itemLookup(id);
    if (item?.healAmount || item?.heal) return this.usePill(item);
    const used = this.shopSystem?.use?.(id, this.player.profile ?? this.player) ?? false;
    if (used) this.onChange();
    return used;
  }

  equipWeapon(weaponOrId) {
    const weapon = typeof weaponOrId === 'string' ? this.itemLookup(weaponOrId) : weaponOrId;
    if (!weapon || weapon.category !== 'weapons') return false;
    if (!this.shopSystem?.equip?.(weapon.id)) return false;
    this.player.equipWeapon(weapon);
    this.onChange();
    return true;
  }

  syncEquipment() {
    const weapon = this.itemLookup(this.shopSystem?.equipment?.weapon);
    this.player.equipWeapon(weapon);
    return this.player.totalAtk;
  }
}

export function usePill(player, pill) {
  const healAmount = Math.max(0, finite(pill?.healAmount ?? pill?.heal));
  player.hp = Math.min(player.maxHp, player.hp + healAmount);
  return player.hp;
}

export function equipWeapon(player, weapon) {
  player.totalAtk = Math.max(0, finite(player.baseAtk)) + Math.max(0, finite(weapon?.atkBonus ?? weapon?.damage));
  return player.totalAtk;
}
