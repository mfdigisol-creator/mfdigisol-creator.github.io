// Analytics-ready integration. Add a GA4 measurement ID only after the business
// account has been created and its privacy requirements have been reviewed.
window.AL_HUMA_GA_MEASUREMENT_ID = window.AL_HUMA_GA_MEASUREMENT_ID || '';
(() => {
  const id = window.AL_HUMA_GA_MEASUREMENT_ID;
  if (!/^G-[A-Z0-9]+$/i.test(id)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip:true });
})();
