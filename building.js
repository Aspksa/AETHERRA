/* AETHERRA inventions: structures are assembled from bricks (function, material, place). Pure functions, no world access. */
(function(global){
'use strict';
// function: what the structure does and which problem it answers
const FUNCTIONS={
 warmth:{problem:'cold',baseCost:6,names:{wood:'костёр',stone:'каменный очаг'}},
 preserve:{problem:'spoil',baseCost:8,names:{wood:'сушилка',stone:'каменный погреб'}}
};
// material: extra wood-equivalent cost and how long/strong the result is
const MATERIALS={wood:{cost:0,durability:1},stone:{cost:6,durability:1.6}};
const PLACES=['depot','homes'];
function enumerate(){
 const out=[];
 for(const fn of Object.keys(FUNCTIONS))for(const material of Object.keys(MATERIALS))for(const place of PLACES)out.push({fn,material,place});
 return out;
}
const costOf=c=>FUNCTIONS[c.fn].baseCost+MATERIALS[c.material].cost;
const nameOf=c=>FUNCTIONS[c.fn].names[c.material]+(c.place==='depot'?' у склада':' среди домов');
const sameCombo=(a,b)=>a.fn===b.fn&&a.material===b.material&&a.place===b.place;
// A problem is {name, severity 0..1, fit:{depot,homes}}. The inventor weighs every combination by how well it
// answers the problems, minus its cost, plus noise that grows with curiosity (so curious residents try odd ideas).
function score(combo,problems,noise){
 const problem=problems.find(p=>p.name===FUNCTIONS[combo.fn].problem);
 const relevance=problem?problem.severity*((problem.fit&&problem.fit[combo.place])??.5):.03;
 return relevance*MATERIALS[combo.material].durability-costOf(combo)*.01+noise;
}
// rnd: () => 0..1. Returns the best combination, or null if nothing is worth inventing.
function choose(problems,rnd,curiosity){
 if(!problems.some(p=>p.severity>=.25))return null;
 const spread=.1+curiosity*.5;
 let best=null,bestScore=-Infinity;
 for(const combo of enumerate()){
  const s=score(combo,problems,(rnd()-.5)*spread);
  if(s>bestScore){bestScore=s;best=combo}
 }
 // Occasional flash of inspiration: a random combination, more likely for curious residents.
 if(rnd()<.04+.12*curiosity){const all=enumerate();best=all[Math.floor(rnd()*all.length)]}
 return best;
}
global.AetherraBuilding={FUNCTIONS,MATERIALS,PLACES,enumerate,costOf,nameOf,sameCombo,score,choose};
})(typeof window!=='undefined'?window:globalThis);
