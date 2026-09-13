/*
 * game.js - gameplay: main loop, spawning, combat, collisions, HUD, progression.
 * Runs last; owns the update/render loop and calls into draw/audio/scenes.
 */

// ---- mutable game state ----
let enemies, bullets, particles, pickups, floaters;
let player;             // orbiting horn
let halves;             // [rightHP, leftHP]
let maxHp;
let wave, spawnQueue, spawnTimer;
let score, best, combo, mult;
let powers2;             // reserved
let pSpread, pTwin, pSlow;
let shake, hitstop, flashT;
let now = 0, last = 0;
let choices, sel;       // upgrade cards + selection
let started;            // has the run begun (audio/first input)

best = +localStorage.getItem('rg_best') || 0;

function resetGame() {
  enemies = []; bullets = []; particles = []; pickups = []; floaters = [];
  halves = [100, 100];
  maxHp = 100;
  score = 0; combo = 0; mult = 1;
  pSpread = 0; pTwin = 0; pSlow = 0;
  shake = 0; hitstop = 0; flashT = 0;
  lastHalves = [100, 100];
  player = { ang: -1.5708, dir: 1, spd: 5.1, radius: 0.07, fireCd: 0, fireInt: 0.26 / 3,
             bdmg: 1, bsize: 4.5, bspeed: 1.05, multi: 1, pierce: 0 };
  wave = 0;
  nextWave(true);
}

function hornRadius() { return R * player.radius; }

// Transform all live geometry when the arena is resized/reoriented mid-run.
// Positions map relative to the old centre, then scale by the radius ratio;
// velocities and sizes scale too so motion and hitboxes stay proportional.
function remapWorld(ox, oy, oR, nx, ny, nR) {
  if (!oR) return;
  let s = nR / oR;
  let move = function (o) { o.x = nx + (o.x - ox) * s; o.y = ny + (o.y - oy) * s; };
  if (enemies) for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i]; move(e); e.r *= s; e.spd *= s; e.vx *= s; e.vy *= s;
  }
  if (bullets) for (let i = 0; i < bullets.length; i++) {
    let b = bullets[i]; move(b); b.r *= s; b.vx *= s; b.vy *= s;
  }
  if (pickups) for (let i = 0; i < pickups.length; i++) move(pickups[i]);
  if (particles) for (let i = 0; i < particles.length; i++) {
    let p = particles[i]; move(p); p.r *= s; p.vx *= s; p.vy *= s;
  }
  if (floaters) for (let i = 0; i < floaters.length; i++) move(floaters[i]);
}

// ---- waves ----
function nextWave(clean) {
  wave++;
  if (wave > 1 && clean) { addFloat('WAVE CLEAR +' + (50 * wave), CX, CY - R * 0.14, '#8fffb0'); score += 50 * wave; }
  spawnQueue = buildWave(wave);
  spawnTimer = 0.4;
}

function buildWave(w) {
  let q = [];
  let count = 3 + Math.floor(w * 1.6);
  let maxType = Math.min(3, Math.floor((w - 1) / 2)); // unlock families over time
  let sidePairs = w % 2 === 0;
  for (let i = 0; i < count; i++) {
    let ty = Math.random() < 0.15 + w * 0.02 ? 1 + Math.floor(Math.random() * maxType) : 0;
    if (ty > maxType) ty = 0;
    if (w >= 3 && Math.random() < 0.12) ty = 3;         // occasional tank
    let ang = Math.random() * 6.2832;
    q.push({ ty: ty, ang: ang, delay: 0.55 + i * (sidePairs ? 0.5 : 0.7) });
    if (sidePairs && i + 1 < count) {                    // mirrored pair
      q.push({ ty: ty, ang: ang + Math.PI, delay: 0.55 + i * 0.5 });
      i++;
    }
  }
  return q;
}

function spawnEnemy(ty, ang, mini) {
  let f = FAMILIES[ty];
  let rad = R * 0.62;
  let size = R * f.size * (mini ? 0.55 : 1);
  enemies.push({
    x: CX + Math.cos(ang) * rad, y: CY + Math.sin(ang) * rad,
    ty: ty, hp: mini ? 1 : f.hp, mhp: mini ? 1 : f.hp, r: size,
    spd: R * f.spd * 0.15 * (mini ? 1.25 : 1),
    seed: Math.random() * 9, t: 0, state: 0, timer: 0,
    hit: 0, sway: (Math.random() - 0.5) * 1.4, mini: !!mini,
    vx: 0, vy: 0,
  });
}

// ---- firing ----
function fireFrom(hx, hy, ang) {
  let shots = player.multi + (pSpread > 0 ? 1 : 0);
  let spread = shots > 1 ? 0.18 : 0;
  for (let s = 0; s < shots; s++) {
    let a = ang + (s - (shots - 1) / 2) * spread;
    let sp = R * player.bspeed;
    bullets.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: player.bsize, dmg: player.bdmg, pierce: player.pierce, life: 1.4 });
  }
  sfx(0);
}

function fireVolley() {
  let bx = CX + Math.cos(player.ang) * hornRadius();
  let by = CY + Math.sin(player.ang) * hornRadius();
  let hx = hornTipX(bx, player.ang), hy = hornTipY(by, player.ang);
  fireFrom(hx, hy, player.ang);
  if (pTwin > 0) {
    let a2 = player.ang + Math.PI;
    let bx2 = CX + Math.cos(a2) * hornRadius();
    let by2 = CY + Math.sin(a2) * hornRadius();
    let hx2 = hornTipX(bx2, a2), hy2 = hornTipY(by2, a2);
    fireFrom(hx2, hy2, a2);
  }
}

function tryFire(dt) {
  let interval = player.fireInt * (pSpread > 0 ? 0.6 : 1);
  player.fireCd -= dt;
  if (player.fireCd > 0) return;
  // Emit a volley for each elapsed interval so cadences shorter than a frame
  // aren't capped to one volley. Bounded to avoid unbounded loops.
  let maxVolleys = 16;
  while (player.fireCd <= 0 && maxVolleys-- > 0) {
    player.fireCd += interval;
    fireVolley();
  }
  if (player.fireCd < 0) player.fireCd = 0;
}

// ---- damage & scoring ----
function addScore(n, x, y) {
  let g = Math.round(n * mult);
  score += g;
  addFloat('+' + g, x, y, '#fff');
}
function addFloat(s, x, y, c) { floaters.push({ s: s, x: x, y: y, c: c, life: 1 }); }

function bumpCombo() {
  combo++;
  let m = Math.min(5, 1 + Math.floor(combo / 5) * 0.5);
  if (m > mult) { mult = m; addFloat('x' + mult + ' CHAIN', CX, CY - R * 0.14, '#ffe37a'); sfx(7); }
}
function breakCombo() { combo = 0; mult = 1; }

function splat(x, y, color, n, big) {
  for (let i = 0; i < n; i++) {
    let a = Math.random() * 6.2832, sp = (0.3 + Math.random()) * R * (big ? 0.5 : 0.32);
    particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: (big ? 3 : 2) + Math.random() * 3, c: color, life: 0.5 + Math.random() * 0.4, blob: 1 });
  }
}

function killEnemy(e) {
  let f = FAMILIES[e.ty];
  splat(e.x, e.y, f.c, e.mini ? 6 : 12, e.ty === 3);
  sfx(2);
  addScore((e.mini ? 5 : 10) + e.ty * 4, e.x, e.y);
  bumpCombo();
  shake = Math.min(shake + (e.ty === 3 ? 7 : 3), 12);
  if (e.ty === 3) hitstop = 0.05;
  if (e.ty === 1 && !e.mini) {                 // splitter spawns minis
    let a = Math.atan2(e.y - CY, e.x - CX);
    spawnEnemy(0, a + 0.4, true);
    spawnEnemy(0, a - 0.4, true);
    enemies[enemies.length - 1].x = e.x; enemies[enemies.length - 1].y = e.y;
    enemies[enemies.length - 2].x = e.x; enemies[enemies.length - 2].y = e.y;
  }
  if (Math.random() < 0.14 + (e.ty === 3 ? 0.4 : 0)) dropPower(e.x, e.y);
}

function dropPower(x, y) {
  let p = POWERS[Math.floor(Math.random() * POWERS.length)];
  pickups.push({ x: x, y: y, k: p.k, c: p.c, n: p.n, life: 9, t: 0 });
}

function applyPower(p) {
  sfx(3);
  let def = POWERS.find(function (d) { return d.k === p.k; });
  addFloat(p.n + '!', CX, CY - R * 0.18, p.c);
  if (p.k === 'patch') { halves[0] = Math.min(maxHp, halves[0] + 40); halves[1] = Math.min(maxHp, halves[1] + 40); }
  else if (p.k === 'nova') {
    flashT = 0.2; shake = 12;
    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      let d = Math.hypot(e.x - CX, e.y - CY);
      if (d < R * 0.5) { killEnemy(e); enemies.splice(i, 1); }
    }
  } else if (p.k === 'spread') pSpread = def.dur;
  else if (p.k === 'twin') pTwin = def.dur;
  else if (p.k === 'slow') pSlow = def.dur;
}

function damageHalf(h, amt, e) {
  halves[h] = Math.max(0, halves[h] - amt);
  breakCombo();
  sfx(4);
  shake = Math.min(shake + 6, 14);
  hitstop = 0.05;
  flashT = 0.12;
  addFloat('-' + amt, e.x, e.y, '#ff6b8a');
}

// ---- power-up choice / upgrades ----
function offerUpgrade() {
  let pool = UPGRADES.slice();
  choices = [];
  for (let i = 0; i < 3; i++) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  sel = 0;
  setScene('upgrade');
}

function applyUpgrade(u) {
  let p = player;
  if (u.k === 'fire') { p.fireInt *= 0.78; p.fireCd *= 0.78; }
  else if (u.k === 'dmg') p.bdmg += 1;
  else if (u.k === 'multi') p.multi += 1;
  else if (u.k === 'speed') p.spd *= 1.18;
  else if (u.k === 'armor') { maxHp += 25; halves[0] = Math.min(maxHp, halves[0] + 25); halves[1] = Math.min(maxHp, halves[1] + 25); }
  else if (u.k === 'big') { p.bsize += 2; p.bdmg += 1; p.bspeed *= 1.05; }
  else if (u.k === 'pierce') p.pierce += 1;
  sfx(5);
  nextWave(pendingClean);
  setScene('play');
}

function gameOver() {
  if (score > best) { best = score; localStorage.setItem('rg_best', best); }
  sfx(6);
  setScene('over');
}

// ---- update ----
function update(dt) {
  now += dt;
  if (hitstop > 0) { hitstop -= dt; return; }
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
  if (flashT > 0) flashT -= dt;

  // power-up timers
  if (pSpread > 0) pSpread -= dt;
  if (pTwin > 0) pTwin -= dt;
  if (pSlow > 0) pSlow -= dt;
  let slow = pSlow > 0 ? 0.35 : 1;

  // player orbit
  player.ang += player.spd * player.dir * dt;
  tryFire(dt);

  // spawns
  spawnTimer -= dt;
  if (spawnQueue.length && spawnTimer <= 0) {
    for (let i = spawnQueue.length - 1; i >= 0; i--) {
      spawnQueue[i].delay -= dt;
      if (spawnQueue[i].delay <= 0) { let s = spawnQueue.splice(i, 1)[0]; spawnEnemy(s.ty, s.ang); }
    }
    spawnTimer = 0.05;
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i]; e.t += dt; if (e.hit > 0) e.hit -= dt;
    let dx = CX - e.x, dy = CY - e.y, dist = Math.hypot(dx, dy) || 1;
    let ux = dx / dist, uy = dy / dist, sp = e.spd * slow;

    if (e.ty === 2) {                               // slinger: approach, wind up, dash
      if (e.state === 0) {
        if (dist < R * 0.44) { e.state = 1; e.timer = 0.75; } else sp *= 1.05;
      } else if (e.state === 1) {
        e.timer -= dt; sp = 0; if (e.timer <= 0) { e.state = 2; }
      } else sp = e.spd * 2.6 * slow;
    }
    let sway = Math.cos(e.t * 2 + e.seed) * e.sway * (e.state === 2 ? 0 : 1);
    let vx = (ux * sp) + (-uy * sway * 20), vy = (uy * sp) + (ux * sway * 20);
    e.x += vx * dt; e.y += vy * dt; e.vx = vx; e.vy = vy;
    dist = Math.hypot(CX - e.x, CY - e.y);

    // collide with rainbow: use the per-half shared live-band geometry so we
    // hit the visible outer stroke of the outermost intact band (not the max
    // possible ring). A fully-peeled half returns 0 and lets enemies pass
    // through to the core, matching what the player sees.
    let half = Math.cos(Math.atan2(e.y - CY, e.x - CX)) > 0 ? 0 : 1;
    let hitR = rainbowHalfOuterRadius(halves[half], maxHp);
    if (hitR > 0 && dist < hitR + e.r) {
      if (halves[half] > 0) {
        let amt = e.ty === 3 ? 18 : e.mini ? 7 : 11;
        damageHalf(half, amt, e);
        splat(e.x, e.y, FAMILIES[e.ty].c, 8);
        enemies.splice(i, 1);
        continue;
      }
    }
    if (dist < R * 0.06) { enemies.splice(i, 1); gameOver(); return; }
  }

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    let d = Math.hypot(b.x - CX, b.y - CY);
    if (b.life <= 0 || d > R * 0.72 || d < R * 0.05) { bullets.splice(i, 1); continue; }
    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      if ((b.x - e.x) * (b.x - e.x) + (b.y - e.y) * (b.y - e.y) < (e.r + b.r) * (e.r + b.r)) {
        e.hp -= b.dmg; e.hit = 0.12; sfx(1);
        splat(b.x, b.y, '#fff', 3);
        if (e.hp <= 0) { killEnemy(e); enemies.splice(j, 1); }
        if (b.pierce > 0) b.pierce--; else { bullets.splice(i, 1); }
        break;
      }
    }
  }

  // pickups
  let hx = CX + Math.cos(player.ang) * hornRadius(), hy = CY + Math.sin(player.ang) * hornRadius();
  for (let i = pickups.length - 1; i >= 0; i--) {
    let p = pickups[i]; p.life -= dt; p.t += dt;
    if (p.life <= 0) { pickups.splice(i, 1); continue; }
    let got = Math.hypot(p.x - hx, p.y - hy) < R * 0.05;
    if (!got) for (let j = 0; j < bullets.length; j++)
      if (Math.hypot(p.x - bullets[j].x, p.y - bullets[j].y) < R * 0.03) { got = 1; break; }
    if (got) { applyPower(p); pickups.splice(i, 1); }
  }

  // particles & floaters
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.9; p.vy *= 0.9; if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    let f = floaters[i]; f.life -= dt; f.y -= 24 * dt; if (f.life <= 0) floaters.splice(i, 1);
  }

  // wave progression
  if (!spawnQueue.length && !enemies.length) {
    let clean = halves[0] === lastHalves[0] && halves[1] === lastHalves[1];
    lastHalves = [halves[0], halves[1]];
    if (wave % 2 === 0) { pendingClean = clean; offerUpgrade(); }
    else nextWave(clean);
  }
}
let lastHalves = [100, 100];
let pendingClean = true;

// ---- render ----
function drawEnemy(e) {
  let f = FAMILIES[e.ty];
  ctx.save();
  ctx.translate(e.x, e.y);
  let ang = Math.atan2(e.vy, e.vx);
  let spd = Math.hypot(e.vx, e.vy);
  let stretch = Math.min(0.5, spd / (R * 1.2));
  ctx.rotate(ang);
  let sq = e.hit > 0 ? 1.3 : 1;                   // squash on hit
  ctx.scale((1 + stretch) / sq, (1 - stretch * 0.5) * sq);
  ctx.rotate(-ang);
  // translucent gelatinous body with radial shading
  let g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.4, e.r * 0.2, 0, 0, e.r * 1.15);
  g.addColorStop(0, e.hit > 0 ? '#ffffff' : f.c);
  g.addColorStop(0.7, f.c);
  g.addColorStop(1, f.c2);
  ctx.globalAlpha = 0.92;
  blobPath(e.r, e.t, e.seed, 9, f.wob);
  ctx.fillStyle = g; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2; ctx.strokeStyle = e.state === 1 ? '#fff' : f.c2;
  if (e.state === 1) ctx.setLineDash([4, 3]);
  ctx.stroke(); ctx.setLineDash([]);
  // shine highlight
  ctx.globalAlpha = 0.5;
  circle(-e.r * 0.3, -e.r * 0.45, e.r * 0.28, '#ffffff');
  ctx.globalAlpha = 1;
  // eyes looking toward core
  let la = Math.atan2(CY - e.y, CX - e.x);
  let ex = Math.cos(la), ey = Math.sin(la);
  let eo = e.r * 0.34, es = e.r * 0.3;
  for (let k = -1; k <= 1; k += 2) {
    let px = -ey * eo * k, py = ex * eo * k;
    circle(px, py, es, '#fff', '#222', 1);
    circle(px + ex * es * 0.4, py + ey * es * 0.4, es * 0.5, '#111');
  }
  if (e.state === 1) { // wind-up telegraph ring
    ctx.globalAlpha = 0.6; circle(0, 0, e.r * 1.6, 0, '#fff', 2); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawThreat() {
  let threat = [0, 0];
  for (let i = 0; i < enemies.length; i++) {
    let e = enemies[i];
    let dist = Math.hypot(e.x - CX, e.y - CY);
    let half = Math.cos(Math.atan2(e.y - CY, e.x - CX)) > 0 ? 0 : 1;
    let lvl = e.state === 2 ? 2 : dist < R * 0.4 ? 1 : 0;
    if (lvl > threat[half]) threat[half] = lvl;
  }
  for (let h = 0; h < 2; h++) {
    if (!threat[h] || halves[h] <= 0) continue;
    let a0 = h === 0 ? -1.5708 : 1.5708, a1 = h === 0 ? 1.5708 : 4.7124;
    ctx.beginPath();
    ctx.arc(CX, CY, rainbowOuterRadius() + 2, a0, a1);
    ctx.strokeStyle = threat[h] === 2 ? '#ff3b5c' : '#ffb020';
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now * 10);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function render() {
  clear();
  let sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(sx, sy);
  drawStars(now);

  // aim telegraphs: outline the half each threatening enemy targets
  drawRainbow(halves, maxHp);
  drawThreat();
  drawCore(now, halves);

  for (let i = 0; i < pickups.length; i++) {
    let p = pickups[i];
    let pulse = 1 + 0.15 * Math.sin(p.t * 6);
    ctx.globalAlpha = p.life < 3 ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.t * 18)) : 1;
    circle(p.x, p.y, R * 0.02 * pulse, p.c, '#fff', 2);
    text(p.n[0], p.x, p.y, R * 0.02, '#111');
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);

  for (let i = 0; i < bullets.length; i++) {
    let b = bullets[i];
    circle(b.x, b.y, b.r, '#fff');
    circle(b.x, b.y, b.r * 1.9, 'rgba(180,230,255,.25)');
  }

  // horn(s)
  let hx = CX + Math.cos(player.ang) * hornRadius(), hy = CY + Math.sin(player.ang) * hornRadius();
  drawHorn(hx, hy, player.ang, 0);
  if (pTwin > 0) {
    let a2 = player.ang + Math.PI;
    drawHorn(CX + Math.cos(a2) * hornRadius(), CY + Math.sin(a2) * hornRadius(), a2, 1);
  }

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life * 1.6);
    circle(p.x, p.y, p.r, p.c);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < floaters.length; i++) {
    let f = floaters[i];
    ctx.globalAlpha = Math.min(1, f.life);
    text(f.s, f.x, f.y, R * 0.022, f.c);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 2) + ')'; ctx.fillRect(0, 0, W, H); }

  drawHUD();
}

function drawHUD() {
  let s = Math.max(14, R * 0.026);
  text('SCORE ' + score, R * 0.02, s, s, '#fff', 'left');
  text('BEST ' + best, R * 0.02, s * 2.1, s * 0.7, '#8fb0ff', 'left');
  text('WAVE ' + wave, W - R * 0.02, s, s, '#fff', 'right');
  if (mult > 1) text('x' + mult + ' CHAIN', W - R * 0.02, s * 2.1, s * 0.8, '#ffe37a', 'right');
  // rainbow HP bars
  barHUD(R * 0.02, H - s * 2, halves[0] / maxHp, '#ff6b8a', 'R');
  barHUD(R * 0.02, H - s, halves[1] / maxHp, '#7cf3ff', 'L');
  // active powers
  let py = s * 3.2;
  let plist = [[pSpread, 'SPREAD'], [pTwin, 'TWIN HORN'], [pSlow, 'SLOW-MO']];
  for (let i = 0; i < 3; i++) {
    if (plist[i][0] > 0) {
      text(plist[i][1] + ' ' + Math.ceil(plist[i][0]), R * 0.02, py, s * 0.6, '#ffd21e', 'left');
      py += s * 0.9;
    }
  }
}
function barHUD(x, y, frac, col, label) {
  let w = R * 0.22, h = R * 0.014;
  ctx.fillStyle = '#222'; ctx.fillRect(x + 18, y - h, w, h);
  ctx.fillStyle = col; ctx.fillRect(x + 18, y - h, w * Math.max(0, frac), h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x + 18, y - h, w, h);
  text(label, x, y - h / 2, h * 1.3, '#fff', 'left');
}

// ---- main loop ----
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (scene === 'play' && !paused) update(dt);
  else now += dt * 0.5; // keep menus animating
  render();
  drawScene();
}

function init() {
  resize();
  initStars();
  resetGame();
  setScene('title');
  setupInput();
  requestAnimationFrame(frame);
}
init();
