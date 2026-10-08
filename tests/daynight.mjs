import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,RegExp,document:{getElementById:id=>id==='seed'?{value:'42'}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
vm.createContext(ctx);
vm.runInContext(readFileSync('planner.js','utf8'),ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
run('createWorld()');
// 1. Sunlight is a smooth 0..1 cycle: noon at day 0, midnight half a cycle later.
assert.equal(run('daylight(0)'),1);
assert.equal(run('daylight(DAY_LENGTH/2)'),0);
assert.equal(run('daylight(DAY_LENGTH)'),1);
for(let d=0;d<24;d+=.1){const v=run(`daylight(${d})`);assert.ok(v>=0&&v<=1);}
assert.equal(run('day=0,isNight()'),false);
assert.equal(run('day=6,isNight()'),true);
// 2. Housed residents go home and sleep through the night, then wake up in the morning.
run(`homes.push({id:900,x:20,y:20,level:1,owner:agents[0].name});const R=agents[0];R.home=900;R.x=20.5;R.y=20.5;R.energy=70;R.hunger=0;R.resting=false;R.path=undefined;R.goal=undefined;stock.food=500;day=5;`);
run('step()');
assert.equal(run('R.resting'),true,'tired housed resident must start sleeping at night');
for(let i=0;i<25;i++)run("step()");
assert.equal(run('R.state'),'Спит дома');
assert.ok(run('R.energy>=95'),'sleep must restore energy');
assert.equal(run('R.resting'),true,'resident must keep sleeping until morning');
run('day=10');for(let i=0;i<3;i++)run('step()');
assert.equal(run('R.resting'),false,'resident must wake in the morning');
// 3. Residents without a home are not forced to sleep by night alone.
run(`const N=agents[1];N.home=null;N.energy=70;N.hunger=0;N.resting=false;day=6;`);
run('step()');
assert.equal(run('N.resting'),false);
// 4. The renderer tints the map at night and lights windows; by day it adds nothing.
const rctx={Math};vm.createContext(rctx);vm.runInContext(readFileSync('renderer.js','utf8'),rctx);
const draw=(daylight)=>{const log=[];let grads=0,fill='';
 const c=new Proxy({}, {get(_t,p){if(p==='fillRect')return()=>log.push(String(fill));if(p==='createRadialGradient')return()=>{grads++;return {addColorStop(){}}};return()=>{}},set(_t,p,v){if(p==='fillStyle')fill=v;return true}});
 const W=48,H=36,tiles=Array.from({length:W*H},()=>'grass');
 rctx.AetherraRenderer.render(c,{daylight,canvas:{clientWidth:640,clientHeight:480},tiles,trail:[],trees:[],berries:[],homes:[{x:4,y:4,id:1}],agents:[],selected:null,seed:1,day:0,depot:{x:3,y:3},W,H,S:52,scale:1,ox:0,oy:0});
 return {tint:log.filter(f=>f.startsWith('rgba(10,16,48')).length,grads};};
const noon=draw(1),night=draw(0);
assert.equal(noon.tint,0);assert.equal(noon.grads,0);
assert.equal(night.tint,1,'night must tint the map');
assert.ok(night.grads>=2,'night must light windows and the depot lantern');
// A renderer without gradient support still works.
assert.doesNotThrow(()=>rctx.AetherraRenderer.render(new Proxy({}, {get:()=>()=>{},set:()=>true}),{daylight:0,canvas:{clientWidth:100,clientHeight:100},tiles:Array(48*36).fill('grass'),trees:[],berries:[],homes:[{x:1,y:1,id:1}],agents:[],selected:null,seed:1,day:0,depot:{x:2,y:2},W:48,H:36,S:52,scale:1,ox:0,oy:0}));
console.log('Day and night: light cycle, sleeping through the night, tint and window lights passed');
