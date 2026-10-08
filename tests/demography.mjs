import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
for(const seedValue of [42,999]){
 const ctx={Math,Uint8Array,Int32Array,Map,document:{getElementById:id=>id==='seed'?{value:String(seedValue)}:{innerHTML:''}},updatePanel:()=>{}};
vm.createContext(ctx);vm.runInContext(readFileSync("planner.js","utf8"),ctx);
 vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${source}`,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run('createWorld();stock.food=2000;stock.wood=300');
 for(let i=0;i<1800;i++)run('step()');
 const result=run('({population:agents.length,homes:homes.length,children:agents.filter(a=>a.age<16).length,oldest:agents[0].age,day})');
 assert.ok(result.population>20,'no births on seed '+seedValue);
 assert.ok(result.homes>10,'housing cannot expand past 10 seed '+seedValue);
 assert.ok(result.children>0,'no children seed '+seedValue);
 assert.ok(result.oldest>18,'no gradual aging seed '+seedValue);
 const snap=run('worldSnapshot()');
 assert.ok(snap.lastBirthCycle>=1,'birth schedule not persisted');
 run('restoreWorld(worldSnapshot())');
 assert.equal(run('lastBirthCycle'),snap.lastBirthCycle,'save roundtrip should preserve demographic clock');
}
console.log('Demography: births, aging, children, housing expansion and save roundtrip passed');
