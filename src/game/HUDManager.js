export class HUDManager {
  constructor(onChange = () => {}) { this.overlays = new Map(); this.active = null; this.onChange = onChange; }
  bindCurrency(name,element){this.currencyElements??=new Map();if(element)this.currencyElements.set(name,element);}
  updateCurrency(name,value){const element=this.currencyElements?.get(name);if(element)element.textContent=Math.max(0,Math.floor(Number(value)||0)).toLocaleString('vi-VN');}
  updateSkillCooldown(button,visual,{insufficientMana=false}={}){if(!button)return;let timer=button.querySelector('.skill-slot__timer');if(!timer){timer=document.createElement('span');timer.className='skill-slot__timer';button.appendChild(timer);}button.style.setProperty('--cooldown-angle',`${visual.angle}deg`);button.classList.toggle('is-cooling-down',visual.coolingDown);button.classList.toggle('is-mana-starved',!visual.coolingDown&&insufficientMana);button.disabled=visual.coolingDown;timer.textContent=visual.label;timer.hidden=!visual.coolingDown;}
  pulseSkillReady(button){if(!button)return;button.classList.remove('cooldown-ready-pulse');void button.offsetWidth;button.classList.add('cooldown-ready-pulse');setTimeout(()=>button.classList.remove('cooldown-ready-pulse'),650);}
  register(name, element) { if (element) this.overlays.set(name, element); this.sync(); }
  isOpen(name) { return this.active === name; }
  open(name) { if (!this.overlays.has(name)) return false; this.active = name; this.sync(); return true; }
  close(name = this.active) { if (!name || this.active !== name) return false; this.active = null; this.sync(); return true; }
  closeAll() { if (!this.active) return false; this.active = null; this.sync(); return true; }
  toggle(name) { return this.isOpen(name) ? this.close(name) : this.open(name); }
  sync() { for (const [name, element] of this.overlays) { const open = name === this.active; element.hidden = !open; element.classList.toggle('is-open', open); } this.onChange(this.active); }
}
