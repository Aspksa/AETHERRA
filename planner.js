/* AETHERRA planner: tiny goal-oriented action planner (GOAP). Pure functions, no world access. */
(function(global){
'use strict';
// An action has preconditions (pre) and effects (eff) over a flat map of boolean facts.
const ACTIONS=[
 {name:'chop',pre:{woodInHand:false},eff:{woodInHand:true}},
 {name:'deliver',pre:{woodInHand:true},eff:{woodInHand:false,woodStocked:true}},
 {name:'buildHome',pre:{woodStocked:true},eff:{woodStocked:false,hasHome:true}}
];
const key=s=>Object.keys(s).sort().map(k=>k+'='+s[k]).join('|');
const holds=(state,cond)=>Object.keys(cond).every(k=>state[k]===cond[k]);
// Breadth-first search: returns the shortest list of action names that turns `state` into one satisfying `goal`,
// [] when the goal already holds, or null when no plan of at most `maxDepth` steps exists.
function plan(state,goal,actions=ACTIONS,maxDepth=6){
 if(holds(state,goal))return [];
 const seen=new Set([key(state)]);
 let frontier=[{state,steps:[]}];
 for(let depth=0;depth<maxDepth;depth++){
  const next=[];
  for(const node of frontier)for(const action of actions){
   if(!holds(node.state,action.pre))continue;
   const after={...node.state,...action.eff},k=key(after);
   if(seen.has(k))continue;
   seen.add(k);
   const steps=[...node.steps,action.name];
   if(holds(after,goal))return steps;
   next.push({state:after,steps});
  }
  frontier=next;
 }
 return null;
}
global.AetherraPlanner={plan,ACTIONS,holds};
})(typeof window!=='undefined'?window:globalThis);
