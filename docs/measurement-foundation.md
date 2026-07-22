# Measurement foundation

The storefront emits standardized events through `window.AlHumaAnalytics`. Platform scripts remain disabled until consent is recorded and valid public IDs are added to `analytics-config.js`.

## Public configuration

- `gtmId`: preferred integration path. Configure GA4 and Meta tags inside this GTM container.
- `ga4MeasurementId`: optional direct GA4 fallback when GTM is blank.
- `metaPixelId`: optional direct Meta Pixel fallback when GTM is blank.

Never store a Meta CAPI token or any other secret in this repository. CAPI belongs in the future server-side milestone.

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
3. Add Meta Pixel PageView and event tags that respect Advertising Storage consent.
4. Map the `meta_event` field to the corresponding Meta event name.
5. Pass `event_id` for future browser/server deduplication.
6. Validate in GTM Preview, GA4 DebugView and Meta Test Events before publishing the container.

The consent banner defaults analytics and advertising storage to denied. Essential cart storage remains available independently.
