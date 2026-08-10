import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUTPUT_DIR = process.env.SMOKE_OUTPUT_DIR || path.join(ROOT, 'performance', 'functional-smoke-artifacts');
const SUMMARY_FILE = process.env.SMOKE_SUMMARY_FILE || path.join(ROOT, 'performance', 'functional-smoke-summary.json');
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);

const profiles = [
  { key:'mobile', width:390, height:844, deviceScaleFactor:2, mobile:true },
  { key:'desktop', width:1440, height:900, deviceScaleFactor:1, mobile:false }
];

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools.')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once:true });
      this.socket.addEventListener('error', event => { clearTimeout(timer); reject(new Error(`Chrome DevTools connection failed: ${event.message || 'unknown error'}`)); }, { once:true });
    });
    this.socket.addEventListener('message', event => this.handleMessage(JSON.parse(String(event.data))));
  }

  handleMessage(message) {
    if (message.id) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result || {});
      return;
    }
    for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  waitForEvent(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Timed out waiting for ${method}.`)); }, timeout);
      const unsubscribe = this.on(method, params => { clearTimeout(timer); unsubscribe(); resolve(params); });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise:true,
      returnByValue:true,
      userGesture:true
    });
    if (response.exceptionDetails) {
      const description = response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'unknown evaluation error';
      throw new Error(description);
    }
    return response.result?.value;
  }

  async waitFor(expression, { timeout = 15000, interval = 150, message = expression } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.evaluate(`Boolean(${expression})`)) return;
      await sleep(interval);
    }
    throw new Error(`Timed out waiting for: ${message}`);
  }

  close() {
    this.socket?.close();
  }
}

async function waitForChrome() {
  const endpoint = `http://127.0.0.1:${DEBUG_PORT}/json/version`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome remote debugging endpoint did not become ready.');
}

async function createTarget() {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent('about:blank')}`, { method:'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${encodeURIComponent(id)}`).catch(() => {});
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
  const bytes = Buffer.from(result.data, 'base64');
  assert(bytes.length > 10000, `${name} screenshot is unexpectedly small.`);
  await fs.writeFile(path.join(OUTPUT_DIR, `${name}.png`), bytes);
  return bytes.length;
}

async function click(cdp, selector) {
  const found = await cdp.evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); if(!element)return false; element.click(); return true; })()`);
  assert(found, `Element not found for click: ${selector}`);
}

async function runProfile(profile) {
  const target = await createTarget();
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  const exceptions = [];
  const consoleErrors = [];
  const checks = [];
  const screenshots = {};

  try {
    await cdp.connect();
    cdp.on('Runtime.exceptionThrown', params => exceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Runtime exception'));
    cdp.on('Runtime.consoleAPICalled', params => {
      if (params.type === 'error') consoleErrors.push(params.args?.map(arg => arg.value || arg.description || '').join(' ') || 'console.error');
    });

    await Promise.all([
      cdp.send('Page.enable'),
      cdp.send('Runtime.enable'),
      cdp.send('Network.enable'),
      cdp.send('Log.enable')
    ]);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width:profile.width,
      height:profile.height,
      deviceScaleFactor:profile.deviceScaleFactor,
      mobile:profile.mobile,
      screenWidth:profile.width,
      screenHeight:profile.height
    });
    await cdp.send('Storage.clearDataForOrigin', { origin:BASE_URL, storageTypes:'all' });

    const loaded = cdp.waitForEvent('Page.loadEventFired', 30000);
    await cdp.send('Page.navigate', { url:`${BASE_URL}/` });
    await loaded;
    await cdp.waitFor('document.readyState === "complete"', { timeout:10000, message:'homepage complete state' });
    await cdp.waitFor('document.querySelector("[data-site-loader]")?.classList.contains("loaded")', { timeout:2000, message:'site loader release' });
    checks.push('site-loader-released');

    const initialResources = await cdp.evaluate('performance.getEntriesByType("resource").map(entry => entry.name)');
    assert(!initialResources.some(url => url.includes('dawood-products.json')), 'Catalogue JSON loaded before catalogue intent.');
    assert(!initialResources.some(url => url.includes('assistant-runtime.js')), 'Assistant runtime loaded before assistant intent.');
    checks.push('initial-catalogue-deferred', 'initial-assistant-deferred');
    screenshots.hero = await screenshot(cdp, `${profile.key}-hero`);

    await cdp.waitFor('document.querySelector("[data-consent-banner]")', { timeout:5000, message:'consent banner' });
    await click(cdp, '[data-consent-essential]');
    await cdp.waitFor('!document.querySelector("[data-consent-banner]")', { timeout:3000, message:'consent banner dismissal' });
    checks.push('essential-consent');

    await click(cdp, 'a[href="#live-catalogue"]');
    await cdp.waitFor('window.AlHumaCatalogueSnapshot?.products?.length >= 20', { timeout:30000, message:'catalogue snapshot' });
    await cdp.waitFor('!document.querySelector("[data-live-catalogue]").hidden && document.querySelectorAll("[data-open-product]").length > 0', { timeout:10000, message:'catalogue render' });
    const catalogueResource = await cdp.evaluate('performance.getEntriesByType("resource").map(entry => entry.name).find(url => url.includes("dawood-products.json")) || null');
    assert(catalogueResource && /dawood-products\.json\?v=[a-f0-9]{16}/.test(catalogueResource), `Catalogue URL is not content-versioned: ${catalogueResource}`);
    checks.push('catalogue-loaded-on-intent', 'catalogue-content-versioned');
    screenshots.catalogue = await screenshot(cdp, `${profile.key}-catalogue`);

    const searchProbe = await cdp.evaluate(`(() => {
      const product=window.AlHumaCatalogueSnapshot?.products?.find(item => item?.code);
      const input=document.querySelector('[data-live-search]');
      if(!product || !input) return null;
      input.value=product.code;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return { code:product.code, text:document.querySelector('[data-live-grid]')?.textContent || '' };
    })()`);
    assert(searchProbe?.code && searchProbe.text.includes(searchProbe.code), `Catalogue search did not return the current product code: ${searchProbe?.code || 'missing probe'}.`);
    checks.push('catalogue-search');
    await click(cdp, '[data-live-clear]');

    await click(cdp, '[data-open-product]');
    await cdp.waitFor('document.querySelector("dialog.live-product-dialog")?.open', { timeout:5000, message:'product dialog' });
    const productDescription = await cdp.evaluate(`(() => {
      const section=document.querySelector('.live-dialog-description');
      return section ? { heading:section.querySelector('strong')?.textContent?.trim() || '', text:section.querySelector('p')?.textContent?.trim() || '' } : null;
    })()`);
    assert(productDescription && /Product (description|information)/i.test(productDescription.heading), 'Product dialog description heading is missing.');
    assert(productDescription.text.length >= 40, 'Product dialog description text is missing or too short.');
    checks.push('product-dialog', 'product-description');
    screenshots.productDialog = await screenshot(cdp, `${profile.key}-product-dialog`);
    await click(cdp, '.live-dialog-close');

    await click(cdp, '[data-add-cart]');
    await cdp.waitFor('document.querySelector(".cart-drawer")?.classList.contains("open") && Number(document.querySelector("[data-cart-count]")?.textContent) > 0', { timeout:5000, message:'cart drawer' });
    checks.push('add-to-cart');
    await click(cdp, '.cart-checkout');
    await cdp.waitFor('document.querySelector(".checkout-dialog")?.open', { timeout:5000, message:'checkout dialog' });
    checks.push('checkout-dialog');
    screenshots.checkout = await screenshot(cdp, `${profile.key}-checkout`);
    await click(cdp, '.checkout-close');

    await click(cdp, '[data-chat-launcher]');
    await cdp.waitFor('document.querySelector("[data-chat-panel]")?.classList.contains("open")', { timeout:10000, message:'assistant panel' });
    const assistantResource = await cdp.evaluate('performance.getEntriesByType("resource").map(entry => entry.name).find(url => url.includes("assistant-runtime.js")) || null');
    assert(assistantResource && /assistant-runtime\.js\?v=[a-f0-9]{16}/.test(assistantResource), `Assistant URL is not content-versioned: ${assistantResource}`);
    checks.push('assistant-lazy-load', 'assistant-content-versioned');

    const initialMessageCount = await cdp.evaluate('document.querySelectorAll("[data-chat-messages] .chat-message").length');
    await cdp.evaluate(`(() => {
      const form=document.querySelector('[data-chat-form]');
      form.elements.question.value='How long is delivery?';
      form.requestSubmit();
    })()`);
    await cdp.waitFor(`document.querySelectorAll('[data-chat-messages] .chat-message').length >= ${initialMessageCount + 2}`, { timeout:5000, message:'assistant response' });
    const assistantText = await cdp.evaluate('document.querySelector("[data-chat-messages]").textContent');
    assert(/7 days|delivery/i.test(assistantText), 'Assistant did not return delivery guidance.');
    checks.push('assistant-response');
    screenshots.assistant = await screenshot(cdp, `${profile.key}-assistant`);

    await sleep(300);
    assert(exceptions.length === 0, `Runtime exceptions detected: ${exceptions.join(' | ')}`);
    assert(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(' | ')}`);
    checks.push('no-runtime-exceptions', 'no-console-errors');

    return { profile:profile.key, passed:true, checks, screenshots, productDescription, exceptions, consoleErrors };
  } finally {
    cdp.close();
    await closeTarget(target.id);
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive:true });
  await fs.mkdir(path.dirname(SUMMARY_FILE), { recursive:true });
  const userDataDir = `/tmp/alhuma-smoke-chrome-${process.pid}`;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio:['ignore', 'pipe', 'pipe'] });

  let chromeError = '';
  chrome.stderr.on('data', chunk => { chromeError += String(chunk); });

  try {
    await waitForChrome();
    const results = [];
    for (const profile of profiles) results.push(await runProfile(profile));
    const summary = {
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      baseUrl:BASE_URL,
      chromePath:CHROME_PATH,
      profiles:results,
      passed:results.every(result => result.passed)
    };
    await fs.writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const summary = {
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      baseUrl:BASE_URL,
      passed:false,
      error:error.stack || error.message,
      chromeError:chromeError.slice(-5000)
    };
    await fs.writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    chrome.kill('SIGTERM');
    await fs.rm(userDataDir, { recursive:true, force:true }).catch(() => {});
  }
}

main();
