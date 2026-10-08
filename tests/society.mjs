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
// 1. Residents working side by side form a bond; distant ones do not.
run(`for(const a of agents){a.state='Отдыхает';a.bonds={}}
 const [p,q,r]=agents;p.state=q.state=r.state='Добывает древесину';p.x=10;p.y=10;q.x=11;q.y=10;r.x=30;r.y=30;
 for(let i=0;i<120;i++){day+=.065*6;socialStep()}`);
assert.ok(run('bondOf(agents[0],agents[1].id)>10'),'neighbours at work must bond');
assert.equal(run('bondOf(agents[0],agents[1].id)'),run('bondOf(agents[1],agents[0].id)'),'bond is mutual');
assert.equal(run('bondOf(agents[0],agents[2].id)'),0,'distant residents must not bond');
// 2. A friendship is announced once and a resident keeps at most 8 bonds.
run(`for(let i=0;i<2000;i++){day+=.065*6;socialStep()}`);
assert.equal(run('events.filter(e=>e.includes("подружились")).length'),1,'friendship must be announced once');
run(`agents[0].bonds={};for(let i=1;i<=15;i++)addBond(agents[0],{id:900+i},i)`);
assert.ok(run('Object.keys(agents[0].bonds).length<=MAX_BONDS'),'bonds must be bounded');
assert.ok(run('Object.values(agents[0].bonds).every(v=>v>=0&&v<=100)'));
// 3. Residents copy a more successful friend; a worse-off friend is ignored.
run(`const A=agents[3],B=agents[4];A.traits={industry:0,sociability:0,courage:0,generosity:0,curiosity:1};B.traits={industry:1,sociability:1,courage:1,generosity:1,curiosity:1};
 A.home=null;A.hunger=90;A.health=60;B.home=1;B.hunger=0;B.health=100;A.bonds={[B.id]:60};B.bonds={};
 for(const a of agents)if(a!==A&&a!==B)a.bonds={};
 for(let i=0;i<20;i++)imitationRound()`);
assert.ok(run('Object.values(agents[3].traits).some(v=>v>0)'),'must adopt traits of successful friend');
assert.ok(run('Object.values(agents[3].traits).every(v=>v<=1)'));
assert.equal(run('JSON.stringify(agents[4].traits)'),'{"industry":1,"sociability":1,"courage":1,"generosity":1,"curiosity":1}','successful resident must not copy a worse-off one');
// 4. Children start bonded to their parents; long runs keep every bond valid.
run('createWorld();stock.food=2000;stock.wood=300');
for(let i=0;i<1800;i++)run('step()');
assert.ok(run('agents.some(a=>a.age<16&&Object.keys(a.bonds||{}).length>=1)'),'children must have family bonds');
assert.ok(run('agents.every(a=>Object.values(a.bonds||{}).every(v=>v>=0&&v<=100)&&Object.keys(a.bonds||{}).length<=8)'));
assert.ok(run('agents.some(a=>Object.keys(a.bonds||{}).length>=2)'),'a society must form');
// 5. Saves keep bonds, reject garbage and accept old saves without bonds.
const snap=run('JSON.parse(JSON.stringify(worldSnapshot()))');
run('restoreWorld')(snap);
const old=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents.forEach(a=>delete a.bonds);return s})()');
run('restoreWorld')(old);
assert.ok(run('agents.every(a=>a.bonds&&Object.keys(a.bonds).length===0)'));
const bad=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents[0].bonds={"x":5};return s})()');
assert.throws(()=>run('validateSnapshot')(bad),'non-numeric bond id accepted');
const bad2=run('(()=>{const s=JSON.parse(JSON.stringify(worldSnapshot()));s.agents[0].bonds={"1":999};return s})()');
assert.throws(()=>run('validateSnapshot')(bad2),'out-of-range bond accepted');
console.log('Society: bonds, friendships, imitation, family ties and save compatibility passed');
