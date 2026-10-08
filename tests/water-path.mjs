import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');
const paths=html.slice(html.indexOf('function passable('),html.indexOf('function chooseSite('));
const moving=html.slice(html.indexOf('function move('),html.indexOf('function updatePanel('));
assert.ok(paths.startsWith('function passable(')&&moving.startsWith('function move('));
const W=8,H=7;
const tiles=Array(W*H).fill('grass');
for(let y=0;y<H-1;y++) tiles[y*W+3]='water';
const context={W,H,tiles,trees:[],inside:(x,y)=>x>=0&&x<W&&y>=0&&y<H,idx:(x,y)=>y*W+x,Math,Int32Array,Uint8Array,Map};
vm.createContext(context);
vm.runInContext(paths+'\n'+moving,context);
const path=context.findPath(1,1,6,1);
assert.ok(path&&path.length>0,'reachable via gap');
assert.ok(path.some(p=>p.y>5),'must travel around river');
for(const point of path)assert.notEqual(tiles[Math.floor(point.y)*W+Math.floor(point.x)],'water');
const a={x:1.5,y:1.5};
for(let i=0;i<900;i++){
 context.move(a,6.5,1.5);
 assert.notEqual(tiles[Math.floor(a.y)*W+Math.floor(a.x)],'water','agent entered water');
}
assert.ok(Math.hypot(a.x-6.5,a.y-1.5)<.15,'agent reaches destination');
tiles[6*W+3]='water';
assert.equal(context.findPath(1,1,6,1),null,'river without crossing impassable');
console.log('Water pathfinding and movement tests passed');
