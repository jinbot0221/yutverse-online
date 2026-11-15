import {useEffect,useRef} from 'react';
import {CHARACTERS,CHARACTER_ATLASES,character,type CharacterId,type PlayerCount,type Difficulty} from '@yutverse/engine';
export function CharacterArt({id,className=''}:{id:unknown;className?:string}){
 const c=character(id),atlas=CHARACTER_ATLASES[c.atlas];
 return <span aria-hidden="true" className={`character-art ${className}`} style={{backgroundImage:`url(${atlas.url})`,backgroundSize:`${atlas.columns*100}% ${atlas.rows*100}%`,backgroundPosition:`${atlas.columns>1?c.column/(atlas.columns-1)*100:0}% ${atlas.rows>1?c.row/(atlas.rows-1)*100:0}%`}}/>;
}
export function CharacterChoices({value,onChange,disabled=false}:{value:CharacterId;onChange:(id:CharacterId)=>void;disabled?:boolean}){
 return <div className="character-choices" role="group" aria-label="말 캐릭터 선택">{CHARACTERS.map(c=><button type="button" key={c.id} className={`character-option ${c.id===value?'selected':''}`} aria-pressed={c.id===value} disabled={disabled} onClick={()=>onChange(c.id)}><CharacterArt id={c.id}/><span className="character-caption"><small>{c.title}</small><strong>{c.name}</strong><em>{c.id===value?'선택됨':'선택하기'}</em></span></button>)}</div>;
}
export function CharacterSelection({value,onChange,count,onCount,difficulty,onDifficulty,onStart,onOnline,onCancel,accountName,onRecords,onAccount,accountAction}:{value:CharacterId;onChange:(id:CharacterId)=>void;count:PlayerCount;onCount:(n:PlayerCount)=>void;difficulty:Difficulty;onDifficulty:(d:Difficulty)=>void;onStart:()=>void;onOnline:()=>void;onCancel?:(()=>void);accountName?:string;onRecords?:()=>void;onAccount?:()=>void;accountAction?:string}){
 const ref=useRef<HTMLElement>(null),selected=character(value);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()},[]);
 return <section className="character-setup" role="dialog" aria-modal="true" aria-label="게임 시작 전 말 선택" ref={ref}>
  <header><span className="brand">Y<span>✦</span>UTVERSE <small>CHOOSE YOUR HERO</small></span><span className="badge">{accountName?`${accountName} · `:''}싱글플레이 · {count}인 개인전</span></header>
  <div className="character-intro"><p className="eyebrow">YOUR NEXT ADVENTURE</p><h1>함께할 영웅을 골라주세요.</h1><p>고른 영웅이 나의 말 4개가 됩니다. 캐릭터마다 능력 차이는 없어요.</p></div>
  <CharacterChoices value={value} onChange={onChange}/>
  <div className="character-bottom"><div className="selected-hero"><small>함께할 영웅</small><strong>{selected.name}</strong><span>{selected.description}</span></div><div className="character-config"><label>참가 인원<select aria-label="시작 인원" value={count} onChange={e=>onCount(Number(e.target.value) as PlayerCount)}><option value={2}>나 + AI 1명 · 2인</option><option value={3}>나 + AI 2명 · 3인</option><option value={4}>나 + AI 3명 · 4인</option></select></label><label>AI 난이도<select aria-label="시작 AI 난이도" value={difficulty} onChange={e=>onDifficulty(e.target.value as Difficulty)}><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option></select></label></div><button className="start-adventure" onClick={onStart}>이 영웅으로 시작하기 ↗</button></div>
  <div className="character-secondary">{onRecords&&<button onClick={onRecords}>내 전적</button>}{onAccount&&<button onClick={onAccount}>{accountAction}</button>}<button onClick={onOnline}>친구와 온라인으로 플레이</button>{onCancel&&<button onClick={onCancel}>진행 중인 경기로 돌아가기</button>}</div>
 </section>;
}
