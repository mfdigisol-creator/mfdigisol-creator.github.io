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
  const updated = original
    .replace(
      /dawood-catalogue\.js\?v=[^"']+/,
      `dawood-catalogue.js?v=${catalogueRuntimeVersion}`
    )
    .replace(
      /assistant-runtime\.js\?v=[^"']+/,
      `assistant-runtime.js?v=${assistantRuntimeVersion}`
    );

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
    homepageChanged:updated !== original
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});