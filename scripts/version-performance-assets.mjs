import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const indexFile = path.join(ROOT, 'index.html');
const catalogueRuntimeFile = path.join(ROOT, 'dawood-catalogue.js');
const assistantRuntimeFile = path.join(ROOT, 'assistant-runtime.js');

const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

async function main() {
  const [catalogueRuntime, assistantRuntime] = await Promise.all([
    fs.readFile(catalogueRuntimeFile),
    fs.readFile(assistantRuntimeFile)
  ]);
  const catalogueRuntimeVersion = digest(catalogueRuntime);
  const assistantRuntimeVersion = digest(assistantRuntime);
  const original = await fs.readFile(indexFile, 'utf8');
  let updated = original
    .replace(
      /dawood-catalogue\.js\?v=[^"']+/,
      `dawood-catalogue.js?v=${catalogueRuntimeVersion}`
    )
    .replace(
      /assistant-runtime\.js\?v=[^"']+/,
      `assistant-runtime.js?v=${assistantRuntimeVersion}`
    );

  // Checkout scripts must never be held under obsolete static cache keys.
  // Hash the actual deployed bytes; a version changes only when that file changes.
  const checkoutAssetFiles = ['dawood-commerce.js', 'dawood-commerce.css', 'orders-client.js', 'orders-config.js'];
  const checkoutAssetVersions = {};
  for (const asset of checkoutAssetFiles) {
    const bytes = await fs.readFile(path.join(ROOT, asset));
    const version = digest(bytes);
    const pattern = new RegExp(asset.replace('.', '\\.') + '\\?v=[^"\\s]+');
    if (!pattern.test(updated)) throw new Error(`Missing versioned checkout asset in homepage: ${asset}`);
    updated = updated.replace(pattern, `${asset}?v=${version}`);
    checkoutAssetVersions[asset] = version;
  }

  if (!updated.includes(`dawood-catalogue.js?v=${catalogueRuntimeVersion}`)) {
    throw new Error('Versioned catalogue runtime reference was not produced.');
  }
  if (!updated.includes(`assistant-runtime.js?v=${assistantRuntimeVersion}`)) {
    throw new Error('Versioned assistant runtime reference was not produced.');
  }
  if (updated !== original) await fs.writeFile(indexFile, updated);

  console.log(JSON.stringify({
    ok:true,
    catalogueRuntimeVersion,
    assistantRuntimeVersion,
    checkoutAssetVersions,
    homepageChanged:updated !== original
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});