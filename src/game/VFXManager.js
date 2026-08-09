import { getSectCombatData } from './SectData.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PROJECTILES=new Set(['swordWave','bloodSlash','bloodFlame','venomBlade','venomDart','flyingSwords','serpentFang','boneSpear','ghostNeedles','nineHeavenThunder','bloodRavens','jadeFireToad']);
const TARGET_AREAS=new Set(['swordRain','holyBeam','demonChains','crimsonNova','poisonMist','starfallBlade','voidSwordPrison','primordialSword','hellfireLotus','bloodMoon','corpseMoths','netherSerpent','dipperArray','azureLotusRain','yinYangWheel','celestialGate','boneGhostGate','infernoDragon','myriadSoulBanner','worldBloodTide','skySpiderWeb','corpsePlagueWind','nineNetherSnakes','venomBurial']);
const TEXTURES=Object.freeze({
  swordWave:['orthodox-basic.png',82,true],flyingSwords:['orthodox-q.png',104,true],swordRain:['orthodox-e.png',190,false],holyBeam:['orthodox-r.png',170,false],goldBarrier:['orthodox-f.png',132,false],myriadSwords:['orthodox-g.png',230,false],
  bloodSlash:['demonic-basic.png',82,true],bloodFlame:['demonic-q.png',96,true],demonChains:['demonic-e.png',176,false],bloodReaver:['demonic-r.png',146,true],crimsonNova:['demonic-f.png',184,false],abyssBurst:['demonic-g.png',234,false],
  venomBlade:['heretic-basic.png',78,true],venomDart:['heretic-q.png',106,true],poisonMist:['heretic-e.png',188,false],shadowStep:['heretic-r.png',142,true],serpentFang:['heretic-f.png',132,true],toxicSkulls:['heretic-g.png',234,false],
  starfallBlade:['orthodox-starfall.png',196,false],voidSwordPrison:['orthodox-void-prison.png',220,false],primordialSword:['orthodox-primordial.png',252,false],
  boneSpear:['demonic-bone-spear.png',152,true],hellfireLotus:['demonic-hell-lotus.png',220,false],bloodMoon:['demonic-blood-moon.png',260,false],
  ghostNeedles:['heretic-ghost-needles.png',158,true],corpseMoths:['heretic-corpse-moths.png',224,false],netherSerpent:['heretic-nether-serpent.png',258,false],
  dipperArray:['orthodox-dipper-array.png',220,false],azureLotusRain:['orthodox-azure-lotus-rain.png',228,false],nineHeavenThunder:['orthodox-nine-heaven-thunder.png',180,true],yinYangWheel:['orthodox-yin-yang-wheel.png',246,false],celestialGate:['orthodox-celestial-gate.png',286,false],
  bloodRavens:['demonic-blood-ravens.png',170,true],boneGhostGate:['demonic-bone-ghost-gate.png',232,false],infernoDragon:['demonic-inferno-dragon.png',246,false],myriadSoulBanner:['demonic-myriad-soul-banner.png',260,false],worldBloodTide:['demonic-world-blood-tide.png',292,false],
  jadeFireToad:['heretic-jade-fire-toad.png',176,true],skySpiderWeb:['heretic-sky-spider-web.png',232,false],corpsePlagueWind:['heretic-corpse-plague-wind.png',244,false],nineNetherSnakes:['heretic-nine-nether-snakes.png',266,false],venomBurial:['heretic-venom-burial.png',294,false],
});

export class VFXManager{
  constructor({screen,audio,collisionTest}={}){this.screen=screen;this.audio=audio;this.collisionTest=collisionTest;this.effects=[];this.textures=new Map();if(globalThis.Image)for(const [style,[file]] of Object.entries(TEXTURES)){const image=new Image();image.src=`/assets/vfx/${file}`;this.textures.set(style,image);}}

  cast({faction,slot,style:requestedStyle,origin,direction,target,maxRange,hitboxWidth,confirmedHitIds=[]}){
    const sect=getSectCombatData(faction),style=TEXTURES[requestedStyle]?requestedStyle:sect.vfx[slot]??sect.vfx.basic;
    this.audio?.play(sect.sound);
    const long=style.includes('Mist')||style.includes('Skulls'),duration=long?1.8:.82;
    const fallbackRange=Math.hypot((target?.x??origin.x)-origin.x,(target?.z??origin.z)-origin.z);
    const range=Math.max(0,Number.isFinite(Number(maxRange))?Number(maxRange):fallbackRange);
    const magnitude=Math.hypot(direction.x,direction.z)||1,dx=direction.x/magnitude,dz=direction.z/magnitude;
    const tx=Number.isFinite(Number(target?.x))?Number(target.x):origin.x+dx*range,tz=Number.isFinite(Number(target?.z))?Number(target.z):origin.z+dz*range;
    const base={style,faction,x:origin.x,z:origin.z,originX:origin.x,originZ:origin.z,dx,dz,tx,tz,life:duration,max:duration,colors:[sect.primary,sect.secondary,sect.accent],seed:Math.random(),maxRange:range,travelled:0,speed:13,hitboxWidth:Math.max(.1,Number(hitboxWidth)||1),hitIds:new Set(),confirmedHitIds:new Set(confirmedHitIds)};
    if(TARGET_AREAS.has(style)){base.x=tx;base.z=tz;}
    if(PROJECTILES.has(style))base.life=base.max=range/base.speed+.08;
    this.effects.push(base);
    return style;
  }

  update(dt){
    const delta=Math.max(0,Math.min(.1,Number(dt)||0)),impacts=[];
    for(let i=this.effects.length-1;i>=0;i--){
      const e=this.effects[i];e.life-=delta;
      if(e.kind==='impact'){if(e.life<=0)this.effects.splice(i,1);continue;}
      if(PROJECTILES.has(e.style)){
        const remaining=Math.max(0,e.maxRange-e.travelled),distance=Math.min(remaining,e.speed*delta);
        const steps=Math.max(1,Math.ceil(distance/Math.max(.25,e.hitboxWidth*.5)));
        let collided=null;
        for(let step=1;step<=steps;step++){
          const travelled=e.travelled+distance*(step/steps),position={x:e.originX+e.dx*travelled,z:e.originZ+e.dz*travelled};
          const candidate=this.collisionTest?.(e,position)??null;
          collided=candidate?.id&&e.confirmedHitIds.has(candidate.id)?candidate:null;
          e.x=position.x;e.z=position.z;
          if(collided)break;
        }
        e.travelled=Math.min(e.maxRange,Math.hypot(e.x-e.originX,e.z-e.originZ));
        if(collided||e.travelled+1e-7>=e.maxRange){
          if(collided?.id)e.hitIds.add(collided.id);
          if(collided)impacts.push(this.createImpact(e,true));
          this.effects.splice(i,1);
          continue;
        }
      }
      if(e.life<=0)this.effects.splice(i,1);
    }
    this.effects.push(...impacts);
  }

  createImpact(effect,collided=false){return{...effect,kind:'impact',style:`${effect.style}Impact`,life:.24,max:.24,collided,seed:Math.random(),hitIds:new Set()};}

  renderTexture(ctx,e,p,t,age,angle){
    const baseStyle=e.style.replace(/Impact$/,''),definition=TEXTURES[baseStyle],image=this.textures.get(baseStyle);
    if(!definition||!image?.complete||!image.naturalWidth)return false;
    const [,baseSize,directional]=definition,size=baseSize*(e.kind==='impact'?.62:1)*(1+age*(e.kind==='impact'?.35:.08));
    ctx.translate(Math.round(p.x),Math.round(p.y-12));if(directional)ctx.rotate(angle);
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,t*1.7)*(e.kind==='impact'?.8:1);
    ctx.drawImage(image,-size/2,-size/2,size,size);return true;
  }

  pixelLine(ctx,x1,y1,x2,y2,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(x1),Math.round(y1));ctx.lineTo(Math.round(x2),Math.round(y2));ctx.stroke();}

  renderSword(ctx,e,p,t,age,angle){
    ctx.translate(Math.round(p.x),Math.round(p.y-12+(e.offset??0)*7));ctx.rotate(angle);
    ctx.lineCap='square';ctx.shadowBlur=0;
    ctx.strokeStyle=e.colors[0];ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,22+age*20,-1.05,1.05);ctx.stroke();
    ctx.strokeStyle=e.colors[2];ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#efffff';ctx.fillRect(10,-2,26,3);
    for(let i=0;i<3;i++){ctx.globalAlpha=t*(1-i*.25);ctx.fillStyle=i===1?e.colors[2]:e.colors[0];ctx.fillRect(-10-i*7,(i-1)*6,8,3);}
  }

  renderDemonic(ctx,e,p,t,age,angle){
    if(e.style==='bloodSlash'||e.style==='bloodReaver'){
      ctx.translate(p.x,p.y-10);ctx.rotate(angle);ctx.strokeStyle='#ff244c';ctx.lineWidth=e.style==='bloodReaver'?10:6;ctx.beginPath();ctx.arc(0,0,18+age*30,-1.2,1.2);ctx.stroke();ctx.strokeStyle='#5e0828';ctx.lineWidth=3;ctx.stroke();
    }else if(e.style==='demonChains'){
      const target=this.screen({x:e.tx,z:e.tz});ctx.strokeStyle=e.colors[0];ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(p.x,p.y-10);ctx.lineTo(target.x,target.y-8);ctx.stroke();ctx.setLineDash([]);
    }else{
      ctx.translate(Math.round(p.x),Math.round(p.y));ctx.fillStyle=age>.55?'#2a0615':e.colors[0];ctx.globalAlpha=t*.58;ctx.beginPath();ctx.arc(0,0,16+age*52,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff3458';ctx.lineWidth=3;for(let i=0;i<6;i++){const a=i*Math.PI/3+e.seed;this.pixelLine(ctx,Math.cos(a)*8,Math.sin(a)*5,Math.cos(a)*(26+age*34),Math.sin(a)*(15+age*22),i%2?e.colors[1]:e.colors[0],3);}ctx.strokeStyle='#15050b';ctx.beginPath();ctx.ellipse(0,3,22+age*24,8+age*10,0,0,Math.PI*2);ctx.stroke();
    }
  }

  renderHeretic(ctx,e,p,t,age,angle){
    if(/venomBlade|venomDart|serpentFang/.test(e.style)){
      ctx.translate(p.x,p.y-11);ctx.rotate(angle);ctx.strokeStyle='#65ff66';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-18,5);ctx.quadraticCurveTo(0,-18,28,0);ctx.stroke();ctx.strokeStyle='#9b52e4';ctx.lineWidth=3;ctx.stroke();
    }else if(e.style==='shadowStep'){
      ctx.fillStyle='#6f35ba';ctx.globalAlpha=t*.55;ctx.beginPath();ctx.ellipse(p.x-e.dx*age*65,p.y-e.dz*age*40-13,17,27,0,0,Math.PI*2);ctx.fill();this.pixelLine(ctx,p.x-13,p.y-12,p.x+13,p.y-12,'#77ff72',2);
    }else{
      const target=this.screen({x:e.tx+(e.offset??0),z:e.tz+(e.offset??0)});ctx.fillStyle=e.colors[Math.floor((e.seed??0)*3)];ctx.globalAlpha=.13+t*.38;ctx.beginPath();ctx.arc(target.x,target.y-8,17+age*36,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){ctx.globalAlpha=t;ctx.fillStyle=i%2?'#9b52e4':'#68f06a';ctx.fillRect(Math.round(target.x+Math.sin(i*2.2+age*7)*23)-3,Math.round(target.y-13-Math.cos(i+age*6)*17)-3,6,6);}
    }
  }

  render(ctx){
    for(const e of this.effects){const p=this.screen(e),t=clamp(e.life/e.max,0,1),age=1-t,angle=Math.atan2(e.dz,e.dx);ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=Math.min(1,t*1.6);ctx.lineJoin='miter';
      if(this.renderTexture(ctx,e,p,t,age,angle)){ctx.restore();continue;}
      if(e.kind==='impact'){ctx.translate(Math.round(p.x),Math.round(p.y-10));ctx.strokeStyle=e.colors[2];ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,4+age*20,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+e.seed;ctx.fillStyle=i%2?e.colors[0]:e.colors[2];ctx.fillRect(Math.round(Math.cos(a)*(6+age*24))-2,Math.round(Math.sin(a)*(4+age*16))-2,4,4);}ctx.restore();continue;}
      if(e.faction==='orthodox'){
        if(e.style==='holyBeam'){ctx.fillStyle=e.colors[2];ctx.globalAlpha=t*.72;ctx.fillRect(Math.round(p.x-7),Math.round(p.y-112),14,112);ctx.fillStyle='#fff';ctx.fillRect(Math.round(p.x-2),Math.round(p.y-126),4,126);}
        else if(e.style==='goldBarrier'){ctx.strokeStyle=e.colors[2];ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,p.y-12,30+age*8,18+age*4,0,0,Math.PI*2);ctx.stroke();}
        else this.renderSword(ctx,e,p,t,age,angle);
      }else if(e.faction==='demonic')this.renderDemonic(ctx,e,p,t,age,angle);
      else this.renderHeretic(ctx,e,p,t,age,angle);
      ctx.restore();
    }
  }

  clear(){this.effects.length=0;}
}
