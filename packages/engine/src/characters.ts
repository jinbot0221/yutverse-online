export const CHARACTER_ATLASES={
 heroes:{url:'/characters/heroes.png',columns:3,rows:2},
 legends:{url:'/characters/legends.png',columns:3,rows:1},
 challengers:{url:'/characters/challengers.png',columns:3,rows:2},
} as const;
export const LEGACY_CHARACTERS = [
 {id:'dwarf',name:'바훈투르',title:'드워프 전사',description:'붉은 수염과 거대한 불꽃 망치',atlas:'heroes',column:0,row:0,foot:.24},
 {id:'archer',name:'니나브',title:'엘프 궁수',description:'하얀 날개와 푸른빛 화살',atlas:'heroes',column:1,row:0,foot:.24},
 {id:'fighter',name:'샨디',title:'무투가',description:'푸른 사자의 기운을 두른 무투가',atlas:'heroes',column:2,row:0,foot:.24},
 {id:'knight',name:'실리안',title:'기사',description:'은빛 검과 붉은 망토의 기사',atlas:'heroes',column:0,row:1,foot:.15},
 {id:'mage',name:'샨디',title:'마법사',description:'초록빛 마법을 다루는 백발의 현자',atlas:'heroes',column:1,row:1,foot:.15},
 {id:'echidna',name:'에키드나',title:'욕망의 여왕',description:'붉은 마법과 거대한 뱀을 거느린 여왕',atlas:'legends',column:0,row:0,foot:.09},
 {id:'karmine',name:'카마인',title:'악마',description:'붉은 머리와 검은 창을 든 악마',atlas:'challengers',column:0,row:0,foot:.11},
 {id:'kakul-saydon',name:'쿠크세이튼',title:'광기의 광대',description:'붉은 웃음과 황금 장식의 광대',atlas:'challengers',column:1,row:0,foot:.11},
 {id:'thaemine',name:'카멘',title:'어둠의 기사',description:'푸른 불꽃과 검은 갑주의 기사',atlas:'challengers',column:2,row:0,foot:.11},
 {id:'luterra',name:'루테란',title:'빛의 왕',description:'푸른 망토와 빛나는 검을 든 왕',atlas:'challengers',column:0,row:1,foot:.11},
 {id:'valtan',name:'발탄',title:'마수',description:'거대한 도끼와 검은 뿔의 마수',atlas:'challengers',column:1,row:1,foot:.11},
 {id:'galatur',name:'갈라투르',title:'전설의 대장장이',description:'거대한 용암 망치와 흰 수염의 장인',atlas:'legends',column:1,row:0,foot:.09},
 {id:'aman',name:'아만',title:'빛의 사제',description:'푸른 망토와 신비로운 빛의 사제',atlas:'legends',column:2,row:0,foot:.09},
] as const;
export const CHARACTERS=[
 {id:'otter',name:'수달',title:'동물 친구',description:'동그란 귀와 폭신한 볼을 가진 수달',color:'#9a6545'},
 {id:'squirrel',name:'다람쥐',title:'동물 친구',description:'통통한 볼과 작은 앞니가 귀여운 다람쥐',color:'#c38441'},
 {id:'cat',name:'고양이',title:'동물 친구',description:'쫑긋한 귀와 분홍 코의 고양이',color:'#aab7c7'},
 {id:'dog',name:'강아지',title:'동물 친구',description:'축 처진 귀와 동그란 눈의 강아지',color:'#d29b65'},
] as const;
export type AnimalId=typeof CHARACTERS[number]['id'];
export type CharacterId=AnimalId|typeof LEGACY_CHARACTERS[number]['id'];
export const DEFAULT_CHARACTER:AnimalId='otter';
export function isCharacterId(id:unknown):id is CharacterId{return typeof id==='string'&&[...CHARACTERS,...LEGACY_CHARACTERS].some(c=>c.id===id);}
export function character(id:unknown){return CHARACTERS.find(c=>c.id===id)||CHARACTERS[Math.max(0,LEGACY_CHARACTERS.findIndex(c=>c.id===id))%CHARACTERS.length];}
