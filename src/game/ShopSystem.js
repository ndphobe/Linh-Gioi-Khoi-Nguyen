const item = (id, name, category, icon, tier, price, requiredOrder, requiredRealm, stats, description) => Object.freeze({ id, name, category, icon, tier, price, requiredOrder, requiredRealm, ...stats, description });

export const WEAPONS = Object.freeze([
  item('iron_sword','Thanh Phong Thiết Kiếm','weapons','⚔',1,80,0,'Luyện Khí',{ damage:8,attackSpeed:.03,critRate:0,lifeSteal:0 },'Kiếm nhập môn cân bằng.'),
  item('jade_sword','Bích Ngọc Linh Kiếm','weapons','🗡',2,260,1,'Trúc Cơ',{ damage:22,attackSpeed:.08,critRate:.05,lifeSteal:0 },'Linh kiếm tăng tốc độ xuất chiêu.'),
  item('blood_sabre','Huyết Sát Ma Đao','weapons','🔪',3,620,2,'Kim Đan',{ damage:48,attackSpeed:.12,critRate:.10,lifeSteal:.06 },'Ma đao hút sinh lực mục tiêu.'),
  item('heaven_blade','Cửu Thiên Thần Kiếm','weapons','✨',4,1500,3,'Nguyên Anh',{ damage:95,attackSpeed:.20,critRate:.18,lifeSteal:.10 },'Thần binh mang kiếm ý Cửu Thiên.'),
]);
export const ARMOR = Object.freeze([
  item('spirit_robe','Tụ Linh Pháp Bào','armor','🥋',1,110,0,'Luyện Khí',{ defense:7,maxMana:12 },'Pháp bào tụ linh cơ bản.'),
  item('jade_armor','Bích Ngọc Hộ Giáp','armor','🛡',2,380,1,'Trúc Cơ',{ defense:20,maxMana:28 },'Hộ giáp kết tinh từ linh ngọc.'),
  item('dragon_armor','Long Lân Chiến Giáp','armor','🐉',3,900,2,'Kim Đan',{ defense:45,maxMana:50 },'Long lân chống lại thuật pháp.'),
]);
export const CONSUMABLES = Object.freeze([
  item('healing_pill','Hồi Xuân Đan','consumables','🔴',1,35,0,'Luyện Khí',{ heal:45 },'Hồi phục 45 Khí Huyết.'),
  item('mana_pill','Tụ Linh Đan','consumables','🔵',1,40,0,'Luyện Khí',{ mana:40 },'Hồi phục 40 Linh Lực.'),
  item('spirit_charm','Hộ Thân Phù','consumables','📜',2,120,1,'Trúc Cơ',{ accessory:true,defense:5 },'Có thể trang bị vào ô Phụ Kiện.'),
  item('thunder_guard_talisman','Lôi Linh Hộ Tâm Kính','boss','⚡',3,780,1,'Trúc Cơ',{ accessory:true,defense:18,critRate:.08,bossDrop:true },'Trang bị Sử Thi chỉ rơi từ Lôi Linh Hộ Pháp.'),
]);
export const SHOP_ITEMS = Object.freeze([...WEAPONS,...ARMOR,...CONSUMABLES]);
export const itemById = id => SHOP_ITEMS.find(entry=>entry.id===id);

export class ShopSystem {
  constructor(state={}){this.gold=Math.max(0,Number(state.gold)||0);this.inventory=[...(state.inventory??[])].filter(id=>itemById(id));const legacy=state.equipped;this.equipment={weapon:null,armor:null,accessory:null,...state.equipment};if(legacy&&!this.equipment.weapon)this.equipment.weapon=legacy;for(const key of Object.keys(this.equipment))if(!this.inventory.includes(this.equipment[key]))this.equipment[key]=null;this.equipped=this.equipment.weapon;}
  buy(id,realmOrder){const entry=itemById(id);if(!entry||realmOrder<entry.requiredOrder||this.gold<entry.price)return false;if(entry.category!=='consumables'&&this.inventory.includes(id))return false;this.gold-=entry.price;this.inventory.push(id);if(entry.category==='weapons'&&!this.equipment.weapon)this.equip(id);return true;}
  sell(id){const entry=itemById(id),index=this.inventory.indexOf(id);if(!entry||index<0)return false;this.inventory.splice(index,1);this.gold+=Math.floor(entry.price*.55);for(const slot of Object.keys(this.equipment))if(this.equipment[slot]===id)this.equipment[slot]=null;this.equipped=this.equipment.weapon;return true;}
  equip(id){const entry=itemById(id);if(!entry||!this.inventory.includes(id))return false;const slot=entry.category==='weapons'?'weapon':entry.category==='armor'?'armor':entry.accessory?'accessory':null;if(!slot)return false;this.equipment[slot]=id;this.equipped=this.equipment.weapon;return true;}
  use(id,player){const entry=itemById(id),index=this.inventory.indexOf(id);if(!entry||entry.category!=='consumables'||entry.accessory||index<0)return false;if(entry.heal)player.hp=Math.min(player.maxHp,player.hp+entry.heal);if(entry.mana)player.mp=Math.min(player.maxMp,player.mp+entry.mana);this.inventory.splice(index,1);return true;}
  addGold(amount){this.gold=Math.max(0,this.gold+(Number(amount)||0));}
  serialize(){return {gold:this.gold,inventory:[...this.inventory],equipment:{...this.equipment},equipped:this.equipment.weapon};}
}
