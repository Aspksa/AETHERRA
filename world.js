/* AETHERRA underground: turns assets/world-spec.json into biomes, deposits, signs and notice chances.
   Pure functions: no access to the simulation, so the same seed always gives the same underground. */
(function(global){
'use strict';
function mulberry32(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
// The surface map only has water/grass/sand/stone, so spec biomes are derived from it.
function deriveBiomes(tiles,W,H,trees){
 const treeAt=new Set(trees.filter(t=>t.wood>0).map(t=>t.y*W+t.x));
 const near=(x,y,r,test)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&test(ny*W+nx))return true}return false};
 const out=new Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,tile=tiles[i];
  if(tile==='water')out[i]='water';
  else if(tile==='stone')out[i]='mountains';
  else if(tile==='sand')out[i]=near(x,y,2,j=>tiles[j]==='water')?'river_bank':'steppe';
  else if(near(x,y,2,j=>tiles[j]==='stone'))out[i]='hills';
  else{let dense=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&treeAt.has(ny*W+nx))dense++}out[i]=dense>=5?'forest':'plains'}
 }
 return out;
}
const rockAt=(spec,biome,depth)=>{const col=spec.geology.column_by_biome[biome];return col?col[depth]:null};
const sampleInt=(rnd,lo,hi)=>lo+Math.floor(rnd()*(hi-lo+1));
// Deposits: [{res,x,y,depth,amount}]; signs: [{sign,x,y,real}]. Resources that need overlays (ley lines, craters) are not generated here.
// `reachable` (optional) limits deposits to land the settlement can walk to. Resources the early game cannot do without
// (clay, copper, tin, flint, salt) are retried with a higher rarity when a world would otherwise have none of them.
const ESSENTIAL=['flint','clay','salt','copper','tin'];
function generate(spec,tiles,trees,W,H,seed,reachable){
 const rnd=mulberry32((seed>>>0)^0x9E3779B9);
 const biomes=deriveBiomes(tiles,W,H,trees);
 const deposits=[],taken=new Set();
 const nearWater=(x,y)=>N4.some(([dx,dy])=>{const nx=x+dx,ny=y+dy;return nx>=0&&ny>=0&&nx<W&&ny<H&&tiles[ny*W+nx]==='water'});
 for(const r of spec.resources){
  if(r.host.near_overlay)continue;
  const hostBiomes=r.host.biomes||[],rocks=r.host.rocks||null;
  // Only depths some extraction method can reach (the spec lists clay down to layer 2 but digging stops at 1).
  const maxReach=Math.max(...r.methods.map(m=>{const e=spec.extraction_methods.find(x=>x.id===m);return e?e.depth[1]:-1}));
  const okDepths=(x,y)=>{const out=[];for(let d=r.depth[0];d<=Math.min(r.depth[1],maxReach);d++){const rock=rockAt(spec,biomes[y*W+x],d);if(!rocks||rocks.includes(rock))out.push(d)}return out};
  const eligible=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return false;if(reachable&&reachable[y*W+x]!==1)return false;const b=biomes[y*W+x];return b!=='water'&&(hostBiomes.includes('*')||hostBiomes.includes(b))&&okDepths(x,y).length>0};
  const cells=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(eligible(x,y))cells.push([x,y]);
  let made=0;const cap=60;
  const put=(x,y,d)=>{const k=r.id+':'+x+':'+y+':'+d;if(taken.has(k)||made>=cap)return false;taken.add(k);deposits.push({res:r.id,x,y,depth:d,amount:sampleInt(rnd,r.amount[0],r.amount[1])});made++;return true};
  const pickDepth=(x,y)=>{const ds=okDepths(x,y);return ds[Math.floor(rnd()*ds.length)]};
  const place=(shape,rarity,depthRange)=>{
   const rngDepth=(x,y)=>{const ds=okDepths(x,y).filter(d=>!depthRange||(d>=depthRange[0]&&d<=depthRange[1]));return ds.length?ds[Math.floor(rnd()*ds.length)]:null};
   for(const [x,y] of cells){
    if(shape==='surface'){if(rnd()<rarity){const ds=okDepths(x,y).filter(d=>!depthRange||(d>=depthRange[0]&&d<=depthRange[1]));if(ds.length)put(x,y,ds[0])}} // surface = shallowest layer
    else if(shape==='pocket'){if(rnd()<rarity/2.5){let cx=x,cy=y;const size=sampleInt(rnd,1,4);for(let k=0;k<size;k++){const d=rngDepth(cx,cy);if(d!==null)put(cx,cy,d);const [dx,dy]=N4[Math.floor(rnd()*4)];if(eligible(cx+dx,cy+dy)){cx+=dx;cy+=dy}}}}
    else if(shape==='vein'){if(rnd()<rarity/8){let cx=x,cy=y,d=rngDepth(x,y);if(d===null)continue;const len=sampleInt(rnd,4,12);for(let k=0;k<len;k++){if(!okDepths(cx,cy).includes(d)){const fix=rngDepth(cx,cy);if(fix===null)break;d=fix}put(cx,cy,d);const [dx,dy]=N4[Math.floor(rnd()*4)];if(eligible(cx+dx,cy+dy)){cx+=dx;cy+=dy}const nd=Math.max(r.depth[0],Math.min(r.depth[1],d+sampleInt(rnd,-1,1)));if(okDepths(cx,cy).includes(nd))d=nd}}}
    else if(shape==='layer'){if(rnd()<rarity/25){const d=rngDepth(x,y);if(d===null)continue;const want=sampleInt(rnd,10,40),seen=new Set([y*W+x]),queue=[[x,y]];let got=0;while(queue.length&&got<want){const [qx,qy]=queue.shift();if(okDepths(qx,qy).includes(d)){put(qx,qy,d);got++}for(const [dx,dy] of N4){const nx=qx+dx,ny=qy+dy;if(eligible(nx,ny)&&!seen.has(ny*W+nx)){seen.add(ny*W+nx);queue.push([nx,ny])}}}}}
    else if(shape==='placer'){if(nearWater(x,y)&&rnd()<rarity*6){const d=rngDepth(x,y);if(d!==null)put(x,y,d)}}
   }
  };
  const boost=ESSENTIAL.includes(r.id)?[1,3,9,27]:[1];
  for(const mult of boost){
   if(made>0)break;
   place(r.shape,Math.min(1,r.rarity*mult));
   if(r.source_shape)place(r.source_shape.shape,Math.min(1,r.source_shape.rarity*mult),r.source_shape.depth);
  }
 }
 // Signs: real ones appear near deposits with the spec reliability; false ones appear anywhere on land.
 const signs=[],seenSign=new Set();
 const addSign=(sign,x,y,real)=>{if(x<0||y<0||x>=W||y>=H||tiles[y*W+x]==='water')return;const k=sign+':'+x+':'+y;if(seenSign.has(k))return;seenSign.add(k);signs.push({sign,x,y,real})};
 const realCount={};
 for(const r of spec.resources)for(const sg of r.signs){
  for(const d of deposits)if(d.res===r.id&&rnd()<sg.reliability*.7){
   const x=d.x+sampleInt(rnd,-sg.radius,sg.radius),y=d.y+sampleInt(rnd,-sg.radius,sg.radius);
   const before=signs.length;addSign(sg.sign,x,y,true);if(signs.length>before)realCount[sg.sign]=(realCount[sg.sign]||0)+1;
  }
 }
 for(const sg of spec.signs){
  const n=Math.round((realCount[sg.id]||0)*sg.false_rate);
  for(let i=0;i<n;i++)addSign(sg.id,sampleInt(rnd,0,W-1),sampleInt(rnd,0,H-1),false);
 }
 return {deposits,signs,biomes};
}
const SIGN_VISIBLE={always:()=>true,day:night=>!night,night:night=>night};
function signVisible(spec,signId,night){const sg=spec.signs.find(s=>s.id===signId);if(!sg)return false;const f=SIGN_VISIBLE[sg.visibility];return f?f(night):false}
// Chance that a resident notices a sign during `days` days (formula from the spec's knowledge_model).
function noticeChance(spec,resource,signId,perception,curiosity,days){
 const sg=spec.signs.find(s=>s.id===signId);if(!sg||!resource.discovery)return 0;
 const p=resource.discovery.base_notice*(.5+(perception[resource.category]??.3))*(.5+curiosity)*(1-sg.notice_difficulty)*days;
 return Math.max(0,Math.min(1,p));
}
// Resources a sign can point to (a false sign points to a random one of these).
function resourcesForSign(spec,signId){return spec.resources.filter(r=>r.signs.some(s=>s.sign===signId))}
global.AetherraWorld={generate,deriveBiomes,rockAt,signVisible,noticeChance,resourcesForSign,mulberry32};
})(typeof window!=='undefined'?window:globalThis);
