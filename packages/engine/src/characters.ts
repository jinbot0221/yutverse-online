export const CHARACTERS = [
 {id:'dwarf',name:'불꽃 망치',title:'드워프 전사',description:'붉은 수염과 거대한 불꽃 망치',column:0,row:0},
 {id:'archer',name:'바람의 화살',title:'엘프 궁수',description:'하얀 날개와 푸른빛 화살',column:1,row:0},
 {id:'fighter',name:'영혼의 주먹',title:'무투가',description:'푸른 사자의 기운을 두른 무투가',column:2,row:0},
 {id:'knight',name:'은빛 맹세',title:'기사',description:'은빛 검과 붉은 망토의 기사',column:0,row:1},
 {id:'mage',name:'별빛 현자',title:'마법사',description:'초록빛 마법을 다루는 백발의 현자',column:1,row:1},
] as const;
export type CharacterId=typeof CHARACTERS[number]['id'];
export const DEFAULT_CHARACTER:CharacterId='knight';
export function isCharacterId(id:unknown):id is CharacterId{return typeof id==='string'&&CHARACTERS.some(c=>c.id===id);}
export function character(id:unknown){return CHARACTERS.find(c=>c.id===id)||CHARACTERS.find(c=>c.id===DEFAULT_CHARACTER)!;}
