import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const RETURN_LINK = 'https://alhumacollection.com/policies.html#exchange-returns';

async function listProductPages() {
  const root = path.join(ROOT, 'products');
  const pages = [];
  async function walk(directory) {
    let entries = [];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name === 'index.html') pages.push(full);
    }
  }
  await walk(root);
  return pages;
}

async function main() {
  const policies = await fs.readFile(path.join(ROOT, 'policies.html'), 'utf8');
  if (!policies.includes('id="exchange-returns"')) throw new Error('The exchange and returns policy anchor is missing.');

  const schemas = [];
  for (const match of policies.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { schemas.push(JSON.parse(match[1])); }
    catch (error) { throw new Error(`Invalid JSON-LD on policies.html: ${error.message}`); }
  }
  const store = schemas.find(value => ['OnlineStore', 'Organization'].includes(value?.['@type']));
  if (!store) throw new Error('OnlineStore or Organization policy schema is missing.');
  if (store.hasMerchantReturnPolicy?.merchantReturnLink !== RETURN_LINK) throw new Error('Merchant return-policy link is missing or incorrect.');

  let incompleteShippingPages = 0;
  for (const file of await listProductPages()) {
    const page = await fs.readFile(file, 'utf8');
    if (/"shippingDetails"\s*:/i.test(page)) incompleteShippingPages += 1;
  }
  if (incompleteShippingPages) throw new Error(`${incompleteShippingPages} product pages contain shippingDetails even though complete rate and delivery fields are not approved.`);

  console.log('Merchant policy validation passed: return-policy link present and incomplete shipping markup absent.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
