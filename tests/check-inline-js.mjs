import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];
if (scripts.length !== 1) throw Error('Expected exactly one inline script');
const folder = mkdtempSync(join(tmpdir(), 'aetherra-'));
try {
  const file = join(folder, 'game.cjs');
  writeFileSync(file, scripts[0][1]);
  execFileSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  for (const value of ['createWorld()', 'requestAnimationFrame(draw)', 'AETHERRA']) {
    if (!html.includes(value)) throw Error('Missing marker: ' + value);
  }
  console.log('Browser JS syntax and entry points OK');
} finally {
  rmSync(folder, { recursive: true, force: true });
}
