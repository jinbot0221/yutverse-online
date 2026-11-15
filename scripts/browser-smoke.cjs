// Requires the web dev server and API server. Uses system Chromium in Cloud.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],contexts=[];const base=process.env.YUTVERSE_URL||'http://localhost:5173';
 fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 try{
  const local=await browser.newContext({viewport:{width:1280,height:1000}});contexts.push(local);const page=await local.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('button',{name:'로그인 없이 싱글플레이',exact:true}).click();await page.getByRole('button',{name:'이 영웅으로 시작하기 ↗',exact:true}).click();await page.getByRole('dialog',{name:'증강 선택'}).waitFor();assert.equal(await page.locator('.augment-picker .card').count(),3);
  assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.getByRole('button').count(),4);await page.screenshot({path:'/tmp/yutverse-browser/augments.png'});await page.locator('.augment-picker .card').first().click();
  await page.getByRole('button',{name:'윷 던지기 ↗',exact:true}).waitFor();await page.getByRole('button',{name:'윷 던지기 ↗',exact:true}).click();
  const moves=page.getByRole('button',{name:/말 \d 이동/});if(await moves.count())await moves.first().click();
  await page.reload();await page.locator('canvas').waitFor();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].slots.length===1));
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/yutverse-browser/mobile.png'});// Exercise a manual card in an isolated local match while the network is offline.
  const {createGame}=await import('../packages/engine/src/index.ts');const fixture=createGame();fixture.phase='move';fixture.result={name:'도',steps:1,extra:false};fixture.throws=0;fixture.players[0].slots=[{id:'boost',remaining:1}];
  await page.evaluate(s=>localStorage.setItem('yutverse.game',JSON.stringify(s)),fixture);await page.reload();await page.getByRole('button',{name:/나의 증강/}).click();await page.getByRole('button',{name:'사용하기',exact:true}).waitFor();await local.setOffline(true);await page.getByRole('button',{name:'사용하기',exact:true}).click();await page.getByText('소모 완료',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'사용하기',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'말 1 이동',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yutverse.game')).players[0].pieces[0].node),'o2');await local.setOffline(false);await page.close();
  const players=[];const playerCount=Number(process.env.YUTVERSE_PLAYERS||3);assert.ok([2,3,4].includes(playerCount));
  for(let i=0;i<playerCount;i++){
   const context=await browser.newContext({viewport:{width:1100,height:900}});contexts.push(context);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));const response=await context.request.post(base+'/api/auth/register',{data:{login:`web_${Date.now()}_${i}`,password:'browser-test-password',nickname:`브라우저${i+1}`}});assert.equal(response.status(),201);const account=await response.json();await p.addInitScript(a=>{localStorage.setItem('yutverse.token',a.token);localStorage.setItem('yutverse.account',JSON.stringify(a.user))},account);await p.goto(base);await p.getByRole('button',{name:'친구와 온라인으로 플레이',exact:true}).click();await p.getByRole('button',{name:'방 만들기',exact:true}).waitFor();players.push(p);
  }
  await players[0].getByRole('combobox',{name:'방 인원'}).selectOption(String(playerCount));await players[0].getByRole('button',{name:'방 만들기',exact:true}).click();const invite=await players[0].locator('.room-title code').textContent();assert.match(invite,/^[A-Z2-9]{6}$/);
  for(let i=1;i<playerCount;i++){await players[i].getByText('초대 코드로 입장하기',{exact:true}).click();await players[i].getByRole('textbox',{name:'초대 코드'}).fill(invite);await players[i].getByRole('button',{name:'참가하기',exact:true}).click();await players[i].locator('.room-title').waitFor();}
  await players[0].getByRole('button',{name:/드워프 전사 바훈투르/}).click();await players[1].getByRole('button',{name:/엘프 궁수 니나브/}).click();await players[0].getByText('니나브',{exact:true}).last().waitFor();
  for(const p of players)await p.getByRole('button',{name:'준비 완료',exact:true}).click();await players[0].getByRole('button',{name:'경기 시작',exact:true}).click();
  for(let i=0;i<playerCount;i++){await players[i].locator('.augment-picker .card').first().waitFor();assert.equal(await players[i].locator('.augment-picker .card').count(),3);await players[i].locator('.augment-picker .card').first().click();}
  await players[0].getByRole('button',{name:'윷 던지기 ↗',exact:true}).waitFor();await players[0].screenshot({path:'/tmp/yutverse-browser/online.png'});await players[0].setViewportSize({width:390,height:844});assert.equal(await players[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await players[0].screenshot({path:'/tmp/yutverse-browser/online-mobile.png'});await players[0].getByRole('button',{name:'윷 던지기 ↗',exact:true}).click();
  await players[1].reload();if(await players[1].getByRole('button',{name:'친구와 온라인으로 플레이',exact:true}).count())await players[1].getByRole('button',{name:'친구와 온라인으로 플레이',exact:true}).click();else await players[1].getByRole('button',{name:'온라인 개인전',exact:true}).click();await players[1].getByRole('button',{name:'설정',exact:true}).click();await players[1].locator('.match-room-info code').waitFor();assert.equal(await players[1].locator('.match-room-info code').textContent(),invite);await players[1].getByRole('button',{name:'설정 닫기',exact:true}).click();
  await players[1].locator('.token-label[data-character="archer"]').first().waitFor();assert.equal(await players[1].locator('.token-label[data-character="archer"]').count(),4);
  for(let i=1;i<playerCount;i++){await players[i].getByRole('button',{name:'설정',exact:true}).click();players[i].once('dialog',dialog=>dialog.accept());await players[i].getByRole('button',{name:'기권하기',exact:true}).click();await players[i].getByRole('button',{name:'설정 닫기',exact:true}).click();}
  for(const p of players)await p.getByRole('heading',{name:'경기 종료',exact:true}).waitFor();
  await players[0].getByRole('button',{name:'대기실로 돌아가기',exact:true}).click();await players[0].getByRole('button',{name:'방 만들기',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS: single augments/reload/mobile/offline/manual consumption; ${playerCount} browser online lobby/ready/selection/throw/reconnect/forfeit/results/leave; no page errors.`);
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
