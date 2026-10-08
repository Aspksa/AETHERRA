import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
assert.match(html,/<script src="tech.js"><\/script>/);
const spec=JSON.parse(readFileSync('assets/world-spec.json','utf8'));
const core=html.slice(html.indexOf('function rand(){'),html.indexOf('function updatePanel('));
const make=(seedValue=42)=>{
 const ctx={Math,Uint8Array,Int32Array,Map,Set,Object,Number,JSON,RegExp,document:{getElementById:id=>id==='seed'?{value:String(seedValue)}:{innerHTML:'',textContent:''}},updatePanel:()=>{}};
 vm.createContext(ctx);
 for(const f of ['planner.js','building.js','world.js','tech.js'])vm.runInContext(readFileSync(f,'utf8'),ctx);
 vm.runInContext(`const W=48,H=36,S=52;let seed,rng,tiles,agents,homes,trees,berries,events,day,stock,selected,scale,ox,oy,uid,reachable,depot;${core}`,ctx);
 ctx.__spec=JSON.parse(JSON.stringify(spec));
 return {ctx,run:s=>vm.runInContext(s,ctx)};
};
const {ctx,run}=make();
const T=ctx.AetherraTech;
// 1. Recipes: tools and materials share ids (bronze, copper), so the kind decides which one is meant.
assert.equal(T.recipe(spec,'tool','bronze').kind,'tool');
assert.equal(T.recipe(spec,'material','bronze').kind,'material');
assert.equal(JSON.stringify(T.recipe(spec,'material','bronze').inputs),'{"copper":3,"tin":1}');
assert.equal(JSON.stringify(T.recipe(spec,'material','bronze').fuelTypes),'["charcoal"]','bronze needs charcoal');
assert.equal(T.recipe(spec,'material','charcoal').fuel,0);
const known=['concept_fire','concept_tool'];
let st={stone:1,wood:3};
assert.equal(T.canCraft(spec,'tool','stone',st,known),true);
assert.equal(T.canCraft(spec,'tool','copper',{copper_metal:1,wood:1},known),false,'metal tools need their concepts');
const made=T.craft(spec,'tool','stone',st,known);
assert.equal(made.dur,40);assert.equal(st.stone,0);assert.equal(st.wood,2);
assert.equal(T.craft(spec,'tool','stone',st,known),null,'no inputs, no tool');
// Fuel: charcoal preferred, wood used when nothing else fits.
st={copper:2,wood:5,charcoal:1};
T.craft(spec,'material','copper_metal',st,[...known,'concept_smelting']);
assert.equal(st.charcoal,0);assert.equal(st.copper_metal,1);assert.equal(st.wood,5);
st={copper:2,wood:5};T.craft(spec,'material','copper_metal',st,[...known,'concept_smelting']);assert.equal(st.wood,4);
st={copper:3,tin:1,charcoal:1};assert.equal(T.canCraft(spec,'material','bronze',st,[...known,'concept_alloy']),false,'two units of charcoal needed');
st.charcoal=2;assert.equal(T.canCraft(spec,'material','bronze',st,[...known,'concept_alloy']),true);
// Tool choice: strongest tool that is good enough.
const box=[{id:'stone',dur:10},{id:'copper',dur:10},{id:'flint_tool',dur:10}];
assert.equal(box[T.pickTool(spec,box,'stone')].id,'copper');
assert.equal(T.pickTool(spec,box,'bronze'),-1,'nothing in the box is strong enough');
assert.equal(T.pickTool(spec,[],'hands'),-1);
// Discovery rules from the spec.
const c=id=>spec.concepts.find(x=>x.id===id);
const u=(id,k,f={},n={})=>T.unlockChance(spec,c(id),k,f,n);
assert.equal(u('concept_pottery',[]),0,'no clay near fire, no pottery');
assert.equal(u('concept_pottery',[],{clay_near_fire:true}),.02);
assert.equal(u('concept_smelting',[],{ore_in_hot_fire:true}),0,'smelting needs pottery first');
assert.equal(u('concept_smelting',['concept_pottery'],{ore_in_hot_fire:true}),.015);
assert.equal(u('concept_knapping',[],{},{flint:4}),0);assert.ok(u('concept_knapping',[],{},{flint:5})>0);
assert.equal(u('concept_alloy',['concept_smelting'],{}),0,'alloy needs two ores');
assert.equal(u('concept_alloy',['concept_smelting'],{two_ores:true}),.01);
assert.equal(u('concept_fire',[],{}),0,'start concepts are already known');
assert.equal(u('concept_moon_cycle',['concept_night_watch'],{}),0,'unsupported unlocks stay locked');
// 2. A resident crafts a stone tool at the hearth, which then speeds up work and wears out.
run('createWorld();attachSpec(__spec);stock.food=500;stock.wood=40;stock.stone=4;day=0');
run('const A=agents[0];A.x=depot.x+.5;A.y=depot.y+.5;A.hunger=0');
run('a=0;for(const q of agents){q.craft=undefined}');
assert.deepEqual(JSON.parse(JSON.stringify(run('craftWanted()'))),['tool','stone'],'the first thing a village wants is a stone tool');
run('A.craft={kind:"tool",id:"stone",left:3}');
for(let i=0;i<10&&run('A.craft');i++)run('craftStep(A)');
assert.equal(run('toolbox.length'),1);assert.equal(run('toolbox[0].id'),'stone');
assert.ok(run('events.some(e=>e.includes("сделал: Каменный инструмент"))'));
// Copper needs a stone tool; with one in the box the resident takes it, works faster, and returns it worn.
run('createWorld();attachSpec(__spec);stock.food=500;stock.wood=40;day=0');
run('const C=deposits.find(d=>d.res==="stone");deposits.push({res:"copper",x:C.x,y:C.y,depth:0,amount:30});const M=agents[0];M.x=C.x+.5;M.y=C.y+.5;M.hunger=0;M.know={copper:{conf:.9,places:[{x:C.x,y:C.y}]}};stock.copper=0;stock.stone=5;');
run('toolbox=[]');
for(let i=0;i<50;i++)run('planExtraction(M)');
assert.equal(run('!!M.extract&&M.extract.res==="copper"'),false,'copper cannot be mined bare-handed');
run('toolbox=[{id:"stone",dur:40}];M.extract=undefined');
for(let i=0;i<200&&!run('M.extract');i++)run('planExtraction(M)');
assert.equal(run('M.extract.res'),'copper');assert.equal(run('M.tool.id'),'stone','the tool is taken from the box');
assert.equal(run('toolbox.length'),0);
const t0=run('M.tool.dur');
for(let i=0;i<4000&&run('M.extract');i++)run('extractStep(M)');
assert.ok(run('stock.copper')>0,'copper reaches the depot');
assert.equal(run('toolbox.length'),1,'the tool comes back');
assert.ok(run('toolbox[0].dur')<t0,'and it is worn');
// Tools make work faster than bare hands.
const days=(power)=>run(`daysPerUnit(resInfo("copper"),worldSpec.extraction_methods.find(e=>e.id==="dig"),0,0,${power})`);
assert.ok(days(1.0)<days(.5)&&days(1.8)<days(1.0));
// 3. Mine shafts: deep tin can only be worked from a shaft, which residents build from wood and stone.
run('createWorld();attachSpec(__spec);stock.food=500;stock.wood=40;stock.stone=10;day=0;toolbox=[{id:"copper",dur:80}]');
run('const T0=deposits.find(d=>d.res==="stone");deposits.push({res:"tin",x:T0.x,y:T0.y,depth:2,amount:30});const W0=agents[0];W0.x=depot.x+.5;W0.y=depot.y+.5;W0.hunger=0;for(const q of agents)q.know={tin:{conf:.9,places:[{x:T0.x,y:T0.y}]}};concepts=[{id:"concept_smelting",by:"x",day:0}]');
assert.equal(run('chooseMethod(resInfo("tin"),2,deposits[deposits.length-1])'),null,'no shaft, no deep mining');
assert.ok(run('shaftWanted()!==null'),'a known deep deposit asks for a shaft');
for(let i=0;i<100&&!run('W0.shaft');i++)run('planShaft(W0)');
assert.ok(run('!!W0.shaft'),'a resident plans the shaft');
for(let i=0;i<4000&&run('W0.shaft');i++)run('shaftStep(W0)');
assert.equal(run('structures.filter(s=>s.fn==="shaft").length'),1);
assert.equal(run('stock.wood'),32);assert.equal(run('stock.stone'),6);
assert.equal(run('chooseMethod(resInfo("tin"),2,deposits[deposits.length-1]).id'),'mine');
assert.equal(run('shaftWanted()'),null,'one shaft is enough');
// Collapse: forced bad luck hurts but never kills, and the miner still gets what was mined.
run('const D=deposits[deposits.length-1];W0.x=D.x+.5;W0.y=D.y+.5;W0.health=100;W0.tool=toolbox.splice(0,1)[0];W0.extract={res:"tin",x:D.x,y:D.y,depth:2,phase:"dig",prog:1,n:0}');
run('const realRand=rand;rand=()=>0');
run('extractStep(W0)');
run('rand=realRand');
assert.equal(run('W0.health'),75);assert.equal(run('W0.extract.phase'),'haul','the miner carries out what was already mined');assert.ok(run('events.some(e=>e.includes("обвал"))'));
assert.equal(run('toolbox.length'),1,'the tool survives a collapse');
// 4. The whole chain to bronze, scripted: each step only becomes possible after the previous one.
run('createWorld();attachSpec(__spec);stock.food=500;stock.wood=60;day=0;toolbox=[];concepts=[]');
const k=()=>run('HUMAN_CONCEPTS()');
assert.ok(!k().includes('concept_smelting'));
run('stock.clay=2;stock.copper=3;stock.tin=1;stock.charcoal=2;stock.stone=2');
run('for(let i=0;i<4000;i++)for(const q of agents)techStep(q)');
assert.ok(k().includes('concept_pottery'),'pottery by accident near a fire');
assert.ok(k().includes('concept_smelting'),'smelting after pottery');
assert.ok(k().includes('concept_metal_tool'));
assert.ok(k().includes('concept_alloy'),'alloy once both ores are at hand');
assert.ok(run('events.filter(e=>e.includes("открыл")).length')>=4);
run('A0=agents[0];A0.x=depot.x+.5;A0.y=depot.y+.5');
const craftNow=(kind,id)=>{run(`A0.craft={kind:"${kind}",id:"${id}",left:2}`);for(let i=0;i<10&&run('A0.craft');i++)run('craftStep(A0)')};
craftNow('material','bronze');
assert.equal(run('stock.bronze'),1);assert.equal(run('stock.copper'),0);assert.equal(run('stock.tin'),0);
craftNow('tool','bronze');
assert.equal(run('toolbox.some(t=>t.id==="bronze"&&t.dur===140)'),true,'a bronze tool exists');
assert.equal(run('stock.bronze'),0);
// 5. Saves keep knowledge and tools; bad data is rejected; old saves load with defaults.
run('toolbox=[{id:"copper",dur:50.5}];techCounts={flint:3};concepts=[{id:"concept_pottery",by:"Аня",day:7}];agents[0].tool={id:"stone",dur:12};agents[0].craft={kind:"tool",id:"stone",left:4};agents[0].shaft={x:5,y:5};explored[3]=9');
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
run('toolbox=[];techCounts={};concepts=[];explored.fill(0);agents[0].tool=undefined;agents[0].craft=undefined;agents[0].shaft=undefined');
run('restoreWorld')(snap);
assert.equal(run('toolbox[0].dur'),50.5);assert.equal(run('techCounts.flint'),3);assert.equal(run('concepts[0].id'),'concept_pottery');
assert.equal(run('agents[0].craft.left'),4);assert.equal(run('agents[0].tool.id'),'stone');assert.equal(run('explored[3]'),9);
const old=JSON.parse(JSON.stringify(snap));for(const key of ['concepts','techCounts','toolbox','explored'])delete old[key];
run('restoreWorld')(old);assert.equal(run('toolbox.length+concepts.length'),0);assert.equal(run('explored.length'),48);
const mutate=f=>{const s=JSON.parse(JSON.stringify(snap));f(s);return s};
for(const f of [s=>{s.toolbox[0].dur=-3},s=>{s.toolbox[0].id='Bad Id'},s=>{s.toolbox=Array(100).fill(s.toolbox[0])},s=>{s.concepts[0].id=42},s=>{s.techCounts.flint=-1},
 s=>{s.explored=[1,2]},s=>{s.agents[0].craft.kind='magic'},s=>{s.agents[0].craft.left=9999},s=>{s.agents[0].shaft.x=999},s=>{s.agents[0].tool.dur='x'}])
 assert.throws(()=>run('validateSnapshot')(mutate(f)));
// 6. A long run with everything attached stays healthy.
run('createWorld();attachSpec(__spec);stock.food=300;stock.wood=100');
for(let i=0;i<4000;i++)run('step()');
assert.ok(run('agents.filter(a=>a.health<=0).length===0'),'technology must not kill anyone');
assert.ok(run('toolbox.length<=60&&concepts.length<=30'));
// 7. Shafts are drawn.
const rctx={Math};vm.createContext(rctx);vm.runInContext(readFileSync('renderer.js','utf8'),rctx);
const draw=(structures)=>{let n=0;const c=new Proxy({}, {get(_t,p){if(p==='ellipse'||p==='fillRect')return()=>{n++};return()=>{}},set(){return true}});
 const W=48,H=36;rctx.AetherraRenderer.render(c,{structures,canvas:{clientWidth:640,clientHeight:480},tiles:Array(W*H).fill('grass'),trail:[],trees:[],berries:[],homes:[],agents:[],selected:null,seed:1,day:0,depot:{x:3,y:3},W,H,S:52,scale:1,ox:0,oy:0});return n};
assert.ok(draw([{id:1,inv:-1,fn:'shaft',material:'wood',place:'mine',x:5,y:5}])>draw([]),'shaft is drawn');
console.log('Technology: recipes, tool tiers, discoveries, crafting, shafts, the chain to bronze, saves and rendering passed');
