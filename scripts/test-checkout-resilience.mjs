import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('dawood-commerce.js','utf8');
const saveStart=source.indexOf('  function save() {');
const saveEnd=source.indexOf('\n  function notify(',saveStart);
assert(saveStart>=0&&saveEnd>saveStart,'Cart save method missing');
const saveSource=source.slice(saveStart,saveEnd);
let renders=0;
const storage={setItem(){throw new Error('Storage disabled')}};
const factory=new Function('localStorage','CART_KEY','cart','render',saveSource+'\nreturn save;');
const save=factory(storage,'test-key',[{code:'TEST-SKU',qty:1}],()=>renders++);
assert.doesNotThrow(()=>save());
assert.equal(renders,1,'Cart should render even when persistence is blocked');

const start=source.indexOf('  function loadTurnstile() {');
const end=source.indexOf('\n  async function ensureTurnstile()',start);
assert(start>=0&&end>start,'Turnstile loader missing');
const segment=source.slice(start,end);
const scripts=[];
const document={
  getElementById(){return null},
  createElement(){
    const listeners=new Map();
    const script={listeners,addEventListener:(type,fn)=>listeners.set(type,fn),remove(){script.removed=true}};
    scripts.push(script);
    return script;
  },
  head:{append(){}}
};
const window={};
const setup=new Function('window','document','Promise','let turnstilePromise=null;\n'+segment+'\nreturn {loadTurnstile,getPending:()=>turnstilePromise};');
const obj=setup(window,document,Promise);
const first=obj.loadTurnstile();
assert.equal(scripts.length,1);
scripts[0].listeners.get('error')();
await assert.rejects(first,/failed to load/);
assert.equal(obj.getPending(),null);
assert.equal(scripts[0].removed,true);
const second=obj.loadTurnstile();
assert.equal(scripts.length,2);
assert.notStrictEqual(second,first);
const turnstile={render:()=>42,reset:()=>{}};
window.turnstile=turnstile;
scripts[1].listeners.get('load')();
assert.strictEqual(await second,turnstile);
console.log('Checkout storage and Turnstile retry tests passed.');
