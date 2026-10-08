import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
assert.match(html,/<script src="building.js"><\/script>/);
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,RegExp,document:{getElementById:id=>id==='seed'?{value:'42'}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
vm.createContext(ctx);
for(const f of ['planner.js','building.js'])vm.runInContext(readFileSync(f,'utf8'),ctx);
vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
const run=s=>vm.runInContext(s,ctx);
// 1. Bricks: every combination of function, material and place is available, and inventors answer real problems.
const B=ctx.AetherraBuilding;
assert.equal(B.enumerate().length,8);
assert.ok(B.costOf({fn:'warmth',material:'stone',place:'depot'})>B.costOf({fn:'warmth',material:'wood',place:'depot'}),'stone costs more');
assert.equal(B.choose([{name:'cold',severity:.1,fit:{}}],()=>.5,0),null,'no acute problem, no invention');
const cold=B.choose([{name:'cold',severity:1,fit:{depot:1,homes:.7}},{name:'spoil',severity:.1,fit:{depot:1,homes:.5}}],()=>.5,0);
assert.equal(cold.fn,'warmth');
const spoil=B.choose([{name:'cold',severity:.1,fit:{depot:1,homes:.7}},{name:'spoil',severity:1,fit:{depot:1,homes:.5}}],()=>.5,0);
assert.equal(spoil.fn,'preserve');
const odd=new Set();let k=0;for(let i=0;i<200;i++){const c=B.choose([{name:'cold',severity:1,fit:{depot:1,homes:.7}}],()=>((k=(k*7919+13)%1000)/1000),1);odd.add(c.fn+c.material+c.place)}
assert.ok(odd.size>2,'curious inventors must try varied ideas');
assert.equal(B.nameOf({fn:'warmth',material:'wood',place:'depot'}),'костёр у склада');
// 2. Cold: a night outdoors drains energy but never health; fires and beds protect; day recovers.
run('createWorld()');
run('const R=agents[0];R.x=10.5;R.y=10.5;R.energy=100;R.hunger=0;R.resting=false;R.home=null;day=6');
for(let i=0;i<80;i++)run('updateCold(R)');
assert.ok(run('R.cold')>=60,'resident outdoors at night gets cold');
assert.ok(run('R.energy')<100,'cold drains energy');
assert.equal(run('R.health'),100,'cold never kills');
run('structures.push({id:1,inv:1,fn:"warmth",material:"wood",place:"depot",x:10,y:10});');
for(let i=0;i<80;i++)run('updateCold(R)');
assert.equal(run('R.cold'),0,'a fire nearby warms the resident');
run('structures.length=0;R.cold=0;R.resting=true;R.home=7;R.state="Спит дома"');
for(let i=0;i<80;i++)run('updateCold(R)');
assert.equal(run('R.cold'),0,'sleeping at home is warm');
run('R.resting=false;R.home=null;R.state="Отдыхает";R.cold=90;day=0');
for(let i=0;i<50;i++)run('updateCold(R)');
assert.equal(run('R.cold'),0,'cold wears off in daylight');
// 3. Food spoils slowly; racks and cellars slow it down.
const lost=n=>run(`(()=>{stock.food=200;spoilAcc=0;for(let i=0;i<${n};i++)decayFood();return 200-stock.food})()`);
const plain=lost(1000);
assert.ok(plain>20&&plain<80,'food spoils at a modest rate: '+plain);
run('structures.push({id:2,inv:1,fn:"preserve",material:"stone",place:"depot",x:3,y:3})');
assert.ok(lost(1000)<plain*.6,'a cellar must slow spoilage');
run('structures.length=0');
// 4. A resident invents a fix to a problem they feel, and the village builds it through the planner.
run('createWorld();stock.food=500;stock.wood=60;day=6');
run('for(const a of agents){a.cold=80;a.traits.curiosity=1;a.nextDecision=0}');
run('inventions.length=0');
for(let i=0;i<40&&!run('inventions.length');i++)run('for(const a of agents)considerInvention(a)');
assert.ok(run('inventions.length')>=1,'someone must invent something');
assert.ok(run('events.some(e=>e.includes("придумал"))'),'invention is announced');
run('const warm=inventions.find(i=>i.fn==="warmth")||inventions[0];if(!inventions.some(i=>i.fn==="warmth"))inventions.push({id:uid++,fn:"warmth",material:"wood",place:"depot",name:"костёр у склада",cost:6,inventor:"x",day:0})');
run('for(const a of agents)a.home=a.home||1;for(const a of agents){a.cold=80;a.nextDecision=0}day=6');
for(let i=0;i<1500&&!run('structures.length');i++){run('for(const a of agents)if(a.cold<70)a.cold=80');run('step()')}
assert.ok(run('structures.length')>=1,'the village must build the invention');
assert.ok(run('Math.hypot(structures[0].x-depot.x,structures[0].y-depot.y)<10'),'structure stands near its place');
assert.ok(run('events.some(e=>e.includes("построил:"))'));
// 5. Long runs stay healthy: nobody dies of cold or spoilage, structures stay bounded.
run('createWorld();stock.food=300;stock.wood=100');
for(let i=0;i<3000;i++)run('step()');
assert.ok(run('agents.filter(a=>a.health<=0).length===0'),'inventions must not kill anyone');
assert.ok(run('structures.length<=MAX_STRUCTURES&&inventions.length<=MAX_INVENTIONS'));
// 6. Saves keep inventions, structures and food spoilage; bad data is rejected; old saves load empty.
run('inventions=[{id:5,fn:"warmth",material:"stone",place:"homes",name:"каменный очаг среди домов",cost:12,inventor:"Аня",day:3}];structures=[{id:6,inv:5,fn:"warmth",material:"stone",place:"homes",x:4,y:5}];spoilAcc=.4;agents[0].cold=33');
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
run('inventions=[];structures=[];spoilAcc=0');run('restoreWorld')(snap);
assert.equal(run('inventions.length'),1);assert.equal(run('structures[0].x'),4);assert.equal(run('spoilAcc'),.4);assert.equal(run('agents[0].cold'),33);
const old=JSON.parse(JSON.stringify(snap));delete old.inventions;delete old.structures;delete old.spoilAcc;
run('restoreWorld')(old);assert.equal(run('inventions.length+structures.length+spoilAcc'),0);
const mutate=f=>{const s=JSON.parse(JSON.stringify(snap));f(s);return s};
for(const f of [s=>{s.inventions[0].fn='magic'},s=>{s.inventions[0].cost=-1},s=>{s.structures[0].x=999},s=>{s.structures[0].material='gold'},s=>{s.spoilAcc=-5},s=>{s.agents[0].cold=500},s=>{s.structures=Array(100).fill(s.structures[0])}])
 assert.throws(()=>run('validateSnapshot')(mutate(f)));
// 7. The renderer draws structures, and warmth fires glow at night.
const rctx={Math};vm.createContext(rctx);vm.runInContext(readFileSync('renderer.js','utf8'),rctx);
const draw=(structures,daylight)=>{let n=0,grads=0;const c=new Proxy({}, {get(_t,p){if(p==='ellipse'||p==='fillRect')return()=>{n++};if(p==='createRadialGradient')return()=>{grads++;return {addColorStop(){}}};return()=>{}},set(){return true}});
 const W=48,H=36;rctx.AetherraRenderer.render(c,{structures,daylight,canvas:{clientWidth:640,clientHeight:480},tiles:Array(W*H).fill('grass'),trail:[],trees:[],berries:[],homes:[],agents:[],selected:null,seed:1,day:0,depot:{x:3,y:3},W,H,S:52,scale:1,ox:0,oy:0});return {n,grads}};
const fire=[{id:1,fn:'warmth',material:'wood',place:'depot',x:5,y:5}],rack=[{id:2,fn:'preserve',material:'wood',place:'depot',x:6,y:6}],cellar=[{id:3,fn:'preserve',material:'stone',place:'depot',x:7,y:7}];
const none=draw([],1).n;
for(const list of [fire,rack,cellar])assert.ok(draw(list,1).n>none,'structure must be drawn');
assert.ok(draw(fire,0).grads>draw([],0).grads,'fire must glow at night');
console.log('Inventions: bricks, cold and spoilage problems, invention and planner-built structures, saves and rendering passed');
