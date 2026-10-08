import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
assert.ok(core.includes('function createWorld()'));
for(const seedValue of [42,77,1,2,3,4,5,6,7,8,9,10]){
 const context={
  Math,Uint8Array,Int32Array,Map,
  document:{getElementById:(id)=>id==='seed'?{value:String(seedValue)}:{innerHTML:''}},
  updatePanel:()=>{},
 };
 vm.createContext(context);
 vm.runInContext(`const W=48,H=36,S=52;
 let seed,rng,tiles,agents,homes,trees,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;
 ${core}`,context);
 vm.runInContext('createWorld()',context);
 const initial=vm.runInContext('({tiles,agents,trees,depot,reachable})',context);
 assert.equal(initial.agents.length,20);
 assert.ok(initial.reachable[initial.depot.y*48+initial.depot.x]===1,'depot must be connected: '+seedValue);
 for(const a of initial.agents){
  assert.ok(initial.reachable[Math.floor(a.y)*48+Math.floor(a.x)]===1,'unreachable spawn '+seedValue);
 }
 for(let tick=0;tick<600;tick++)vm.runInContext('step()',context);
 const output=vm.runInContext('({stock,homes,agents,depot,trees})',context);
 assert.ok(output.stock.wood>0||output.homes.length>0,'no delivered timber on seed '+seedValue);
 for(const h of output.homes)assert.ok(!output.trees.some(t=>t.wood>0&&t.x===h.x&&t.y===h.y),'house overlapping tree');
}
console.log('12 procedural world seeds: accessible depots, reachable settlers and wood delivery passed');
