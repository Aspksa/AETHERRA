import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,RegExp,document:{getElementById:id=>id==='seed'?{value:'42'}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
vm.createContext(ctx);
vm.runInContext(readFileSync('planner.js','utf8'),ctx);vm.runInContext(readFileSync('building.js','utf8'),ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
run('createWorld()');
// 1. Walking wears the ground; untouched ground stays clean.
assert.ok(run('trail.every(v=>v===0)'),'new world has no trails');
run('for(let i=0;i<1500;i++)step()');
assert.ok(run('trail.filter(v=>v>=3).length')>10,'residents must wear visible trails');
assert.ok(run('trail.every(v=>v>=0&&v<=255)'));
const worn=run('trail.filter(v=>v>0).length');
assert.ok(worn<run('W*H')*.8,'trails must not cover the whole map');
// 2. Worn ground is faster to walk on.
run('const R=agents[0];R.path=[{x:20,y:20}];R.goal=-1;R.x=10.5;R.y=10.5;trail.fill(0);globalThis.slow=(()=>{move(R,20.5,10.5);return R.x-10.5})()');
run('R.x=10.5;R.y=10.5;R.path=undefined;R.goal=undefined;trail[idx(10,10)]=60;globalThis.fast=(()=>{move(R,20.5,10.5);return R.x-10.5})()');
assert.ok(run('fast>slow'),'trail must speed up walking');
// 3. Trails fade when unused, deterministically from the saved clock.
run('trail.fill(0);trail[5]=100;day=.065*20;decayTrails()');
assert.ok(run('trail[5]<100&&trail[5]>90'));
run('trail[5]=100;day=.065*21;decayTrails()');
assert.equal(run('trail[5]'),100,'decay must only run on its tick');
// 4. New houses prefer ground beside a trail and avoid building on the road itself.
run(`for(let y=3;y<=13;y++)for(let x=10;x<=36;x++){tiles[idx(x,y)]='grass';reachable[idx(x,y)]=1}trees=[];homes=[{id:1,x:22,y:10,level:1,owner:'x'}];trail.fill(0);for(let x=14;x<=30;x++)trail[idx(x,8)]=40;`);
const share=()=>{let near=0,total=0;for(let i=0;i<300;i++){const site=run('chooseSite()');if(!site)continue;total++;if(Math.abs(site.y-8)<=1)near++}return near/total};
const withTrail=share();
run('trail.fill(0)');const without=share();
assert.ok(withTrail>without+.1,'trail must pull houses toward it ('+withTrail.toFixed(2)+' vs '+without.toFixed(2)+')');
run('for(let x=14;x<=30;x++)trail[idx(x,8)]=40');
let onRoad=0;for(let i=0;i<300;i++){const site=run('chooseSite()');if(site&&site.y===8)onRoad++}
assert.ok(onRoad<=withTrail*300*.5,'houses should avoid the road itself');
assert.equal(run('wearAt(-5,-5)'),0);
// 5. Saves keep trails, reject garbage and accept old saves without trails.
run('trail.fill(0);trail[100]=33.3;trail[200]=7');
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
assert.equal(Object.keys(snap.trail).length,2);
run('trail.fill(0)');run('restoreWorld')(snap);
assert.equal(run('trail[100]'),33.3);
const old=JSON.parse(JSON.stringify(snap));delete old.trail;run('restoreWorld')(old);
assert.ok(run('trail.length===W*H&&trail.every(v=>v===0)'));
for(const bad of [{"x":1},{"99999":1},{"5":999},{"5":"a"}]){const s=JSON.parse(JSON.stringify(snap));s.trail=bad;assert.throws(()=>run('validateSnapshot')(s),'bad trail accepted: '+JSON.stringify(bad));}
// 6. The renderer draws trails and does not mutate them.
const rsrc=readFileSync('renderer.js','utf8');const rctx={Math};vm.createContext(rctx);vm.runInContext(rsrc,rctx);
let ellipses=0;const c=new Proxy({}, {get(_t,p){if(p==='ellipse')return()=>{ellipses++};return ()=>{}},set(){return true}});
const W=48,H=36,tiles=Array.from({length:W*H},()=>'grass'),trail=new Array(W*H).fill(0);
const world={canvas:{clientWidth:640,clientHeight:480},tiles,trail,trees:[],berries:[],homes:[],agents:[],selected:null,seed:1,day:0,depot:{x:3,y:3},W,H,S:52,scale:1,ox:0,oy:0};
rctx.AetherraRenderer.render(c,world);const base=ellipses;
for(let i=0;i<12;i++)trail[5*W+i]=80;ellipses=0;rctx.AetherraRenderer.render(c,world);
assert.ok(ellipses>base,'worn ground must be drawn');
console.log('Trails: wear, speed bonus, decay, house placement, save compatibility and rendering passed');
