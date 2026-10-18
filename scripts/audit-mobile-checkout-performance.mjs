// Read-only Chrome DevTools audit. Intercept and block ALL non-GET/HEAD requests.
// Cart and checkout UI are simulated in a disposable browser profile; no order is submitted.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const binary=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync);
if(!binary)throw new Error('Chrome is unavailable on this audit runner');
const profile=await mkdtemp(join(tmpdir(),'alhuma-audit-'));
const port=9237;
const child=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws;
try{
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/json/version');if(r.ok){ready=true;break}}catch{}await sleep(250)}
  if(!ready)throw new Error('Chrome DevTools did not start');
  const tab=await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});
  const jobs=new Map(),issues=[],blocked={count:0};let nextId=1;
  const cmd=(method,params={},timeoutMs=65000)=>new Promise((ok,fail)=>{
    const id=nextId++,timer=setTimeout(()=>{jobs.delete(id);fail(new Error(method+' timed out'))},timeoutMs);
    jobs.set(id,{ok,fail,timer,method});ws.send(JSON.stringify({id,method,params}));
  });
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const j=jobs.get(m.id);if(!j)return;clearTimeout(j.timer);jobs.delete(m.id);if(m.error)j.fail(new Error('CDP '+j.method+': '+(m.error.message||'unknown')+' '+(m.error.data||'')));else j.ok(m.result||{});return}
    if(m.method==='Fetch.requestPaused'){
      if(!['GET','HEAD'].includes(m.params.request.method)){blocked.count++;cmd('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
      else cmd('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
    }
    if(m.method==='Runtime.exceptionThrown')issues.push(String(m.params.exceptionDetails?.exception?.description||'').slice(0,200));
  });
  const evalPage=async(expression,ms=65000)=>{
    const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},ms);
    if(r.exceptionDetails)throw new Error('Browser evaluation: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));
    return r.result?.value;
  };
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
  await cmd('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await cmd('Page.navigate',{url:'https://alhumacollection.com/'});
  let loaded=false;
  for(let i=0;i<80;i++){try{loaded=await evalPage("document.readyState==='complete' && !!window.AlHumaOrdersClient");if(loaded)break}catch{}await sleep(250)}
  if(!loaded)throw new Error('Homepage did not complete startup');
  await sleep(850);
  const layout="(()=>{const w=innerWidth,d=document.documentElement.scrollWidth;const rect=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();return {left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),height:Math.round(r.height)}};return {viewport:w,documentWidth:d,overflow:d>w+3,header:rect('[data-header]'),cart:rect('.cart-launcher'),firstCard:rect('.live-product'),checkout:rect('.checkout-dialog')}})()";
  const initially=await evalPage(layout);
  const began=Date.now();
  const catalog=await evalPage("window.AlHumaCatalogue.load().then(()=>({ok:!!window.AlHumaCatalogueSnapshot,products:window.AlHumaCatalogueSnapshot?.products?.length||0})).catch(e=>({ok:false,error:String(e)}))",90000);
  const catalogMs=Date.now()-began;
  const widths=[];
  for(const width of [360,390,768,1366]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height:width<=390?780:900,deviceScaleFactor:width<=390?2:1,mobile:width<800});
    await sleep(200);widths.push(await evalPage(layout));
  }
  await cmd('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:2,mobile:true});
  const checkout=await evalPage("(()=>{window.AlHumaAnalytics={track:()=>{}};const item=window.AlHumaCatalogueSnapshot?.products?.find(p=>p.available&&p.price>0);if(!item)return {error:'No orderable product'};window.dispatchEvent(new CustomEvent('alhuma:add-to-cart',{detail:{product:{code:item.code,name:item.name,price:item.price,image:''}}}));const btn=document.querySelector('.cart-checkout');if(!btn||btn.disabled)return {error:'Cart checkout inaccessible'};btn.click();const form=document.querySelector('.checkout-form'),city=form?.elements.City;city.value='Outside Sialkot';city.dispatchEvent(new Event('change'));return {dialogOpen:document.querySelector('.checkout-dialog')?.open,cartCount:document.querySelector('[data-cart-count]')?.textContent,otherCityRequired:form.elements['Other city'].required,formInvalidWithoutCustomerData:!form.checkValidity(),submitDisabled:document.querySelector('.checkout-submit').disabled,checkoutWidth:Math.round(document.querySelector('.checkout-dialog').getBoundingClientRect().width),viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}})()");
  const ui=await evalPage(checkout);
  const timing=await evalPage("(()=>{const nav=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource'),c=r.filter(x=>x.name.includes('dawood-products.json')).map(x=>({durationMs:Math.round(x.duration),transferBytes:x.transferSize,decodedBytes:x.decodedBodySize}));return {loadEventMs:Math.round(nav?.loadEventEnd||0),domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),resourceCount:r.length,catalogue:c,totalResourceTransferBytes:r.reduce((n,x)=>n+x.transferSize,0)}})()");
  console.log('ALHUMA_BROWSER_AUDIT_BEGIN');
  console.log(JSON.stringify({at:new Date().toISOString(),browser:binary,scope:'Production GET only; POST blocked',initially,catalog,catalogMs,widths,checkout:ui,timing,blockedWriteRequests:blocked.count,exceptions:issues.slice(0,10)},null,2));
  console.log('ALHUMA_BROWSER_AUDIT_END');
  if(!catalog.ok||widths.some(x=>x.overflow))process.exitCode=1;
}catch(error){console.error('ALHUMA_BROWSER_AUDIT_ERROR',error?.stack||String(error));process.exitCode=1}finally{try{ws?.close()}catch{}child.kill('SIGKILL');await sleep(650);try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250})}catch(error){console.warn('Temporary Chrome profile cleanup warning:',error?.message)}}
