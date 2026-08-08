export const SECT_COMBAT_DATA=Object.freeze({
  orthodox:Object.freeze({name:'Thiên Kiếm Môn',element:'Kiếm Khí · Thánh Quang',primary:'#58e8ff',secondary:'#b7f7ff',accent:'#ffd96a',sound:'sect-sword',mechanics:Object.freeze({rangeMultiplier:1.25,multiHit:3,parryShield:true}),vfx:Object.freeze({basic:'swordWave',q:'flyingSwords',e:'swordRain',r:'holyBeam',f:'goldBarrier',g:'myriadSwords'})}),
  demonic:Object.freeze({name:'Vạn Ma Điện',element:'Huyết · Ma Hỏa',primary:'#ff3458',secondary:'#6d174f',accent:'#b84cff',sound:'sect-demon',mechanics:Object.freeze({lifeSteal:.14,enrageCrit:.22,aoeMultiplier:1.35}),vfx:Object.freeze({basic:'bloodSlash',q:'bloodFlame',e:'demonChains',r:'bloodReaver',f:'crimsonNova',g:'abyssBurst'})}),
  heretic:Object.freeze({name:'U Minh Cốc',element:'Độc · Ám Ảnh',primary:'#68f06a',secondary:'#8b45d6',accent:'#d1ff5c',sound:'sect-poison',mechanics:Object.freeze({poisonStacks:5,slow:.3,shadowStep:true}),vfx:Object.freeze({basic:'venomBlade',q:'venomDart',e:'poisonMist',r:'shadowStep',f:'serpentFang',g:'toxicSkulls'})}),
});
export const getSectCombatData=faction=>SECT_COMBAT_DATA[faction]??SECT_COMBAT_DATA.orthodox;
