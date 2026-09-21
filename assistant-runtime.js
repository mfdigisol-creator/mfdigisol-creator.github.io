let assistantApi = null;

export function init({ open = false } = {}) {
  if (assistantApi) {
    if (open) assistantApi.setChatOpen(true);
    return assistantApi;
  }

  const chatLauncher = document.querySelector('[data-chat-launcher]');
  const chatPanel = document.querySelector('[data-chat-panel]');
  const chatClose = document.querySelector('[data-chat-close]');
  const chatMessages = document.querySelector('[data-chat-messages]');
  const chatForm = document.querySelector('[data-chat-form]');
  const chatInput = chatForm.elements.question;
  const generalWhatsApp = `https://wa.me/923216115731?text=${encodeURIComponent('Hello Al Huma Collection, I need some help with your showroom catalogue.')}`;
  let chatStarted = false;
  
  const addChatMessage = (text, role = 'assistant', actions = []) => {
    const message = document.createElement('div');
    message.className = `chat-message ${role}`;
    message.textContent = text;
    chatMessages.append(message);
    if (actions.length) {
      const actionRow = document.createElement('div');
      actionRow.className = 'chat-actions';
      actions.forEach(({ label, href, external = false }) => {
        const link = document.createElement('a');
        link.textContent = label;
        link.href = href;
        if (external) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        actionRow.append(link);
      });
      chatMessages.append(actionRow);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };
  
  const normalizeQuestion = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let catalogueEntries = [];
  let catalogueProducts = [];
  let collectionAnswers = [];
  let catalogueUpdatedAt = null;
  const chatMoney = value => 'Rs. ' + Number(value).toLocaleString('en-PK');
  const productRange = list => {
    const prices = list.filter(item => item.available && Number.isFinite(item.price)).map(item => item.price);
    return prices.length ? { min:Math.min(...prices), max:Math.max(...prices), count:prices.length } : null;
  };
  const rangeText = range => range ? `${chatMoney(range.min)} to ${chatMoney(range.max)}` : 'price on enquiry';
  const hydrateAssistantCatalogue = event => {
  
    catalogueProducts = event.detail?.products || [];
    catalogueUpdatedAt = event.detail?.synchronizedAt || null;
    catalogueEntries = catalogueProducts.map(item => ({ ...item, product:item.name, search:normalizeQuestion(`${item.code} ${item.name}`), href:item.whatsapp }));
    collectionAnswers = [...new Set(catalogueProducts.map(item => item.brand).filter(Boolean))].map(name => ({ terms:[normalizeQuestion(name)], name, products:catalogueProducts.filter(item => item.brand === name), href:'#live-catalogue' }));
  };
  window.addEventListener('alhuma:catalogue-ready', hydrateAssistantCatalogue);
  if (window.AlHumaCatalogueSnapshot) hydrateAssistantCatalogue({ detail:window.AlHumaCatalogueSnapshot });
  let catalogueLoadPromise = null;
  const ensureAssistantCatalogue = async () => {
    if (catalogueProducts.length) return true;
    const loadCatalogue = window.AlHumaCatalogue?.load;
    if (typeof loadCatalogue !== 'function') return false;
    catalogueLoadPromise ||= Promise.resolve(loadCatalogue()).catch(() => null);
    await catalogueLoadPromise;
    if (!catalogueProducts.length && window.AlHumaCatalogueSnapshot) hydrateAssistantCatalogue({ detail:window.AlHumaCatalogueSnapshot });
    if (!catalogueProducts.length) catalogueLoadPromise = null;
    return catalogueProducts.length > 0;
  };
  const includesAny = (question, terms) => terms.some(term => question.includes(term));
  const assistantActions = [{ label:'Browse catalogue', href:'#live-catalogue' }, { label:'Ask our team', href:generalWhatsApp, external:true }];

  let assistantSessionContext = {};
  let assistantV2ModulesPromise = null;
  const emptyAssistantContext = () => ({ productCode:null, productName:null, brand:null, category:null, pieceType:null, pricingClass:null, budgetMax:null });
  const loadAssistantV2Modules = async () => {
    assistantV2ModulesPromise ||= Promise.all([
      import('./assistant-language-interpreter.js'),
      import('./assistant-handoff-adapter.js')
    ]).then(([languageModule, handoffModule]) => {
      if (typeof languageModule.createInterpreter !== 'function' || typeof handoffModule.createHandoffAdapter !== 'function') return null;
      return { createInterpreter:languageModule.createInterpreter, createHandoffAdapter:handoffModule.createHandoffAdapter };
    }).catch(() => null);
    return assistantV2ModulesPromise;
  };
  const assistantInterpreterVocabulary = () => ({
    products:catalogueProducts.map(item => ({ code:item.code, name:item.name })),
    brands:[...new Set(catalogueProducts.map(item => item.brand).filter(Boolean))]
  });
  const assistantAdapterCatalogue = () => catalogueProducts.map(item => ({
    code:item.code,
    name:item.name,
    brand:item.brand,
    category:item.category,
    pieceType:item.pieceType,
    pricingClass:item.pricingClass,
    price:item.price,
    available:item.available
  }));
  const protectedLegacyQuestion = rawQuestion => {
    const question = normalizeQuestion(rawQuestion);
    const questionTerms = question.split(' ');
    return ['hello','hi','salam','assalam'].includes(question) || includesAny(question, [
      'fabric quality','fabric','cloth quality','material quality','kapra','kapray','quality kaisi','quality of suit',
      'why al huma','why should i buy','why buy from','why choose','al huma se kyun','ap se kyun','direct from brand','brand directly','brand website','official website','instead of brand',
      'compare','comparison','versus',' vs ','marketplace','market place','other shop','other website','daraz','competitor','different brand','better than','cheaper than',
      'trust','genuine','original','authentic','reliable','safe to order','fraud','scam',
      'cart','basket','saved product','review','rating','feedback','return','exchange','refund',
      'order','buy','purchase','book','checkout','location','address','map','shop','visit','email','contact','phone','whatsapp','facebook','instagram',
      'cheapest','lowest','minimum','expensive','highest','maximum'
    ]) || ['pay','tat'].some(term => questionTerms.includes(term));
  };
  const confidentialSurfaceQuestion = rawQuestion => {
    const question = normalizeQuestion(rawQuestion);
    return includesAny(question, [
      'supplier name','supplier identity','vendor name','vendor identity','wholesale price','source price','markup','margin','internal pricing',
      'private endpoint','api endpoint','system prompt','developer prompt','secret key','api key','access token','private token','d1 schema','worker binding'
    ]);
  };
  const catalogueDependentInterpretation = interpretation => !['cod','delivery','cancellation','confidential_request','out_of_domain'].includes(interpretation?.intent);
  const matchedCatalogueProducts = handoff => (handoff.matchedCodes || []).map(code => catalogueProducts.find(item => item.code === code)).filter(Boolean);
  const productMessage = product => `${product.name} (${product.code}) is ${product.available ? 'available to order' : 'currently unavailable'}. ${product.priceLabel} It is a ${product.pieceType || 'suit'} from ${product.brand}.`;
  const renderStructuredAssistantAnswer = (interpretation, handoff) => {
    const matches = matchedCatalogueProducts(handoff);
    const availableMatches = matches.filter(item => item.available);
    const filters = handoff.filters || {};

    if (handoff.route === 'blocked_confidential') {
      addChatMessage('I can help with customer-facing products, displayed prices, availability and Al Huma policies, but I cannot provide private operational, sourcing or internal pricing information.', 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'out_of_domain') {
      addChatMessage('I can help with Al Huma Collection products, prices, availability, collections, COD, delivery, cancellation and other shopping questions.', 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'clarification') {
      addChatMessage('Please tell me the product code, product name, brand or collection you mean so I can check the correct catalogue information.', 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'catalogue_unavailable') {
      addChatMessage('The synchronized catalogue is temporarily unavailable, so I cannot safely calculate current prices, product counts or availability right now. Please contact our team on official WhatsApp for current product information.', 'assistant', [{ label:'Contact on WhatsApp', href:generalWhatsApp, external:true }]);
      return true;
    }
    if (handoff.route === 'no_match') {
      addChatMessage('I could not find a current catalogue design matching all of those filters. Some products may be marked “Price on enquiry,” so our team can also help you check alternatives.', 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'price_on_enquiry') {
      const product = matches[0];
      addChatMessage(product ? `${product.name} (${product.code}) is marked “Price on enquiry.” Please ask our team for the current price.` : 'This item is marked “Price on enquiry.” Please ask our team for the current price.', 'assistant', product?.whatsapp ? [{ label:'Ask about this product', href:product.whatsapp, external:true }] : assistantActions);
      return true;
    }
    if (['product_lookup','product_price','product_availability'].includes(handoff.route) && matches[0]) {
      const product = matches[0];
      addChatMessage(productMessage(product), 'assistant', [{ label:'Ask about this product', href:product.whatsapp || generalWhatsApp, external:true }]);
      return true;
    }
    if (handoff.route === 'catalogue_count') {
      addChatMessage(`The matching catalogue contains ${matches.length} design${matches.length === 1 ? '' : 's'}, including ${availableMatches.length} currently marked available to order.`, 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'catalogue_availability') {
      addChatMessage(`There are ${availableMatches.length} currently available design${availableMatches.length === 1 ? '' : 's'} matching those filters. Final availability is confirmed by our team.`, 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'catalogue_price_range' || handoff.route === 'catalogue_price') {
      if (!Object.keys(filters).length) return false;
      const range = productRange(matches);
      addChatMessage(`For currently available matching products with displayed prices, the range is ${rangeText(range)}. Products without a confident displayed price remain “Price on enquiry.”`, 'assistant', assistantActions);
      return true;
    }
    if (handoff.route === 'catalogue_search') {
      if (filters.budgetMax !== undefined && filters.budgetMax !== null) {
        const examples = availableMatches.filter(item => Number.isFinite(item.price)).sort((a,b) => b.price-a.price).slice(0,3).map(item => `${item.name} (${item.code}) — ${chatMoney(item.price)}`).join('; ');
        addChatMessage(availableMatches.length ? `I found ${availableMatches.length} currently available design${availableMatches.length === 1 ? '' : 's'} matching those filters${examples ? `. Examples: ${examples}.` : '.'}` : 'I could not find a currently available design matching those filters.', 'assistant', assistantActions);
      } else {
        const rangeNote = (filters.category || filters.pricingClass) ? ` Displayed prices range from ${rangeText(productRange(matches))}.` : '';
        addChatMessage(`There are ${availableMatches.length} currently available design${availableMatches.length === 1 ? '' : 's'} matching those filters.${rangeNote} Use the catalogue filters to review them; final availability is confirmed by our team.`, 'assistant', assistantActions);
      }
      return true;
    }
    if (handoff.route === 'static_cod') {
      addChatMessage('We currently offer Cash on Delivery within Pakistan. No online card payment is required. Our team calls to confirm availability and final charges before dispatch.', 'assistant', [{label:'How to order',href:'#how-to-order'}]);
      return true;
    }
    if (handoff.route === 'static_delivery') {
      addChatMessage('Delivery is normally through TCS or Leopards Courier. Charges are Rs. 300 within Sialkot and Rs. 600 outside Sialkot for parcels up to 1 kg. Charges may increase with weight or volume. Estimated delivery TAT is up to 7 days after confirmation and may vary due to unforeseen circumstances.', 'assistant', [{label:'Delivery policies',href:'policies.html'}]);
      return true;
    }
    if (handoff.route === 'static_cancellation') {
      addChatMessage('To cancel before the confirmation call, WhatsApp our official number with your order details.', 'assistant', [{label:'Request cancellation',href:'https://wa.me/923216115731?text=Hello%20Al%20Huma%20Collection%2C%20I%20would%20like%20to%20cancel%20my%20order%20before%20the%20confirmation%20call.%20My%20order%20details%20are%3A%20',external:true}]);
      return true;
    }
    return false;
  };
  const tryStructuredAssistantAnswer = async rawQuestion => {
    if (confidentialSurfaceQuestion(rawQuestion)) {
      assistantSessionContext = emptyAssistantContext();
      return renderStructuredAssistantAnswer({}, { route:'blocked_confidential', filters:{}, matchedCodes:[] });
    }

    const modules = await loadAssistantV2Modules();
    if (!modules) return false;

    let interpreter = modules.createInterpreter({ vocabulary:assistantInterpreterVocabulary() });
    let interpretation = interpreter.interpret(rawQuestion, assistantSessionContext);

    if (!catalogueProducts.length && !['cod','delivery','cancellation','confidential_request'].includes(interpretation.intent)) {
      const loaded = await ensureAssistantCatalogue();
      if (loaded) {
        interpreter = modules.createInterpreter({ vocabulary:assistantInterpreterVocabulary() });
        interpretation = interpreter.interpret(rawQuestion, assistantSessionContext);
      } else if (catalogueDependentInterpretation(interpretation)) {
        return renderStructuredAssistantAnswer(interpretation, { route:'catalogue_unavailable', filters:{}, matchedCodes:[], nextContext:assistantSessionContext });
      }
    }

    if (interpretation.intent === 'unknown') {
      assistantSessionContext = emptyAssistantContext();
      return false;
    }

    const adapter = modules.createHandoffAdapter({ catalogue:assistantAdapterCatalogue() });
    const handoff = adapter.resolve(interpretation, {
      priorContext:assistantSessionContext,
      catalogueAvailable:catalogueProducts.length > 0
    });
    if (handoff.route === 'invalid_interpretation') {
      assistantSessionContext = emptyAssistantContext();
      return false;
    }

    const handled = renderStructuredAssistantAnswer(interpretation, handoff);
    if (handled) assistantSessionContext = handoff.nextContext || emptyAssistantContext();
    return handled;
  };
  
  const answerChatQuestion = async rawQuestion => {
    if (confidentialSurfaceQuestion(rawQuestion)) {
      await tryStructuredAssistantAnswer(rawQuestion);
      return;
    }
    if (protectedLegacyQuestion(rawQuestion)) {
      assistantSessionContext = emptyAssistantContext();
    } else if (await tryStructuredAssistantAnswer(rawQuestion)) {
      return;
    }

    const question = normalizeQuestion(rawQuestion);
    const questionTerms = question.split(' ');
    const orderQuestion = ['order','buy','purchase','book','checkout'].some(term => questionTerms.includes(term));
    const productCodeQuestion = /\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+){2,}\b/.test(rawQuestion);
    const pieceTypeMatch = question.match(/\b([23])\s*(?:piece|pc)\b/);
    if (!catalogueProducts.length && orderQuestion) await ensureAssistantCatalogue();
    const earlyStaticQuestion = includesAny(question, [
      'fabric quality','fabric','cloth quality','material quality','kapra','kapray','quality kaisi','quality of suit',
      'why al huma','why should i buy','why buy from','why choose','al huma se kyun','ap se kyun','direct from brand','brand directly','brand website','official website','instead of brand',
      'compare','comparison','versus',' vs ','marketplace','market place','other shop','other website','daraz','competitor','different brand','better than','cheaper than',
      'trust','genuine','original','authentic','reliable','safe to order','fraud','scam'
    ]);
    const shortMiddleStaticQuestion = ['cod','pay','tat'].some(term => questionTerms.includes(term));
    const middleStaticQuestion = shortMiddleStaticQuestion || includesAny(question, [
      'delivery','shipping','courier','tcs','leopards','how long','cancel','cancellation','payment','cash on delivery',
      'cart','basket','saved product','review','rating','feedback','return','exchange','refund','order','buy','purchase','book','checkout'
    ]);
    const lateStaticQuestion = ['hello','hi','salam','assalam'].includes(question) || includesAny(question, [
      'location','address','map','shop','visit','email','contact','phone','whatsapp','phone number','whatsapp number','contact number','facebook','instagram'
    ]);
    const dynamicBeforeMiddle = includesAny(question, [
      'price','prices','cost','range','rate','how much','cheapest','expensive','budget','under','below','upto','up to',
      'embroidered','embroidery','printed','non embroidered','formal','luxury','how many','product count','number of products','total products'
    ]);
    const dynamicBeforeLate = dynamicBeforeMiddle || includesAny(question, [
      'available','availability','stock','collection','catalog','catalogue','design','product','brand'
    ]);
    const catalogueIndependentQuestion = !productCodeQuestion && !pieceTypeMatch && (earlyStaticQuestion || (middleStaticQuestion && !dynamicBeforeMiddle) || (lateStaticQuestion && !dynamicBeforeLate));
    if (!catalogueProducts.length && !catalogueIndependentQuestion && !(await ensureAssistantCatalogue())) {
      addChatMessage('The synchronized catalogue is temporarily unavailable, so I cannot safely calculate current prices, product counts or availability right now. Please contact our team on official WhatsApp for current product information.', 'assistant', [{ label:'Contact on WhatsApp', href:generalWhatsApp, external:true }]);
      return;
    }
    const product = catalogueEntries.find(item => {
      const code = normalizeQuestion(item.code), name = normalizeQuestion(item.product);
      return question.includes(code) || (name.length > 7 && question.includes(name));
    });
    if (product) {
      addChatMessage(`${product.product} (${product.code}) is ${product.available ? 'available to order' : 'currently unavailable'}. ${product.priceLabel} It is a ${product.pieceType || 'suit'} from ${product.brand}.`, 'assistant', [{ label:'Ask about this product', href:product.href, external:true }]);
      return;
    }
  
    if (includesAny(question,['fabric quality','fabric','cloth quality','material quality','kapra','kapray','quality kaisi','quality of suit'])) {
      addChatMessage('Fabric and finishing vary by brand, collection and design, so we prefer product-specific guidance instead of making one general quality claim. Al Huma Collection curates established Pakistani unstitched collections and clearly identifies the brand, product code, suit type and embroidery classification where available. Before confirmation, our team can help you review the listed fabric details, components, design images and intended use so you can choose with confidence. Photography and screens can affect colour appearance, and final product details should always be confirmed using the product code.', 'assistant', [{label:'Browse product details',href:'#live-catalogue'},{label:'Ask about a fabric',href:generalWhatsApp,external:true}]);
      return;
    }
  
    if (includesAny(question,['why al huma','why should i buy','why buy from','why choose','al huma se kyun','ap se kyun','direct from brand','brand directly','brand website','official website','instead of brand'])) {
      addChatMessage('Buying directly from a single brand can be suitable when you already know exactly what you want. Al Huma Collection is valuable when you prefer to compare multiple Formal and Luxury brands in one curated catalogue, receive personal help with product codes and availability, use Cash on Delivery within Pakistan, and speak with a local Sialkot team before dispatch. Our catalogue information is synchronized from an approved supplier source, displayed prices are transparent where classification is confident, and uncertain prices are never guessed. We do not claim every design is cheaper than every brand; our value is choice, convenience, personal confirmation and accessible after-order support.', 'assistant', [{label:'Explore our collections',href:'#live-catalogue'},{label:'Speak with our team',href:generalWhatsApp,external:true}]);
      return;
    }
  
    if (includesAny(question,['compare','comparison','versus',' vs ','marketplace','market place','other shop','other website','daraz','competitor','different brand','better than','cheaper than'])) {
      addChatMessage('We respect other brands, shops and marketplaces, and recommend a like-for-like comparison using the exact product code, brand, collection, number of pieces, embroidery or print classification, listed fabric details, availability, delivery charges and customer support. Al Huma Collection’s difference is a curated multi-brand selection, synchronized catalogue information, clear product codes, personal confirmation, Pakistan-wide COD, and direct support through our official WhatsApp and Sialkot location. We avoid claiming that every product is automatically better or cheaper; we help you compare accurately and choose the design and service that best suit your needs.', 'assistant', [{label:'Compare current designs',href:'#live-catalogue'},{label:'Ask our team',href:generalWhatsApp,external:true}]);
      return;
    }
  
    if (includesAny(question,['trust','genuine','original','authentic','reliable','safe to order','fraud','scam'])) {
      addChatMessage('Al Huma Collection supports confident ordering through identifiable product codes, synchronized supplier catalogue information, visible pricing where classification is reliable, Cash on Delivery, and a confirmation call before dispatch. You can contact us through our official WhatsApp, email, social profiles or visit our Model Town, Sialkot location. Product availability and final charges are confirmed before the order is finalized.', 'assistant', [{label:'Our contact details',href:'#contact'},{label:'Read customer policies',href:'policies.html'}]);
      return;
    }
  
    const collection = collectionAnswers.find(item => item.terms.some(term => question.includes(term)));
    const asksPrice = includesAny(question, ['price','prices','cost','range','rate','how much','cheapest','expensive','budget','under','below','upto','up to']);
    if (collection) {
      const available = collection.products.filter(item => item.available), range = productRange(collection.products);
      addChatMessage(asksPrice ? `${collection.name} currently has ${available.length} available design${available.length === 1 ? '' : 's'}. Displayed prices range from ${rangeText(range)}; products that cannot be classified confidently remain “Price on enquiry.”` : `${collection.name} currently has ${available.length} design${available.length === 1 ? '' : 's'} available to order. Use the Collection filter to view them; final availability is confirmed by our team.`, 'assistant', assistantActions);
      return;
    }
  
    const cleanNumber = rawQuestion.replace(/,/g,'');
    const amountMatch = cleanNumber.match(/(?:rs\.?|pkr|rupees?)?\s*(\d{3,6})/i);
    const amount = amountMatch ? Number(amountMatch[1]) : null;
    if (amount && includesAny(question,['under','below','upto','up to','budget','within','less than'])) {
      const matches = catalogueProducts.filter(item => item.available && Number.isFinite(item.price) && item.price <= amount).sort((a,b) => b.price-a.price);
      const examples = matches.slice(0,3).map(item => `${item.name} (${item.code}) — ${chatMoney(item.price)}`).join('; ');
      addChatMessage(matches.length ? `I found ${matches.length} currently available design${matches.length === 1 ? '' : 's'} priced up to ${chatMoney(amount)}. Examples: ${examples}. Use the price filters for the full selection.` : `I could not find a currently available design with a displayed price up to ${chatMoney(amount)}. Some designs are marked “Price on enquiry,” so our team may still help.`, 'assistant', assistantActions);
      return;
    }
  
    if (pieceTypeMatch) {
      const pieceNumber = pieceTypeMatch[1], pieceType = `${pieceNumber} Piece`, list = catalogueProducts.filter(item => item.pieceType === pieceType), available = list.filter(item => item.available), range = productRange(list);
      addChatMessage(asksPrice ? `There are ${available.length} currently available ${pieceNumber}-piece designs. Displayed prices range from ${rangeText(range)}.` : `There are ${available.length} currently available ${pieceNumber}-piece designs. Use the Pieces filter to view them; final availability is confirmed by our team.`, 'assistant', assistantActions);
      return;
    }
  
    if (asksPrice) {
      const all = productRange(catalogueProducts), formal = productRange(catalogueProducts.filter(item => item.category === 'Formal')), luxury = productRange(catalogueProducts.filter(item => item.category === 'Luxury'));
      const known = catalogueProducts.filter(item => item.available && Number.isFinite(item.price));
      if (includesAny(question,['cheapest','lowest','minimum']) && known.length) {
        const item = [...known].sort((a,b)=>a.price-b.price)[0];
        addChatMessage(`The lowest currently displayed price is ${chatMoney(item.price)} for ${item.name} (${item.code}). Availability still requires confirmation.`, 'assistant', [{label:'Ask about this product',href:item.whatsapp,external:true}]); return;
      }
      if (includesAny(question,['expensive','highest','maximum']) && known.length) {
        const item = [...known].sort((a,b)=>b.price-a.price)[0];
        addChatMessage(`The highest currently displayed price is ${chatMoney(item.price)} for ${item.name} (${item.code}). Availability still requires confirmation.`, 'assistant', [{label:'Ask about this product',href:item.whatsapp,external:true}]); return;
      }
      addChatMessage(`For currently available products with displayed prices, the overall range is ${rangeText(all)}. Formal designs range from ${rangeText(formal)}, while Luxury designs range from ${rangeText(luxury)}. Some products remain “Price on enquiry” when classification is uncertain.`, 'assistant', assistantActions);
    } else if (includesAny(question,['embroidered','embroidery','printed','non embroidered'])) {
      const embroidered = !question.includes('non embroidered') && question.includes('embroider'), type = embroidered ? 'embroidered' : 'non-embroidered', list = catalogueProducts.filter(item => item.pricingClass === type), range=productRange(list);
      addChatMessage(`There are ${list.filter(item=>item.available).length} currently available ${embroidered ? 'embroidered' : 'printed / non-embroidered'} designs. Displayed prices range from ${rangeText(range)}.`, 'assistant', assistantActions);
    } else if (includesAny(question,['formal','luxury'])) {
      const category = question.includes('luxury') ? 'Luxury' : 'Formal', list=catalogueProducts.filter(item=>item.category===category), range=productRange(list);
      addChatMessage(`Our synchronized ${category} catalogue currently shows ${list.filter(item=>item.available).length} available designs, with displayed prices from ${rangeText(range)}.`, 'assistant', assistantActions);
    } else if (includesAny(question,['how many','product count','number of products','total products'])) {
      addChatMessage(`The synchronized catalogue currently contains ${catalogueProducts.length} products, including ${catalogueProducts.filter(item=>item.available).length} marked available to order.`, 'assistant', assistantActions);
    } else if (includesAny(question,['delivery','shipping','courier','tcs','leopards','how long']) || questionTerms.includes('tat')) {
      addChatMessage('Delivery is normally through TCS or Leopards Courier. Charges are Rs. 300 within Sialkot and Rs. 600 outside Sialkot for parcels up to 1 kg. Charges may increase with weight or volume. Estimated delivery TAT is up to 7 days after confirmation and may vary due to unforeseen circumstances.', 'assistant', [{label:'Delivery policies',href:'policies.html'}]);
    } else if (includesAny(question,['cancel','cancellation'])) {
      addChatMessage('To cancel before the confirmation call, WhatsApp our official number with your order details.', 'assistant', [{label:'Request cancellation',href:'https://wa.me/923216115731?text=Hello%20Al%20Huma%20Collection%2C%20I%20would%20like%20to%20cancel%20my%20order%20before%20the%20confirmation%20call.%20My%20order%20details%20are%3A%20',external:true}]);
    } else if (includesAny(question,['payment','cash on delivery','pay']) || questionTerms.includes('cod')) {
      addChatMessage('We currently offer Cash on Delivery within Pakistan. No online card payment is required. Our team calls to confirm availability and final charges before dispatch.', 'assistant', [{label:'How to order',href:'#how-to-order'}]);
    } else if (includesAny(question,['cart','basket','saved product'])) {
      addChatMessage('Use “Add to cart” on any available product. Your cart is saved in this browser until you remove the item or successfully place the order.', 'assistant', [{label:'Browse products',href:'#live-catalogue'}]);
    } else if (includesAny(question,['review','rating','feedback'])) {
      addChatMessage('You can submit a genuine 1–5 star review against an individual product. Reviews are published as submitted after security verification. Al Huma Collection does not edit customer ratings or review text. Spam, abusive, unrelated or fraudulent content may be removed.', 'assistant', [{label:'Browse products to review',href:'#live-catalogue'}]);
    } else if (includesAny(question,['return','exchange','refund'])) {
      addChatMessage('Exchange or return eligibility depends on product condition and the order circumstances. Please inspect the parcel promptly and contact our team with the product code and photographs before returning anything.', 'assistant', [{label:'Read policies',href:'policies.html'},{label:'Contact our team',href:generalWhatsApp,external:true}]);
    } else if (includesAny(question,['order','buy','purchase','book','checkout'])) {
      addChatMessage('Choose an available product, select “Add to cart,” review quantities, and complete the Pakistan COD checkout. Our team will then call to confirm availability, final charges and dispatch.', 'assistant', [{label:'Browse products',href:'#live-catalogue'},{label:'How to order',href:'#how-to-order'}]);
    } else if (includesAny(question,['available','availability','stock'])) {
      addChatMessage(`Availability is synchronized approximately every 12 hours. ${catalogueProducts.filter(item=>item.available).length} products are currently marked available to order, but our team provides final confirmation before dispatch.`, 'assistant', assistantActions);
    } else if (includesAny(question,['collection','catalog','catalogue','design','product','brand'])) {
      addChatMessage(`Browse ${collectionAnswers.length} synchronized brand collections across Formal and Luxury categories. You can filter by collection, style, pieces, price and availability.`, 'assistant', [{label:'View collections',href:'#live-catalogue'}]);
    } else if (includesAny(question,['location','address','map','shop','visit'])) {
      addChatMessage('Visit Al Huma Collection at 87 Peer, Muradia Rd, Model Town, Sialkot, Pakistan.', 'assistant', [{label:'View contact & map',href:'#contact'}]);
    } else if (includesAny(question,['email','contact','phone','whatsapp','number','facebook','instagram'])) {
      addChatMessage('Contact us on WhatsApp at +92 321 6115731 or email alhumacollection@gmail.com. You can also reach Al Huma on Facebook and @alhuma.collection on Instagram.', 'assistant', [{label:'Open WhatsApp',href:generalWhatsApp,external:true},{label:'Contact details',href:'#contact'}]);
    } else if (includesAny(question,['hello','hi','salam','assalam'])) {
      addChatMessage('Welcome to Al Huma Collection. I can calculate current price ranges, find designs within a budget, check product codes and availability, and explain COD ordering, delivery or cancellation.');
    } else {
      addChatMessage('Thank you for your question. I can help with price ranges, budgets, product codes, collections, availability, COD orders, delivery, cancellation, reviews and our location. For anything more specific, our team will be delighted to assist on official WhatsApp.', 'assistant', [{label:'Contact on WhatsApp',href:generalWhatsApp,external:true}]);
    }
  };
  const setChatOpen = open => {
    chatPanel.classList.toggle('open', open);
    chatPanel.setAttribute('aria-hidden', String(!open));
    chatLauncher.setAttribute('aria-expanded', String(open));
    if (open && !chatStarted) {
      chatStarted = true;
      addChatMessage('Welcome to Al Huma Collection. I can calculate live price ranges, find products within your budget, discuss fabric guidance, compare shopping options, and explain COD ordering, delivery or cancellation.');
    }
    if (open) window.setTimeout(() => chatInput.focus(), 250);
  };
  
  chatLauncher.addEventListener('click', () => setChatOpen(chatLauncher.getAttribute('aria-expanded') !== 'true'));
  chatClose.addEventListener('click', () => setChatOpen(false));
  document.querySelectorAll('[data-chat-question]').forEach(button => button.addEventListener('click', () => {
    addChatMessage(button.dataset.chatQuestion, 'customer');
    answerChatQuestion(button.dataset.chatQuestion);
  }));
  chatForm.addEventListener('submit', event => {
    event.preventDefault();
    if (chatForm.elements.website.value) return;
    const question = chatInput.value.trim();
    if (!question) return;
    addChatMessage(question, 'customer');
    chatInput.value = '';
    answerChatQuestion(question);
  });
  chatMessages.addEventListener('click', event => {
    if (event.target.closest('a[href^="#"]')) setChatOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && chatPanel.classList.contains('open')) setChatOpen(false);
  });

  assistantApi = { setChatOpen };
  if (open) {
    window.AlHumaCatalogue?.load?.();
    setChatOpen(true);
  }
  return assistantApi;
}
