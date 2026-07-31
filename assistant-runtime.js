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
  const includesAny = (question, terms) => terms.some(term => question.includes(term));
  const assistantActions = [{ label:'Browse catalogue', href:'#live-catalogue' }, { label:'Ask our team', href:generalWhatsApp, external:true }];
  
  const answerChatQuestion = rawQuestion => {
    const question = normalizeQuestion(rawQuestion);
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
      const embroidered = question.includes('embroider'), type = embroidered ? 'embroidered' : 'non-embroidered', list = catalogueProducts.filter(item => item.pricingClass === type), range=productRange(list);
      addChatMessage(`There are ${list.filter(item=>item.available).length} currently available ${embroidered ? 'embroidered' : 'printed / non-embroidered'} designs. Displayed prices range from ${rangeText(range)}.`, 'assistant', assistantActions);
    } else if (includesAny(question,['formal','luxury'])) {
      const category = question.includes('luxury') ? 'Luxury' : 'Formal', list=catalogueProducts.filter(item=>item.category===category), range=productRange(list);
      addChatMessage(`Our synchronized ${category} catalogue currently shows ${list.filter(item=>item.available).length} available designs, with displayed prices from ${rangeText(range)}.`, 'assistant', assistantActions);
    } else if (includesAny(question,['how many','product count','number of products','total products'])) {
      addChatMessage(`The synchronized catalogue currently contains ${catalogueProducts.length} products, including ${catalogueProducts.filter(item=>item.available).length} marked available to order.`, 'assistant', assistantActions);
    } else if (includesAny(question,['delivery','shipping','courier','tcs','leopards','how long','tat'])) {
      addChatMessage('Delivery is normally through TCS or Leopards Courier. Charges are Rs. 300 within Sialkot and Rs. 600 outside Sialkot for parcels up to 1 kg. Charges may increase with weight or volume. Estimated delivery TAT is up to 7 days after confirmation and may vary due to unforeseen circumstances.', 'assistant', [{label:'Delivery policies',href:'policies.html'}]);
    } else if (includesAny(question,['cancel','cancellation'])) {
      addChatMessage('To cancel before the confirmation call, WhatsApp our official number with your order details.', 'assistant', [{label:'Request cancellation',href:'https://wa.me/923216115731?text=Hello%20Al%20Huma%20Collection%2C%20I%20would%20like%20to%20cancel%20my%20order%20before%20the%20confirmation%20call.%20My%20order%20details%20are%3A%20',external:true}]);
    } else if (includesAny(question,['payment','cod','cash on delivery','pay'])) {
      addChatMessage('We currently offer Cash on Delivery within Pakistan. No online card payment is required. Our team calls to confirm availability and final charges before dispatch.', 'assistant', [{label:'How to order',href:'#how-to-order'}]);
    } else if (includesAny(question,['cart','basket','saved product'])) {
      addChatMessage('Use “Add to cart” on any available product. Your cart is saved in this browser until you remove the item or successfully place the order.', 'assistant', [{label:'Browse products',href:'#live-catalogue'}]);
    } else if (includesAny(question,['review','rating','feedback'])) {
      addChatMessage('You can submit a genuine 1–5 star review in our Customer Voices section. Reviews are sent privately for moderation and published only after approval.', 'assistant', [{label:'Leave a review',href:'#reviews'}]);
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
