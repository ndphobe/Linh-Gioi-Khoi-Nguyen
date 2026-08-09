export class SaveSystem{
  constructor(storage,key='van-kiep-tu-tien:characters:v2'){this.storage=storage;this.key=key;}
  load(){try{const value=JSON.parse(this.storage?.getItem(this.key)??'null');return value&&typeof value==='object'?value:{activeCharacterId:null,characters:{}};}catch{return {activeCharacterId:null,characters:{}};}}
  save(state){const safe=JSON.parse(JSON.stringify(state));try{this.storage?.setItem(this.key,JSON.stringify(safe));}catch{/* Private/sandboxed browsers may deny storage; keep the current session playable. */}return safe;}
}
