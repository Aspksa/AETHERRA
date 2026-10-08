import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,document:{getElementById:id=>id==='seed'?{value:'42'}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
vm.createContext(ctx);
vm.runInContext(readFileSync('planner.js','utf8'),ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
run('createWorld()');
// 1. Every founder has five traits in 0..1, and they differ between people.
assert.ok(run('agents.every(a=>TRAITS.every(k=>a.traits[k]>=0&&a.traits[k]<=1))'));
assert.ok(run('new Set(agents.map(a=>a.traits.industry)).size>5'),'founders must differ');
// 2. Children inherit the parents average plus a small mutation, always clamped.
run('globalThis.hi={industry:1,sociability:1,courage:1,generosity:1,curiosity:1};globalThis.lo={industry:0,sociability:0,courage:0,generosity:0,curiosity:0}');
for(let i=0;i<200;i++){
 const c=run('inheritTraits({traits:hi},{traits:lo})');
 for(const k of Object.keys(c)){assert.ok(c[k]>=.37&&c[k]<=.63,'child outside mutation band: '+c[k]);}
 const d=run('inheritTraits({traits:hi},{traits:hi})');
 for(const k of Object.keys(d))assert.ok(d[k]<=1&&d[k]>=.87);
}
// 3. Traits shape decisions: industrious residents choose wood more, generous ones choose food more.
run('stock.wood=20;stock.food=agents.filter(a=>a.health>0).length*4.5');
const share=(t)=>run(`(()=>{let wood=0,n=0;for(let id=1;id<=300;id++){const a={id,traits:{${t}}};if(chooseWork(a)==='wood')wood++;n++}return wood/n})()`);
const lazy=share('industry:0,generosity:1'),busy=share('industry:1,generosity:0');
assert.ok(busy>lazy,'traits must change work choice');
// 4. Children born in a long run carry traits; old saves without traits load with neutral ones.
run('stock.food=2000;stock.wood=300');
for(let i=0;i<1800;i++)run('step()');
assert.ok(run('agents.filter(a=>a.age<16).every(a=>TRAITS.every(k=>a.traits[k]>=0&&a.traits[k]<=1))'));
const old=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents.forEach(a=>delete a.traits);return s})()');
run('restoreWorld')(old);
assert.ok(run('agents.every(a=>TRAITS.every(k=>a.traits[k]===.5))'),'missing traits default to neutral');
// 5. Out-of-range traits in an imported save are rejected.
const bad=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents[0].traits.courage=7;return s})()');
assert.throws(()=>run('validateSnapshot')(bad));
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
run('restoreWorld')(snap);
console.log('Traits: random founders, bounded inheritance, work bias, save compatibility passed');
