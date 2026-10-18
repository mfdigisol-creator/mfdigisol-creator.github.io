// Bounded, read-only external HTTP audit of canonical host and legacy collection redirects.
// No changes are made to public infrastructure, the supplier or the catalogue.
import fs from 'node:fs/promises';

const policy = JSON.parse(await fs.readFile('catalogue/host-canonical-policy.json','utf8'));
const brands = JSON.parse(await fs.readFile('catalogue/brand-slugs.json','utf8'));
const preferred = policy.preferredOrigin;
const tests = [
  {label:'apex HTTPS',url:`${preferred}/`,type:'canonical'},
  ...policy.alternateOrigins.map(origin=>({label:`alternate ${origin}`,url:`${origin}/`,type:'alternate'})),
  ...Object.entries(brands.redirects||{}).map(([alias,target])=>({
    label:`legacy ${alias}`,url:`${preferred}/collections/${encodeURIComponent(alias)}/`,
    type:'legacy',target:`${preferred}/collections/${encodeURIComponent(target)}/`
  }))
];
const hits = [];
const agent = 'AlHumaSeoReadOnlyAudit/1.0 (+https://alhumacollection.com)';
for(const test of tests){
  let lastError = null, record = null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(test.url,{
        method:'GET',redirect:'manual',headers:{'User-Agent':agent,'Accept':'text/html'},
        signal:AbortSignal.timeout(12000)
      });
      const location=response.headers.get('location')||null;
      const contentType=response.headers.get('content-type')||'';
      const html=contentType.includes('html') ? (await response.text()).slice(0,15000):'';
      const canonical=html.match(/<link\\s+rel=["']canonical["']\\s+href=["']([^"']+)/i)?.[1]||null;
      const robots=html.match(/<meta\\s+name=["']robots["']\\s+content=["']([^"']+)/i)?.[1]||null;
      const refresh=html.match(/<meta\\s+http-equiv=["']refresh["']\\s+content=["']([^"']+)/i)?.[1]||null;
      record={label:test.label,type:test.type,url:test.url,status:response.status,location,canonical,robots,refresh,
        expectedTarget:test.target||null, 
        permanentHttpRedirect:[301,308].includes(response.status),
        canonicalMatchesTarget:test.target ? canonical === test.target : null,
        redirectsToExpectedTarget: test.target ? (location ? new URL(location,test.url).href===test.target : false):null
      };
      break;
    }catch(error){lastError=String(error?.message||error);}
  }
  hits.push(record||{label:test.label,type:test.type,url:test.url,error:lastError});
}
const errors=hits.filter(x=>x.error);
const legacy=hits.filter(x=>x.type==='legacy');
const alternate=hits.filter(x=>x.type==='alternate');
const summary={
  audited:tests.length,networkErrors:errors.length,
  legacyTotal:legacy.length,
  legacyPermanentHttpRedirects:legacy.filter(x=>x.permanentHttpRedirect&&x.redirectsToExpectedTarget).length,
  legacyHtmlRefresh:legacy.filter(x=>x.status===200&&x.refresh).length,
  alternatePermanentHttpRedirects:alternate.filter(x=>x.permanentHttpRedirect).length,
  preferredHomeHealthy:hits.find(x=>x.type==='canonical')?.status===200
};
console.log('SEO_HTTP_REDIRECT_AUDIT_BEGIN');
console.log(JSON.stringify({summary,results:hits},null,2));
console.log('SEO_HTTP_REDIRECT_AUDIT_END');
// Do not fail the diagnostic PR merely because a legacy HTTP 301 is currently absent.
// Failing on inability to reach all targets prevents a false "audit passed" assessment.
if(errors.length) process.exitCode=1;
