import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
for(const id of ['exportWorld','importWorld','importWorldFile','previousWorld'])assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/new Blob\(\[raw\]/);
assert.match(html,/JSON\.parse\(raw\);validateSnapshot\(data\)/);
assert.match(html,/AETHERRA_PREVIOUS_WORLD/);
assert.match(html,/localStorage\.setItem\(SAVE_KEY,saved\)/);
console.log('Portable save import/export controls and backup slot present');
