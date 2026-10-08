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
function render(ctx,w){
 const {tiles,trees,berries,homes,agents,selected,seed,day,depot,W,H,S,scale,ox,oy}=w;
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
 // Everything standing on the map is drawn in one pass sorted by depth (y), so nearer objects overlap farther ones.
 const items=[];
 for(const b of berries){if(b.food>0&&b.x>=left&&b.x<right&&b.y>=top&&b.y<bottom)items.push({y:b.y+.65,draw:()=>drawBerry(ctx,b)})}
 for(const t of trees){if(t.wood>0&&t.x>=left&&t.x<right&&t.y>=top&&t.y<bottom)items.push({y:t.y+.6,draw:()=>drawTree(ctx,t,seed)})}
 for(const h of homes)items.push({y:h.y+.9,draw:()=>drawHome(ctx,h,day)});
 items.push({y:depot.y+.7,draw:()=>drawDepot(ctx,depot)});
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
}
global.AetherraRenderer={render,hash};
})(typeof window!=='undefined'?window:globalThis);
