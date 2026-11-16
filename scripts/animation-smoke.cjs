const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const {createGame}=await import('../packages/engine/src/index.ts');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const base=process.env.YUTVERSE_URL||'http://localhost:5173',errors=[];fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 try{
  for(const [name,width,height] of [['desktop',1280,900],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const s=createGame(2);s.phase='move';s.result={name:'걸',steps:3,extra:false};s.throws=0;s.players[0].pieces[0]={node:'o1',history:['home']};s.players[1].pieces[0]={node:'o4',history:[]};
   await page.addInitScript(s=>{localStorage.setItem('yutverse.offline','true');if(!localStorage.getItem('yutverse.game'))localStorage.setItem('yutverse.game',JSON.stringify(s))},s);
   await page.goto(base);await page.locator('.mode-menu').getByRole('button',{name:'싱글플레이',exact:true}).click();await page.locator('.token-label').first().waitFor();
   await page.getByRole('button',{name:'말 1 이동',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('.board-render[data-animating="true"]')&&document.querySelector('button.throw')?.disabled);
   await page.waitForFunction(()=>!!document.querySelector('.token-label[data-motion="capture"]'));
   const victim=page.locator('.token-label').filter({hasText:'AI1 · 1'});const before=await victim.getAttribute('style');await page.waitForFunction(before=>{const e=[...document.querySelectorAll('.token-label')].find(e=>e.textContent.includes('AI1 · 1'));return e?.dataset.motion==='capture'&&e.getAttribute('style')!==before},before);assert.notEqual(await victim.getAttribute('style'),before);
   await page.screenshot({path:`/tmp/yutverse-browser/capture-${name}.png`});
   await page.locator('.board-render[data-animating="false"]').waitFor();
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')));assert.equal(stored.players[0].pieces[0].node,'o4');assert.equal(stored.players[1].pieces[0].node,'home');assert.equal(stored.lastMove.captures.length,1);
   await page.reload();await page.locator('.mode-menu').getByRole('button',{name:'싱글플레이',exact:true}).click();await page.locator('.board-render[data-animating="false"]').waitFor();assert.equal(await page.locator('.motion-status').count(),0);
   await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('combobox',{name:'싱글 인원'}).selectOption('2');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'새 경기 시작 ↗',exact:true}).click();
   await page.getByRole('dialog',{name:'게임 시작 전 말 선택'}).waitFor();await page.getByRole('button',{name:'이 동물로 시작하기 ↗',exact:true}).click();await page.getByRole('dialog',{name:'증강 선택'}).waitFor();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.locator('.token-label').count(),0);assert.equal(await page.getByRole('button').count(),5);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')).players.length),2);
   const first=page.locator('.augment-picker .card').first();await first.focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('.augment-picker .selection-exit').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await first.evaluate(e=>e===document.activeElement),true);
   await page.screenshot({path:`/tmp/yutverse-browser/selection-${name}.png`});await first.click();await page.getByRole('button',{name:'윷 던지기 ↗',exact:true}).waitFor();await page.locator('canvas').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await context.close();console.log(`PASS ${name}: animated capture, input lock, reload without replay, two-player single game, opaque selection-only screen, focus trap.`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
