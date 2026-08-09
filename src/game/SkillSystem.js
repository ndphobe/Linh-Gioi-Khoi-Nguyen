import { MAX_CULTIVATION_LEVEL, MIN_CULTIVATION_LEVEL, REALM_HIERARCHY, globalLevelForRealm, realmForLevel } from './CultivationSystem.js';

export const HOTBAR_SLOTS = Object.freeze(['q', 'e', 'r', 'f', 'g']);
export const SKILL_UNLOCK_LEVELS = Object.freeze([2, 3, 4, 5, 6, 8, 10]);

// Use one short Hán–Việt keyword that describes the actual technique. Keeping
// one word also guarantees that the glyph stays inside its square frame.
export function vietnameseSkillGlyph(skill = {}) {
  const source = String(skill.icon || skill.shortName || skill.name || 'Chiêu').trim();
  return source.split(/\s+/).find(Boolean) || 'Chiêu';
}

export function skillThemeColor(skill = {}) {
  const id = String(skill.id || '');
  if (/blood|crimson/.test(id)) return '#ff4f68';
  if (/flame|fire|inferno|sun/.test(id)) return '#ff9a3d';
  if (/soul|ghost|nightmare|nether|void/.test(id)) return '#ad75ff';
  if (/poison|venom|serpent|snake|toad|moth|plague|web|burial/.test(id)) return '#70e66b';
  if (/bone/.test(id)) return '#f1dfb0';
  if (/thunder/.test(id)) return '#63b8ff';
  if (/star|heaven|celestial|primordial|jade|lotus|dipper|yin_yang/.test(id)) return '#ffd866';
  if (/shadow/.test(id)) return '#8f82ff';
  return '#5eeeff';
}

const earnedUnlockPointsAt = level => SKILL_UNLOCK_LEVELS.filter(milestone => milestone <= level).length;
const earnedUpgradePointsAt = level => Math.max(0, level - 1 - earnedUnlockPointsAt(level));

export function cooldownVisual(remaining, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeRemaining = Math.max(0, Number(remaining) || 0);
  const ratio = safeTotal > 0 ? Math.min(1, safeRemaining / safeTotal) : 0;
  const label = safeRemaining <= 0 ? '' : safeRemaining < 1 ? `${safeRemaining.toFixed(1)}s` : safeRemaining < 10 ? `${safeRemaining.toFixed(1)}s` : `${Math.ceil(safeRemaining)}s`;
  return { remaining: safeRemaining, total: safeTotal, ratio, angle: ratio * 360, label, coolingDown: safeRemaining > 0 };
}

export const CULTIVATION_REALMS = Object.freeze(REALM_HIERARCHY.map(realm=>Object.freeze({...realm})));

const SKILL_REQUIREMENTS=Object.freeze({
  sword_intent:[1,0,'swordRain'],jade_shield:[2,80,'goldBarrier'],myriad_swords:[3,180,'flyingSwords'],heaven_sever:[4,320,'holyBeam'],sun_sword_domain:[5,520,'myriadSwords'],
  blood_flame:[1,0,'bloodFlame'],crimson_nova:[2,90,'crimsonNova'],soul_chains:[3,190,'demonChains'],blood_reaver:[4,340,'bloodReaver'],abyss_feast:[5,560,'abyssBurst'],
  venom_dart:[1,0,'venomDart'],shadow_step:[2,75,'shadowStep'],poison_mist:[3,170,'poisonMist'],serpent_fang:[4,310,'serpentFang'],nightmare_garden:[5,500,'toxicSkulls'],
});

const SKILL_COMBAT_META=Object.freeze({
  sword_intent:{targetMode:'single',range:14,radius:1.1},jade_shield:{targetMode:'self',range:0,radius:1},myriad_swords:{targetMode:'area',range:9,radius:4.3},heaven_sever:{targetMode:'single',range:11,radius:1.35},sun_sword_domain:{targetMode:'around-self',range:0,radius:13},
  blood_flame:{targetMode:'single',range:14,radius:1.1},crimson_nova:{targetMode:'area',range:7,radius:4.3},soul_chains:{targetMode:'area',range:9,radius:4.3},blood_reaver:{targetMode:'single',range:11,radius:1.35},abyss_feast:{targetMode:'around-self',range:0,radius:13},
  venom_dart:{targetMode:'single',range:14,radius:1.1},shadow_step:{targetMode:'self',range:0,radius:1},poison_mist:{targetMode:'area',range:9,radius:4.3},serpent_fang:{targetMode:'single',range:7,radius:1.35},nightmare_garden:{targetMode:'around-self',range:0,radius:13},
});

const SKILL_SHORT_NAMES=Object.freeze({
  sword_intent:'Kiếm Khí',myriad_swords:'Vạn Kiếm',heaven_sever:'Thiên Quang',jade_shield:'Hộ Thể',sun_sword_domain:'Kiếm Vực',starfall_blade:'Lạc Kiếm',void_sword_prison:'Kiếm Lao',primordial_sword:'Thái Sơ',
  blood_flame:'Huyết Diễm',soul_chains:'Hồn Liên',blood_reaver:'Huyết Trảm',crimson_nova:'Xích Viêm',abyss_feast:'Vạn Hồn',bone_spear:'Cốt Thương',hellfire_lotus:'Hỏa Liên',blood_moon:'Huyết Nguyệt',
  venom_dart:'Độc Châm',poison_mist:'Độc Vụ',shadow_step:'Ảnh Độn',serpent_fang:'Xà Nha',nightmare_garden:'Độc Giới',ghost_needles:'Quỷ Châm',corpse_moths:'Minh Nga',nether_serpent:'Vạn Xà',
});

const skill = (id, name, icon, description, archetype, requiredRealm, stats, meta={}) => {
  const [defaultLevel=1,defaultCost=0,defaultVfx=archetype]=SKILL_REQUIREMENTS[id]??[];
  const combat=SKILL_COMBAT_META[id]??{};
  return Object.freeze({
  id, name, shortName:meta.shortName??SKILL_SHORT_NAMES[id]??name, icon, description, archetype, requiredRealm, requiredLevel:meta.requiredLevel??defaultLevel, unlockCost:meta.unlockCost??defaultCost, vfx:meta.vfx??defaultVfx, targetMode:meta.targetMode??combat.targetMode, range:meta.range??combat.range, radius:meta.radius??combat.radius, maxTier: 3,
  tiers: Object.freeze(stats.map((entry, index) => Object.freeze({ tier: index + 1, ...entry }))),
});};

export const SECT_SKILL_TREES = Object.freeze({
  orthodox: Object.freeze([
    skill('sword_intent', 'Kiếm Ý', 'Kiếm', 'Kiếm khí thuần dương gây sát thương vật lý.', 'q', 'qi_refining', [{ damage: 28, manaCost: 16, cooldown: 4.8 }, { damage: 39, manaCost: 14, cooldown: 4.3 }, { damage: 54, manaCost: 12, cooldown: 3.8 }]),
    skill('myriad_swords', 'Vạn Kiếm Quy Tông', 'Vạn', 'Kiếm trận ánh sáng quét nhiều mục tiêu.', 'e', 'foundation', [{ damage: 48, manaCost: 30, cooldown: 8 }, { damage: 65, manaCost: 27, cooldown: 7.2 }, { damage: 86, manaCost: 24, cooldown: 6.4 }]),
    skill('heaven_sever', 'Thiên Quang Trảm', 'Trảm', 'Nhát chém ánh sáng tập trung uy lực lớn.', 'r', 'foundation', [{ damage: 76, manaCost: 40, cooldown: 12 }, { damage: 101, manaCost: 36, cooldown: 10.8 }, { damage: 132, manaCost: 32, cooldown: 9.5 }]),
    skill('jade_shield', 'Hộ Thể Kiếm Cương', 'Thuẫn', 'Tạo lá chắn linh lực bảo hộ bản thân.', 'f', 'qi_refining', [{ damage: 0, shield: 34, manaCost: 25, cooldown: 14 }, { damage: 0, shield: 48, manaCost: 22, cooldown: 12.5 }, { damage: 0, shield: 65, manaCost: 19, cooldown: 11 }]),
    skill('sun_sword_domain', 'Thái Dương Kiếm Vực', 'Nhật', 'Tuyệt kỹ kiếm vực chính khí.', 'g', 'golden_core', [{ damage: 125, manaCost: 82, cooldown: 40 }, { damage: 165, manaCost: 74, cooldown: 36 }, { damage: 215, manaCost: 66, cooldown: 32 }]),
    skill('starfall_blade','Tinh Hà Lạc Kiếm','Tinh','Triệu một thiên kiếm mang tinh lực giáng xuống mục tiêu.','starfall','golden_core',[{damage:96,manaCost:48,cooldown:15},{damage:128,manaCost:43,cooldown:13.5},{damage:168,manaCost:38,cooldown:12}],{requiredLevel:6,unlockCost:680,vfx:'starfallBlade',targetMode:'area',range:12,radius:4.2}),
    skill('void_sword_prison','Hư Không Kiếm Lao','Lao','Phong tỏa một vùng bằng kiếm lao hư không.','voidprison','nascent_soul',[{damage:158,control:2.2,manaCost:68,cooldown:22},{damage:208,control:2.7,manaCost:61,cooldown:19.5},{damage:270,control:3.2,manaCost:54,cooldown:17}],{requiredLevel:9,unlockCost:1750,vfx:'voidSwordPrison',targetMode:'area',range:11,radius:5}),
    skill('primordial_sword','Thái Sơ Vô Cực Kiếm','Sơ','Một kiếm thái sơ xé mở hư không, uy lực cực đại.','primordial','spirit_transformation',[{damage:285,manaCost:96,cooldown:36},{damage:370,manaCost:86,cooldown:32},{damage:480,manaCost:76,cooldown:28}],{requiredLevel:13,unlockCost:4600,vfx:'primordialSword',targetMode:'area',range:14,radius:6}),
    skill('dipper_array','Bắc Đẩu Kiếm Trận','Đẩu','Bảy tinh kiếm kết trận khóa và chém mục tiêu.','dipper','nascent_soul',[{damage:125,control:1.4,manaCost:56,cooldown:17},{damage:166,control:1.8,manaCost:50,cooldown:15},{damage:218,control:2.2,manaCost:44,cooldown:13}],{shortName:'Bắc Đẩu',requiredLevel:7,unlockCost:900,vfx:'dipperArray',targetMode:'area',range:11,radius:4.6}),
    skill('azure_lotus_rain','Thanh Liên Kiếm Vũ','Liên','Thanh liên nở rộ, phóng kiếm vũ liên hoàn.','lotusrain','nascent_soul',[{damage:154,manaCost:62,cooldown:18},{damage:204,manaCost:55,cooldown:16},{damage:267,manaCost:48,cooldown:14}],{shortName:'Thanh Liên',requiredLevel:8,unlockCost:1250,vfx:'azureLotusRain',targetMode:'area',range:12,radius:5}),
    skill('nine_heaven_thunder','Cửu Tiêu Lôi Kiếm','Lôi','Lôi kiếm Cửu Tiêu đánh xuyên một đường thẳng.','thundersword','nascent_soul',[{damage:222,control:1.2,manaCost:74,cooldown:23},{damage:288,control:1.6,manaCost:66,cooldown:20},{damage:372,control:2,manaCost:58,cooldown:17}],{shortName:'Lôi Kiếm',requiredLevel:10,unlockCost:2600,vfx:'nineHeavenThunder',targetMode:'single',range:17,radius:1.8}),
    skill('yin_yang_wheel','Âm Dương Kiếm Luân','Luân','Song kiếm luân âm dương nghiền nát cả vùng.','swordwheel','spirit_transformation',[{damage:328,manaCost:88,cooldown:29},{damage:420,manaCost:79,cooldown:26},{damage:536,manaCost:70,cooldown:23}],{shortName:'Kiếm Luân',requiredLevel:12,unlockCost:3800,vfx:'yinYangWheel',targetMode:'area',range:12,radius:6.4}),
    skill('celestial_gate','Thiên Môn Vạn Kiếm','Môn','Mở Thiên Môn gọi vạn tiên kiếm giáng thế.','heavengate','spirit_transformation',[{damage:520,manaCost:118,cooldown:44},{damage:665,manaCost:106,cooldown:39},{damage:850,manaCost:94,cooldown:34}],{shortName:'Thiên Môn',requiredLevel:15,unlockCost:7000,vfx:'celestialGate',targetMode:'area',range:15,radius:8}),
  ]),
  demonic: Object.freeze([
    skill('blood_flame', 'Huyết Diễm', 'Hỏa', 'Ma hỏa đỏ thẫm thiêu đốt mục tiêu.', 'q', 'qi_refining', [{ damage: 31, manaCost: 18, cooldown: 5 }, { damage: 44, manaCost: 16, cooldown: 4.4 }, { damage: 60, manaCost: 14, cooldown: 3.9 }]),
    skill('soul_chains', 'Tỏa Hồn Liên', 'Tỏa', 'Xiềng hồn khống chế một vùng.', 'e', 'foundation', [{ damage: 42, control: 1.4, manaCost: 32, cooldown: 9 }, { damage: 57, control: 1.8, manaCost: 29, cooldown: 8 }, { damage: 76, control: 2.2, manaCost: 26, cooldown: 7 }]),
    skill('blood_reaver', 'Huyết Sát Trảm', 'Huyết', 'Chém bóng tối và hút sinh lực.', 'r', 'foundation', [{ damage: 72, lifeSteal: .12, manaCost: 38, cooldown: 11 }, { damage: 96, lifeSteal: .16, manaCost: 34, cooldown: 10 }, { damage: 126, lifeSteal: .22, manaCost: 30, cooldown: 8.8 }]),
    skill('crimson_nova', 'Xích Viêm Bạo', 'Bạo', 'Bùng nổ ma hỏa quanh người.', 'f', 'qi_refining', [{ damage: 54, manaCost: 29, cooldown: 13 }, { damage: 73, manaCost: 26, cooldown: 11.8 }, { damage: 97, manaCost: 23, cooldown: 10.5 }]),
    skill('abyss_feast', 'Vạn Hồn Phệ Thiên', 'Ma', 'Tuyệt kỹ nuốt sinh lực mọi kẻ trong vực.', 'g', 'golden_core', [{ damage: 132, lifeSteal: .18, manaCost: 86, cooldown: 42 }, { damage: 176, lifeSteal: .23, manaCost: 77, cooldown: 38 }, { damage: 230, lifeSteal: .3, manaCost: 68, cooldown: 34 }]),
    skill('bone_spear','Bạch Cốt Ma Thương','Cốt','Ma thương bạch cốt xuyên phá mục tiêu từ xa.','bonespear','golden_core',[{damage:104,manaCost:46,cooldown:14},{damage:139,manaCost:41,cooldown:12.5},{damage:183,manaCost:36,cooldown:11}],{requiredLevel:6,unlockCost:720,vfx:'boneSpear',targetMode:'single',range:15,radius:1.3}),
    skill('hellfire_lotus','Địa Ngục Hỏa Liên','Liên','Hỏa liên địa ngục nở rộ, thiêu đốt cả vùng.','helllotus','nascent_soul',[{damage:168,dot:48,manaCost:72,cooldown:23},{damage:220,dot:68,manaCost:64,cooldown:20},{damage:286,dot:92,manaCost:56,cooldown:17.5}],{requiredLevel:9,unlockCost:1820,vfx:'hellfireLotus',targetMode:'area',range:10,radius:5.4}),
    skill('blood_moon','Huyết Nguyệt Diệt Thế','Nguyệt','Huyết nguyệt giáng thế nghiền nát sinh cơ quanh thân.','bloodmoon','spirit_transformation',[{damage:302,lifeSteal:.22,manaCost:100,cooldown:38},{damage:394,lifeSteal:.28,manaCost:90,cooldown:34},{damage:510,lifeSteal:.36,manaCost:80,cooldown:30}],{requiredLevel:13,unlockCost:4800,vfx:'bloodMoon',targetMode:'around-self',range:0,radius:9}),
    skill('blood_ravens','Huyết Nha Phệ Hồn','Nha','Đàn huyết nha truy sát và hút sinh lực.','ravens','nascent_soul',[{damage:132,lifeSteal:.1,manaCost:57,cooldown:17},{damage:176,lifeSteal:.14,manaCost:51,cooldown:15},{damage:230,lifeSteal:.18,manaCost:45,cooldown:13}],{shortName:'Huyết Nha',requiredLevel:7,unlockCost:950,vfx:'bloodRavens',targetMode:'single',range:16,radius:1.6}),
    skill('bone_ghost_gate','Quỷ Môn Cốt Trận','Môn','Quỷ môn trồi lên cùng cốt thương phong tỏa vùng đất.','bonegate','nascent_soul',[{damage:164,control:1.8,manaCost:64,cooldown:19},{damage:216,control:2.3,manaCost:57,cooldown:17},{damage:282,control:2.8,manaCost:50,cooldown:15}],{shortName:'Quỷ Môn',requiredLevel:8,unlockCost:1320,vfx:'boneGhostGate',targetMode:'area',range:11,radius:5.2}),
    skill('inferno_dragon','Nghiệp Hỏa Ma Long','Long','Ma long nghiệp hỏa lao qua thiêu cháy mọi sinh linh.','firedragon','nascent_soul',[{damage:236,dot:58,manaCost:78,cooldown:24},{damage:306,dot:80,manaCost:70,cooldown:21},{damage:396,dot:108,manaCost:62,cooldown:18}],{shortName:'Ma Long',requiredLevel:10,unlockCost:2750,vfx:'infernoDragon',targetMode:'area',range:14,radius:4.8}),
    skill('myriad_soul_banner','Vạn Hồn Ma Phiên','Phiên','Ma phiên triệu vạn hồn cắn xé quanh người.','soulbanner','spirit_transformation',[{damage:344,lifeSteal:.16,manaCost:92,cooldown:30},{damage:442,lifeSteal:.21,manaCost:82,cooldown:27},{damage:566,lifeSteal:.27,manaCost:72,cooldown:24}],{shortName:'Ma Phiên',requiredLevel:12,unlockCost:4000,vfx:'myriadSoulBanner',targetMode:'around-self',range:0,radius:10}),
    skill('world_blood_tide','Diệt Thế Huyết Triều','Triều','Huyết hải dâng trào cuốn sạch chiến trường.','bloodtide','spirit_transformation',[{damage:548,lifeSteal:.24,manaCost:122,cooldown:46},{damage:704,lifeSteal:.3,manaCost:109,cooldown:41},{damage:900,lifeSteal:.38,manaCost:96,cooldown:36}],{shortName:'Huyết Triều',requiredLevel:15,unlockCost:7400,vfx:'worldBloodTide',targetMode:'area',range:14,radius:9}),
  ]),
  heretic: Object.freeze([
    skill('venom_dart', 'Đoạt Mệnh Châm', 'Độc', 'Ám khí tẩm độc gây sát thương theo thời gian.', 'q', 'qi_refining', [{ damage: 20, dot: 18, manaCost: 14, cooldown: 4.2 }, { damage: 27, dot: 27, manaCost: 12, cooldown: 3.7 }, { damage: 36, dot: 39, manaCost: 10, cooldown: 3.2 }]),
    skill('poison_mist', 'Vạn Độc Vụ', 'Vụ', 'Màn sương độc bào mòn nhiều mục tiêu.', 'e', 'foundation', [{ damage: 32, dot: 30, manaCost: 28, cooldown: 9 }, { damage: 43, dot: 44, manaCost: 25, cooldown: 8 }, { damage: 57, dot: 61, manaCost: 22, cooldown: 7 }]),
    skill('shadow_step', 'Ảnh Độn', 'Ảnh', 'Ẩn thân ngắn và tăng tốc di chuyển.', 'r', 'qi_refining', [{ damage: 0, speed: .2, stealth: 2, manaCost: 22, cooldown: 12 }, { damage: 0, speed: .3, stealth: 2.8, manaCost: 19, cooldown: 10.5 }, { damage: 0, speed: .42, stealth: 3.6, manaCost: 16, cooldown: 9 }]),
    skill('serpent_fang', 'Xà Nha Phệ', 'Xà', 'Đột kích cực nhanh, cộng dồn kịch độc.', 'f', 'foundation', [{ damage: 59, dot: 16, manaCost: 30, cooldown: 10 }, { damage: 79, dot: 24, manaCost: 27, cooldown: 9 }, { damage: 104, dot: 34, manaCost: 24, cooldown: 8 }]),
    skill('nightmare_garden', 'U Minh Độc Giới', 'Minh', 'Tuyệt kỹ biến chiến trường thành độc giới.', 'g', 'golden_core', [{ damage: 105, dot: 62, manaCost: 78, cooldown: 39 }, { damage: 140, dot: 86, manaCost: 70, cooldown: 35 }, { damage: 184, dot: 116, manaCost: 62, cooldown: 31 }]),
    skill('ghost_needles','Quỷ Ảnh Phi Châm','Châm','Bảy quỷ châm phá không, độc phát ngay khi trúng.','needles','golden_core',[{damage:78,dot:46,manaCost:42,cooldown:12},{damage:104,dot:64,manaCost:37,cooldown:10.5},{damage:138,dot:86,manaCost:32,cooldown:9}],{requiredLevel:6,unlockCost:650,vfx:'ghostNeedles',targetMode:'single',range:15,radius:1.5}),
    skill('corpse_moths','Thi Cổ Minh Nga','Nga','Bầy minh nga mang thi độc bao phủ một khu vực.','moths','nascent_soul',[{damage:126,dot:96,manaCost:66,cooldown:21},{damage:166,dot:128,manaCost:59,cooldown:18.5},{damage:216,dot:168,manaCost:52,cooldown:16}],{requiredLevel:9,unlockCost:1680,vfx:'corpseMoths',targetMode:'area',range:11,radius:5.5}),
    skill('nether_serpent','U Minh Vạn Xà','Xà Vương','U Minh xà vương phun độc diệt cả chiến trường.','netherserpent','spirit_transformation',[{damage:238,dot:172,manaCost:92,cooldown:35},{damage:312,dot:224,manaCost:82,cooldown:31},{damage:408,dot:292,manaCost:72,cooldown:27}],{requiredLevel:13,unlockCost:4450,vfx:'netherSerpent',targetMode:'area',range:13,radius:6.5}),
    skill('jade_fire_toad','Bích Hỏa Độc Thiềm','Thiềm','Độc thiềm phun bích hỏa bám theo mục tiêu.','toad','nascent_soul',[{damage:92,dot:68,manaCost:53,cooldown:16},{damage:122,dot:94,manaCost:47,cooldown:14},{damage:160,dot:126,manaCost:41,cooldown:12}],{shortName:'Độc Thiềm',requiredLevel:7,unlockCost:860,vfx:'jadeFireToad',targetMode:'single',range:15,radius:1.7}),
    skill('sky_spider_web','Thiên Chu Phược Võng','Võng','Thiên chu giăng độc võng trói cả một vùng.','web','nascent_soul',[{damage:118,dot:82,control:2.2,manaCost:61,cooldown:19},{damage:156,dot:112,control:2.8,manaCost:54,cooldown:17},{damage:204,dot:150,control:3.4,manaCost:47,cooldown:15}],{shortName:'Phược Võng',requiredLevel:8,unlockCost:1180,vfx:'skySpiderWeb',targetMode:'area',range:12,radius:5.5}),
    skill('corpse_plague_wind','Âm Phong Thi Cổ','Phong','Âm phong mang thi cổ xuyên qua và gieo dịch độc.','plaguewind','nascent_soul',[{damage:168,dot:126,manaCost:72,cooldown:22},{damage:220,dot:170,manaCost:64,cooldown:19},{damage:286,dot:226,manaCost:56,cooldown:17}],{shortName:'Thi Cổ',requiredLevel:10,unlockCost:2400,vfx:'corpsePlagueWind',targetMode:'area',range:14,radius:5}),
    skill('nine_nether_snakes','Cửu U Xà Trận','Cửu Xà','Chín độc xà kết trận săn mọi kẻ trong vùng.','snakearray','spirit_transformation',[{damage:248,dot:210,manaCost:84,cooldown:28},{damage:324,dot:276,manaCost:75,cooldown:25},{damage:420,dot:356,manaCost:66,cooldown:22}],{shortName:'Cửu Xà',requiredLevel:12,unlockCost:3500,vfx:'nineNetherSnakes',targetMode:'area',range:12,radius:7}),
    skill('venom_burial','Vạn Độc Táng Giới','Táng','Vạn độc hóa thành cấm địa chôn vùi sinh cơ.','burial','spirit_transformation',[{damage:388,dot:330,manaCost:108,cooldown:42},{damage:504,dot:430,manaCost:96,cooldown:37},{damage:650,dot:558,manaCost:84,cooldown:32}],{shortName:'Táng Giới',requiredLevel:15,unlockCost:6500,vfx:'venomBurial',targetMode:'area',range:14,radius:9}),
  ]),
});

const realmOrder = (id) => CULTIVATION_REALMS.find((realm) => realm.id === id)?.order ?? 0;

export class SkillSystemManager {
  constructor({ faction = 'orthodox', realmId = 'qi_refining', minorLevel = 1, state } = {}) {
    this.faction = SECT_SKILL_TREES[faction] ? faction : 'orthodox';
    this.realmId = CULTIVATION_REALMS.some((realm) => realm.id === realmId) ? realmId : 'qi_refining';
    const realm=CULTIVATION_REALMS.find(entry=>entry.id===this.realmId)??CULTIVATION_REALMS[0];
    this.minorLevel = Math.max(1, Math.min(realm.stages, Math.floor(minorLevel)||1));
    this.lastCultivationLevel=globalLevelForRealm(this.realmId,this.minorLevel);
    this.skillUnlockPoints=earnedUnlockPointsAt(this.lastCultivationLevel);
    this.skillUpgradePoints=earnedUpgradePointsAt(this.lastCultivationLevel);
    this.cultivationProgress = 0;
    this.unlocked = {};
    this.hotbar = Object.fromEntries(HOTBAR_SLOTS.map((slot) => [slot, null]));
    if (state) { const targetLevel=this.lastCultivationLevel;this.restore(state);this.applyCultivationLevel(targetLevel); }
    // Every new or migrated character needs one usable combat art. Realm
    // breakthroughs still award the remaining four unlocks.
    if (Object.keys(this.unlocked).length === 0) {
      const starter = this.tree[0];
      this.unlocked[starter.id] = 1;
      this.hotbar.q = starter.id;
    }
    const starter=this.tree[0];
    if(this.unlocked[starter.id]&&!this.slotForSkill(starter.id)&&HOTBAR_SLOTS.every(slot=>!this.hotbar[slot]))this.hotbar.q=starter.id;
  }

  get unlockPoints(){return this.skillUnlockPoints;}
  set unlockPoints(value){this.skillUnlockPoints=Math.max(0,Math.floor(Number(value)||0));}
  get upgradePoints(){return this.skillUpgradePoints;}
  set upgradePoints(value){this.skillUpgradePoints=Math.max(0,Math.floor(Number(value)||0));}
  get tree() { return SECT_SKILL_TREES[this.faction]; }
  getSkill(id) { return this.tree.find((entry) => entry.id === id); }
  canUnlock(id) { const item = this.getSkill(id); return Boolean(item && !this.unlocked[id] && this.skillUnlockPoints > 0 && this.lastCultivationLevel >= item.requiredLevel && realmOrder(this.realmId) >= realmOrder(item.requiredRealm)); }
  unlock(id) { if (!this.canUnlock(id)) return false; this.unlocked[id] = 1; this.skillUnlockPoints -= 1; return true; }
  canUpgrade(id) { const item = this.getSkill(id); return Boolean(item && this.unlocked[id] && this.unlocked[id] < item.maxTier && this.skillUpgradePoints > 0); }
  upgrade(id) { if (!this.canUpgrade(id)) return false; this.unlocked[id] += 1; this.skillUpgradePoints -= 1; return true; }
  assign(slot, id) {
    if (!HOTBAR_SLOTS.includes(slot) || !this.unlocked[id] || !this.getSkill(id)) return false;
    // Players must explicitly remove a binding before reusing either its skill
    // or its slot. This prevents silent replacement and duplicate hotbar art.
    if (this.hotbar[slot] || this.slotForSkill(id)) return false;
    this.hotbar[slot] = id;
    return true;
  }
  unassign(slot) { if (!HOTBAR_SLOTS.includes(slot) || !this.hotbar[slot]) return false; this.hotbar[slot] = null; return true; }
  slotForSkill(id) { return HOTBAR_SLOTS.find((slot) => this.hotbar[slot] === id) ?? null; }
  skillForSlot(slot) {
    const item = this.getSkill(this.hotbar[slot]);
    if (!item) return null;
    const tier = item.tiers[this.unlocked[item.id] - 1];
    const cultivationMultiplier = 1 + Math.max(0, this.lastCultivationLevel - 1) * .025;
    const resolved = { ...item, ...tier, cultivationMultiplier };
    for (const stat of ['damage', 'dot', 'heal', 'shield']) {
      if (Number.isFinite(Number(tier[stat]))) resolved[stat] = Math.round(Number(tier[stat]) * cultivationMultiplier * 100) / 100;
    }
    return resolved;
  }
  applyCultivationLevel(targetLevel){
    const target=Math.max(MIN_CULTIVATION_LEVEL,Math.min(MAX_CULTIVATION_LEVEL,Math.trunc(Number(targetLevel)||MIN_CULTIVATION_LEVEL)));
    const from=Math.max(MIN_CULTIVATION_LEVEL,this.lastCultivationLevel||target);
    if(target<from)return{unlockAwarded:0,upgradeAwarded:0,fromLevel:from,toLevel:from};
    let unlockAwarded=0,upgradeAwarded=0;
    for(let level=from+1;level<=target;level++){
      if(SKILL_UNLOCK_LEVELS.includes(level)){this.skillUnlockPoints+=1;unlockAwarded+=1;}
      else{this.skillUpgradePoints+=1;upgradeAwarded+=1;}
    }
    const realm=realmForLevel(target);
    this.realmId=realm.id;this.minorLevel=target-realm.startLevel+1;this.lastCultivationLevel=Math.max(this.lastCultivationLevel||target,target);
    return{unlockAwarded,upgradeAwarded,fromLevel:from,toLevel:target};
  }
  advanceMinor() { const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current);if(current>=realm.endLevel)return false;this.applyCultivationLevel(current+1);return true; }
  gainCultivation(amount) {
    const gained = Math.max(0, Number(amount) || 0);
    const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current);
    if (!gained || (current===realm.endLevel && this.cultivationProgress >= 100)) return { gained: 0, levels: 0, tribulationReady: current===realm.endLevel && this.cultivationProgress >= 100 };
    this.cultivationProgress += gained;
    let levels = 0;
    while (this.cultivationProgress >= 100 && this.advanceMinor()) { this.cultivationProgress -= 100; levels += 1; }
    const nextCurrent=globalLevelForRealm(this.realmId,this.minorLevel),nextRealm=realmForLevel(nextCurrent);
    if(nextCurrent===nextRealm.endLevel)this.cultivationProgress=Math.min(100,this.cultivationProgress);
    return { gained, levels, tribulationReady: nextCurrent===nextRealm.endLevel && this.cultivationProgress >= 100 };
  }
  breakthrough(nextRealmId) { const current=globalLevelForRealm(this.realmId,this.minorLevel),realm=realmForLevel(current),next=CULTIVATION_REALMS.find(entry=>entry.id===nextRealmId);if(current!==realm.endLevel||this.cultivationProgress<100||!next||next.order!==realm.order+1)return false;this.applyCultivationLevel(next.startLevel);this.cultivationProgress=0;return true; }
  serialize() { return { pointVersion:4,faction:this.faction,realmId:this.realmId,minorLevel:this.minorLevel,cultivationProgress:this.cultivationProgress,skillUnlockPoints:this.skillUnlockPoints,skillUpgradePoints:this.skillUpgradePoints,unlockPoints:this.skillUnlockPoints,upgradePoints:this.skillUpgradePoints,lastCultivationLevel:this.lastCultivationLevel,unlocked:{...this.unlocked},hotbar:{...this.hotbar} }; }
  restore(state) {
    if (!state || state.faction !== this.faction) return;
    this.cultivationProgress = Math.max(0, Math.min(100, Number(state.cultivationProgress) || 0));
    this.unlocked = {};
    // A server snapshot is authoritative, including empty slots. Resetting first
    // prevents a removed or moved skill from surviving locally as a ghost binding.
    this.hotbar = Object.fromEntries(HOTBAR_SLOTS.map((slot) => [slot, null]));
    // Never trust an old or edited save to grant arts above the character's
    // actual cultivation level. The server constructs this manager with the
    // authoritative realm/stage before restoring the snapshot.
    for (const item of this.tree) {
      const meetsLevel = item.requiredLevel <= this.lastCultivationLevel;
      const meetsRealm = realmOrder(this.realmId) >= realmOrder(item.requiredRealm);
      if (state.unlocked?.[item.id] && meetsLevel && meetsRealm) this.unlocked[item.id] = Math.min(item.maxTier, Math.max(1, Math.floor(state.unlocked[item.id])));
    }
    const assigned=new Set();
    for (const slot of HOTBAR_SLOTS) { const id=state.hotbar?.[slot];if(this.unlocked[id]&&!assigned.has(id)){this.hotbar[slot]=id;assigned.add(id);} }
    if(state.pointVersion===4){
      this.skillUnlockPoints=Math.max(0,Math.floor(Number(state.skillUnlockPoints??state.unlockPoints)||0));
      this.skillUpgradePoints=Math.max(0,Math.floor(Number(state.skillUpgradePoints??state.upgradePoints)||0));
      this.lastCultivationLevel=Math.max(MIN_CULTIVATION_LEVEL,Math.min(MAX_CULTIVATION_LEVEL,Math.floor(Number(state.lastCultivationLevel)||this.lastCultivationLevel)));
    }else{
      const unlockSpent=Math.max(0,Object.keys(this.unlocked).length-1),upgradeSpent=Object.values(this.unlocked).reduce((sum,tier)=>sum+Math.max(0,tier-1),0);
      this.skillUnlockPoints=Math.max(0,earnedUnlockPointsAt(this.lastCultivationLevel)-unlockSpent);
      this.skillUpgradePoints=Math.max(0,earnedUpgradePointsAt(this.lastCultivationLevel)-upgradeSpent);
    }
  }
}
