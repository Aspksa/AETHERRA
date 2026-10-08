import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
assert.match(html,/<script src="planner.js"><\/script>/);
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const ctx={Math,Uint8Array,Int32Array,Map,Set,document:{getElementById:id=>id==='seed'?{value:'42'}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
vm.createContext(ctx);
vm.runInContext(readFileSync('planner.js','utf8'),ctx);vm.runInContext(readFileSync('building.js','utf8'),ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
// 1. The planner chains actions on its own from facts and effects.
const P=ctx.AetherraPlanner;
const goal={hasHome:true};
assert.equal(JSON.stringify(P.plan({woodInHand:false,woodStocked:false,hasHome:false},goal)),JSON.stringify(['chop','deliver','buildHome']));
assert.equal(JSON.stringify(P.plan({woodInHand:true,woodStocked:false,hasHome:false},goal)),JSON.stringify(['deliver','buildHome']));
assert.equal(JSON.stringify(P.plan({woodInHand:false,woodStocked:true,hasHome:false},goal)),JSON.stringify(['buildHome']));
assert.equal(JSON.stringify(P.plan({woodInHand:false,woodStocked:false,hasHome:true},goal)),JSON.stringify([]));
assert.equal(P.plan({a:false},{a:true},[]),null,'unreachable goal must return null');
// 2. A new action extends behaviour without changing the planner: dried berries feed the hungry.
const extra=[...P.ACTIONS,{name:'pick',pre:{berries:false},eff:{berries:true}},{name:'dry',pre:{berries:true},eff:{berries:false,stored:true}}];
assert.equal(JSON.stringify(P.plan({berries:false,stored:false},{stored:true},extra)),JSON.stringify(['pick','dry']));
// 3. Houses are built by a resident's decision, not by a global rule.
run('createWorld()');
run('stock.wood=40;stock.food=500');
assert.equal(run('homes.length'),0);
for(let i=0;i<4000&&run('homes.length')===0;i++)run('step()');
assert.ok(run('homes.length')>=1,'no resident built a home');
const owner=run('homes[0].owner');
assert.equal(run('agents.find(a=>a.name===homes[0].owner).home'),run('homes[0].id'),'builder must own the new home');
assert.ok(run("events.some(e=>e.includes('построил дом'))"),"build must be logged");
console.log('Planner chains actions; homes are built by resident decisions');
