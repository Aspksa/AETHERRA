/* AETHERRA map renderer v1: standalone Canvas 2D, no simulation mutations. */
(function(global){
'use strict';
const palette={
 grass:['#6b9252','#729d58','#7ba563'],sand:['#c0b37c','#d2bf89','#b8a975'],
 stone:['#858f85','#9ca89c','#747d78'],water:['#387e92','#428da0','#33788b']
};
function hash(x,y,seed){let n=Math.imul(x+11,374761393)+Math.imul(y+17,668265263)+Math.imul(seed|0,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function drawBerry(ctx,b){
 const S=52,px=(b.x+.5)*S,py=(b.y+.65)*S;
 ellipse(ctx,px,py+9,15,5,'#172e243f');
 for(const [dx,dy,r] of [[-9,0,11],[8,-4,12],[0,-10,12]])ellipse(ctx,px+dx,py+dy,r,r*.75,'#365f36');
 ctx.fillStyle='#b94358';for(let i=0;i<Math.min(5,b.food);i++){ctx.beginPath();ctx.arc(px-12+i*6,py-7+(i%2)*5,2.5,0,Math.PI*2);ctx.fill()}
}
function drawTree(ctx,t,seed){
 const S=52,px=(t.x+.5)*S,py=(t.y+.6)*S,v=hash(t.x,t.y,seed);
 ellipse(ctx,px+6,py+14,23,8,'#142a2059');
 ctx.fillStyle='#5b4230';ctx.fillRect(px-4,py-8,8,25);
 ellipse(ctx,px+9,py-17,18,18,'#244d37');
 ellipse(ctx,px-10,py-19,17,19,v>.5?'#326a46':'#27613e');
 ellipse(ctx,px,py-31,19,21,v>.5?'#438657':'#387c4a');
 ellipse(ctx,px-7,py-37,9,6,'#8dbd7799');
}
function drawHome(ctx,h,day){
 const S=52,px=h.x*S,py=h.y*S;
 ellipse(ctx,px+S*.55,py+S*.88,28,10,'#1a29205c');
 ctx.fillStyle='#d1aa70';ctx.fillRect(px+7,py+14,40,32);
 ctx.fillStyle='#684638';ctx.beginPath();ctx.moveTo(px+2,py+17);ctx.lineTo(px+26,py-5);ctx.lineTo(px+53,py+17);ctx.closePath();ctx.fill();
 ctx.fillStyle='#a56846';ctx.beginPath();ctx.moveTo(px+9,py+15);ctx.lineTo(px+26,py+1);ctx.lineTo(px+45,py+15);ctx.closePath();ctx.fill();
 ctx.fillStyle='#715037';ctx.fillRect(px+27,py+30,10,16);
 ctx.fillStyle='#f3d69a';ctx.fillRect(px+13,py+26,9,10);
}
// The depot is the centre of village life: drawn larger, with a banner and a warm ground ring so it never gets lost among houses.
function drawDepot(ctx,depot){
 const S=52,cx=(depot.x+.5)*S,cy=(depot.y+.5)*S;
 ctx.save();ctx.translate(cx,cy+22);ctx.scale(1.45,1.45);ctx.translate(-cx,-(cy+22));
 ctx.fillStyle='#e8d29a55';ctx.beginPath();ctx.ellipse(cx,cy+20,38,15,0,0,Math.PI*2);ctx.fill();
 ellipse(ctx,cx,cy+17,26,9,'#152b2066');
 ctx.fillStyle='#725539';ctx.fillRect(cx-17,cy-4,34,27);
 ctx.fillStyle='#d4bb85';ctx.fillRect(cx-19,cy-13,38,12);
 ctx.fillStyle='#503728';ctx.fillRect(cx-6,cy+6,12,17);
 ctx.fillStyle='#4b3a2a';ctx.fillRect(cx+15,cy-30,2,20);
 ctx.fillStyle='#e0a83c';ctx.beginPath();ctx.moveTo(cx+17,cy-30);ctx.lineTo(cx+31,cy-25);ctx.lineTo(cx+17,cy-20);ctx.closePath();ctx.fill();
 ctx.restore();
}
function stateIcon(a){
 const st=a.state||'';
 if(/древесин/.test(st))return '🌲';
 if(/ягод|пищей/.test(st))return '🍓';
 if(st==='Ест')return '🍞';
 if(/^Спит|^Отдых/.test(st))return 'Zzz';
 return '';
}
// Children are drawn smaller than adults; a small icon shows what the villager is doing.
function drawAgent(ctx,a){
 const S=52,px=a.x*S,py=a.y*S,k=a.age<16?.72:1;
 ctx.save();ctx.translate(px,py+7);ctx.scale(k,k);ctx.translate(-px,-(py+7));
 ellipse(ctx,px,py+7,8,3.7,'#142a2655');
 ellipse(ctx,px,py-3,6.5,8,['#e6c47c','#d99d8b','#95bed3','#bca6d2'][a.id%4]);
 ellipse(ctx,px,py-13,5,5,'#e6c59f');
 ellipse(ctx,px,py-16,5.5,2.7,['#4d3b32','#775b40','#332d36','#b49d63'][a.id%4]);
 ctx.restore();
 const top=py+7-(24*k);
 if(a.hunger>75){ellipse(ctx,px+9,top-4,7,6,'#d9b87f');ctx.fillStyle='#613a30';ctx.font='bold 9px sans-serif';ctx.fillText('!',px+7,top-1)}
 else{
  const icon=stateIcon(a);
  if(icon){
   ctx.font=icon==='Zzz'?'bold 11px sans-serif':'13px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
   ctx.textAlign='center';
   if(icon==='Zzz'){ctx.fillStyle='#e8f0ff';ctx.fillText(icon,px+6,top-2)}else ctx.fillText(icon,px,top)
   ctx.textAlign='start';
  }
 }
}
// Structures invented by residents: fire pits (warmth) and drying racks / cellars (preservation).
function drawStructure(ctx,st,day){
 const S=52,cx=(st.x+.5)*S,cy=(st.y+.6)*S,stone=st.material==='stone';
 ellipse(ctx,cx,cy+8,20,7,'#142a2059');
 if(st.fn==='warmth'){
  ellipse(ctx,cx,cy+2,15,8,stone?'#7d867d':'#5b4230');
  ellipse(ctx,cx,cy,11,5,'#2a2420');
  const f=Math.sin(day*40+st.x*3)*1.5;
  ellipse(ctx,cx,cy-5,6,9+f,'#e0742a');ellipse(ctx,cx,cy-4,3.5,6+f,'#f4c23d');
 }else if(stone){
  ellipse(ctx,cx,cy-2,22,15,'#8a928a');ellipse(ctx,cx,cy-5,18,11,'#a2aaa0');
  ctx.fillStyle='#3a3029';ctx.fillRect(cx-5,cy-4,10,12);
 }else{
  ctx.fillStyle='#5b4230';ctx.fillRect(cx-17,cy-18,4,26);ctx.fillRect(cx+13,cy-18,4,26);ctx.fillRect(cx-19,cy-18,38,3);
  ctx.fillStyle='#b94358';for(let i=0;i<5;i++)ctx.fillRect(cx-14+i*7,cy-14+(i%2)*3,3,6);
 }
}
// Natural signs hinting at what lies underground; colours follow what the sign is made of.
const SIGN_COLORS={green_stain:'#4fae8b',rusty_stream:'#c0603a',red_soil:'#b5523b',black_crumbs:'#2b2b2b',white_crust:'#f1efe6',glitter_sand:'#f3d36a',
 heavy_dark_pebbles:'#3a3a40',black_glass:'#15151c',rotten_egg_smell:'#d8d36a',springy_ground:'#6a5a3a',knapped_shards:'#d8d2c0',sticky_mud:'#7a6a55',
 night_glow:'#8ff0d0',humming_stones:'#a9b4c8',silver_frost:'#dfeaf5',crater_glass:'#6b4f7a',warm_ground:'#e0905a',whispering_reeds:'#9ccf8a',birds_avoid:'#b9b1a0'};
function drawSign(ctx,sg,seed){
 const S=52,h=hash(sg.x,sg.y,seed+9),px=(sg.x+.5)*S,py=(sg.y+.5)*S;
 ctx.fillStyle=SIGN_COLORS[sg.sign]||'#d0d0d0';
 for(let i=0;i<3;i++)ellipse(ctx,px+(i-1)*7+h*4,py+((i*5+h*7)%9)-4,3.4,2.2,ctx.fillStyle);
 if(sg.sign==='night_glow'||sg.sign==='warm_ground')ellipse(ctx,px,py,12,8,'#ffe9a033');
}
// A place the settlement has confirmed holds something worth digging: a small golden marker.
function drawSpot(ctx,sp){
 const S=52,px=(sp.x+.5)*S,py=(sp.y+.5)*S;
 ctx.fillStyle='#ffe08a';ctx.beginPath();ctx.moveTo(px,py-9);ctx.lineTo(px+6,py);ctx.lineTo(px,py+9);ctx.lineTo(px-6,py);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#7a5a1a';ctx.lineWidth=1.5;ctx.stroke();
}
function render(ctx,w){
 const {signs=[],spots=[],structures=[],trail,tiles,trees,berries,homes,agents,selected,seed,day,depot,W,H,S,scale,ox,oy}=w;
 const width=w.canvas.clientWidth,height=w.canvas.clientHeight;
 ctx.clearRect(0,0,width,height);
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 const left=Math.max(0,Math.floor((-ox/scale)/S)-2),top=Math.max(0,Math.floor((-oy/scale)/S)-2);
 const right=Math.min(W,Math.ceil((width-ox)/scale/S)+2),bottom=Math.min(H,Math.ceil((height-oy)/scale/S)+2);
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const tile=tiles[y*W+x],h=hash(x,y,seed),px=x*S,py=y*S;
  const variants=palette[tile]||palette.grass;
  ctx.fillStyle=variants[Math.min(variants.length-1,Math.floor(h*variants.length))];
  ctx.fillRect(px,py,S+.7,S+.7);
  // Soft irregular patches stay inside cells and never change passability.
  if(tile==='grass'){
   ellipse(ctx,px+S*(.25+h*.45),py+S*(.25+h*.35),S*.25,S*.18,'#78a76155');
   if(h>.47){ctx.strokeStyle='#3d6e42';ctx.lineWidth=1.4;for(let n=0;n<3;n++){const a=px+10+n*8+h*13,b=py+S*.65+(n%2)*4;ctx.beginPath();ctx.moveTo(a,b+4);ctx.lineTo(a-2,b-2);ctx.moveTo(a,b+4);ctx.lineTo(a+3,b);ctx.stroke()}}
  }else if(tile==='stone'){
   ellipse(ctx,px+S*.44,py+S*.50,17+h*9,11,'#535e5888');
   ellipse(ctx,px+S*.41,py+S*.43,14+h*8,8,'#abb5a8');
  }else if(tile==='sand'){
   ctx.fillStyle='#ead6a055';for(let n=0;n<4;n++)ctx.fillRect(px+6+n*10,py+10+((n*7+x)%23),4,2);
  }else{
   const shore=[[0,-1],[1,0],[0,1],[-1,0]];
   for(const [dx,dy] of shore){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H||tiles[ny*W+nx]!=='water'){
    ctx.fillStyle='#a7d0c077';
    if(dx===1)ctx.fillRect(px+S-5,py,5,S);
    if(dx===-1)ctx.fillRect(px,py,5,S);
    if(dy===1)ctx.fillRect(px,py+S-5,S,5);
    if(dy===-1)ctx.fillRect(px,py,S,5);
   }}
   const wave=(day*.12+h*7)%1;
   ctx.strokeStyle='#c6eddf88';ctx.lineWidth=1.6;ctx.beginPath();
   ctx.moveTo(px+6+wave*11,py+14+h*10);ctx.lineTo(px+21+wave*11,py+14+h*10);ctx.stroke();
  }
 }
 // Trails: worn ground between places residents visit often; stronger wear reads as a road.
 if(trail){
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const wear=trail[y*W+x]||0;
   if(wear<50||tiles[y*W+x]==='water')continue;
   const px=x*S,py=y*S,h=hash(x,y,seed+5),t=Math.min(1,(wear-50)/150);
   ctx.fillStyle='rgba(158,124,80,'+(.16+t*.5).toFixed(2)+')';
   ctx.beginPath();ctx.ellipse(px+S*.5,py+S*.5,S*(.46+t*.1),S*(.4+t*.1),0,0,Math.PI*2);ctx.fill();
   if(wear>120){ctx.fillStyle='rgba(120,92,58,'+(.2+t*.3).toFixed(2)+')';ctx.fillRect(px+S*.18+h*S*.2,py+S*.3+h*S*.3,5,3)}
  }
 }
 for(const sg of signs)if(sg.x>=left&&sg.x<right&&sg.y>=top&&sg.y<bottom)drawSign(ctx,sg,seed);
 for(const sp of spots)if(sp.x>=left&&sp.x<right&&sp.y>=top&&sp.y<bottom)drawSpot(ctx,sp);
 // Everything standing on the map is drawn in one pass sorted by depth (y), so nearer objects overlap farther ones.
 const items=[];
 for(const b of berries){if(b.food>0&&b.x>=left&&b.x<right&&b.y>=top&&b.y<bottom)items.push({y:b.y+.65,draw:()=>drawBerry(ctx,b)})}
 for(const t of trees){if(t.wood>0&&t.x>=left&&t.x<right&&t.y>=top&&t.y<bottom)items.push({y:t.y+.6,draw:()=>drawTree(ctx,t,seed)})}
 for(const h of homes)items.push({y:h.y+.9,draw:()=>drawHome(ctx,h,day)});
 items.push({y:depot.y+.7,draw:()=>drawDepot(ctx,depot)});
 for(const st of structures)items.push({y:st.y+.7,draw:()=>drawStructure(ctx,st,day)});
 for(const a of agents){
  if(a.health<=0)continue;
  const px=a.x*S,py=a.y*S;
  if(px<left*S-20||px>right*S+20||py<top*S-20||py>bottom*S+20)continue;
  items.push({y:a.y+.1,draw:()=>drawAgent(ctx,a)});
 }
 items.sort((p,q)=>p.y-q.y);
 for(const it of items)it.draw();
 if(selected){const a=selected.type==='agent'?agents.find(x=>x.id===selected.id&&x.health>0):homes.find(x=>x.id===selected.id);if(a){ctx.strokeStyle='#ffe4a0';ctx.lineWidth=2.5;if(selected.type==='home')ctx.strokeRect(a.x*S+2,a.y*S-8,52,59);else ctx.strokeRect(a.x*S-12,a.y*S-25,24,39)}}
 ctx.restore();
 // Night: a cool tint over the whole map, then warm light from windows and the depot lantern.
 const dark=1-(w.daylight===undefined?1:w.daylight);
 if(dark>.02){
  ctx.fillStyle='rgba(10,16,48,'+(dark*.5).toFixed(3)+')';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
  const glow=(x,y,r,alpha)=>{
   if(typeof ctx.createRadialGradient!=='function')return;
   const g=ctx.createRadialGradient(x,y,2,x,y,r);
   if(!g||typeof g.addColorStop!=='function')return;
   g.addColorStop(0,'rgba(255,205,120,'+alpha.toFixed(3)+')');g.addColorStop(1,'rgba(255,205,120,0)');
   ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  };
  for(const h of homes){
   if(h.x<left-1||h.x>right||h.y<top-1||h.y>bottom)continue;
   const px=h.x*S,py=h.y*S;
   glow(px+17.5,py+31,44,dark*.55);
   ctx.fillStyle='rgba(255,226,150,'+Math.min(1,dark*1.6).toFixed(2)+')';ctx.fillRect(px+13,py+26,9,10);
  }
  glow((depot.x+.5)*S+22,(depot.y+.5)*S-28,70,dark*.6);
  for(const st of structures)if(st.fn==='warmth')glow((st.x+.5)*S,(st.y+.5)*S-4,90,dark*.8);
  ctx.restore();
 }
}
global.AetherraRenderer={render,hash};
})(typeof window!=='undefined'?window:globalThis);
