/*
 * data.js - enemy families, upgrade cards, and power-up definitions.
 * Behaviour for each is implemented in game.js; here we just describe them.
 */

// Four gelatinous blob families. size is a radius factor of R.
// b = behaviour tag: 0 drift, 1 split-on-death, 2 slingshot dash, 3 tank.
let FAMILIES = [
  { n: 'GOO',      c: '#4dff87', c2: '#0b7a3a', hp: 2, spd: 0.55, size: 0.028, wob: 0.30, b: 0, eyes: 2 },
  { n: 'SPLITTER', c: '#c86bff', c2: '#5a1e8f', hp: 3, spd: 0.50, size: 0.032, wob: 0.42, b: 1, eyes: 3 },
  { n: 'SLINGER',  c: '#ff5b8a', c2: '#8f1440', hp: 2, spd: 0.62, size: 0.026, wob: 0.55, b: 2, eyes: 1 },
  { n: 'TANK',     c: '#54b0ff', c2: '#153e8f', hp: 8, spd: 0.34, size: 0.05,  wob: 0.22, b: 3, eyes: 4 },
];

// Upgrade cards offered after every 2nd wave. k = effect key handled in game.js.
let UPGRADES = [
  { k: 'fire',  n: 'RAPID HORN',    d: 'Fire 22% faster' },
  { k: 'dmg',   n: 'SHARP TIP',     d: '+1 bullet damage' },
  { k: 'multi', n: 'TWIN SHOT',     d: 'Fire an extra bullet' },
  { k: 'speed', n: 'SWIFT ORBIT',   d: 'Orbit 18% faster' },
  { k: 'armor', n: 'RAINBOW ARMOR', d: '+25 max HP & mend' },
  { k: 'big',   n: 'PLASMA ROUNDS', d: 'Bigger, stronger shots' },
  { k: 'pierce',n: 'PIERCE BEAM',   d: 'Shots pierce blobs' },
];

// Power-ups dropped by slain blobs. dur 0 = instant. k handled in game.js.
let POWERS = [
  { k: 'spread', n: 'SPREAD',     c: '#ffd21e', dur: 8 },
  { k: 'twin',   n: 'TWIN HORN',  c: '#7cf3ff', dur: 9 },
  { k: 'slow',   n: 'SLOW-MO',    c: '#a24bff', dur: 5 },
  { k: 'patch',  n: 'RAINBOW MEND', c: '#4dff87', dur: 0 },
  { k: 'nova',   n: 'NOVA',       c: '#ff5b8a', dur: 0 },
];
