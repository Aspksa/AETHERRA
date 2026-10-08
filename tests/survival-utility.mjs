import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
for(const seed of [42,77,1,2,3,4,5,6,7,8,9,10]){
 const context={Math,Uint8Array,Int32Array,Map,document:{getElementById:id=>id==='seed'?{value:String(seed)}:{innerHTML:''}},updatePanel:()=>{}};
 vm.createContext(context);
 vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${code}`,context);
 vm.runInContext('createWorld()',context);
 const before=vm.runInContext('({stock:{...stock},agents:agents.map(a=>({hunger:a.hunger}))})',context);
 assert.equal(before.agents.length,20);
 assert.ok(vm.runInContext('berries.length>0',context),'missing food sources seed '+seed);
 for(let i=0;i<1200;i++)vm.runInContext('step()',context);
 const after=vm.runInContext('({stock,homes,agents,berries,day})',context);
 assert.ok(after.agents.some(a=>a.experience.food>0),'no foraging seed '+seed);
 assert.ok(after.agents.some(a=>a.experience.wood>0),'no logging seed '+seed);
 assert.ok(after.agents.some(a=>a.hunger<50),'no eating seed '+seed);
 assert.ok(after.stock.food>=0,'negative food seed '+seed);
 assert.ok(after.agents.every(a=>a.hunger>=0&&a.hunger<=100&&a.health>=0&&a.health<=100),'invalid needs seed '+seed);
 assert.ok(after.homes.length>0,'no homes seed '+seed);
}
console.log('12 seed survival tests: food gathering, consumption, building and bounded needs passed');
