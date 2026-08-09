const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const point=value=>({x:Number(value?.x)||0,y:Number(value?.y)||0,z:Number(value?.z)||0});

export const MONSTER_ATTACK_PROFILES=Object.freeze({
  spirit_fox:Object.freeze({type:'claw-swipe',vfx:'claw',kind:'melee',windupMs:420,radius:1.05,sound:'monster-claw'}),
  spirit_wolf:Object.freeze({type:'feral-claw',vfx:'claw',kind:'melee',windupMs:520,radius:1.35,sound:'monster-claw'}),
  flame_imp:Object.freeze({type:'dark-fireball',vfx:'dark-projectile',kind:'projectile',windupMs:680,radius:1.0,sound:'monster-magic'}),
  rogue_cultivator:Object.freeze({type:'shadow-bolt',vfx:'dark-projectile',kind:'projectile',windupMs:760,radius:1.15,sound:'monster-magic'}),
  fallen_guardian:Object.freeze({type:'falling-blade',vfx:'shockwave',kind:'boss',windupMs:850,radius:3.1,sound:'monster-impact'}),
});

const BOSS_VARIANTS=Object.freeze({
  'falling-blade':Object.freeze({type:'falling-blade',vfx:'blade-impact',kind:'boss',windupMs:850,radius:3.1,sound:'monster-impact'}),
  'thunder-nova':Object.freeze({type:'thunder-nova',vfx:'shockwave',kind:'boss',windupMs:1100,radius:5.4,sound:'thunder'}),
});

export function monsterAttackFor(monsterType,variant){return BOSS_VARIANTS[variant]??MONSTER_ATTACK_PROFILES[monsterType]??MONSTER_ATTACK_PROFILES.spirit_wolf;}

export class Monster{
  constructor(snapshot={},animator=null){this.animator=animator;this.attackVisual=null;this.impactVisual=null;this.sync(snapshot);}

  sync(snapshot={},now=globalThis.performance?.now?.()??0,epoch=Date.now()){
    const previousResolve=this.pendingAttack?.resolveAt;
    Object.assign(this,snapshot);
    this.position=point(snapshot.position??this.position);
    this.target=point(snapshot.target??snapshot.position??this.target??this.position);
    if(snapshot.pendingAttack&&snapshot.pendingAttack.resolveAt!==previousResolve)this.beginAttack(snapshot.pendingAttack,now,epoch);
    if(!snapshot.pendingAttack&&this.attackVisual?.resolveAtEpoch>epoch+25)this.attackVisual=null;
    return this;
  }

  beginAttack(event={},now=globalThis.performance?.now?.()??0,epoch=Date.now()){
    const profile=monsterAttackFor(this.type,event.attack??event.type),resolveAtEpoch=Number(event.resolveAt)||epoch+profile.windupMs;
    const duration=Math.max(80,resolveAtEpoch-epoch),remaining=Math.max(0,resolveAtEpoch-epoch);
    this.attackVisual={profile,origin:point(event.origin??this.position),position:point(event.position??this.position),radius:Number(event.radius)||profile.radius,startedAt:now-Math.max(0,duration-remaining),resolveAt:now+remaining,resolveAtEpoch,duration};
    return this.attackVisual;
  }

  resolveAttack(event={},now=globalThis.performance?.now?.()??0){
    const profile=monsterAttackFor(this.type,event.attack);
    this.impactVisual={profile,position:point(event.position??this.attackVisual?.position??this.position),radius:Number(event.radius)||profile.radius,startedAt:now,endsAt:now+280,hitIds:[...(event.hitIds??[])]};
    this.attackVisual=null;
    return this.impactVisual;
  }

  updateAttackVisual(now=globalThis.performance?.now?.()??0){if(this.impactVisual&&now>=this.impactVisual.endsAt)this.impactVisual=null;}

  attackFrame(){return this.animator?.frame??0;}

  renderAttackVFX(ctx,screen,now=globalThis.performance?.now?.()??0){
    this.updateAttackVisual(now);
    const attack=this.attackVisual;
    if(attack){
      const progress=clamp(1-(attack.resolveAt-now)/Math.max(1,attack.duration),0,1),target=screen(attack.position),origin=screen(attack.origin);
      ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='rgba(255,35,55,.10)';ctx.strokeStyle=`rgba(255,55,72,${.32+progress*.56})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(target.x,target.y,attack.radius*18,attack.radius*12,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(attack.profile.vfx==='claw'){
        ctx.strokeStyle=`rgba(255,72,78,${.35+progress*.65})`;ctx.lineWidth=3;
        for(let index=-1;index<=1;index++){ctx.beginPath();ctx.arc(target.x+index*5,target.y-8,10+progress*16,-2.2,-.2);ctx.stroke();}
      }else if(attack.profile.vfx==='dark-projectile'){
        const x=origin.x+(target.x-origin.x)*progress,y=origin.y+(target.y-origin.y)*progress;
        ctx.fillStyle='#7e35c9';ctx.shadowColor='#dc315d';ctx.shadowBlur=8;ctx.fillRect(Math.round(x-5),Math.round(y-10),10,10);ctx.fillStyle='#ff3b61';ctx.fillRect(Math.round(x-2),Math.round(y-7),4,4);
      }else{
        ctx.strokeStyle=attack.profile.vfx==='blade-impact'?'#e9c06b':'#ff405d';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(target.x,target.y,attack.radius*18*progress,attack.radius*12*progress,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    const impact=this.impactVisual;
    if(impact){
      const progress=clamp((now-impact.startedAt)/(impact.endsAt-impact.startedAt),0,1),target=screen(impact.position);
      ctx.save();ctx.globalAlpha=1-progress;ctx.strokeStyle=impact.profile.vfx==='dark-projectile'?'#a84cff':'#ff534f';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(target.x,target.y,5+impact.radius*18*progress,3+impact.radius*12*progress,0,0,Math.PI*2);ctx.stroke();
      for(let index=0;index<7;index++){const angle=index*Math.PI*2/7;ctx.fillStyle=index%2?'#ffce74':'#ff4059';ctx.fillRect(Math.round(target.x+Math.cos(angle)*(8+progress*24))-2,Math.round(target.y+Math.sin(angle)*(5+progress*16))-2,4,4);}ctx.restore();
    }
  }
}
