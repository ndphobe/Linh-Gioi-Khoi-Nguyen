import { CULTIVATION_REALMS, HOTBAR_SLOTS } from '../SkillSystem.js';

export function skillTreePanelMarkup(system){
  const counters=`<div class="skill-tree-summary"><span>Điểm Mở Khóa Chiêu: <b>${system.skillUnlockPoints}</b></span><span>Điểm Nâng Cấp Chiêu: <b>${system.skillUpgradePoints}</b></span></div>`;
  const skills=system.tree.map(skill=>{
    const tier=system.unlocked[skill.id]??0,assigned=system.slotForSkill(skill.id),realmLocked=!system.canUnlock(skill.id)&&!tier&&system.skillUnlockPoints>0;
    const requiredRealm=CULTIVATION_REALMS.find(realm=>realm.id===skill.requiredRealm)?.name??skill.requiredRealm;
    const action=tier
      ? `<button class="skill-node__upgrade" data-action="upgrade" data-skill-id="${skill.id}" aria-label="Nâng cấp ${skill.name}" ${system.canUpgrade(skill.id)?'':'disabled'}>+</button>`
      : `<button data-action="unlock" data-skill-id="${skill.id}" ${system.canUnlock(skill.id)?'':'disabled'}>Mở Khóa</button>`;
    const assignment=tier?`<div class="skill-assign">${HOTBAR_SLOTS.map(slot=>`<button data-action="assign" data-skill-id="${skill.id}" data-slot="${slot}" class="${assigned===slot?'active':''}">${slot.toUpperCase()}</button>`).join('')}${assigned?`<button data-action="remove" data-slot="${assigned}">Gỡ</button>`:''}</div>`:'';
    return `<article class="skill-node ${tier?'unlocked':'locked'} ${realmLocked?'realm-locked':''}"><i>${skill.icon}</i><div><h3>${skill.name}</h3><p>${skill.description}</p><small>${tier?`Cấp ${tier}/${skill.maxTier}`:`Chưa mở khóa · ${requiredRealm}`}${assigned?` · Đang ở ${assigned.toUpperCase()}`:''}</small></div>${action}${assignment}</article>`;
  }).join('');
  return `${counters}<div class="skill-tree-grid">${skills}</div>`;
}

export class SkillTreePanel{
  constructor({app,hudManager,skillSystem,onChange=()=>{}}={}){this.app=app;this.hudManager=hudManager;this.skillSystem=skillSystem;this.onChange=onChange;}
  ensure(){
    if(this.element)return this.element;
    const element=document.createElement('section');element.className='screen-overlay skill-tree-overlay';element.hidden=true;element.innerHTML='<div class="skill-tree-card"><header><div><small>TÂM PHÁP MÔN PHÁI</small><h2>Bảng Kỹ Năng</h2></div><button data-close aria-label="Đóng">×</button></header><div data-skill-tree-content></div></div>';
    this.app?.appendChild(element);this.hudManager?.register('skills',element);element.querySelector('[data-close]').onclick=()=>this.hudManager?.close('skills');
    element.addEventListener('click',event=>this.handleAction(event));this.element=element;this.render();return element;
  }
  handleAction(event){
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const action=button.dataset.action,id=button.dataset.skillId,slot=button.dataset.slot;let changed=false;
    if(action==='unlock')changed=this.skillSystem.unlock(id);
    if(action==='upgrade')changed=this.skillSystem.upgrade(id);
    if(action==='assign')changed=this.skillSystem.assign(slot,id);
    if(action==='remove')changed=this.skillSystem.unassign(slot);
    if(changed){this.onChange({action,id,slot,state:this.skillSystem.serialize()});this.render();}
  }
  render(){const element=this.ensure(),content=element.querySelector('[data-skill-tree-content]');if(content)content.innerHTML=skillTreePanelMarkup(this.skillSystem);return element;}
  toggle(force){this.ensure();const open=force??!this.hudManager?.isOpen('skills');if(open){this.render();return this.hudManager?.open('skills');}return this.hudManager?.close('skills');}
  destroy(){this.element?.remove();this.element=null;}
}
