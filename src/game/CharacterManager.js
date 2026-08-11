const SLOT_BY_FACTION=Object.freeze({orthodox:'Character_A',demonic:'Character_B',heretic:'Character_C'});
const REALM_LABELS=Object.freeze({qi_refining:'Luyện Khí',foundation:'Trúc Cơ',golden_core:'Kim Đan',nascent_soul:'Nguyên Anh',spirit_transformation:'Hóa Thần'});
const clone=value=>JSON.parse(JSON.stringify(value));
const realmTitle=(realm,level)=>`${REALM_LABELS[realm]??realm} ${realm==='qi_refining'?'Tầng':'Cấp'} ${level}`;
const resumeToken=()=>globalThis.crypto?.randomUUID?.().replaceAll('-','')??`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

export class CharacterManager{
  constructor(saveSystem){this.saveSystem=saveSystem;const state=saveSystem.load();this.characters=state.characters??{};this.activeCharacterId=state.activeCharacterId??null;}
  create(faction,name='Vô Danh'){
    const id=SLOT_BY_FACTION[faction]??`Character_${Date.now()}`;
    if(!this.characters[id])this.characters[id]={id,faction,name,resumeToken:resumeToken(),realm:'qi_refining',realmName:'Luyện Khí Tầng 1',minorLevel:1,currentExp:0,maxExp:150,cultivationSystem:null,gold:0,inventory:[],equipment:{weapon:null,armor:null,accessory:null},allocatedStats:{strength:0,spirit:0,vitality:0,agility:0},skillSystem:null,currentRegion:'sect_hall',resources:{linhThach:0,linhThao:0,linhCot:0,hoTamDan:0}};
    this.characters[id].resumeToken??=resumeToken();
    this.persist();return this.characters[id];
  }
  selectByFaction(faction,name){const character=this.create(faction,name);if(name)character.name=name;this.activeCharacterId=character.id;this.persist();return clone(character);}
  active(){return this.activeCharacterId?clone(this.characters[this.activeCharacterId]):null;}
  updateActive(profile){
    // Network/UI callbacks from the character that was just closed may arrive
    // after another character has become active.  Always apply a profile to
    // the character that owns it instead of blindly using the mutable active
    // slot; otherwise the previous character's gold can overwrite the new one.
    const characterId=profile?.characterId??this.activeCharacterId;
    const current=this.characters[characterId];if(!current)return null;
    const cultivation=profile.cultivationSystem??current.cultivationSystem,realm=cultivation?.realmId??profile.realm??current.realm,minorLevel=cultivation?.subStage??profile.skillSystem?.minorLevel??profile.minorLevel??current.minorLevel;
    Object.assign(current,{name:profile.name??current.name,faction:profile.faction??current.faction,realm,realmName:cultivation?profile.realmName??realmTitle(realm,minorLevel):realmTitle(realm,minorLevel),minorLevel,currentExp:cultivation?.currentExp??profile.skillSystem?.cultivationProgress??profile.qi??current.currentExp,maxExp:cultivation?.requiredEXP??current.maxExp??100,cultivationSystem:cultivation,gold:profile.shopSystem?.gold??profile.gold??current.gold,inventory:[...(profile.shopSystem?.inventory??current.inventory)],equipment:{...current.equipment,...profile.shopSystem?.equipment},allocatedStats:{...current.allocatedStats,...profile.allocatedStats},skillSystem:profile.skillSystem??current.skillSystem,currentRegion:profile.currentRegion??current.currentRegion,resources:{...(current.resources??{}),...(profile.resources??{})}});
    this.persist();return clone(current);
  }
  persist(){this.saveSystem.save({activeCharacterId:this.activeCharacterId,characters:this.characters});}
  static slotForFaction(faction){return SLOT_BY_FACTION[faction];}
}
