import { itemById } from './ShopSystem.js';

export class InventorySystem {
  constructor(shopSystem, player){this.shopSystem=shopSystem;this.player=player;}
  addItem(itemOrId){const id=typeof itemOrId==='string'?itemOrId:itemOrId?.id;if(!itemById(id))return false;this.shopSystem.inventory.push(id);return true;}
  equipItem(id){return this.shopSystem.equip(id);}
  useItem(id){return this.shopSystem.use(id,this.player);}
  hasItem(id){return this.shopSystem.inventory.includes(id);}
}
