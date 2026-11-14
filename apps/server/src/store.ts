import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {State} from '@yutverse/engine';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export class Store {
 readonly db:DatabaseSync;
 constructor(path:string){
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL);
   CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,finished_at TEXT NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS participants(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),rank INTEGER NOT NULL,points INTEGER NOT NULL,forfeited INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));
   CREATE TABLE IF NOT EXISTS augment_choices(match_id TEXT NOT NULL,user_id TEXT NOT NULL,id TEXT NOT NULL,turn INTEGER NOT NULL,chosen_at INTEGER NOT NULL,PRIMARY KEY(match_id,user_id,id));`);
 }
 createUser(name:string){const token=randomBytes(32).toString('hex'),id=randomUUID();this.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,name,hash(token));return {id,name,token};}
 user(token:unknown):{id:string;name:string}|null{if(typeof token!=='string'||token.length!==64)return null;return (this.db.prepare('SELECT id,name FROM users WHERE token_hash=?').get(hash(token)) as {id:string;name:string}|undefined)||null;}
 saveRoom(room:{code:string;state:State|null;members:{id:string}[];matchId:string}){
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('INSERT INTO rooms VALUES(?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data').run(room.code,JSON.stringify(room));
   if(room.state){for(const c of room.state.choices)this.db.prepare('INSERT OR IGNORE INTO augment_choices VALUES(?,?,?,?,?)').run(room.matchId,room.members[c.player].id,c.id,c.turn,c.at);}
   if(room.state?.phase==='over'){
    const saved=this.db.prepare('INSERT OR IGNORE INTO matches VALUES(?,?,?)').run(room.matchId,new Date().toISOString(),JSON.stringify(room.state));
    if(saved.changes){room.state.ranks.forEach((player,index)=>{const points=room.members.length===2?[20,0][index]:room.members.length===3?[30,10,0][index]:[40,20,5,0][index];this.db.prepare('INSERT INTO participants VALUES(?,?,?,?,?)').run(room.matchId,room.members[player].id,index+1,points,room.state!.forfeited.includes(player)?1:0);});}
   }
   this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 rooms():unknown[]{return this.db.prepare('SELECT data FROM rooms').all().map(row=>JSON.parse(row.data as string));}
 removeRoom(code:string){this.db.prepare('DELETE FROM rooms WHERE code=?').run(code);}
 leaderboard(season?:string){return this.db.prepare(`SELECT u.id,u.name,SUM(p.points) AS points,COUNT(*) AS games,SUM(CASE WHEN p.rank=1 THEN 1 ELSE 0 END) AS wins FROM participants p JOIN users u ON u.id=p.user_id JOIN matches m ON m.id=p.match_id WHERE (? IS NULL OR substr(m.finished_at,1,7)=?) GROUP BY u.id ORDER BY points DESC,wins DESC,u.id LIMIT 100`).all(season||null,season||null);}
 history(id:string){return this.db.prepare('SELECT m.id,m.finished_at,p.rank,p.points,p.forfeited FROM participants p JOIN matches m ON m.id=p.match_id WHERE p.user_id=? ORDER BY m.finished_at DESC LIMIT 50').all(id);}
 close(){this.db.close();}
}
