/*
 * draw.js - DPR-aware Canvas2D setup and crisp vector drawing primitives.
 * No images, no fonts, no blur: everything is tight strokes and layered fills.
 */

let canvas = document.createElement('canvas');
document.body.appendChild(canvas);
let ctx = canvas.getContext('2d');

// Logical (CSS-pixel) viewport size, device pixel ratio, and derived radius.
let W = 800, H = 600, DPR = 1, R = 600, CX = 400, CY = 300;

function resize() {
  let ox = CX, oy = CY, oR = R;      // previous arena centre / radius
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX = W / 2;
  CY = H / 2;
  R = Math.min(W, H);
  // Rescale all live entity geometry from the old arena to the new one so a
  // resize / orientation change mid-run keeps everything aligned to the core.
  if (typeof remapWorld === 'function') remapWorld(ox, oy, oR, CX, CY, R);
}
window.addEventListener('resize', resize);

// The seven rainbow band colours, outer (red) to inner (violet).
let SPECTRUM = ['#ff2b4e', '#ff8a1e', '#ffd21e', '#37e05a', '#25b7ff', '#3b56ff', '#a24bff'];

function clear() {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);
}

function text(str, x, y, size, color, align, weight) {
  ctx.font = (weight || 800) + ' ' + size + 'px system-ui,Arial,sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// A small parallax starfield. Restrained: sparse, gentle twinkle, no glow.
let stars = [];
function initStars() {
  stars = [];
  for (let i = 0; i < 90; i++)
    stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, p: Math.random() * 7 });
}
function drawStars(t) {
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    let tw = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
    let r = s.z * 1.4;
    ctx.globalAlpha = 0.25 + tw * 0.55 * s.z;
    ctx.fillStyle = '#cfe0ff';
    ctx.fillRect(s.x * W, s.y * H, r, r);
  }
  ctx.globalAlpha = 1;
}

/*
 * Build a wobbly closed organic path centred on the current origin.
 * Uses midpoint-smoothed segments so silhouettes read as gooey, not polygonal.
 */
function blobPath(r, t, seed, n, wob) {
  let pts = [];
  for (let i = 0; i < n; i++) {
    let a = (i / n) * 6.2832;
    let w = 1 + wob * Math.sin(t * 3 + seed + i * 1.7) * 0.5 + wob * Math.sin(t * 1.7 - i) * 0.3;
    pts.push([Math.cos(a) * r * w, Math.sin(a) * r * w]);
  }
  ctx.beginPath();
  let mx = (pts[n - 1][0] + pts[0][0]) / 2, my = (pts[n - 1][1] + pts[0][1]) / 2;
  ctx.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    let c = pts[i], nx = pts[(i + 1) % n];
    ctx.quadraticCurveTo(c[0], c[1], (c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2);
  }
  ctx.closePath();
}

function rainbowBandWidth() { return R * 0.012; }
function rainbowLineWidth() { return rainbowBandWidth() + 1.2; }
function rainbowInnerRadius() { return R * 0.05; }
function rainbowOuterRadius() {
  return rainbowInnerRadius() + rainbowLineWidth() + rainbowBandWidth() * 6;
}

// Shared live-band geometry: how many of the seven bands are still intact
// for a half at hp/max, and the outer stroke-edge radius of its outermost
// currently-drawn band. Returns 0 when the half is fully peeled so that
// collision and rendering agree that no shield remains there.
function rainbowLiveCount(hp, max) {
  return Math.max(0, Math.min(7, Math.ceil(hp / (max || 100) * 7)));
}
function rainbowHalfOuterRadius(hp, max) {
  let live = rainbowLiveCount(hp, max);
  if (live <= 0) return 0;
  let bw = rainbowBandWidth();
  let lw = rainbowLineWidth();
  let base = rainbowInnerRadius() + lw / 2;
  // Outermost currently-drawn band index b = 7 - live; its centre radius is
  // base + (6 - b) * bw = base + (live - 1) * bw. Add half the stroke to get
  // the visible outer edge.
  return base + (live - 1) * bw + lw / 2;
}

/*
 * Draw the rainbow ring around the core. Each half is drawn independently so
 * damage can peel bands from the outer (red) edge inward.
 */
function drawRainbow(halves, max) {
  max = max || 100;
  let bw = rainbowBandWidth();
  let lineWidth = rainbowLineWidth();
  let base = rainbowInnerRadius() + lineWidth / 2;
  for (let h = 0; h < 2; h++) {
    let hp = halves[h]; // 0..max
    let live = rainbowLiveCount(hp, max);
    if (live <= 0) continue;
    // Full right / left semicircles so the drawn shield matches the collision
    // half-split (cos(angle) > 0 == right). No top/bottom gaps to slip through.
    let a0 = h === 0 ? -1.5708 : 1.5708; // right / left arc start
    let a1 = h === 0 ? 1.5708 : 4.7124;
    ctx.globalAlpha = h ? 0.82 : 1;
    ctx.shadowColor = h ? '#7cf3ff' : '#ff6b8a';
    ctx.shadowBlur = R * 0.004;
    for (let b = 0; b < 7; b++) {
      if (b < 7 - live) continue; // peeled from the outer (red) edge inward
      let rr = base + (6 - b) * bw;
      ctx.beginPath();
      ctx.arc(CX, CY, rr, a0, a1);
      ctx.strokeStyle = SPECTRUM[b];
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// Shared horn geometry so the drawn tip and the spawned projectile origin
// agree exactly. `hornBaseSize` is the base half-height; `hornLength` is the
// distance from the horn base (hx,hy) to the rendered tip along `ang`.
function hornBaseSize() { return R * 0.03; }
function hornLength() { return hornBaseSize() * 2.6; }
function hornTipX(x, ang) { return x + Math.cos(ang) * hornLength(); }
function hornTipY(y, ang) { return y + Math.sin(ang) * hornLength(); }

/*
 * The player's orbital unicorn horn. A crisp spiral-striped cone with a bright
 * tip, pointing outward along its facing angle. Drawn at (x,y).
 */
function drawHorn(x, y, ang, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  let size = hornBaseSize();
  let len = hornLength(), wid = size * 0.9;
  // body
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(-wid * 0.3, wid);
  ctx.lineTo(-wid * 0.6, 0);
  ctx.lineTo(-wid * 0.3, -wid);
  ctx.closePath();
  let g = ctx.createLinearGradient(-wid, 0, len, 0);
  g.addColorStop(0, '#ffe9f6');
  g.addColorStop(1, glow ? '#7cf3ff' : '#ff7ad9');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  // spiral stripes
  ctx.strokeStyle = 'rgba(120,40,120,.55)';
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 5; i++) {
    let px = (i / 5) * len;
    let pw = wid * (1 - i / 5);
    ctx.beginPath();
    ctx.moveTo(px, -pw);
    ctx.lineTo(px + wid * 0.35, pw);
    ctx.stroke();
  }
  // bright tip
  circle(len, 0, 2.2, '#fff');
  ctx.restore();
}

function drawCore(t, health) {
  let r = R * 0.05;
  let pulse = 1 + 0.05 * Math.sin(t * 4);
  circle(CX, CY, r * 1.7 * pulse, 'rgba(120,180,255,.10)');
  let g = ctx.createRadialGradient(CX, CY, 1, CX, CY, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#8fd0ff');
  g.addColorStop(1, '#2a6cff');
  // Floor the opaque core radius to a hair past the rainbow's inner edge so
  // the pulse shrink can never expose a black seam between core and bands.
  // The pulse still animates any time r*pulse exceeds that floor.
  let coreR = Math.max(r * pulse, rainbowInnerRadius() + 1);
  circle(CX, CY, coreR, g, '#fff', 1.5);
  // inner sparkle cross
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    let a = t + i * 1.5708;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(a) * r * 0.7, CY + Math.sin(a) * r * 0.7);
    ctx.stroke();
  }
}
