/* AETHERRA technology: concepts, crafting recipes and tools from assets/world-spec.json. Pure functions, no world access. */
(function(global){
'use strict';
const tierIndex=(spec,id)=>spec.tool_tier_order.indexOf(id);
const toolDef=(spec,id)=>spec.tools.find(t=>t.id===id);
const conceptDef=(spec,id)=>spec.concepts.find(c=>c.id===id);
// Index of the strongest tool in `toolbox` that is at least as good as `minTool`, or -1.
function pickTool(spec,toolbox,minTool){
 const need=tierIndex(spec,minTool);
 let best=-1,power=-1;
 toolbox.forEach((t,i)=>{const d=toolDef(spec,t.id);if(d&&tierIndex(spec,t.id)>=need&&d.power>power){power=d.power;best=i}});
 return best;
}
// Something that can be crafted: a tool (made_from) or a derived material (from.inputs + fuel).
// Tool and material ids overlap (bronze, copper), so the kind is always given: 'tool' or 'material'.
function recipe(spec,kind,id){
 const tool=kind==='tool'?toolDef(spec,id):null;
 if(tool&&tool.made_from)return {id,kind:'tool',inputs:tool.made_from,fuel:0,fuelTypes:[],concepts:tool.needs_concepts||[],days:.5,durability:tool.durability};
 const d=kind==='material'?spec.derived_materials.find(m=>m.id===id):null;
 if(d&&typeof d.from==='object'){
  const inputs=d.from.inputs;
  let types=null;
  for(const k of Object.keys(inputs)){
   const r=spec.resources.find(x=>x.id===k);
   if(r&&r.smelt){types=types?types.filter(f=>r.smelt.fuel.includes(f)):[...r.smelt.fuel]}
  }
  return {id,kind:'material',inputs,fuel:d.from.fuel||0,fuelTypes:types||[],concepts:d.from.needs_concepts||[],days:(d.from.fuel||0)?.5+.5*(d.from.fuel||0):.5};
 }
 return null;
}
// First available fuel type with enough stock, preferring clean fuels (charcoal) over wood.
function pickFuel(rec,stock){
 if(!rec.fuel)return null;
 const order=['charcoal','peat','coal','wood'];
 for(const f of order)if(rec.fuelTypes.includes(f)&&(stock[f]||0)>=rec.fuel)return f;
 return null;
}
function canCraft(spec,kind,id,stock,known){
 const rec=recipe(spec,kind,id);
 if(!rec||!rec.concepts.every(c=>known.includes(c)))return false;
 if(!Object.entries(rec.inputs).every(([k,n])=>(stock[k]||0)>=n))return false;
 if(rec.fuel&&!pickFuel(rec,stock))return false;
 return true;
}
// Consumes the inputs and returns what was made, or null when something is missing.
function craft(spec,kind,id,stock,known){
 if(!canCraft(spec,kind,id,stock,known))return null;
 const rec=recipe(spec,kind,id),fuel=pickFuel(rec,stock);
 for(const [k,n] of Object.entries(rec.inputs))stock[k]-=n;
 if(fuel)stock[fuel]-=rec.fuel;
 if(rec.kind==='tool')return {kind:'tool',id,dur:rec.durability};
 stock[id]=(stock[id]||0)+1;
 return {kind:'material',id};
}
// Chance per resident-day that a locked concept gets discovered, given facts about the world. 0 = not possible now.
// flags: named situations (clay_near_fire...), counts: how often something was used.
function unlockChance(spec,concept,known,flags,counts){
 if(known.includes(concept.id)||concept.known_at_start||!concept.unlock)return 0;
 const u=concept.unlock;
 if(!(u.requires||[]).every(c=>known.includes(c)))return 0;
 switch(u.via){
  case 'use':return (counts[u.resource]||0)>=u.times?.5:0;
  case 'accident':return flags[u.context]?u.chance:0;
  case 'combine':return u.chance;
  case 'experiment':
   if(u.needs_two_ores_known&&!flags.two_ores)return 0;
   if(u.needs_fuel&&!flags.fuel_ok)return 0;
   if(u.needs_resource_held&&!flags['held_'+u.needs_resource_held])return 0;
   return u.chance;
  default:return 0; // habit, observe, generalize: not supported yet
 }
}
global.AetherraTech={tierIndex,toolDef,conceptDef,pickTool,recipe,pickFuel,canCraft,craft,unlockChance};
})(typeof window!=='undefined'?window:globalThis);
