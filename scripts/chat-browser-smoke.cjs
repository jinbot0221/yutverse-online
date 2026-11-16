const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const base=process.env.YUTVERSE_URL||'http://localhost:5173',contexts=[],errors=[];fs.mkdirSync('/tmp/yutverse-browser',{recursive:true});
 async function bounds(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const d=p.getByRole('dialog',{name:'방 채팅'});const b=await d.boundingBox(),v=p.viewportSize();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,JSON.stringify(b));for(const name of ['채팅 닫기','보내기']){const box=await d.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box.y>=b.y&&box.y+box.height<=b.y+b.height,`${name}: ${JSON.stringify(box)}`);}}
 try{
  const pages=[];
  for(let i=0;i<2;i++){
   const c=await browser.newContext({viewport:{width:390,height:844}});contexts.push(c);
   const result=await c.request.post(base+'/api/auth/register',{data:{login:`chat_${Date.now()}_${i}`,password:'browser-chat-password',nickname:i?'장난꾸러기':'채팅방장'}});assert.equal(result.status(),201);const account=await result.json();const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(a=>{localStorage.setItem('yutverse.token',a.token);localStorage.setItem('yutverse.account',JSON.stringify(a.user))},account);await p.goto(base);await p.getByRole('button',{name:'멀티플레이',exact:true}).click();await p.getByRole('button',{name:'방 만들기',exact:true}).waitFor();pages.push(p);
  }
  const [a,b]=pages,title=`채팅 테스트 ${Date.now()}`;
  await a.getByRole('textbox',{name:'방 제목',exact:true}).fill(title);await a.getByRole('combobox',{name:'방 인원',exact:true}).selectOption('2');await a.getByRole('button',{name:'방 만들기',exact:true}).click();await b.locator('.room-row').filter({hasText:title}).click();
  for(const p of pages)await p.getByRole('button',{name:/💬 채팅/}).click();
  await a.getByRole('textbox',{name:'채팅 메시지'}).fill('<b>안녕하세요!</b>');await a.getByRole('button',{name:'보내기',exact:true}).click();await b.locator('.chat-history').getByText('<b>안녕하세요!</b>',{exact:true}).waitFor();assert.equal(await b.locator('.chat-history b').count(),0);
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:1280,height:800},{width:390,height:420}]){await a.setViewportSize(viewport);await bounds(a);await a.screenshot({path:`/tmp/yutverse-browser/chat-${viewport.width}-${viewport.height}.png`});}
  await a.getByRole('button',{name:'채팅 닫기',exact:true}).click();await b.getByRole('button',{name:'채팅 닫기',exact:true}).click();
  for(const p of pages)await p.getByRole('button',{name:'준비 완료',exact:true}).click();await a.getByRole('button',{name:'경기 시작',exact:true}).click();
  await a.locator('.augment-picker .card').first().click();await b.locator('.augment-picker .card').first().click();await a.locator('canvas').waitFor();await b.locator('canvas').waitFor();
  await b.getByRole('button',{name:/💬 채팅/}).click();await b.getByRole('button',{name:'😂 이게 잡히네!',exact:true}).click();await b.getByRole('button',{name:'채팅 닫기',exact:true}).click();await a.locator('.token-reaction').getByText('😂 이게 잡히네!',{exact:true}).waitFor();await a.screenshot({path:'/tmp/yutverse-browser/chat-reaction-board.png'});
  await a.getByRole('button',{name:/💬 채팅/}).click();await a.getByRole('button',{name:'채팅 숨기기',exact:true}).click();assert.equal(await a.locator('.token-reaction').count(),0);await a.getByRole('button',{name:'채팅 닫기',exact:true}).click();await b.getByRole('button',{name:/💬 채팅/}).click();await b.getByRole('button',{name:'👏 잘했어요!',exact:true}).click();await b.getByRole('button',{name:'채팅 닫기',exact:true}).click();assert.equal(await a.locator('.token-reaction').count(),0);
  await a.getByRole('button',{name:/💬 채팅/}).click();await a.getByRole('button',{name:'채팅 표시',exact:true}).click();await a.getByRole('button',{name:'채팅 닫기',exact:true}).click();
  await a.reload();await a.getByRole('button',{name:'멀티플레이',exact:true}).click();await a.getByRole('button',{name:/💬 채팅/}).click();await a.locator('.chat-history').getByText('<b>안녕하세요!</b>',{exact:true}).waitFor();assert.equal(await a.locator('.token-reaction').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: two-player lobby/game chat, text escaping, reactions, hide/show, reconnect history and dialog bounds at six sizes including keyboard height.');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
