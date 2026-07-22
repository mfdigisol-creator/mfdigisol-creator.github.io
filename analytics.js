(() => {
  'use strict';
  const config = Object.assign({ gtmId:'', ga4MeasurementId:'', metaPixelId:'', consentVersion:1, currency:'PKR', debug:false }, window.AL_HUMA_ANALYTICS_CONFIG || {});
  const CONSENT_KEY = `alhuma-consent-v${config.consentVersion}`;
  const valid = { gtm:v => /^GTM-[A-Z0-9]+$/i.test(v || ''), ga4:v => /^G-[A-Z0-9]+$/i.test(v || ''), meta:v => /^\d{5,20}$/.test(v || '') };
  const dataLayer = window.dataLayer = window.dataLayer || [];
  let consent = readConsent(), integrationsLoaded = false;

  function readConsent(){ try { return JSON.parse(localStorage.getItem(CONSENT_KEY)) || null; } catch { return null; } }
  function eventId(prefix='evt'){ return `${prefix}-${crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`}`; }
  function cleanItem(item={}){ const price=Number(item.price); return { item_id:String(item.item_id || item.code || ''), item_name:String(item.item_name || item.name || ''), item_brand:String(item.item_brand || item.brand || ''), item_category:String(item.item_category || item.category || ''), price:Number.isFinite(price) ? price : undefined, quantity:Math.max(1, Number(item.quantity || item.qty || 1)) }; }
  function track(event, params={}){
    if (!event) return null;
    const id=params.event_id || eventId(event), payload={ event, event_id:id, ...params };
    if (Array.isArray(params.items)) { payload.ecommerce={ currency:params.currency || config.currency, value:params.value, items:params.items.map(cleanItem) }; delete payload.items; delete payload.currency; delete payload.value; }
    if (consent?.analytics || consent?.marketing) dataLayer.push(payload);
    if (consent?.analytics && !valid.gtm(config.gtmId) && valid.ga4(config.ga4MeasurementId) && window.gtag) window.gtag('event',event,payload.ecommerce ? {...params,...payload.ecommerce} : params);
    if (consent?.marketing && !valid.gtm(config.gtmId) && valid.meta(config.metaPixelId) && window.fbq && params.meta_event) window.fbq('track',params.meta_event,{content_ids:params.content_ids,content_type:'product',currency:params.currency || config.currency,value:params.value},{eventID:id});
    window.dispatchEvent(new CustomEvent('alhuma:measurement',{detail:payload}));
    if (config.debug) console.info('[Al Huma analytics]',payload);
    return id;
  }
  function consentCommand(action,state){ dataLayer.push(['consent',action,{ analytics_storage:state.analytics?'granted':'denied', ad_storage:state.marketing?'granted':'denied', ad_user_data:state.marketing?'granted':'denied', ad_personalization:state.marketing?'granted':'denied', functionality_storage:'granted', security_storage:'granted' }]); }
  consentCommand('default',consent || {analytics:false,marketing:false});
  function loadScript(src,id){ if(id && document.getElementById(id))return; const script=document.createElement('script'); script.async=true; script.src=src; if(id)script.id=id; document.head.append(script); }
  function loadIntegrations(){
    if(!consent || integrationsLoaded)return; integrationsLoaded=true;
    if((consent.analytics || consent.marketing) && valid.gtm(config.gtmId)){ dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'}); loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`,'alhuma-gtm'); return; }
    if(consent.analytics && valid.ga4(config.ga4MeasurementId)){ loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4MeasurementId)}`,'alhuma-ga4'); window.gtag=window.gtag || function(){dataLayer.push(arguments)}; window.gtag('js',new Date()); window.gtag('config',config.ga4MeasurementId,{send_page_view:true}); }
    if(consent.marketing && valid.meta(config.metaPixelId)){ window.fbq=window.fbq || function(){(window.fbq.callMethod?window.fbq.callMethod:window.fbq.queue.push).apply(window.fbq,arguments)}; window.fbq.queue=window.fbq.queue || []; window.fbq.loaded=true; window.fbq.version='2.0'; loadScript('https://connect.facebook.net/en_US/fbevents.js','alhuma-meta-pixel'); window.fbq('init',config.metaPixelId); window.fbq('track','PageView'); }
  }
  function saveConsent(next){ consent={analytics:!!next.analytics,marketing:!!next.marketing,updatedAt:new Date().toISOString()}; localStorage.setItem(CONSENT_KEY,JSON.stringify(consent)); consentCommand('update',consent); document.querySelector('[data-consent-banner]')?.remove(); loadIntegrations(); track('consent_update',{analytics:consent.analytics,marketing:consent.marketing}); }
  function showConsent(){
    if(consent || document.querySelector('[data-consent-banner]'))return;
    const style=document.createElement('style'); style.textContent='.consent-banner{position:fixed;z-index:120;left:1rem;right:1rem;bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;max-width:920px;margin:auto;padding:1rem 1.15rem;border:1px solid #b9914d;background:#17130f;color:#f6f0e5;box-shadow:0 18px 60px #0008;font:14px/1.5 Arial,sans-serif}.consent-banner p{margin:0;max-width:600px}.consent-banner a{color:#e1c17c}.consent-actions{display:flex;flex-wrap:wrap;gap:.55rem}.consent-actions button{min-height:42px;padding:.65rem .9rem;border:1px solid #c7a45f;background:transparent;color:#f6f0e5;cursor:pointer}.consent-actions [data-consent-accept]{background:#c7a45f;color:#17130f}@media(max-width:700px){.consent-banner{align-items:stretch;flex-direction:column}.consent-actions{display:grid;grid-template-columns:1fr 1fr}.consent-actions button{width:100%}}'; document.head.append(style);
    document.body.insertAdjacentHTML('beforeend','<aside class="consent-banner" data-consent-banner aria-label="Privacy choices"><p>We use optional analytics to understand website use and optional advertising tools for relevant promotions. Essential cart functions work without them. See our <a href="policies.html">policies</a>.</p><div class="consent-actions"><button type="button" data-consent-essential>Essential only</button><button type="button" data-consent-accept>Accept all optional</button></div></aside>');
    const banner=document.querySelector('[data-consent-banner]'); banner.querySelector('[data-consent-essential]').onclick=()=>saveConsent({analytics:false,marketing:false}); banner.querySelector('[data-consent-accept]').onclick=()=>saveConsent({analytics:true,marketing:true});
  }
  window.AlHumaAnalytics={track,eventId,getConsent:()=>consent,setConsent:saveConsent,config};
  document.addEventListener('click',event=>{ const whatsapp=event.target.closest('a[href*="wa.me"],a[href*="whatsapp.com"]'); if(whatsapp)track('whatsapp_click',{link_text:(whatsapp.textContent||'').trim().slice(0,100),link_url:whatsapp.href,meta_event:'Contact'}); if(event.target.closest('[data-chat-launcher]'))track('assistant_open'); const question=event.target.closest('[data-chat-question]'); if(question)track('assistant_question',{question_type:'quick',question:(question.dataset.chatQuestion||'').slice(0,120)}); const recommendation=event.target.closest('.chat-actions a'); if(recommendation)track('assistant_recommendation_click',{link_text:(recommendation.textContent||'').trim().slice(0,100),link_url:recommendation.href}); });
  document.addEventListener('submit',event=>{ if(event.target.matches('[data-chat-form]')){ const question=String(new FormData(event.target).get('question')||'').trim(); track('assistant_question',{question_type:'typed',question_length:question.length}); } });
  window.addEventListener('DOMContentLoaded',()=>{showConsent();loadIntegrations()});
})();
