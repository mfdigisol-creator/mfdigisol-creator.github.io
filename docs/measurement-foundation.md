# Measurement foundation

The storefront emits standardized events through `window.AlHumaAnalytics`. Platform scripts remain disabled until consent is recorded. GTM handles Google Analytics, while Meta Pixel and the Cloudflare Conversions API bridge are controlled directly by the website so both Meta channels receive the same `event_id`.

## Public configuration

- `gtmId`: Google Analytics integration path.
- `ga4MeasurementId`: optional direct GA4 fallback when GTM is blank.
- `metaPixelId`: direct browser Meta Pixel identifier.
- `metaCapiEndpoint`: public Cloudflare Worker `/events` endpoint.

Never store a Meta CAPI token or any other secret in this repository. The access token remains only in the Cloudflare Worker secret `META_ACCESS_TOKEN`.

## Event contract

| Website event | GA4 use | Meta mapping |
|---|---|---|
| `view_item` | View product details | `ViewContent` |
| `search` | Catalogue search | `Search` |
| `add_to_cart` | Add product to cart | `AddToCart` |
| `begin_checkout` | Open COD checkout | `InitiateCheckout` |
| `generate_lead` | Submit COD order | `Lead` |
| `whatsapp_click` | WhatsApp contact | `Contact` |
| `assistant_open` | Assistant engagement | Custom event |
| `assistant_question` | Assistant question | Custom event |
| `assistant_recommendation_click` | Assistant recommendation click | Custom event |

Every event receives an `event_id`. Commerce events include PKR currency, value where known, stable product codes, item names, brands, categories, prices and quantities. A COD form submission is deliberately not reported as `purchase`; a verified Purchase event requires the secure order/CAPI layer.

## GTM requirements

1. Add a GA4 configuration tag that respects Analytics Storage consent.
2. Trigger GA4 event tags from the website event names above and pass the `ecommerce` object.
3. Do not duplicate Meta tags in GTM; the website directly controls Meta Pixel after marketing consent.
4. Validate GA4 in GTM Preview/DebugView and Meta browser/server events in Meta Test Events.

The consent banner defaults analytics and advertising storage to denied. Essential cart storage remains available independently.
