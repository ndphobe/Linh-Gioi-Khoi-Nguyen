import { CULTIVATION_REALMS, HOTBAR_SLOTS, SKILL_UNLOCK_LEVELS, skillThemeColor, vietnameseSkillGlyph } from '../SkillSystem.js';

export function skillTreePanelMarkup(system){
  const nextUnlock=SKILL_UNLOCK_LEVELS.find(level=>level>system.lastCultivationLevel);
  const counters=`<div class="skill-tree-summary"><span>Điểm Mở Khóa Chiêu: <b>${system.skillUnlockPoints}</b></span><span>Điểm Nâng Cấp Chiêu: <b>${system.skillUpgradePoints}</b></span><span>${nextUnlock?`Mở thêm điểm ở Lv ${nextUnlock}`:'Đã nhận đủ điểm mở chiêu'}</span></div>`;
  const skills=system.tree.map(skill=>{
    const tier=system.unlocked[skill.id]??0,assigned=system.slotForSkill(skill.id),levelLocked=system.lastCultivationLevel<skill.requiredLevel,affordable=(system.availableGold??Infinity)>=skill.unlockCost,canUnlock=system.canUnlock(skill.id)&&affordable;
    const requiredRealm=CULTIVATION_REALMS.find(realm=>realm.id===skill.requiredRealm)?.name??skill.requiredRealm;
    const currentRealm=CULTIVATION_REALMS.find(realm=>realm.id===system.realmId),requiredRealmData=CULTIVATION_REALMS.find(realm=>realm.id===skill.requiredRealm),realmLocked=(currentRealm?.order??0)<(requiredRealmData?.order??0);
    const tierData=tier?skill.tiers[tier-1]:skill.tiers[0],multiplier=1+Math.max(0,system.lastCultivationLevel-1)*.025;
    const combatStats=[tierData.damage&&`Sát thương ${Math.round(tierData.damage*multiplier*100)/100}`,tierData.dot&&`Độc ${Math.round(tierData.dot*multiplier*100)/100}`,tierData.shield&&`Lá chắn ${Math.round(tierData.shield*multiplier*100)/100}`].filter(Boolean).join(' · ');
    const action=tier
      ? `<button class="skill-node__upgrade" data-action="upgrade" data-skill-id="${skill.id}" aria-label="Nâng cấp ${skill.name}" ${system.canUpgrade(skill.id)?'':'disabled'}>+</button>`
      : `<button data-action="unlock" data-skill-id="${skill.id}" ${canUnlock?'':'disabled'}>Mở · 🪙 ${skill.unlockCost}</button>`;
    const assignment=tier?`<div class="skill-assign" aria-label="Gán phím cho ${skill.name}">${HOTBAR_SLOTS.map(slot=>{const occupant=system.skillForSlot(slot),isCurrent=assigned===slot,occupied=Boolean(occupant&&!isCurrent),blocked=Boolean(assigned||occupant);const stateClass=isCurrent?'active':occupied?'occupied':'available';const label=isCurrent?`${slot.toUpperCase()} ✓`:occupied?`${slot.toUpperCase()} 🔒`:`${slot.toUpperCase()} +`;return `<button data-action="assign" data-skill-id="${skill.id}" data-slot="${slot}" class="${stateClass}" ${blocked?'disabled':''} aria-label="${isCurrent?skill.name+' đang ở ô '+slot.toUpperCase():occupied?'Ô '+slot.toUpperCase()+' đã có '+occupant.name:'Gán '+skill.name+' vào ô '+slot.toUpperCase()}" title="${isCurrent?'Chiêu này đang ở '+slot.toUpperCase():occupied?'Ô '+slot.toUpperCase()+' đã có '+occupant.name:'Ô trống · gán vào '+slot.toUpperCase()}">${label}</button>`;}).join('')}${assigned?`<button class="skill-remove" data-action="remove" data-skill-id="${skill.id}" data-slot="${assigned}">Gỡ ${skill.name} khỏi ${assigned.toUpperCase()}</button>`:''}</div>`:'';
    const requirement=tier?`Cấp chiêu ${tier}/${skill.maxTier}`:`${levelLocked||realmLocked?'🔒 ':''}Yêu cầu: ${requiredRealm} · Cấp ${skill.requiredLevel} · Giá ${skill.unlockCost} vàng${!affordable?' · Chưa đủ vàng':''}`;
    return `<article class="skill-node ${tier?'unlocked':'locked'} ${levelLocked||realmLocked?'realm-locked':''}"><i title="${skill.name}" style="--skill-color:${skillThemeColor(skill)}">${vietnameseSkillGlyph(skill)}</i><div><h3>${skill.name}</h3><p>${skill.description}</p>${combatStats?`<small class="skill-stats">${combatStats} · Tu vi ×${multiplier.toFixed(2)}</small>`:''}<small class="skill-requirement">${requirement}${assigned?` · Đang ở ${assigned.toUpperCase()}`:''}</small></div>${action}${assignment}</article>`;
  }).join('');
  return `${counters}<div class="skill-tree-grid">${skills}</div>`;
}

export class SkillTreePanel{
  constructor({app,hudManager,skillSystem,onChange=()=>{},onAction=null}={}){this.app=app;this.hudManager=hudManager;this.skillSystem=skillSystem;this.onChange=onChange;this.onAction=onAction;}
  ensure(){
    if(this.element)return this.element;
    const element=document.createElement('section');element.className='screen-overlay skill-tree-overlay';element.hidden=true;element.innerHTML='<div class="skill-tree-card"><header><div><small>TÂM PHÁP MÔN PHÁI</small><h2>Bảng Kỹ Năng</h2></div><button data-close aria-label="Đóng">×</button></header><div data-skill-tree-content></div></div>';
    this.app?.appendChild(element);this.hudManager?.register('skills',element);element.querySelector('[data-close]').onclick=()=>this.hudManager?.close('skills');
    element.addEventListener('click',event=>this.handleAction(event));this.element=element;this.render();return element;
  }
  async handleAction(event){
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const action=button.dataset.action,id=button.dataset.skillId,slot=button.dataset.slot;let changed=false;
    button.disabled=true;
    if(this.onAction)changed=await this.onAction({action,id,slot});
    else{
      if(action==='unlock')changed=this.skillSystem.unlock(id);
      if(action==='upgrade')changed=this.skillSystem.upgrade(id);
      if(action==='assign')changed=this.skillSystem.assign(slot,id);
      if(action==='remove')changed=this.skillSystem.unassign(slot);
    }
    if(changed){this.onChange({action,id,slot,state:this.skillSystem.serialize()});this.render();}
    else button.disabled=false;
  }
  render(){const element=this.ensure(),content=element.querySelector('[data-skill-tree-content]');if(content)content.innerHTML=skillTreePanelMarkup(this.skillSystem);return element;}
  toggle(force){this.ensure();const open=force??!this.hudManager?.isOpen('skills');if(open){this.render();return this.hudManager?.open('skills');}return this.hudManager?.close('skills');}
  destroy(){this.element?.remove();this.element=null;}
}
