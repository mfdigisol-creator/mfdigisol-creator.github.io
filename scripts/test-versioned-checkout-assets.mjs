import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const html=readFileSync('index.html','utf8');
for(const file of ['dawood-commerce.js','dawood-commerce.css','orders-client.js','orders-config.js']){
  const digest=createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
  const link=file+'?v='+digest;
  assert(html.includes(link),'Homepage is not linking to the latest '+file+' content: '+link);
  const count=html.split(file+'?v=').length-1;
  assert.equal(count,1,'Expected exactly one versioned homepage reference for '+file);
}
console.log('Checkout asset cache-busting hashes match deployed code.');
