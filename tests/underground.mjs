import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
assert.match(html,/<script src="world.js"><\/script>/);
assert.match(html,/fetch\('assets\/world-spec.json'\)/);
const spec=JSON.parse(readFileSync('assets/world-spec.json','utf8'));
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const make=(seedValue=42)=>{
 const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,RegExp,document:{getElementById:id=>id==='seed'?{value:String(seedValue)}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
 vm.createContext(ctx);
 for(const f of ['planner.js','building.js','world.js'])vm.runInContext(readFileSync(f,'utf8'),ctx);
 vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
 ctx.__spec=JSON.parse(JSON.stringify(spec));
 return {ctx,run:s=>vm.runInContext(s,ctx)};
};
const {ctx,run}=make();
run('createWorld()');
assert.equal(run('deposits.length+signs.length'),0,'no spec, no underground');
assert.equal(run('attachSpec({})'),false,'junk spec rejected');
assert.equal(run('attachSpec(__spec)'),true);
// 1. Generation follows the spec and the seed.
const depositsA=run('JSON.stringify(deposits)'),signsA=run('JSON.stringify(signs)');
assert.ok(run('deposits.length')>20,'world must have deposits');
assert.ok(run('signs.length')>0,'world must have signs');
const W=48,H=36;
const ok=run(`(()=>{const B=AetherraWorld.deriveBiomes(tiles,W,H,trees);
 for(const d of deposits){const r=resInfo(d.res);if(!r)return 'unknown '+d.res;const b=B[d.y*W+d.x];
  if(!(r.host.biomes.includes('*')||r.host.biomes.includes(b)))return r.id+' in wrong biome '+b;
  if(r.host.rocks&&!r.host.rocks.includes(AetherraWorld.rockAt(__spec,b,d.depth)))return r.id+' in wrong rock';
  if(d.depth<r.depth[0]||d.depth>r.depth[1])return r.id+' depth';
  if(d.amount<1||d.amount>r.amount[1])return r.id+' amount';
  if(r.host.near_overlay)return r.id+' needs an overlay';
  if(reachable[d.y*W+d.x]!==1)return 'unreachable deposit';}
 for(const t of signs){if(!__spec.signs.some(s=>s.id===t.sign))return 'unknown sign';if(tiles[t.y*W+t.x]==='water')return 'sign on water'}
 return 'ok'})()`);
assert.equal(ok,'ok');
assert.ok(run(`(()=>{const B=AetherraWorld.deriveBiomes(tiles,W,H,trees),r=resInfo('stone');
 return deposits.filter(d=>d.res==='stone').every(d=>{for(let k=r.depth[0];k<d.depth;k++)if(r.host.rocks.includes(AetherraWorld.rockAt(__spec,B[d.y*W+d.x],k)))return false;return true})})()`),'surface deposits lie in the shallowest matching layer');
const two=make(42);two.run('createWorld()');two.run('attachSpec(__spec)');
assert.equal(two.run('JSON.stringify(deposits)'),depositsA,'same seed gives the same underground');
assert.equal(two.run('JSON.stringify(signs)'),signsA);
const other=make(7);other.run('createWorld()');other.run('attachSpec(__spec)');
assert.notEqual(other.run('JSON.stringify(deposits)'),depositsA,'different seed, different underground');
// 2. Visibility and noticing.
const Wd=ctx.AetherraWorld;
assert.equal(Wd.signVisible(spec,'sticky_mud',true),true);
assert.equal(Wd.signVisible(spec,'green_stain',true),false,'day signs are hidden at night');
assert.equal(Wd.signVisible(spec,'night_glow',false),false,'night signs are hidden by day');
assert.equal(Wd.signVisible(spec,'silver_frost',false),false,'moon and season signs are not supported yet');
const clay=spec.resources.find(r=>r.id==='clay'),perc={material:.5};
const low=Wd.noticeChance(spec,clay,'sticky_mud',perc,0,1.5),high=Wd.noticeChance(spec,clay,'sticky_mud',perc,1,1.5);
assert.ok(low>0&&high>low&&high<=1,'curiosity raises the notice chance');
// 3. Knowledge: noticing, test pits, confirmation, teaching.
run('const R=agents[0];R.know=undefined;const flintSpec=resInfo("flint");const P=deposits.find(d=>d.res==="stone");');
run('deposits.push({res:"flint",x:P.x,y:P.y,depth:0,amount:9});signs.push({sign:"knapped_shards",x:P.x,y:P.y,real:true});');
run('learnSignLink(R,flintSpec,{sign:"knapped_shards",x:P.x,y:P.y})');
assert.equal(run('R.know.flint.conf'),.15);
assert.ok(run('events.some(e=>e.includes("заметил"))'),'first sighting is announced');
for(let round=0;round<3&&run('R.know&&R.know.flint&&R.know.flint.conf<.6');round++){
 run('R.x=P.x+.5;R.y=P.y+.5;R.dig={res:"flint",x:P.x,y:P.y,left:-1}');
 for(let i=0;i<30&&run('R.dig');i++)run('digStep(R)');
}
assert.ok(run('R.know.flint.conf>=.6'),'finding the deposit confirms the belief');
assert.ok(run('events.some(e=>e.includes("подтвердил"))'));
assert.equal(run('knows(R,"flint")'),true);
run('const Q=agents[1];Q.know=undefined;for(let i=0;i<400;i++)teachPair(R,Q)');
assert.ok(run('Q.know&&Q.know.flint&&Q.know.flint.conf>0&&Q.know.flint.conf<=R.know.flint.conf*.6+1e-9'),'neighbours teach at 60%');
// An empty pit weakens the belief and removes it when nothing is left.
run('const E=agents[2];E.know={clay:{conf:.15,places:[{x:0,y:0}]}};deposits=deposits.filter(d=>d.res!=="clay");E.dig={res:"clay",x:0,y:0,left:-1};E.x=.5;E.y=.5');
for(let i=0;i<30&&run('E.dig');i++)run('digStep(E)');
assert.equal(run('E.know.clay'),undefined,'a wrong sign link disappears');
// 4. Extraction: bare hands, real time, deposits shrink and run out, goods reach the depot.
run('createWorld();attachSpec(__spec);');
run('const T=deposits.find(d=>d.res==="stone");const M=agents[0];M.x=T.x+.5;M.y=T.y+.5;M.hunger=0;M.energy=100;stock.stone=0;stock.food=500;const before=T.amount;M.extract={res:"stone",x:T.x,y:T.y,depth:T.depth,phase:"dig",prog:0,n:0}');
for(let i=0;i<4000&&run('M.extract');i++)run('extractStep(M)');
assert.ok(run('stock.stone>0'),'mined stone reaches the depot');
assert.ok(run('T.amount<before'),'deposit shrinks');
run('stock.stone=0;T.amount=2;M.x=T.x+.5;M.y=T.y+.5;M.extract={res:"stone",x:T.x,y:T.y,depth:T.depth,phase:"dig",prog:0,n:0}');
for(let i=0;i<4000&&run('M.extract');i++)run('extractStep(M)');
assert.ok(run('!deposits.includes(T)'),'empty deposits disappear');
assert.equal(run('stock.stone'),2,'exactly what was mined is delivered');
// Salt preserves food; stone structures use stone instead of wood.
const lost=n=>run(`(()=>{stock.food=200;spoilAcc=0;for(let i=0;i<${n};i++)decayFood();return 200-stock.food})()`);
run('stock.salt=0');const plain=lost(1000);run('stock.salt=30');assert.ok(lost(1000)<plain*.5,'salt slows spoilage');run('stock.salt=0');
run('const inv={cost:12,material:"stone"};stock.stone=0');assert.equal(run('structureWoodCost(inv)'),12);
run('stock.stone=6');assert.equal(run('structureWoodCost(inv)'),6,'stone replaces part of the wood');
// 5. Saves: keep the underground and what residents know, reject garbage, regenerate for old saves.
run('createWorld();attachSpec(__spec);agents[0].know={flint:{conf:.7,places:[{x:5,y:5}]}};agents[0].extract={res:"stone",x:3,y:3,depth:0,phase:"dig",prog:.3,n:2}');
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
const keep=run('JSON.stringify(deposits)');
run('deposits=[];signs=[];agents[0].know=undefined;agents[0].extract=undefined');run('restoreWorld')(snap);
assert.equal(run('JSON.stringify(deposits)'),keep);assert.equal(run('agents[0].know.flint.conf'),.7);
const old=JSON.parse(JSON.stringify(snap));delete old.deposits;delete old.signs;
run('deposits=[];signs=[]');run('restoreWorld')(old);
assert.equal(run('JSON.stringify(deposits)'),keep,'old saves get the same underground back from the seed');
const mutate=f=>{const s=JSON.parse(JSON.stringify(snap));f(s);return s};
for(const f of [s=>{s.deposits[0].amount=-1},s=>{s.deposits[0].depth=9},s=>{s.deposits[0].res='Bad Id'},s=>{s.signs[0].real='yes'},s=>{s.agents[0].know.flint.conf=3},
 s=>{s.agents[0].know.flint.places=[{x:999,y:0}]},s=>{s.agents[0].extract.phase='teleport'},s=>{s.stock.stone=-5},s=>{s.deposits=Array(5000).fill(s.deposits[0])}])
 assert.throws(()=>run('validateSnapshot')(mutate(f)));
// 6. A long run with the underground attached keeps everyone alive and learns something.
run('createWorld();attachSpec(__spec);stock.food=300;stock.wood=100');
for(let i=0;i<4000;i++)run('step()');
assert.ok(run('agents.filter(a=>a.health<=0).length===0'),'the underground must not kill anyone');
assert.ok(run('agents.every(a=>!a.know||Object.keys(a.know).length<=12)'));
assert.ok(run('deposits.every(d=>d.amount>=0)'));
// 7. The renderer draws signs and confirmed spots.
const rctx={Math};vm.createContext(rctx);vm.runInContext(readFileSync('renderer.js','utf8'),rctx);
const draw=(extra)=>{let n=0;const c=new Proxy({}, {get(_t,p){if(p==='ellipse'||p==='fillRect'||p==='fill'||p==='stroke')return()=>{n++};return()=>{}},set(){return true}});
 rctx.AetherraRenderer.render(c,{...extra,canvas:{clientWidth:640,clientHeight:480},tiles:Array(W*H).fill('grass'),trail:[],trees:[],berries:[],homes:[],agents:[],structures:[],selected:null,seed:1,day:0,depot:{x:3,y:3},W,H,S:52,scale:1,ox:0,oy:0});return n};
const base=draw({signs:[],spots:[]});
assert.ok(draw({signs:[{sign:'green_stain',x:5,y:5,real:true}],spots:[]})>base,'signs are drawn');
assert.ok(draw({signs:[],spots:[{res:'flint',x:6,y:6}]})>base,'confirmed spots are drawn');
console.log('Underground: spec-driven deposits and signs, noticing, test pits, teaching, extraction, saves and rendering passed');
