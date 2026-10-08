import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const html = readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
if (start < 0 || end < 0 || html.indexOf('<script>', start + 1) >= 0) throw Error('Expected one script');
const folder = mkdtempSync(join(tmpdir(), 'aetherra-'));
try {
  const file = join(folder, 'game.cjs');
  writeFileSync(file, html.slice(start + 8, end));
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  for (const marker of ['createWorld()', 'requestAnimationFrame(draw)', 'AETHERRA'])
    if (!html.includes(marker)) throw Error('Missing marker: ' + marker);
  console.log('Browser JavaScript syntax OK');
} finally { rmSync(folder, { recursive: true, force: true }); }
