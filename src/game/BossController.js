export class BossController {
  constructor({onDefeated}={}){this.onDefeated=onDefeated;this.defeated=new Set();}
  handle(event,enemies){if(event?.type!=='enemy:defeated'||this.defeated.has(event.enemyId))return false;const enemy=enemies.get(event.enemyId);if(!enemy?.isBoss)return false;this.defeated.add(event.enemyId);this.onDefeated?.(enemy);return true;}
  respawn(enemyId){this.defeated.delete(enemyId);}
}
