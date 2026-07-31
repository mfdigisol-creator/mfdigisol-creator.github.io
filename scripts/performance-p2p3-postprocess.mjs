import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const INDEX_FILE = path.join(ROOT, 'index.html');
const CATALOGUE_RUNTIME_FILE = path.join(ROOT, 'dawood-catalogue.js');
const CATALOGUE_DATA_FILE = path.join(ROOT, 'catalogue/dawood-products.json');
const ASSISTANT_RUNTIME_RELATIVE = 'assistant-runtime.js';
const ASSISTANT_RUNTIME_FILE = path.join(ROOT, ASSISTANT_RUNTIME_RELATIVE);

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function digest(value, length = 16) {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function createAssistantModule(source) {
  const listenerStart = "window.addEventListener('alhuma:catalogue-ready', event => {";
  const listenerIndex = source.indexOf(listenerStart);
  if (listenerIndex < 0) throw new Error('Assistant catalogue listener was not found.');
  const listenerEnd = source.indexOf('\n});', listenerIndex);
  if (listenerEnd < 0) throw new Error('Assistant catalogue listener is malformed.');

  const listenerBody = source.slice(listenerIndex + listenerStart.length, listenerEnd);
  const hydratedListener = [
    'const hydrateAssistantCatalogue = event => {',
    listenerBody,
    '};',
    "window.addEventListener('alhuma:catalogue-ready', hydrateAssistantCatalogue);",
    'if (window.AlHumaCatalogueSnapshot) hydrateAssistantCatalogue({ detail:window.AlHumaCatalogueSnapshot });'
  ].join('\n');
  const transformed = `${source.slice(0, listenerIndex)}${hydratedListener}${source.slice(listenerEnd + '\n});'.length)}`;

  return [
    'let assistantApi = null;',
    '',
    'export function init({ open = false } = {}) {',
    '  if (assistantApi) {',
    '    if (open) assistantApi.setChatOpen(true);',
    '    return assistantApi;',
    '  }',
    '',
    transformed.split('\n').map(line => `  ${line}`).join('\n'),
    '',
    '  assistantApi = { setChatOpen };',
    '  if (open) {',
    '    window.AlHumaCatalogue?.load?.();',
    '    setChatOpen(true);',
    '  }',
    '  return assistantApi;',
    '}',
    ''
  ].join('\n');
}

function createAssistantLoader(moduleVersion) {
  return [
    "const assistantLauncher = document.querySelector('[data-chat-launcher]');",
    'let assistantRuntimePromise;',
    'const loadAssistantRuntime = (open = false) => {',
    `  assistantRuntimePromise ||= import('./${ASSISTANT_RUNTIME_RELATIVE}?v=${moduleVersion}');`,
    '  return assistantRuntimePromise.then(module => module.init({ open })).catch(error => {',
    "    console.error('Assistant runtime failed to load.', error);",
    "    assistantLauncher?.setAttribute('aria-label', 'Assistant temporarily unavailable');",
    '  });',
    '};',
    "assistantLauncher?.addEventListener('click', () => loadAssistantRuntime(true), { once:true });",
    "assistantLauncher?.addEventListener('pointerenter', () => loadAssistantRuntime(false), { once:true });",
    "assistantLauncher?.addEventListener('focus', () => loadAssistantRuntime(false), { once:true });",
    ''
  ].join('\n');
}

async function externalizeAssistant(document) {
  const startMarker = "const chatLauncher = document.querySelector('[data-chat-launcher]');";
  const endMarker = "document.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());";
  const start = document.indexOf(startMarker);

  if (start < 0) {
    if (!document.includes('const loadAssistantRuntime =') || !(await exists(ASSISTANT_RUNTIME_FILE))) {
      throw new Error('Assistant runtime is neither inline nor available as an external module.');
    }
    return { document, changed: false, moduleVersion: null };
  }

  const end = document.indexOf(endMarker, start);
  if (end < 0) throw new Error('Assistant runtime end marker was not found.');

  const source = document.slice(start, end).trimEnd();
  const module = createAssistantModule(source);
  const moduleVersion = digest(module);
  await fs.writeFile(ASSISTANT_RUNTIME_FILE, module);

  return {
    document: `${document.slice(0, start)}${createAssistantLoader(moduleVersion)}${document.slice(end)}`,
    changed: true,
    moduleVersion
  };
}

async function optimizeHomepage() {
  let document = await fs.readFile(INDEX_FILE, 'utf8');
  let changed = false;

  const catalogueBytes = await fs.readFile(CATALOGUE_DATA_FILE);
  const catalogueVersion = digest(catalogueBytes);
  const htmlTag = document.match(/<html\b[^>]*>/i)?.[0];
  if (!htmlTag) throw new Error('Homepage html element was not found.');
  const versionedHtmlTag = /\sdata-catalogue-version=/i.test(htmlTag)
    ? htmlTag.replace(/\sdata-catalogue-version=["'][^"']*["']/i, ` data-catalogue-version="${catalogueVersion}"`)
    : htmlTag.replace(/>$/, ` data-catalogue-version="${catalogueVersion}">`);
  if (versionedHtmlTag !== htmlTag) {
    document = document.replace(htmlTag, versionedHtmlTag);
    changed = true;
  }

  const legacyLoader = [
    "window.addEventListener('load', () => window.setTimeout(() => siteLoader.classList.add('loaded'), 180));",
    "window.setTimeout(() => siteLoader.classList.add('loaded'), 2200);"
  ].join('\n');
  if (document.includes(legacyLoader)) {
    const immediateLoader = [
      "const releaseSiteLoader = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => siteLoader.classList.add('loaded')));",
      'releaseSiteLoader();',
      "window.setTimeout(() => siteLoader.classList.add('loaded'), 900);"
    ].join('\n');
    document = document.replace(legacyLoader, immediateLoader);
    changed = true;
  }

  const assistant = await externalizeAssistant(document);
  document = assistant.document;
  changed ||= assistant.changed;

  const versionedCatalogueScript = document.replace(
    /dawood-catalogue\.js\?v=[^"']+/,
    `dawood-catalogue.js?v=${catalogueVersion}`
  );
  if (versionedCatalogueScript !== document) {
    document = versionedCatalogueScript;
    changed = true;
  }

  if (document.includes("window.addEventListener('load', () => window.setTimeout(() => siteLoader.classList.add('loaded')")) {
    throw new Error('Legacy window.load site-loader dependency remains.');
  }
  if (document.includes('const answerChatQuestion =')) {
    throw new Error('Assistant rule engine remains inline on the homepage.');
  }
  if (!document.includes('const loadAssistantRuntime =')) {
    throw new Error('Assistant lazy loader is missing from the homepage.');
  }
  if (!document.includes(`data-catalogue-version="${catalogueVersion}"`)) {
    throw new Error('Catalogue content version is missing from the homepage.');
  }

  if (changed) await fs.writeFile(INDEX_FILE, document);
  return { changed, catalogueVersion, assistantModuleVersion:assistant.moduleVersion };
}

async function optimizeCatalogueRuntime() {
  let runtime = await fs.readFile(CATALOGUE_RUNTIME_FILE, 'utf8');
  let changed = false;

  const legacyNavigation = `  document.addEventListener('click', event => {\n    const link = event.target.closest('a[href="#live-catalogue"], a[href="#new-arrivals"]');\n    if (!link || link.hasAttribute('data-nav-brand')) return;\n    resetCatalogue();\n    liveNav?.removeAttribute('open');\n    track('catalogue_navigation_open', { source:(link.textContent || 'catalogue link').trim() });\n  });`;
  if (runtime.includes(legacyNavigation)) {
    const deferredNavigation = `  document.addEventListener('click', event => {\n    const link = event.target.closest('a[href="#live-catalogue"], a[href="#new-arrivals"]');\n    if (!link || link.hasAttribute('data-nav-brand')) return;\n    event.preventDefault();\n    liveNav?.removeAttribute('open');\n    track('catalogue_navigation_open', { source:(link.textContent || 'catalogue link').trim() });\n    loadCatalogue().then(() => {\n      if (!products.length) return;\n      resetCatalogue();\n      section.scrollIntoView({ behavior:'smooth', block:'start' });\n    });\n  });`;
    runtime = runtime.replace(legacyNavigation, deferredNavigation);
    changed = true;
  }

  const fetchStart = runtime.indexOf("  fetch(`catalogue/dawood-products.json?v=${Date.now()}`, { cache:'no-store' })");
  if (fetchStart >= 0) {
    const catchMarker = "    .catch(() => { section.hidden=true; if(navGroups) navGroups.innerHTML='<a href=\"https://wa.me/923216115731\">Catalogue temporarily unavailable — contact our team</a>'; });";
    const catchStart = runtime.indexOf(catchMarker, fetchStart);
    if (catchStart < 0) throw new Error('Catalogue fetch catch handler was not found.');
    const fetchEnd = catchStart + catchMarker.length;
    let chain = runtime.slice(fetchStart, fetchEnd);

    chain = chain.replace(
      "  fetch(`catalogue/dawood-products.json?v=${Date.now()}`, { cache:'no-store' })",
      "    return fetch(`catalogue/dawood-products.json?v=${encodeURIComponent(catalogueVersion)}`, { cache:'default' })"
    );
    chain = chain.replace(
      catchMarker.trimStart(),
      "    .catch(() => { cataloguePromise=null; section.hidden=true; if(navGroups) navGroups.innerHTML='<a href=\"https://wa.me/923216115731\">Catalogue temporarily unavailable — contact our team</a>'; return null; });"
    );

    const eventLineStart = chain.indexOf("      window.dispatchEvent(new CustomEvent('alhuma:catalogue-ready'");
    if (eventLineStart < 0) throw new Error('Catalogue ready event was not found.');
    const eventLineEnd = chain.indexOf('\n', eventLineStart);
    const eventLine = chain.slice(eventLineStart, eventLineEnd < 0 ? chain.length : eventLineEnd);
    const detailPrefix = '{ detail:';
    const detailStart = eventLine.indexOf(detailPrefix);
    const detailEnd = eventLine.lastIndexOf(' }));');
    if (detailStart < 0 || detailEnd < 0) throw new Error('Catalogue ready event detail could not be parsed.');
    const detailExpression = eventLine.slice(detailStart + detailPrefix.length, detailEnd).trim();
    const snapshotLines = [
      `      const catalogueSnapshot = ${detailExpression};`,
      '      window.AlHumaCatalogueSnapshot = catalogueSnapshot;',
      "      window.dispatchEvent(new CustomEvent('alhuma:catalogue-ready', { detail:catalogueSnapshot }));"
    ].join('\n');
    chain = chain.replace(eventLine, snapshotLines);

    const deferredFetch = [
      "  const catalogueVersion = document.documentElement.dataset.catalogueVersion || 'current';",
      '  let cataloguePromise = null;',
      '  function loadCatalogue() {',
      '    if (cataloguePromise) return cataloguePromise;',
      '    cataloguePromise = (() => {',
      chain,
      '    })();',
      '    return cataloguePromise;',
      '  }',
      '',
      '  window.AlHumaCatalogue = { load:loadCatalogue };',
      "  const catalogueSentinel = document.createElement('span');",
      "  catalogueSentinel.setAttribute('aria-hidden', 'true');",
      "  catalogueSentinel.style.cssText = 'display:block;width:1px;height:1px;';",
      '  section.before(catalogueSentinel);',
      "  const catalogueObserver = new IntersectionObserver(entries => {",
      '    if (!entries.some(entry => entry.isIntersecting)) return;',
      '    catalogueObserver.disconnect();',
      '    loadCatalogue();',
      "  }, { rootMargin:'320px 0px' });",
      '  catalogueObserver.observe(catalogueSentinel);',
      "  document.querySelector('[data-live-nav] summary')?.addEventListener('pointerenter', loadCatalogue, { once:true });",
      "  document.querySelector('[data-live-nav] summary')?.addEventListener('focus', loadCatalogue, { once:true });",
      "  document.querySelector('[data-live-nav] summary')?.addEventListener('click', loadCatalogue, { once:true });",
      "  const initialCatalogueTarget = location.hash === '#live-catalogue' || location.hash === '#new-arrivals' || new URLSearchParams(location.search).has('product');",
      "  if (initialCatalogueTarget) loadCatalogue().then(() => section.scrollIntoView({ block:'start' }));"
    ].join('\n');

    runtime = `${runtime.slice(0, fetchStart)}${deferredFetch}${runtime.slice(fetchEnd)}`;
    changed = true;
  }

  if (runtime.includes("cache:'no-store'") || runtime.includes('Date.now()')) {
    throw new Error('Catalogue runtime still bypasses browser caching.');
  }
  if (!runtime.includes('window.AlHumaCatalogueSnapshot = catalogueSnapshot;')) {
    throw new Error('Catalogue snapshot bridge for the lazy assistant is missing.');
  }
  if (!runtime.includes('function loadCatalogue()')) {
    throw new Error('Deferred catalogue loader is missing.');
  }

  if (changed) await fs.writeFile(CATALOGUE_RUNTIME_FILE, runtime);
  return changed;
}

async function main() {
  const homepage = await optimizeHomepage();
  const catalogueRuntimeChanged = await optimizeCatalogueRuntime();

  console.log(JSON.stringify({
    ok: true,
    homepageChanged:homepage.changed,
    catalogueVersion:homepage.catalogueVersion,
    assistantModuleVersion:homepage.assistantModuleVersion,
    catalogueRuntimeChanged,
    assistantRuntime:ASSISTANT_RUNTIME_RELATIVE
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});