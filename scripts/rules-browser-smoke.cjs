const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const {createGame}=await import('../packages/engine/src/index.ts');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const base=process.env.YUTVERSE_URL||'http://localhost:5173',errors=[];fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 async function pageFor(state,viewport={width:1280,height:900}){const context=await browser.newContext({viewport}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>{localStorage.setItem('yutverse.offline','true');localStorage.setItem('yutverse.game',JSON.stringify(s))},state);await page.goto(base);await page.locator('.mode-menu').getByRole('button',{name:'싱글플레이',exact:true}).click();return {page,context};}
 try{
  for(const [name,width,height] of [['desktop',1280,900],['mobile',390,844]]){
   const s=createGame(2);s.phase='move';s.throws=0;s.result={name:'개',steps:2,extra:false};s.players[0].pieces[0]={node:'o5',history:[]};const {page,context}=await pageFor(s,{width,height});
   await page.getByRole('button',{name:'말 1 이동',exact:true}).click();await page.getByRole('group',{name:'이동 경로 선택'}).waitFor();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].pieces[0].node),'o5');
   await page.screenshot({path:`/tmp/yutverse-browser/fork-${name}.png`});await page.getByRole('button',{name:'바깥길로 가기',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].pieces[0].node==='o7');await context.close();
  }
  const stock=createGame(2);stock.phase='move';stock.throws=0;stock.pendingResults=[{name:'모',steps:5,extra:true,id:1,extraSettled:true},{name:'도',steps:1,extra:false,id:2,extraSettled:true}];stock.result=stock.pendingResults[0];
  const saved=await pageFor(stock);await saved.page.getByRole('button',{name:'도 1칸',exact:true}).click();await saved.page.getByRole('button',{name:'말 1 이동',exact:true}).click();await saved.page.waitForFunction(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].pieces[0].node==='o1');await saved.page.locator('.board-render[data-animating="false"]').waitFor();assert.equal(await saved.page.getByRole('button',{name:'모 5칸',exact:true}).count(),1);await saved.context.close();
  const ai=createGame(2,true);ai.turn=1;ai.players[1].baseTurns=2;ai.players[1].pieces[0]={node:'o1',history:['home']};ai.selection={player:1,offers:['do-plus','launch','finish'],deadline:Date.now()+60000,queue:[]};
  const bot=await browser.newContext({viewport:{width:1280,height:900}}),p=await bot.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(s=>{localStorage.setItem('yutverse.offline','true');localStorage.setItem('yutverse.game',JSON.stringify(s));const schedule=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>schedule(fn,ms===750?2000:ms,...args);let n=0;Math.random=()=>{const i=n++;return i%4===0?.1+(i%197)*.0001:.8+(i%173)*.0001}},ai);await p.goto(base);await p.locator('.mode-menu').getByRole('button',{name:'싱글플레이',exact:true}).click();
  await p.locator('.selection-notice').waitFor();assert.equal(await p.getByRole('dialog',{name:'증강 선택'}).count(),0);
  await p.locator('.board-render[data-throwing="true"]').waitFor();await p.screenshot({path:'/tmp/yutverse-browser/ai-throw.png'});
  await p.locator('.board-render[data-animating="true"]').waitFor();await p.screenshot({path:'/tmp/yutverse-browser/ai-move.png'});await bot.close();
  const human=await pageFor(createGame(2));await human.page.getByRole('button',{name:'윷 던지기 ↗',exact:true}).click();await human.page.locator('.board-render[data-throwing="true"]').waitFor();assert.ok((await human.page.getByRole('button',{name:'윷이 떨어지는 중…',exact:true}).isDisabled()));await human.page.locator('.board-render[data-throwing="false"]').waitFor();await human.context.close();
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile fork choice, stored-result order, AI augment → throw → movement sequence, and visible human throw animation.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
