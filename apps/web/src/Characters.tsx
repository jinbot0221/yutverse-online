import {AugmentCatalog} from './AugmentCatalog';
import {GameStylePicker} from './GameStylePicker';
import {useEffect,useRef} from 'react';
import {CHARACTERS,character,type CharacterId,type PlayerCount,type Difficulty,type GameStyle} from '@yutverse/engine';
export function CharacterArt({id,className=''}:{id:unknown;className?:string}){
 const c=character(id),cat=c.id==='cat',dog=c.id==='dog',squirrel=c.id==='squirrel';
 return <span aria-hidden="true" className={`character-art animal-art ${className}`}><svg viewBox="0 0 120 120" fill="none">
 {cat?<><path d="M20 49 17 14 48 34M72 34 103 14 100 49" fill={c.color}/><path d="m23 35-1-13 15 12m46 0 15-12-1 13" fill="#e8a9b2"/></>:dog?<><ellipse cx="22" cy="57" rx="15" ry="31" fill="#8b5736"/><ellipse cx="98" cy="57" rx="15" ry="31" fill="#8b5736"/></>:<><circle cx="28" cy="30" r="16" fill={c.color}/><circle cx="92" cy="30" r="16" fill={c.color}/><circle cx="28" cy="30" r="9" fill="#e8b595"/><circle cx="92" cy="30" r="9" fill="#e8b595"/></>}
 <ellipse cx="60" cy="61" rx="43" ry="39" fill={c.color}/><ellipse cx="60" cy="78" rx="30" ry="19" fill="#fae8ce"/>
 <circle cx="43" cy="58" r="6" fill="#1c3031"/><circle cx="77" cy="58" r="6" fill="#1c3031"/><circle cx="45" cy="56" r="2" fill="white"/><circle cx="79" cy="56" r="2" fill="white"/>
 <ellipse cx="60" cy="74" rx="7" ry="5" fill={cat?'#d98b9f':'#453126'}/><path d="M60 79v7m-8-1q8 8 16 0" stroke="#795744" strokeWidth="2.5" strokeLinecap="round"/>
 {squirrel&&<><path d="m53 94 1-12h6v12zm7 0V82h6l1 12z" fill="white"/><path d="m54 26 6-15 7 15" fill="#92562d"/></>}
 {(cat||c.id==='otter')&&<path d="m35 78-16-3m16 10-17 3m67-10 16-3m-16 10 17 3" stroke="#6a5144" strokeWidth="2" strokeLinecap="round"/>}
 </svg></span>;
}
export function CharacterChoices({value,onChange,disabled=false}:{value:CharacterId;onChange:(id:CharacterId)=>void;disabled?:boolean}){
 return <div className="character-choices" role="group" aria-label="말 캐릭터 선택">{CHARACTERS.map(c=><button type="button" key={c.id} className={`character-option ${c.id===value?'selected':''}`} aria-pressed={c.id===value} disabled={disabled} onClick={()=>onChange(c.id)}><CharacterArt id={c.id}/><span className="character-caption"><small>{c.title}</small><strong>{c.name}</strong><em>{c.id===value?'선택됨':'선택하기'}</em></span></button>)}</div>;
}
export function CharacterSelection({gameStyle,onGameStyle,value,onChange,count,onCount,difficulty,onDifficulty,onStart,onOnline,onCancel,accountName,onHome,onRecords,onProfile,onAccount,accountAction}: {gameStyle:GameStyle;onGameStyle:(style:GameStyle)=>void;value:CharacterId;onChange:(id:CharacterId)=>void;count:PlayerCount;onCount:(n:PlayerCount)=>void;difficulty:Difficulty;onDifficulty:(d:Difficulty)=>void;onStart:()=>void;onOnline:()=>void;onCancel?:(()=>void);accountName?:string;onHome?:()=>void;onRecords?:()=>void;onProfile?:()=>void;onAccount?:()=>void;accountAction?:string}){
 const ref=useRef<HTMLElement>(null),selected=character(value);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()},[]);
 return <section className="character-setup" role="dialog" aria-modal="true" aria-label="게임 시작 전 말 선택" ref={ref}>
  <header><span className="brand">Y<span>✦</span>UTVERSE <small>CHOOSE YOUR HERO</small></span><span className="badge">{accountName?`${accountName} · `:''}싱글플레이 · {count}인 개인전</span></header>
  <div className="character-intro"><p className="eyebrow">YOUR NEXT ADVENTURE</p><h1>함께할 동물을 골라주세요.</h1><p>고른 동물이 나의 말 4개가 됩니다. 캐릭터마다 능력 차이는 없어요.</p></div>
  <GameStylePicker value={gameStyle} onChange={onGameStyle}/><CharacterChoices value={value} onChange={onChange}/>
  <div className="character-bottom"><div className="selected-hero"><small>함께할 동물</small><strong>{selected.name}</strong><span>{selected.description}</span></div><div className="character-config"><label>참가 인원<select aria-label="시작 인원" value={count} onChange={e=>onCount(Number(e.target.value) as PlayerCount)}><option value={2}>나 + AI 1명 · 2인</option><option value={3}>나 + AI 2명 · 3인</option><option value={4}>나 + AI 3명 · 4인</option></select></label><label>AI 난이도<select aria-label="시작 AI 난이도" value={difficulty} onChange={e=>onDifficulty(e.target.value as Difficulty)}><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option></select></label></div><button className="start-adventure" onClick={onStart}>이 동물로 시작하기 ↗</button></div>
  <div className="character-secondary"><AugmentCatalog/>{onHome&&<button onClick={onHome}>시작화면으로</button>}{onProfile&&<button onClick={onProfile}>회원정보</button>}{onRecords&&<button onClick={onRecords}>내 전적</button>}{onAccount&&<button onClick={onAccount}>{accountAction}</button>}<button onClick={onOnline}>친구와 온라인으로 플레이</button>{onCancel&&<button onClick={onCancel}>진행 중인 경기로 돌아가기</button>}</div>
 </section>;
}
