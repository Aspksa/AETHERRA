import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
for(const seedValue of [42,999,77,1]){
 const ctx={Math,Uint8Array,Int32Array,Map,document:{getElementById:id=>id==='seed'?{value:String(seedValue)}:{innerHTML:''}},updatePanel:()=>{}};
 vm.createContext(ctx);
 vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run('createWorld()');
 const location=run('({x:depot.x,y:depot.y})');
 run(`agents[0].x=${location.x}+.05; agents[0].y=${location.y}+.05;agents[0].hunger=85;stock.food=150;agents[0].path=undefined;agents[0].goal=undefined`);
 for(let i=0;i<70;i++)run('step()');
 assert.ok(run('agents[0].hunger<85'),'citizen cannot eat from inside depot tile seed '+seedValue);
 run(`agents[1].x=${location.x}+.05;agents[1].y=${location.y}+.05;agents[1].carrying=3;agents[1].hunger=0`);
 for(let i=0;i<70;i++)run('step()');
 assert.equal(run('agents[1].carrying'),0,'wood trapped within depot tile seed '+seedValue);
 run('agents[0].energy=18;agents[0].resting=false;agents[0].hunger=0');
 for(let i=0;i<2;i++)run('step()');
 assert.equal(run('agents[0].resting'),true,'rest must not stop at 22 seed '+seedValue);
 assert.ok(run('agents[0].energy>18'),'rest does not restore energy');
 for(let i=0;i<1600;i++)run('step()');
 assert.ok(run('agents.filter(a=>a.health<=0).length===0'),'death despite food access seed '+seedValue);
}
console.log('same-tile depot hunger, wood delivery, rest hysteresis, multi-seed survival passed');
