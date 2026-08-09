import { io } from 'socket.io-client';

const url=process.env.GAME_URL||'http://127.0.0.1:3000';
const roomCode=`MECH-${Date.now().toString(36).slice(-6).toUpperCase()}`;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function emitAck(socket,event,payload,timeout=4_000){
  return new Promise((resolve,reject)=>socket.timeout(timeout).emit(event,payload,(error,response)=>{
    if(error)return reject(new Error(`${event} did not acknowledge`));
    if(!response?.ok)return reject(new Error(response?.error?.message||`${event} failed`));
    resolve(response);
  }));
}

function waitForEvent(socket,predicate,timeout=6_000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off('world:event',handler);reject(new Error('Expected gameplay event did not arrive'));},timeout);
    const handler=event=>{if(!predicate(event))return;clearTimeout(timer);socket.off('world:event',handler);resolve(event);};
    socket.on('world:event',handler);
  });
}

const socket=io(url,{transports:['websocket'],forceNew:true,timeout:5_000});
try{
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const joined=await emitAck(socket,'room:join',{roomCode,name:'Kiểm Thử Cơ Chế',faction:'heretic',session:{gold:500,cultivationSystem:{level:2,currentExp:200}}});
  const purchase=await emitAck(socket,'shop:action',{action:'buy',itemId:'healing_pill'});
  if(purchase.shopSystem.gold!==465||!purchase.shopSystem.inventory.includes('healing_pill'))throw new Error('Authoritative purchase snapshot was incorrect');

  for(let index=0;index<40;index++){
    socket.emit('player:move',{position:{x:-6,y:0,z:14.25},yaw:Math.PI,velocity:{x:0,z:-7.2},sequence:index+1});
    await delay(50);
  }

  const lootPromise=waitForEvent(socket,event=>event.type==='loot:granted'&&event.playerId===socket.id);
  const hits=[];
  for(let strike=0;strike<3;strike++){
    const attack=await emitAck(socket,'combat:ability',{ability:'basic',aim:{x:0,z:-1}});
    hits.push(...attack.hitIds);
    if(strike<2)await delay(480);
  }
  const lootEvent=await lootPromise;
  const cultivation=lootEvent.loot?.cultivationSystem;
  if(!(lootEvent.loot?.exp>0))throw new Error('Monster defeat did not emit an EXP drop');
  if(!(cultivation?.currentExp>200))throw new Error('Authoritative EXP did not increase');

  process.stdout.write(`${JSON.stringify({passed:true,roomCode,joinedGold:joined.player.gold,purchaseGold:purchase.shopSystem.gold,purchased:purchase.shopSystem.inventory,hitIds:hits,expDrop:lootEvent.loot.exp,cultivation},null,2)}\n`);
}finally{socket.disconnect();}
