import {useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,throwYut,move,chooseMove,legalMoves,DONE,selectAugment,expireSelection,definition,useAugment,canUseAugment,skipMove,type State,type Difficulty} from '@yutverse/engine';
import {Board} from './Board';
import {useOnline} from './online';
import './style.css';
const colors=['#ffbd69','#8fdac2','#b6a4ff','#ff8eac'];
type RecordEntry={date:string;rank:number;turns:number};
type MatchRecord={id:string;finished_at:string;rank:number;points:number;forfeited:number};
type Ranking={id:string;name:string;points:number;games:number;wins:number};
function load<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function initialGame(){const saved=load<State|null>('yutverse.game',null);return saved?.version===2&&saved.players.every(p=>Array.isArray(p.slots))?saved:createGame(3,true)}
function App(){
 const [single,setSingle]=useState<State>(initialGame),[mode,setMode]=useState<'single'|'online'>('single');
 const online=useOnline(mode==='online');const s=mode==='single'?single:online.room?.state;const me=mode==='single'?0:online.room?.me??-1;
 const [difficulty,setDifficulty]=useState<Difficulty>('normal'),[low,setLow]=useState(false),[cameraKey,setCameraKey]=useState(0),[records,setRecords]=useState<RecordEntry[]>(()=>load('yutverse.records',[]));
 const [storageError,setStorageError]=useState(false),[clock,setClock]=useState(Date.now()),[name,setName]=useState(''),[code,setCode]=useState(''),[capacity,setCapacity]=useState<3|4>(3),[ranking,setRanking]=useState<Ranking[]>([]),[rankingError,setRankingError]=useState('');
 const [history,setHistory]=useState<MatchRecord[]>([]),[season,setSeason]=useState('');
 const recorded=useRef(single.phase==='over');
 useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),500);return()=>clearInterval(t)},[]);
 useEffect(()=>{try{localStorage.setItem('yutverse.game',JSON.stringify(single))}catch{setStorageError(true)}},[single]);
 useEffect(()=>{if(mode!=='single')return;setSingle(prev=>expireSelection(prev,clock))},[clock,mode]);
 useEffect(()=>{
  if(mode!=='single')return;
  if(single.phase==='over'){
   if(!recorded.current){recorded.current=true;setRecords(prev=>{const r=[{date:new Date().toLocaleDateString('ko-KR'),rank:single.ranks.indexOf(0)+1,turns:single.turns},...prev].slice(0,50);try{localStorage.setItem('yutverse.records',JSON.stringify(r))}catch{setStorageError(true)}return r;});}return;
  }
  const actor=single.selection?.player??single.turn;if(actor===0)return;
  const t=setTimeout(()=>setSingle(prev=>{
   if(prev.phase==='augment'&&prev.selection)return selectAugment(prev,prev.selection.player,prev.selection.offers[0]);
   if(prev.phase==='throw')return throwYut(prev);
   const useful=prev.players[prev.turn].slots.find(slot=>canUseAugment(prev,prev.turn,slot.id)&&slot.id!=='reroll'&&slot.id!=='steady');
   if(useful)return useAugment(prev,prev.turn,useful.id);
   return legalMoves(prev).length?move(prev,chooseMove(prev,difficulty)):skipMove(prev);
  }),750);return()=>clearTimeout(t);
 },[single,difficulty,mode]);
 function act(kind:string,data:{index?:number;id?:string}={}){
  if(mode==='online'){void online.act(kind,data);return;}
  setSingle(prev=>kind==='throw'?throwYut(prev):kind==='move'?move(prev,data.index!):kind==='choose'?selectAugment(prev,0,data.id!):kind==='use'?useAugment(prev,0,data.id!):skipMove(prev));
 }
 async function refreshRanking(selectedSeason=season){setRankingError('');try{const response=await fetch('/api/ranking'+(selectedSeason?'?season='+selectedSeason:''));if(!response.ok)throw Error();setRanking(await response.json());if(online.token){const h=await fetch('/api/history',{headers:{Authorization:`Bearer ${online.token}`}});if(h.ok)setHistory(await h.json())}}catch{setRankingError('온라인 서버에서 랭킹을 불러올 수 없습니다.')}}
 const busy=mode==='online'&&(!online.connected||online.pending);const activeOnline=online.room?.state&&online.room.state.phase!=='over'&&!online.room.state.forfeited.includes(online.room.me);
 const remaining=s?.selection?Math.max(0,Math.ceil((s.selection.deadline-clock)/1000)):0;
 return <main>
  <header><a className="brand" href="/">Y<span>✦</span>UTVERSE <small>ONLINE</small></a><div className="badge">● {mode==='single'?'브라우저 싱글플레이':online.connected?'온라인 연결됨':'온라인 연결 대기'}</div></header>
  <section className="heading"><div><p className="eyebrow">TRADITION MEETS A NEW WORLD</p><h1>한 수에 담긴,<br/>새로운 모험.</h1><p className="subtitle">네 개의 말, 스무 가지 증강. 마지막 순위까지 이어지는 윷놀이.</p></div><div className="settings"><label>AI 난이도 <select value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option></select></label><label><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/> 저사양 모드</label></div></section>
  <nav className="mode-tabs"><button className={mode==='single'?'selected':''} disabled={!!activeOnline} onClick={()=>setMode('single')}>싱글플레이</button><button className={mode==='online'?'selected':''} onClick={()=>setMode('online')}>온라인 개인전</button><span>이동 보너스 최대 +2 · 영웅 최대 1개</span></nav>
  {mode==='online'&&<section className="lobby">
   <h2>함께 떠나는 여정</h2><p>3~4명의 실제 플레이어와 초대 코드로 만납니다. 연결이 끊기면 90초 안에 같은 브라우저로 재접속하세요.</p>
   {!online.token?<form onSubmit={e=>{e.preventDefault();void online.login(name)}}><input aria-label="온라인 이름" maxLength={16} required value={name} onChange={e=>setName(e.target.value)} placeholder="여행자 이름 (1~16자)"/><button disabled={online.pending}>온라인 입장</button></form>:!online.connected?<><p>서버에 연결 중입니다… 개발 시 서버도 실행하세요.</p><button onClick={online.resetSession}>새 게스트 세션</button></>:!online.room?<div className="lobby-controls"><label>인원 <select aria-label="방 인원" value={capacity} onChange={e=>setCapacity(Number(e.target.value) as 3|4)}><option value={3}>3인</option><option value={4}>4인</option></select></label><button disabled={busy} onClick={()=>void online.request('create',{capacity})}>방 만들기</button><form onSubmit={e=>{e.preventDefault();void online.request('join',{code})}}><input aria-label="초대 코드" placeholder="초대 코드 6자리" maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button disabled={busy||code.length!==6}>참가하기</button></form></div>:<>
    <div className="room-title"><strong>초대 코드 <code>{online.room.code}</code></strong><span>{online.room.members.length} / {online.room.capacity}명</span></div>
    {!online.room.state?<><ul className="members">{online.room.members.map(m=><li key={m.id}>{m.name}{m.id===online.room!.owner?' ♛':''} · {m.connected?'접속':'재접속 대기'} · {m.ready?'준비 완료':'준비 중'}</li>)}</ul><div className="lobby-controls"><button disabled={busy} onClick={()=>void online.request('ready')}>{online.room.members[me]?.ready?'준비 취소':'준비 완료'}</button>{online.room.members[me]?.id===online.room.owner&&<button disabled={busy||online.room.members.length!==online.room.capacity||online.room.members.some(m=>!m.ready||!m.connected)} onClick={()=>void online.request('start')}>경기 시작</button>}<button disabled={busy} onClick={()=>void online.request('leave')}>방 나가기</button></div></>:online.room.state.phase==='over'?<button disabled={busy} onClick={()=>void online.request('leave')}>대기실로 돌아가기</button>:<button disabled={busy||online.room.state.forfeited.includes(me)||online.room.state.ranks.includes(me)} onClick={()=>{if(window.confirm('기권하면 남은 순위의 마지막 순위로 기록됩니다. 계속할까요?'))void online.act('forfeit')}}>기권하기</button>}
   </>}
   {online.error&&<p role="alert" className="error">{online.error}</p>}
   <details><summary onClick={()=>void refreshRanking()}>온라인 랭킹 · 나의 전적</summary><label>시즌 <select aria-label="랭킹 시즌" value={season} onChange={e=>{setSeason(e.target.value);void refreshRanking(e.target.value)}}><option value="">누적</option><option value={new Date().toISOString().slice(0,7)}>이번 달 (UTC)</option></select></label>{rankingError?<p>{rankingError}</p>:ranking.length?<ol>{ranking.map(r=><li key={r.id}>{r.name} · {r.points}점 · {r.games}경기 · {r.wins}승</li>)}</ol>:<p>아직 완료된 온라인 경기가 없습니다.</p>}<h3>최근 온라인 전적</h3>{history.length?<ul>{history.slice(0,10).map(h=><li key={h.id}>{new Date(h.finished_at).toLocaleDateString('ko-KR')} · {h.rank}위 · {h.points}점{h.forfeited?' · 기권':''}</li>)}</ul>:<p>완료된 경기가 없습니다.</p>}<p>게스트 세션은 이 브라우저에 저장됩니다. 저장 데이터를 지우면 복구할 수 없습니다.</p></details>
  </section>}
  {s&&<><section className="layout"><div className="arena"><div className="arena-top"><span>달빛 정원 <small>· {s.players.length}인 개인전</small></span><button onClick={()=>setCameraKey(k=>k+1)}>시점 초기화 ↻</button></div><Board key={cameraKey} s={s} me={me} low={low} onMove={i=>{if(!busy)act('move',{index:i})}}/><div className="hint">드래그로 회전 · 휠 / 두 손가락으로 확대</div>{s.selection&&<section className="augment-picker" role="dialog" aria-label="증강 선택"><div><p className="eyebrow">AUGMENT · {remaining}s</p><h2>{s.selection.player===me?'이번 여정의 힘을 선택하세요':`${s.players[s.selection.player].name}의 선택을 기다립니다`}</h2><p>선택 중 전체 게임 정지 · 60초 후 첫 후보 자동 선택</p></div>{s.selection.player===me&&<div className="cards">{s.selection.offers.map(id=>{const a=definition(id)!;return <button key={id} disabled={busy} className={a.hero?'card hero':'card'} onClick={()=>act('choose',{id})}><small>{a.hero?'영웅':'일반'} · {a.manual?'수동':'자동'}</small><strong>{a.name}</strong><span>{a.description}</span></button>})}</div>}</section>}</div><aside>
   <div className="turn"><p className="eyebrow">TURN {s.turns} · 기본 턴 {s.players[s.turn].baseTurns}</p><h2>{s.phase==='over'?'경기 종료':s.phase==='augment'?'증강 선택 중':`${s.players[s.turn].name}의 차례`}</h2><p>{s.phase==='over'?s.ranks.map((id,i)=>`${i+1}위 ${s.players[id].name}`).join(' · '):s.phase==='augment'?`${s.players[s.selection!.player].name} 선택 대기 · ${remaining}초`:s.phase==='move'?`${s.result?.name}! 이동할 말을 선택하세요.`:`윷을 던져 여정을 이어가세요. (남은 던지기 ${s.throws})`}</p><div className="sticks">{[0,1,2,3].map(i=><span key={i} style={{transform:`rotate(${i%2?12:-10}deg)`}}>●</span>)}</div><button className="throw" disabled={busy||s.turn!==me||s.phase!=='throw'} onClick={()=>act('throw')}>{s.phase==='over'?'여정 완료':s.phase==='augment'?'모두 잠시 쉬어갑니다':s.turn!==me?'상대의 차례':s.phase==='move'?'이동할 말 선택':'윷 던지기 ↗'}</button>{s.turn===me&&s.phase==='move'&&<div className="moves">{legalMoves(s).map(i=><button disabled={busy} key={i} onClick={()=>act('move',{index:i})}>말 {i+1} 이동</button>)}{!legalMoves(s).length&&<button disabled={busy} onClick={()=>act('skip')}>이동 없이 넘기기</button>}</div>}</div>
   <div className="players">{s.players.map((p,i)=><div className={s.turn===i?'player active':'player'} key={i}><span className="avatar" style={{background:colors[i]}}>♟</span><div><strong>{p.name}{i===me?' (나)':''}</strong><small>{s.forfeited.includes(i)?'기권':mode==='single'?(i===0?'달빛 여행자':`AI · ${difficulty}`):online.room?.members[i]?.connected?'온라인':'재접속 대기'}</small></div><b>{s.ranks.includes(i)?`${s.ranks.indexOf(i)+1}위`:`${p.pieces.filter(x=>x.node===DONE).length} / 4`}</b></div>)}</div>
   <div className="journal"><h3>여정 기록</h3>{s.log.slice(0,5).map((l,i)=><p key={i}>{l}</p>)}</div>
  </aside></section>
  <section className="inventory"><h3>나의 증강 <small>{s.players[me]?.slots.length||0} / 5</small></h3><div className="cards">{s.players[me]?.slots.map(slot=>{const a=definition(slot.id)!;return <div className={`card ${a.hero?'hero':''} ${slot.remaining===0?'spent':''}`} key={slot.id}><small>{a.hero?'영웅 · ':''}{slot.remaining===0?'소모 완료':slot.remaining===-1?'지속 효과':`${slot.remaining}회 남음`}</small><strong>{a.name}</strong><span>{a.description}</span>{a.manual&&<button disabled={busy||!canUseAugment(s,me,slot.id)} onClick={()=>act('use',{id:slot.id})}>사용하기</button>}</div>})}{!s.players[me]?.slots.length&&<p>첫 증강을 선택하면 이곳에 표시됩니다.</p>}</div></section>
  {mode==='single'&&<footer><div><strong>나의 싱글 전적</strong><span>{records.length}경기 · 1위 {records.filter(r=>r.rank===1).length}회 {storageError?'· 저장 공간 사용 불가':''}</span></div><label>인원 <select aria-label="싱글 인원" value={capacity} onChange={e=>setCapacity(Number(e.target.value) as 3|4)}><option value={3}>3인</option><option value={4}>4인</option></select></label><button onClick={()=>{if(s.phase==='over'||window.confirm('현재 경기를 끝내고 새로 시작할까요?')){recorded.current=false;setSingle(createGame(capacity,true))}}}>새 경기 시작 ↗</button></footer>}
  </>}
  <p className="notice">도·개·걸·윷·모·빽도 / 잡기·업기·지름길 / 기본 턴 2·4·6·8에 증강 추가<br/>{mode==='single'?'싱글 전적은 브라우저에만 저장되며 온라인 점수에 반영되지 않습니다.':'온라인은 서버가 결과를 판정합니다. 120초 동안 행동이 없으면 자동 기권됩니다.'}</p>
 </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
