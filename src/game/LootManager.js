export class LootManager {
  constructor({inventory,onGold,onBossReward,onChange,audio}){this.inventory=inventory;this.onGold=onGold;this.onBossReward=onBossReward;this.onChange=onChange;this.audio=audio;}
  handle(event){if(event?.type!=='loot:granted')return false;const loot=event.loot??{};if(loot.gold>0)this.onGold?.(loot.gold,event);if(loot.bossEquipment&&this.inventory.addItem(loot.bossEquipment)){this.onBossReward?.(loot.bossEquipment);this.audio?.play('success');}this.onChange?.();return true;}
}
