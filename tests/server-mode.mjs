import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');
const launcher=readFileSync('AETHERRA.bat','utf8');
assert.match(html,/location\.protocol==='file:'/);
assert.match(html,/Cloud\.ru и проверка обновлений недоступны/);
assert.match(html,/http:\/\/127\.0\.0\.1:8765\//);
assert.match(launcher,/http:\/\/127\.0\.0\.1:8765\/health/);
console.log('Server-mode diagnostics assertions passed');
