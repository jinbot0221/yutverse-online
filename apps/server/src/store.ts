import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {State} from '@yutverse/engine';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const derive=promisify(scrypt);
export type AccountUser={id:string;name:string;login:string|null};
export type SingleRecord={id:string;rank:number;turns:number;players:number;character:string;forfeited:boolean};
export class Store {
 readonly db:DatabaseSync;
 constructor(path:string){
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL);
   CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,finished_at TEXT NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS participants(match_id TEXT NOT NULL REFERENCES matches(id),user_id TEXT NOT NULL REFERENCES users(id),rank INTEGER NOT NULL,points INTEGER NOT NULL,forfeited INTEGER NOT NULL,PRIMARY KEY(match_id,user_id));
   CREATE TABLE IF NOT EXISTS augment_choices(match_id TEXT NOT NULL,user_id TEXT NOT NULL,id TEXT NOT NULL,turn INTEGER NOT NULL,chosen_at INTEGER NOT NULL,PRIMARY KEY(match_id,user_id,id));
   CREATE TABLE IF NOT EXISTS accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),login TEXT NOT NULL UNIQUE COLLATE NOCASE,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS account_recovery(user_id TEXT PRIMARY KEY REFERENCES users(id),code_hash TEXT NOT NULL UNIQUE);
   CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
   CREATE TABLE IF NOT EXISTS single_records(user_id TEXT NOT NULL REFERENCES users(id),id TEXT NOT NULL,finished_at TEXT NOT NULL,rank INTEGER NOT NULL,turns INTEGER NOT NULL,players INTEGER NOT NULL,character TEXT NOT NULL,forfeited INTEGER NOT NULL,PRIMARY KEY(user_id,id));`);
 }
 createUser(name:string){const token=randomBytes(32).toString('hex'),id=randomUUID();this.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,name,hash(token));return {id,name,token};}
 user(token:unknown):AccountUser|null{
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
  return (this.db.prepare(`SELECT u.id,u.name,a.login FROM users u LEFT JOIN accounts a ON a.user_id=u.id WHERE (a.user_id IS NULL AND u.token_hash=?) OR EXISTS(SELECT 1 FROM auth_sessions s WHERE s.user_id=u.id AND s.token_hash=? AND s.expires_at>?)`).get(hash(token),hash(token),Date.now()) as AccountUser|undefined)||null;
 }
 session(id:string,remember=true){const token=randomBytes(32).toString('hex');this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(Date.now());this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+(remember?30*86400000:12*3600000));return {token,user:this.db.prepare('SELECT u.id,u.name,a.login FROM users u JOIN accounts a ON a.user_id=u.id WHERE u.id=?').get(id) as AccountUser};}
 async register(login:string,password:string,name:string,guest?:AccountUser|null,remember=true){
  const salt=randomBytes(16).toString('hex'),digest=await derive(password,salt,64) as Buffer;
  if(this.db.prepare('SELECT 1 FROM accounts WHERE login=?').get(login))throw Error('이미 사용 중인 아이디입니다.');
  if(guest?.login)throw Error('다른 계정을 만들려면 먼저 로그아웃하세요.');
  const id=guest?.id||randomUUID();this.db.exec('BEGIN IMMEDIATE');try{
   if(guest)this.db.prepare('UPDATE users SET name=?,token_hash=? WHERE id=?').run(name,hash(randomBytes(32).toString('hex')),id);
   else this.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,name,hash(randomBytes(32).toString('hex')));
   this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(id,login,salt,digest.toString('hex'));this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
  return {...this.session(id,remember),recoveryCode:this.issueRecovery(id)};
 }
 async login(login:string,password:string,remember=true){
  const account=this.db.prepare('SELECT user_id,salt,password_hash FROM accounts WHERE login=?').get(login) as {user_id:string;salt:string;password_hash:string}|undefined;
  const digest=await derive(password,account?.salt||'yutverse-missing-account',64) as Buffer;
  if(!account||!timingSafeEqual(digest,Buffer.from(account.password_hash,'hex')))return null;
  if(this.db.prepare('SELECT password_hash FROM accounts WHERE user_id=?').get(account.user_id)?.password_hash!==account.password_hash)return null;
  return this.session(account.user_id,remember);
 }
 issueRecovery(id:string){const code=randomBytes(24).toString('hex').toUpperCase().match(/.{1,8}/g)!.join('-');this.db.prepare('INSERT INTO account_recovery VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash').run(id,hash(code.replaceAll('-','').toLowerCase()));return code;}
 recoveryAccount(code:unknown){if(typeof code!=='string')return null;const clean=code.replaceAll('-','').replace(/\s/g,'').toLowerCase();if(!/^[a-f0-9]{48}$/.test(clean))return null;return (this.db.prepare('SELECT a.user_id,a.login,u.name FROM account_recovery r JOIN accounts a ON a.user_id=r.user_id JOIN users u ON u.id=a.user_id WHERE r.code_hash=?').get(hash(clean)) as {user_id:string;login:string;name:string}|undefined)||null;}
 async resetPassword(code:string,password:string){const account=this.recoveryAccount(code);if(!account)return null;const salt=randomBytes(16).toString('hex'),digest=await derive(password,salt,64) as Buffer;
  // Consume atomically after the expensive derivation, so concurrent resets cannot reuse a code.
  this.db.exec('BEGIN IMMEDIATE');try{if(this.recoveryAccount(code)?.user_id!==account.user_id){this.db.exec('ROLLBACK');return null;}this.db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE user_id=?').run(salt,digest.toString('hex'),account.user_id);this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(account.user_id);const recoveryCode=this.issueRecovery(account.user_id);this.db.exec('COMMIT');return {id:account.user_id,login:account.login,recoveryCode};}catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 revoke(token:string){this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));}
 saveSingle(userId:string,record:SingleRecord){this.db.prepare('INSERT OR IGNORE INTO single_records VALUES(?,?,?,?,?,?,?,?)').run(userId,record.id,new Date().toISOString(),record.rank,record.turns,record.players,record.character,record.forfeited?1:0);}
 singleHistory(userId:string){return this.db.prepare('SELECT id,finished_at,rank,turns,players,character,forfeited FROM single_records WHERE user_id=? ORDER BY finished_at DESC LIMIT 100').all(userId);}
 summary(userId:string){return this.db.prepare('SELECT COUNT(*) AS games,COALESCE(SUM(points),0) AS points,COALESCE(SUM(CASE WHEN rank=1 THEN 1 ELSE 0 END),0) AS wins FROM participants WHERE user_id=?').get(userId);}
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
