const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const PLAYER_RADIUS=.055;
const MOVE_SPEED=1.35;
const FACTION_ROW=Object.freeze({orthodox:0,demonic:1,heretic:2});

export class TribulationScreen {
  constructor({app,socket,keys,faction='orthodox',spriteSrc='/assets/sect-character-atlas.png'}){
    this.app=app;this.socket=socket;this.keys=keys;this.faction=faction;
    this.active=false;this.dodgeX=0;this.wave=0;this.hits=0;this.maxHits=3;this.targetRealmId='nascent_soul';
    this.telegraph=null;this.lastStrike=null;this.netAccumulator=0;this.lastDirection=0;this.finishTimer=null;
    this.background=new Image();this.background.src='/assets/tribulation-arena.png';
    this.sprite=new Image();this.sprite.src=spriteSrc;
    this.create();
  }
  create(){
    const el=document.createElement('section');el.className='screen-overlay tribulation-overlay';el.hidden=true;
    el.innerHTML=`<canvas class="tribulation-canvas" width="960" height="540" aria-label="Đấu trường lôi kiếp"></canvas><div class="tribulation-hud"><div><small data-tier>ĐẠI LÔI KIẾP</small><h2 data-title>Đột Phá Nguyên Anh</h2></div><div class="tribulation-stats"><strong data-wave>Đợt 0 / 10</strong><span data-hits>Trúng 0 / 3</span></div></div><div class="tribulation-controls"><kbd>A</kbd><span>Di chuyển né sét</span><kbd>D</kbd></div><div class="tribulation-result" data-result hidden></div>`;
    this.app?.appendChild(el);this.element=el;this.canvas=el.querySelector('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
  }
  show(state={}){clearTimeout(this.finishTimer);this.active=true;this.element.hidden=false;this.element.classList.toggle('is-ascension',state.targetRealmId==='spirit_transformation');this.sync(state,true);this.element.querySelector('[data-result]').hidden=true;}
  hide(){clearTimeout(this.finishTimer);this.active=false;this.element.hidden=true;this.telegraph=null;this.lastStrike=null;}
  finish(outcome,state={}){
    if(!this.element||this.element.hidden)return;
    this.active=false;this.sync(state);
    const result=this.element.querySelector('[data-result]');
    const success=outcome==='success';result.className=`tribulation-result ${success?'is-success':'is-failure'}`;result.innerHTML=success?'<strong>ĐỘ KIẾP THÀNH CÔNG</strong><span>Thiên môn đã mở</span>':'<strong>ĐỘ KIẾP THẤT BẠI</strong><span>Cảnh giới bị tổn thương</span>';result.hidden=false;
    this.finishTimer=setTimeout(()=>this.hide(),1500);
  }
  sync(state={},snap=false){
    if(Number.isFinite(Number(state.dodgeX)))this.dodgeX=snap?Number(state.dodgeX):this.dodgeX+(Number(state.dodgeX)-this.dodgeX)*.22;
    if(Number.isFinite(Number(state.wave)))this.wave=Number(state.wave);
    if(Number.isFinite(Number(state.hits)))this.hits=Number(state.hits);
    if(Number.isFinite(Number(state.maxHits)))this.maxHits=Number(state.maxHits);
    if(state.targetRealmId)this.targetRealmId=state.targetRealmId;
    if(state.telegraph)this.telegraph={...state.telegraph};
    this.refreshHud();
  }
  refreshHud(){
    const ascension=this.targetRealmId==='spirit_transformation';
    const title=this.element.querySelector('[data-title]'),tier=this.element.querySelector('[data-tier]'),wave=this.element.querySelector('[data-wave]'),hits=this.element.querySelector('[data-hits]');
    if(title)title.textContent=ascension?'Đột Phá Hóa Thần':'Đột Phá Nguyên Anh';if(tier)tier.textContent=ascension?'CỬU THIÊN HÓA THẦN KIẾP':'ĐẠI LÔI KIẾP';
    if(wave)wave.textContent=`Đợt ${this.wave} / 10`;if(hits){hits.textContent=`Trúng ${this.hits} / ${this.maxHits}`;hits.classList.toggle('is-danger',this.hits>=this.maxHits);}
  }
  onTelegraph(event){this.telegraph={strikeX:Number(event.strikeX)||0,radius:Number(event.radius)||.13,resolveAt:Number(event.resolveAt)||Date.now()+1_000};this.sync(event);}
  onStrike(event){this.telegraph=null;this.lastStrike={strikeX:Number(event.strikeX)||0,hit:Boolean(event.hit),intensity:Number(event.intensity)||1,until:performance.now()+520};this.sync(event);}
  update(dt){
    if(!this.active)return;
    const direction=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    this.dodgeX=clamp(this.dodgeX+direction*MOVE_SPEED*dt,-1,1);
    this.netAccumulator+=dt;
    if(this.netAccumulator>=.05||direction!==this.lastDirection){this.netAccumulator=0;this.lastDirection=direction;this.socket?.emit('breakthrough:move',{direction});}
    this.render(performance.now());
  }
  render(now){
    if(!this.ctx||this.element.hidden)return;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);
    if(this.background.complete&&this.background.naturalWidth)c.drawImage(this.background,0,0,w,h);else{c.fillStyle='#080d27';c.fillRect(0,0,w,h);}
    const left=w*.14,right=w*.86,half=(right-left)/2,center=(left+right)/2,ground=h*.80,toX=value=>center+clamp(value,-1,1)*half;
    c.save();c.fillStyle='rgba(3,6,18,.24)';c.fillRect(0,0,w,h);c.restore();
    if(this.telegraph){
      const x=toX(this.telegraph.strikeX),radius=this.telegraph.radius*half,pulse=.68+.2*Math.sin(now*.018),remaining=clamp((this.telegraph.resolveAt-Date.now())/1_150,0,1);
      c.save();c.globalAlpha=pulse;c.fillStyle='rgba(255,34,64,.27)';c.strokeStyle='#ff3659';c.lineWidth=4;c.setLineDash([10,7]);c.fillRect(x-radius,0,radius*2,ground+9);c.strokeRect(x-radius,2,radius*2,ground+7);c.setLineDash([]);c.fillStyle='rgba(255,48,75,.48)';c.beginPath();c.ellipse(x,ground,radius,18,0,0,Math.PI*2);c.fill();c.strokeStyle='#fff0a8';c.lineWidth=5;c.beginPath();c.arc(x,ground,Math.max(8,radius*remaining),0,Math.PI*2);c.stroke();c.fillStyle='#fff3c2';c.font='bold 15px monospace';c.textAlign='center';c.fillText('HITBOX',x,ground-26);c.restore();
    }
    if(this.lastStrike&&now<this.lastStrike.until)this.drawLightning(toX(this.lastStrike.strikeX),ground,this.lastStrike,now);
    this.drawCharacter(toX(this.dodgeX),ground,now);
    c.save();c.strokeStyle='rgba(112,226,255,.65)';c.lineWidth=2;c.beginPath();c.ellipse(toX(this.dodgeX),ground,PLAYER_RADIUS*half,8,0,0,Math.PI*2);c.stroke();c.restore();
    c.fillStyle='rgba(5,8,20,.32)';for(let y=0;y<h;y+=3)c.fillRect(0,y,w,1);
  }
  drawCharacter(x,ground,now){const c=this.ctx,row=FACTION_ROW[this.faction]??0,moving=this.keys.has('KeyA')||this.keys.has('KeyD'),frame=moving?1:0,size=138;if(this.sprite.complete&&this.sprite.naturalWidth){const sw=this.sprite.naturalWidth/4,sh=this.sprite.naturalHeight/3;c.save();if(this.keys.has('KeyA')){c.translate(x*2,0);c.scale(-1,1);}c.drawImage(this.sprite,frame*sw,row*sh,sw,sh,Math.round(x-size/2),Math.round(ground-size*.82),size,size);c.restore();}else{c.fillStyle='#dbeaff';c.fillRect(x-16,ground-55,32,55);}if(moving){c.fillStyle='rgba(115,225,255,.35)';c.fillRect(x-24,ground+4,48,3);}}
  drawLightning(x,ground,strike,now){const c=this.ctx,life=clamp((strike.until-now)/520,0,1),color=strike.hit?'#ff4164':'#dffbff';c.save();c.globalAlpha=.55+life*.45;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=24*strike.intensity;c.lineWidth=7*strike.intensity;c.beginPath();c.moveTo(x+(Math.random()-.5)*18,0);for(let y=20;y<ground;y+=32)c.lineTo(x+(Math.random()-.5)*42,y);c.lineTo(x,ground);c.stroke();c.globalAlpha=life*.38;c.fillStyle=color;c.beginPath();c.ellipse(x,ground,70*strike.intensity*(1-life+.35),22,0,0,Math.PI*2);c.fill();c.restore();}
  destroy(){clearTimeout(this.finishTimer);this.element?.remove();}
}
