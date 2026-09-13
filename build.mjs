#!/usr/bin/env node
/*
 * Build script for Rainbow Guardian.
 *
 * The game is a self-contained Canvas2D + WebAudio project with no runtime
 * libraries or assets. This script concatenates the game sources, compiles them
 * with Closure (ADVANCED) -> UglifyJS -> Roadroller, inlines everything into a
 * single HTML file, and zips it with ect.
 *
 * The shipped ZIP must stay at or under 13,000 bytes.
 *
 * Usage: node build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ectLocation from 'ect-bin';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const LIMIT = 13000;
const TITLE = 'Rainbow Guardian';

// Concatenation order matches the <script> tags in index.html.
const GAME = [
  'src/draw.js',
  'src/audio.js',
  'src/data.js',
  'src/scenes.js',
  'src/game.js',
];

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Concatenate game sources
console.log('Bundling...');
let buffer = GAME
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n')
  .join('');

const js = path.join(DIST, 'index.js');
fs.writeFileSync(js, buffer);
const rawSize = buffer.length;

// 2. Closure Compiler (ADVANCED)
console.log('Running closure compiler...');
const tmp = js + '.tmp';
fs.copyFileSync(js, tmp);
try {
  execFileSync('npx', ['--yes', 'google-closure-compiler',
    `--js=${tmp}`, `--js_output_file=${js}`,
    '--compilation_level=ADVANCED', '--warning_level=QUIET',
    '--jscomp_off=*', '--assume_function_wrapper', '--language_out=ECMASCRIPT_2017',
  ], { stdio: 'inherit', cwd: ROOT });
} catch (e) { fail('Closure Compiler step failed!'); }
fs.rmSync(tmp);
const closureSize = fs.statSync(js).size;

// 3. UglifyJS
console.log('Running uglify...');
try {
  execFileSync('npx', ['--yes', 'uglifyjs', js, '-c', '-m', '--toplevel', '-o', js],
    { stdio: 'inherit', cwd: ROOT });
} catch (e) { fail('Uglify step failed!'); }
const uglifySize = fs.statSync(js).size;

// 4. Roadroller
console.log('Running roadroller...');
try {
  execFileSync('npx', ['--yes', 'roadroller', js, '-o', js], { stdio: 'ignore', cwd: ROOT });
} catch (e) { fail('Roadroller step failed!'); }
const rrSize = fs.statSync(js).size;

// 5. Inline into a single HTML file
console.log('Building html...');
fs.writeFileSync(path.join(DIST, 'index.html'),
  '<!DOCTYPE html><html lang=en><head><meta charset=UTF-8>' +
  '<meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no">' +
  `<title>${TITLE}</title><style>*{margin:0;padding:0}` +
  'html,body{width:100%;height:100%;background:#05060f;overflow:hidden}' +
  'canvas{display:block;touch-action:none}' +
  '</style></head><body><script>' +
  fs.readFileSync(js) +
  '</script></body></html>');
fs.rmSync(js);

// 6. Zip with ect
console.log('Zipping...');
const zip = path.join(ROOT, 'rainbow-guardian.zip');
fs.rmSync(zip, { force: true });
const result = spawnSync(ectLocation, ['-9', '-strip', '-zip', zip, 'index.html'],
  { cwd: DIST, stdio: 'ignore' });
if (result.error || result.status) fail('Zip step failed!');

const size = fs.statSync(zip).size;
console.log('');
console.log(`  bundled    ${rawSize}`);
console.log(`  closure    ${closureSize}`);
console.log(`  uglify     ${uglifySize}`);
console.log(`  roadroller ${rrSize}`);
console.log('');
console.log(`rainbow-guardian.zip: ${size} / ${LIMIT} bytes (${(100 * size / LIMIT).toFixed(1)}%)`);
if (size > LIMIT) {
  console.error(`OVER BUDGET by ${size - LIMIT} bytes`);
  process.exit(1);
}
console.log(`Under budget by ${LIMIT - size} bytes.`);
