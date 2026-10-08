import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:'42',innerHTML:'',textContent:''});return els.get(id)};
const ctx={Math,Uint8Array,Int32Array,Map,Set,document:{getElementById:el},updatePanel:()=>{}};
vm.createContext(ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
run('createWorld()');
// 1. Text from a save/import is rendered as text, never as HTML.
run(`log('<img src=x onerror=alert(1)>')`);
assert.ok(!el('events').innerHTML.includes('<img'),'event text injected as HTML');
assert.ok(el('events').innerHTML.includes('&lt;img'),'event text not escaped');
// 2. Saves with non-string names or memories are rejected.
const bad=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents[0].name={toString(){return "x"}};return s})()');
assert.throws(()=>run('validateSnapshot')(bad),'object name accepted');
const bad2=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents[0].memory=[42];return s})()');
assert.throws(()=>run('validateSnapshot')(bad2),'non-string memory accepted');
// 3. Routine memories do not flood the memory list.
run(`agents[0].memory=['Родился'];for(let i=0;i<10;i++)remember(agents[0],'Получил еду со склада')`);
assert.equal(run('agents[0].memory.length'),2,'routine memory duplicated');
// 4. Deceased residents are pruned, so long-running saves stay loadable.
run(`stock.food=5000;for(let i=0;i<60;i++)agents.push({...agents[0],id:uid++,health:0,memory:[],experience:{wood:0,food:0}})`);
for(let i=0;i<200;i++)run('step()');
assert.ok(run('agents.filter(a=>a.health<=0).length')<=20,'dead residents never pruned');
run('validateSnapshot(JSON.parse(JSON.stringify(worldSnapshot())))');
console.log('Save safety: escaped text, strict text validation, memory dedupe, bounded deceased list passed');
