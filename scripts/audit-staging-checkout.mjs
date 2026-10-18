// Bounded staging-only checkout probe. No valid Turnstile token is supplied:
// every POST MUST be rejected and no order may be registered.
import assert from 'node:assert/strict';
const STAGING='https://alhuma-orders-staging.alhumacollection.workers.dev';
const STAGING_ORIGIN='https://alhuma-storefront-staging.pages.dev';
const checks=[];
async function hit(label,path,{method='GET',origin,body}={}){
  const headers={'Accept':'application/json','User-Agent':'AlHumaStagingCheckoutAudit/1.0'};
  if(origin)headers.Origin=origin;
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(STAGING+path,{
    method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),
    redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store'
  });
  const value=await r.json().catch(()=>({}));
  const result={label,status:r.status,code:value.code||null,success:value.success===true,
    cors:r.headers.get('access-control-allow-origin'),idempotent:value.idempotent||false,
    orderIdReturned:!!value.order_id};
  checks.push(result);return {r,result,value};
}
const health=await hit('health','/health');
assert.equal(health.r.status,200);
assert.equal(health.value.environment,'staging');
assert.equal(health.value.deployment_mode,'active');

const options=await hit('allowed preflight','/v1/orders',{method:'OPTIONS',origin:STAGING_ORIGIN});
assert.equal(options.r.status,204);
assert.equal(options.r.headers.get('access-control-allow-origin'),STAGING_ORIGIN);
const disallowed=await hit('unapproved origin','/v1/orders',{method:'POST',origin:'https://invalid.example',body:{}});
assert.equal(disallowed.r.status,403);
assert.equal(disallowed.value.code,'ORIGIN_REJECTED');
const malformed=await hit('malformed payload','/v1/orders',{method:'POST',origin:STAGING_ORIGIN,body:{}});
assert.equal(malformed.r.status,400);
assert.equal(malformed.value.code,'VALIDATION_FAILED');
const payload={
  idempotency_key:'0f4c1733-bb84-447c-ab30-ed171e80c023',
  turnstile_token:'synthetic-audit-invalid-token',
  customer:{name:'Staging Audit',mobile:'03000000000',email:'staging-test@example.invalid',
    city_type:'sialkot',city:'Sialkot',address:'Nonexistent test address',notes:'AUTOMATED STAGING AUDIT ONLY'},
  items:[{product_id:'NONEXISTENT-STAGING-AUDIT-SKU',quantity:1}],
  measurement:{marketing_consent:false,consent_version:1,source_url:STAGING_ORIGIN+'/'}
};
const invalid=await hit('invalid Turnstile rejected','/v1/orders',{method:'POST',origin:STAGING_ORIGIN,body:payload});
assert.equal(invalid.r.status,400);
assert.equal(invalid.value.code,'BOT_CHECK_FAILED');
assert.ok(checks.every(c=>!c.orderIdReturned&&!c.idempotent),'Unexpected order was registered');
console.log('STAGING_CHECKOUT_AUDIT_BEGIN');
console.log(JSON.stringify({checks,orderSubmissionsAccepted:0,metaPurchaseDisabled:'verified separately via staging Worker bindings',note:'Does not establish a successful valid-Turnstile order lifecycle'},null,2));
console.log('STAGING_CHECKOUT_AUDIT_END');
