const item = (id, name, category, icon, tier, price, requiredOrder, requiredRealm, stats, description) => Object.freeze({ id, name, category, icon, tier, price, requiredOrder, requiredRealm, ...stats, description });

export const EQUIPMENT_VARIANTS = Object.freeze({
  iron_sword:Object.freeze({
    orthodox:Object.freeze({name:'Thanh Phong Nhập Môn Kiếm',asset:'/assets/equipment/orthodox-iron-sword.png',damage:8,atkBonus:8,attackSpeed:.03,critRate:0,lifeSteal:0,description:'Kiếm nhập môn thanh chính, vận Thanh Phong kiếm khí.'}),
    demonic:Object.freeze({name:'Hắc Thiết Huyết Kiếm',asset:'/assets/equipment/demonic-iron-sword.png',damage:10,atkBonus:10,attackSpeed:.01,critRate:0,lifeSteal:.01,description:'Hắc thiết tôi huyết dành cho đệ tử Ma Đạo.'}),
    heretic:Object.freeze({name:'Thanh Xà Đoản Kiếm',asset:'/assets/equipment/heretic-iron-sword.png',damage:7,atkBonus:7,attackSpeed:.05,critRate:.02,lifeSteal:0,description:'Đoản kiếm linh hoạt khắc xà văn U Minh.'}),
  }),
  jade_sword:Object.freeze({
    orthodox:Object.freeze({name:'Bích Ngọc Lưu Quang Kiếm',asset:'/assets/equipment/orthodox-jade-sword.png',damage:22,atkBonus:22,attackSpeed:.08,critRate:.05,lifeSteal:0,description:'Linh kiếm chính khí kết từ bích ngọc.'}),
    demonic:Object.freeze({name:'Huyết Ngọc Ma Kiếm',asset:'/assets/equipment/demonic-jade-sword.png',damage:25,atkBonus:25,attackSpeed:.05,critRate:.03,lifeSteal:.03,description:'Huyết ngọc nuôi ma khí và hút sinh cơ.'}),
    heretic:Object.freeze({name:'U Lân Độc Kiếm',asset:'/assets/equipment/heretic-jade-sword.png',damage:20,atkBonus:20,attackSpeed:.10,critRate:.08,lifeSteal:0,description:'Ngọc kiếm phủ độc, nhanh và hiểm.'}),
  }),
  blood_sabre:Object.freeze({
    orthodox:Object.freeze({name:'Trấn Ma Xích Dương Kiếm',asset:'/assets/equipment/orthodox-blood-saber.png',damage:45,atkBonus:45,attackSpeed:.14,critRate:.12,lifeSteal:0,description:'Xích Dương kiếm chuyên trấn áp ma khí.'}),
    demonic:Object.freeze({name:'Huyết Sát Ma Đao',asset:'/assets/equipment/demonic-blood-saber.png',damage:52,atkBonus:52,attackSpeed:.10,critRate:.09,lifeSteal:.08,description:'Ma đao lấy sát khí và máu làm sức mạnh.'}),
    heretic:Object.freeze({name:'Huyết Cổ Độc Nhận',asset:'/assets/equipment/heretic-blood-saber.png',damage:41,atkBonus:41,attackSpeed:.16,critRate:.15,lifeSteal:.03,description:'Độc nhận nuôi huyết cổ trong lưỡi đao.'}),
  }),
  spirit_robe:Object.freeze({
    orthodox:Object.freeze({name:'Tụ Linh Thanh Vân Bào',asset:'/assets/equipment/orthodox-spirit-robe.png',defense:7,maxMana:14,description:'Thanh Vân bào dẫn linh khí thuần chính.'}),
    demonic:Object.freeze({name:'Huyết Khí Sơ Ma Y',asset:'/assets/equipment/demonic-spirit-robe.png',attack:2,atkBonus:2,defense:8,lifeSteal:.01,description:'Sơ ma y dẫn huyết khí bảo hộ thân thể.'}),
    heretic:Object.freeze({name:'U Hành Tàng Độc Bào',asset:'/assets/equipment/heretic-spirit-robe.png',defense:6,maxMana:10,critRate:.02,description:'Độc bào nhẹ giúp ẩn khí và hành động mau lẹ.'}),
  }),
  jade_armor:Object.freeze({
    orthodox:Object.freeze({name:'Bích Ngọc Hộ Tâm Giáp',asset:'/assets/equipment/orthodox-jade-armor.png',defense:22,maxMana:30,description:'Ngọc giáp thanh chính bảo hộ tâm mạch.'}),
    demonic:Object.freeze({name:'Huyết Ngọc Ma Lân Giáp',asset:'/assets/equipment/demonic-jade-armor.png',attack:5,atkBonus:5,defense:24,lifeSteal:.02,description:'Ma lân huyết ngọc phản dưỡng sát lực.'}),
    heretic:Object.freeze({name:'Bích Lân Tị Độc Giáp',asset:'/assets/equipment/heretic-jade-armor.png',defense:18,maxMana:24,critRate:.05,description:'Bích lân kháng độc và tăng độ hiểm của đòn đánh.'}),
  }),
  dragon_armor:Object.freeze({
    orthodox:Object.freeze({name:'Thương Long Thiên Kiếm Khải',asset:'/assets/equipment/orthodox-dragon-armor.png',attack:10,atkBonus:10,defense:48,maxMana:55,description:'Thiên khải Thương Long hội tụ kiếm ý.'}),
    demonic:Object.freeze({name:'Huyết Long Nghịch Lân Giáp',asset:'/assets/equipment/demonic-dragon-armor.png',attack:16,atkBonus:16,defense:52,lifeSteal:.06,description:'Nghịch lân Huyết Long càng chiến càng hung.'}),
    heretic:Object.freeze({name:'U Minh Độc Long Khải',asset:'/assets/equipment/heretic-dragon-armor.png',attack:9,atkBonus:9,defense:42,maxMana:40,critRate:.10,description:'Độc Long khải dung hợp u khí và kịch độc.'}),
  }),
});

export const itemForFaction = (itemOrId,faction) => {
  const entry=typeof itemOrId==='string'?itemById(itemOrId):itemOrId,variant=entry&&EQUIPMENT_VARIANTS[entry.id]?.[faction];
  return variant?Object.freeze({...entry,...variant}):entry;
};

export const WEAPONS = Object.freeze([
  item('iron_sword','Thanh Phong Thiết Kiếm','weapons','⚔',1,80,0,'Luyện Khí',{ damage:8,atkBonus:8,attackSpeed:.03,critRate:0,lifeSteal:0 },'Kiếm nhập môn cân bằng.'),
  item('jade_sword','Bích Ngọc Linh Kiếm','weapons','🗡',2,260,1,'Trúc Cơ',{ damage:22,atkBonus:22,attackSpeed:.08,critRate:.05,lifeSteal:0 },'Linh kiếm tăng tốc độ xuất chiêu.'),
  item('blood_sabre','Huyết Sát Ma Đao','weapons','🔪',3,620,2,'Kim Đan',{ damage:48,atkBonus:48,attackSpeed:.12,critRate:.10,lifeSteal:.06 },'Vũ khí Kim Đan biến đổi theo con đường tu hành.'),
  item('nether_path_twinblades','U Minh Song Độc Nhận','weapons','Độc',3,920,2,'Kim Đan',{ faction:'heretic',asset:'/assets/weapons/heretic-venom-twinblades.png',damage:52,atkBonus:52,attackSpeed:.22,critRate:.17,lifeSteal:.03 },'Song nhận kịch độc, chỉ hiện với U Minh Cốc.'),
  item('celestial_path_sword','Thái Hư Tinh Kiếm','weapons','Tinh',3,980,2,'Kim Đan',{ faction:'orthodox',asset:'/assets/weapons/orthodox-celestial-sword.png',damage:58,atkBonus:58,attackSpeed:.16,critRate:.12,lifeSteal:0 },'Tinh kiếm Chính Đạo, chỉ hiện với Thiên Kiếm Môn.'),
  item('blood_path_saber','Huyết Nguyệt Ma Nhận','weapons','Huyết',3,1040,2,'Kim Đan',{ faction:'demonic',asset:'/assets/weapons/demonic-blood-saber.png',damage:64,atkBonus:64,attackSpeed:.11,critRate:.09,lifeSteal:.10 },'Ma nhận uống máu, chỉ hiện với Vạn Ma Điện.'),
  item('heaven_blade','Cửu Thiên Thần Kiếm','weapons','✨',4,1500,3,'Nguyên Anh',{ faction:'orthodox',damage:95,atkBonus:95,attackSpeed:.20,critRate:.18,lifeSteal:.10 },'Thần binh mang kiếm ý Cửu Thiên.'),
  item('orthodox_stream_sword','Lưu Quang Kiếm','weapons','Quang',2,420,1,'Trúc Cơ',{ faction:'orthodox',asset:'/assets/equipment/orthodox-stream-sword.png',damage:32,atkBonus:32,attackSpeed:.12,critRate:.07,lifeSteal:0 },'Linh kiếm ánh bạc dành cho Chính Đạo.'),
  item('orthodox_dipper_sword','Bắc Đẩu Thất Tinh Kiếm','weapons','Tinh',4,1850,3,'Nguyên Anh',{ faction:'orthodox',asset:'/assets/equipment/orthodox-dipper-sword.png',damage:108,atkBonus:108,attackSpeed:.22,critRate:.18,lifeSteal:0 },'Thất tinh hội tụ trên lưỡi kiếm.'),
  item('orthodox_supreme_sword','Thái Thượng Đạo Kiếm','weapons','Đạo',5,5200,4,'Hóa Thần',{ faction:'orthodox',asset:'/assets/equipment/orthodox-supreme-sword.png',damage:190,atkBonus:190,attackSpeed:.28,critRate:.25,lifeSteal:.04 },'Đạo kiếm tối thượng của kiếm tiên.'),
  item('demonic_soul_saber','Xích Hồn Đao','weapons','Hồn',2,450,1,'Trúc Cơ',{ faction:'demonic',asset:'/assets/equipment/demonic-soul-saber.png',damage:36,atkBonus:36,attackSpeed:.09,critRate:.05,lifeSteal:.06 },'Ma đao hút lấy tàn hồn.'),
  item('demonic_inferno_scythe','Luyện Ngục Ma Liêm','weapons','Liêm',4,1950,3,'Nguyên Anh',{ faction:'demonic',asset:'/assets/equipment/demonic-inferno-scythe.png',damage:116,atkBonus:116,attackSpeed:.16,critRate:.15,lifeSteal:.12 },'Ma liêm rực nghiệp hỏa luyện ngục.'),
  item('demonic_blood_emperor','Huyết Hải Đế Nhận','weapons','Đế',5,5500,4,'Hóa Thần',{ faction:'demonic',asset:'/assets/equipment/demonic-blood-emperor.png',damage:205,atkBonus:205,attackSpeed:.20,critRate:.20,lifeSteal:.18 },'Đế nhận sinh ra từ biển máu.'),
  item('heretic_scale_sword','Bích Lân Độc Kiếm','weapons','Lân',2,400,1,'Trúc Cơ',{ faction:'heretic',asset:'/assets/equipment/heretic-scale-sword.png',damage:29,atkBonus:29,attackSpeed:.15,critRate:.10,lifeSteal:.02 },'Độc kiếm bọc vảy bích xà.'),
  item('heretic_spider_blades','Thiên Chu Song Nhận','weapons','Chu',4,1780,3,'Nguyên Anh',{ faction:'heretic',asset:'/assets/equipment/heretic-spider-blades.png',damage:98,atkBonus:98,attackSpeed:.28,critRate:.24,lifeSteal:.05 },'Song nhận nhanh như chân thiên chu.'),
  item('heretic_plague_staff','Vạn Cổ U Minh Trượng','weapons','Cổ',5,4900,4,'Hóa Thần',{ faction:'heretic',asset:'/assets/equipment/heretic-plague-staff.png',damage:174,atkBonus:174,attackSpeed:.23,critRate:.28,lifeSteal:.08 },'U minh trượng nuôi dưỡng vạn cổ.'),
]);
export const ARMOR = Object.freeze([
  item('spirit_robe','Tụ Linh Pháp Bào','armor','🥋',1,110,0,'Luyện Khí',{ defense:7,maxMana:12 },'Pháp bào tụ linh cơ bản.'),
  item('jade_armor','Bích Ngọc Hộ Giáp','armor','🛡',2,380,1,'Trúc Cơ',{ defense:20,maxMana:28 },'Hộ giáp kết tinh từ linh ngọc.'),
  item('dragon_armor','Long Lân Chiến Giáp','armor','🐉',3,900,2,'Kim Đan',{ defense:45,maxMana:50 },'Long lân chống lại thuật pháp.'),
  item('celestial_sword_set','Thiên Kiếm Đạo Bào','armor','Kiếm',2,540,1,'Trúc Cơ',{ faction:'orthodox',asset:'/assets/equipment/orthodox-celestial-set.png',damage:16,atkBonus:16,defense:18,maxMana:24 },'Đạo bào và linh kiếm dành riêng cho Chính Đạo.'),
  item('blood_lord_set','Huyết Tôn Ma Y','armor','Huyết',2,540,1,'Trúc Cơ',{ faction:'demonic',asset:'/assets/equipment/demonic-blood-set.png',damage:20,atkBonus:20,defense:14,lifeSteal:.04 },'Ma y huyết sát dành riêng cho Ma Đạo.'),
  item('nether_venom_set','U Minh Độc Y','armor','Độc',2,540,1,'Trúc Cơ',{ faction:'heretic',asset:'/assets/equipment/heretic-nether-set.png',damage:15,atkBonus:15,defense:15,critRate:.05 },'Độc y song nhận dành riêng cho Tà Đạo.'),
  item('orthodox_cloud_robe','Thanh Vân Pháp Y','armor','Vân',2,460,1,'Trúc Cơ',{ faction:'orthodox',asset:'/assets/equipment/orthodox-cloud-robe.png',defense:24,maxMana:32 },'Pháp y thanh vân nhẹ mà bền.'),
  item('orthodox_star_armor','Tinh Thần Kiếm Khải','armor','Khải',4,2100,3,'Nguyên Anh',{ faction:'orthodox',asset:'/assets/equipment/orthodox-star-armor.png',damage:28,atkBonus:28,defense:68,maxMana:65 },'Kiếm khải kết từ tinh thần.'),
  item('orthodox_infinite_robe','Vô Cực Tiên Bào','armor','Cực',5,5800,4,'Hóa Thần',{ faction:'orthodox',asset:'/assets/equipment/orthodox-infinite-robe.png',damage:52,atkBonus:52,defense:118,maxMana:100 },'Tiên bào vận chuyển âm dương vô cực.'),
  item('demonic_blood_armor','Huyết Văn Ma Giáp','armor','Văn',2,480,1,'Trúc Cơ',{ faction:'demonic',asset:'/assets/equipment/demonic-blood-armor.png',defense:27,lifeSteal:.04 },'Ma giáp khắc huyết văn sống.'),
  item('demonic_ninehell_armor','Cửu U Quỷ Khải','armor','Quỷ',4,2250,3,'Nguyên Anh',{ faction:'demonic',asset:'/assets/equipment/demonic-ninehell-armor.png',damage:34,atkBonus:34,defense:74,lifeSteal:.08 },'Quỷ khải rèn dưới chín tầng u minh.'),
  item('demonic_emperor_robe','Thiên Ma Đế Bào','armor','Ma',5,6200,4,'Hóa Thần',{ faction:'demonic',asset:'/assets/equipment/demonic-emperor-robe.png',damage:62,atkBonus:62,defense:125,lifeSteal:.12 },'Đế bào của Thiên Ma giáng thế.'),
  item('heretic_bone_robe','Hủ Cốt Độc Bào','armor','Cốt',2,440,1,'Trúc Cơ',{ faction:'heretic',asset:'/assets/equipment/heretic-bone-robe.png',defense:22,critRate:.06,maxMana:20 },'Độc bào ăn mòn linh lực đối thủ.'),
  item('heretic_spider_armor','Thiên Chu Yêu Khải','armor','Yêu',4,1980,3,'Nguyên Anh',{ faction:'heretic',asset:'/assets/equipment/heretic-spider-armor.png',damage:25,atkBonus:25,defense:62,critRate:.13 },'Yêu khải dệt bằng tơ thiên chu.'),
  item('heretic_saint_robe','Vạn Độc Thánh Y','armor','Thánh',5,5400,4,'Hóa Thần',{ faction:'heretic',asset:'/assets/equipment/heretic-saint-robe.png',damage:47,atkBonus:47,defense:105,critRate:.20,maxMana:70 },'Thánh y hội tụ vạn độc bất xâm.'),
]);
export const CONSUMABLES = Object.freeze([
  item('healing_pill','Hồi Xuân Đan','consumables','🔴',1,35,0,'Luyện Khí',{ heal:45,healAmount:45 },'Hồi phục 45 Khí Huyết.'),
  item('mana_pill','Tụ Linh Đan','consumables','🔵',1,40,0,'Luyện Khí',{ mana:40 },'Hồi phục 40 Linh Lực.'),
  item('spirit_charm','Hộ Thân Phù','consumables','📜',2,120,1,'Trúc Cơ',{ accessory:true,defense:5 },'Có thể trang bị vào ô Phụ Kiện.'),
  item('thunder_guard_talisman','Lôi Linh Hộ Tâm Kính','boss','⚡',3,780,1,'Trúc Cơ',{ accessory:true,defense:18,critRate:.08,bossDrop:true },'Trang bị Sử Thi chỉ rơi từ Lôi Linh Hộ Pháp.'),
]);
export const SHOP_ITEMS = Object.freeze([...WEAPONS,...ARMOR,...CONSUMABLES]);
export const itemById = id => SHOP_ITEMS.find(entry=>entry.id===id);

export class ShopSystem {
  constructor(state={}){this.gold=Math.max(0,Number(state.gold)||0);this.inventory=[...(state.inventory??[])].filter(id=>itemById(id));const legacy=state.equipped;this.equipment={weapon:null,armor:null,accessory:null,...state.equipment};if(legacy&&!this.equipment.weapon)this.equipment.weapon=legacy;for(const key of Object.keys(this.equipment))if(!this.inventory.includes(this.equipment[key]))this.equipment[key]=null;this.equipped=this.equipment.weapon;}
  buy(id,realmOrder,faction){const entry=itemById(id);if(!entry||entry.faction&&entry.faction!==faction||realmOrder<entry.requiredOrder||this.gold<entry.price)return false;if(entry.category!=='consumables'&&this.inventory.includes(id))return false;this.gold-=entry.price;this.inventory.push(id);if(entry.category==='weapons'&&!this.equipment.weapon)this.equip(id,faction);return true;}
  sell(id){const entry=itemById(id),index=this.inventory.indexOf(id);if(!entry||index<0)return false;this.inventory.splice(index,1);this.gold+=Math.floor(entry.price*.55);for(const slot of Object.keys(this.equipment))if(this.equipment[slot]===id)this.equipment[slot]=null;this.equipped=this.equipment.weapon;return true;}
  equip(id,faction){const entry=itemById(id);if(!entry||entry.faction&&entry.faction!==faction||!this.inventory.includes(id))return false;const slot=entry.category==='weapons'?'weapon':entry.category==='armor'?'armor':entry.accessory?'accessory':null;if(!slot)return false;this.equipment[slot]=id;this.equipped=this.equipment.weapon;return true;}
  unequip(id){const slot=Object.keys(this.equipment).find(key=>this.equipment[key]===id);if(!slot)return false;this.equipment[slot]=null;this.equipped=this.equipment.weapon;return true;}
  use(id,player){const entry=itemById(id),index=this.inventory.indexOf(id);if(!entry||entry.category!=='consumables'||entry.accessory||index<0)return false;if(entry.heal)player.hp=Math.min(player.maxHp,player.hp+entry.heal);if(entry.mana)player.mp=Math.min(player.maxMp,player.mp+entry.mana);this.inventory.splice(index,1);return true;}
  addGold(amount){this.gold=Math.max(0,this.gold+(Number(amount)||0));}
  serialize(){return {gold:this.gold,inventory:[...this.inventory],equipment:{...this.equipment},equipped:this.equipment.weapon};}
}
