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
  await cmd('Network.setCacheDisabled',{cacheDisabled:true});
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__auditLab={lcp:0,cls:0};try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__auditLab.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})}catch{}try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__auditLab.cls+=e.value}).observe({type:'layout-shift',buffered:true})}catch{}"});
  const scenarios=[
    {label:'mobile_4g',latency:150,downKbps:1600,upKbps:750,cpuFactor:4},
    {label:'slow_3g',latency:400,downKbps:400,upKbps:400,cpuFactor:4}
  ];
  const results=[];
  for(const scenario of scenarios){
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await cmd('Network.emulateNetworkConditions',{offline:false,latency:scenario.latency,
      downloadThroughput:scenario.downKbps*1000/8,uploadThroughput:scenario.upKbps*1000/8});
    await cmd('Emulation.setCPUThrottlingRate',{rate:scenario.cpuFactor});
    await cmd('Network.clearBrowserCache');
    await cmd('Page.navigate',{url:'https://alhumacollection.com/'});
    let ready=false;
    for(let i=0;i<240;i++){
      try{ready=await evalPage("document.readyState==='complete' && !!window.AlHumaCatalogue")}catch{}
      if(ready)break;
      await sleep(250);
    }
    if(!ready)throw new Error(scenario.label+' homepage not ready within 60 seconds');
    const base=await evalPage("(()=>{const n=performance.getEntriesByType('navigation')[0],p=performance.getEntriesByType('paint');return {loadMs:Math.round(n.loadEventEnd),domContentLoadedMs:Math.round(n.domContentLoadedEventEnd),firstContentfulPaintMs:Math.round(p.find(x=>x.name==='first-contentful-paint')?.startTime||0)}})()");
    const startTime=Date.now();
    const loaded=await evalPage("window.AlHumaCatalogue.load().then(()=>({ok:!!window.AlHumaCatalogueSnapshot,products:window.AlHumaCatalogueSnapshot?.products?.length||0})).catch(e=>({ok:false,message:String(e)}))",90000);
    const catalogueInvocationMs=Date.now()-startTime;
    await sleep(500);
    const metrics=await evalPage("(()=>{const r=performance.getEntriesByType('resource'),c=r.filter(x=>x.name.includes('dawood-products.json'));return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,catalogue:c.map(x=>({durationMs:Math.round(x.duration),transferBytes:x.transferSize,decodedBytes:x.decodedBodySize})),lcpObservedMs:Math.round(window.__auditLab?.lcp||0),clsObserved:Number((window.__auditLab?.cls||0).toFixed(4)),requests:r.length,totalResourceTransferBytes:r.reduce((n,x)=>n+x.transferSize,0)}})()");
    results.push({...scenario,...base,loaded,catalogueInvocationMs,...metrics});
    if(!loaded.ok)process.exitCode=1;
    if(metrics.documentWidth>metrics.viewport+3)process.exitCode=1;
  }
  console.log('ALHUMA_THROTTLED_AUDIT_BEGIN');
  console.log(JSON.stringify({at:new Date().toISOString(),scope:'Chrome runner, simulated mobile 390px / CPU 4x; Chrome network throttling; no orders placed',scenarios:results,blockedWriteRequests:blocked.count,exceptions:issues.slice(0,12)},null,2));
  console.log('ALHUMA_THROTTLED_AUDIT_END');
}catch(error){console.error('ALHUMA_THROTTLED_AUDIT_ERROR',error?.stack||String(error));process.exitCode=1}finally{try{ws?.close()}catch{}child.kill('SIGKILL');await sleep(650);try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250})}catch(error){console.warn('Temporary Chrome profile cleanup warning:',error?.message)}}
