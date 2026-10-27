// Autogenics hero: the wordmark assembles itself out of light, then holds as brushed metal
// that follows the viewer. Real-time WebGL2, no libraries. Without WebGL2, or with reduced
// motion, the page keeps its CSS hero. Preview stills: ?t=<seconds> freezes the timeline.

const root = document.documentElement;
const canvas = document.getElementById('gl');
const mark = document.querySelector('.mark');
const hero = document.querySelector('.hero');
const flare = document.querySelector('.flare');
const team = document.querySelector('.team3');
const query = new URLSearchParams(location.search);
const still = query.has('t') ? Math.max(0, parseFloat(query.get('t')) || 0) : null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const fallback = () => root.classList.remove('gl');
if (reduce || !canvas || !mark || !hero) fallback();
else boot().catch(fallback);

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROT = `
mat3 rot(vec2 t){
  float cx = cos(t.x), sx = sin(t.x), cy = cos(t.y), sy = sin(t.y);
  return mat3(cy, 0., -sy, 0., 1., 0., sy, 0., cy) * mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx);
}`;

const PARTICLE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aTarget;
layout(location = 1) in vec4 aRand;
uniform vec2 uCenter, uHalf, uTilt, uMouse;
uniform float uAspect, uTime, uAssemble, uDust, uDpr, uPulse, uSize, uField;
out float vA;
out vec3 vC;
${ROT}
void main(){
  // Starts as fine dust drifting through the whole view at many depths. About a fifth
  // of it never joins the mark and keeps drifting behind the page.
  vec3 start = vec3((aRand.y - .5) * 2.3 * uAspect, fract(aRand.z + uTime * .011) * 2.8 - 1.4, -.35 - aRand.x * 3.2);
  float ambient = step(fract(aRand.y * 7.31 + aRand.z * 3.17), .2);

  // Its place in the wordmark, on the tilted logo plane.
  vec3 local = vec3(aTarget * uHalf, (aRand.w - .5) * .018);
  vec3 tgt = rot(uTilt) * local;
  tgt.xy += uCenter;

  float p = clamp((uAssemble - aRand.w * .42) / .58, 0., 1.) * (1. - ambient);
  p = 1. - pow(1. - p, 3.);
  vec3 pos = mix(start, tgt, p);
  pos.xy += vec2(-start.y, start.x) * .05 * sin(p * 3.14159);

  // Alive once formed: a faint shimmer, a burst on click, a parting around the cursor.
  pos += vec3(sin(uTime * .9 + aRand.x * 50.), cos(uTime * .7 + aRand.y * 50.), sin(uTime * .5 + aRand.z * 50.)) * .0035 * p;
  float burst = exp(-uPulse * 2.4) * sin(min(uPulse, 1.3) * 2.4) * (1. - ambient);
  pos.xy += normalize(local.xy + 1e-4) * burst * (.18 + aRand.z * .3);
  pos.z += burst * (aRand.y - .5) * 1.1;
  vec2 dm = pos.xy - uMouse;
  pos.xy += normalize(dm + 1e-5) * .06 * exp(-dot(dm, dm) * 60.) * p;

  // Near the team photos the background dust spreads out and fades away.
  pos.xy *= 1. + (1. - uField) * .35 * ambient;

  float persp = 2.6 / (2.6 - pos.z);
  gl_Position = vec4(pos.x * persp / uAspect, pos.y * persp, 0., 1.);
  gl_PointSize = clamp((.7 + aRand.z * 1.5) * uSize * uDpr * persp, 1., 22.);

  float born = smoothstep(0., .6, uTime - aRand.w * .35);
  float level = mix(mix(.4, uDust, p), .32, ambient);
  float twinkle = mix(1., .65 + .35 * sin(uTime * 2.3 + aRand.x * 90.), p);
  vA = born * level * twinkle * (.55 + .45 * aRand.y) * clamp(persp, .3, 1.3) * mix(1., uField, ambient);
  vec3 silver = vec3(.88, .9, .95), steel = vec3(.6, .68, .84), ember = vec3(1., .8, .58);
  vC = mix(mix(steel, silver, aRand.y), ember, step(.968, aRand.x));
}`;

const PARTICLE_FS = `#version 300 es
precision mediump float;
in float vA;
in vec3 vC;
out vec4 o;
void main(){
  vec2 q = gl_PointCoord - .5;
  float a = exp(-dot(q, q) * 14.) * vA;
  o = vec4(vC * a, a);
}`;

const LOGO_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
uniform vec2 uCenter, uHalf, uTilt;
uniform float uAspect;
out vec2 vUv;
out vec2 vPos;
out vec3 vN;
${ROT}
void main(){
  mat3 r = rot(uTilt);
  vec3 p = r * vec3(aCorner * uHalf, 0.);
  p.xy += uCenter;
  float persp = 2.6 / (2.6 - p.z);
  gl_Position = vec4(p.x / uAspect, p.y, 0., 1. / persp);
  vUv = vec2(aCorner.x * .5 + .5, .5 - aCorner.y * .5);
  vPos = p.xy;
  vN = r * vec3(0., 0., 1.);
}`;

const LOGO_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel, uLight;
uniform float uReveal, uTime;
in vec2 vUv;
in vec2 vPos;
in vec3 vN;
out vec4 o;
float lum(vec2 uv){ vec4 c = texture(uTex, uv); return dot(c.rgb, vec3(.299, .587, .114)) * c.a; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main(){
  vec4 c = texture(uTex, vUv);
  if (c.a < .004) discard;
  // Relief from the metal's own brightness, so the light rakes across the grain.
  float hx = lum(vUv + vec2(uTexel.x, 0.)) - lum(vUv - vec2(uTexel.x, 0.));
  float hy = lum(vUv + vec2(0., uTexel.y)) - lum(vUv - vec2(0., uTexel.y));
  vec3 N = normalize(vec3(-hx * 2.6, hy * 2.6, 1.) + (vN - vec3(0., 0., 1.)) * 1.5);
  vec3 L = normalize(vec3(uLight - vPos, .85));
  float diff = .62 + .38 * max(dot(N, L), 0.);
  float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 26.);
  float sweep = fract(uTime * .07 + .35) * 2.6 - .8;
  float band = smoothstep(.07, 0., abs(vUv.x + vUv.y * .32 - sweep));
  vec3 col = c.rgb * diff + vec3(spec * .5 + band * .3);

  // Crystallizes out of noise, with a bright forming edge.
  float nz = noise(vUv * vec2(42., 7.)) * .62 + noise(vUv * vec2(150., 26.)) * .38;
  float edge = uReveal * 1.25 - nz;
  float vis = smoothstep(0., .07, edge);
  float rim = smoothstep(.1, 0., abs(edge - .035)) * (1. - smoothstep(.96, 1., uReveal));
  col += vec3(.9, .95, 1.) * rim * 1.3;
  float a = c.a * clamp(vis + rim * .6, 0., 1.);
  o = vec4(col * a, a);
}`;

function compile(gl, vs, fs) {
  const program = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uniforms = {};
  for (let i = 0, n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const name = gl.getActiveUniform(program, i).name;
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, u: uniforms };
}

function sampleLogo(img, count, random) {
  const w = 879, h = 142;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h).data;
  const solid = [];
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 70) solid.push(i);
  const out = new Float32Array(count * 2);
  for (let k = 0; k < count; k++) {
    const i = solid[(random() * solid.length) | 0];
    out[k * 2] = ((i % w) + random()) / w * 2 - 1;
    out[k * 2 + 1] = 1 - (((i / w) | 0) + random()) / h * 2;
  }
  return out;
}

async function boot() {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: still !== null });
  if (!gl) throw new Error('WebGL2 unavailable');
  const img = new Image();
  img.src = mark.querySelector('img').currentSrc || 'logo.png';
  await img.decode();

  const random = rng(20261027);
  const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const count = small ? 30000 : 72000;
  const targets = sampleLogo(img, count, random);
  const seeds = new Float32Array(count * 4).map(() => random());

  const particles = compile(gl, PARTICLE_VS, PARTICLE_FS);
  const logo = compile(gl, LOGO_VS, LOGO_FS);

  const pVao = gl.createVertexArray();
  gl.bindVertexArray(pVao);
  for (const [loc, size, data] of [[0, 2, targets], [1, 4, seeds]]) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  const lVao = gl.createVertexArray();
  gl.bindVertexArray(lVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0, seen: false };
  const tilt = { x: 0, y: 0 };
  let pulseAt = -99, flared = false, frameNo = 0, blank = false;
  let begin = performance.now();
  const now = () => (still ?? (performance.now() - begin) / 1000);
  // sound.js reads the intro clock and can replay the intro.
  window.autogenicsHero = {
    time: now,
    restart() {
      scrollTo(0, 0);
      flare?.classList.remove('go');
      void flare?.offsetWidth;
      flared = false;
      pulseAt = -99;
      begin = performance.now();
    },
  };

  addEventListener('pointermove', e => {
    const aspect = innerWidth / innerHeight;
    pointer.x = (e.clientX / innerWidth * 2 - 1) * aspect;
    pointer.y = 1 - e.clientY / innerHeight * 2;
    if (!pointer.seen) { pointer.sx = pointer.x; pointer.sy = pointer.y; pointer.seen = true; }
  }, { passive: true });
  hero.addEventListener('pointerdown', () => {
    if (now() > 4.6) { pulseAt = now(); dispatchEvent(new Event('hero:pulse')); }
  });

  function frame() {
    const t = now();
    frameNo++;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const aspect = innerWidth / innerHeight;

    const r = mark.getBoundingClientRect();
    const center = [((r.left + r.width / 2) / innerWidth * 2 - 1) * aspect, 1 - (r.top + r.height / 2) / innerHeight * 2];
    const half = [r.width / innerWidth * aspect, r.height / innerHeight];

    // The mark finishes forming and stays formed; it simply scrolls with the page.
    const reveal = smooth(3.9, 5.6, t);
    // The dust clears as the team photos come up: gone by the time they reach mid-screen.
    const field = team ? smooth(innerHeight * .45, innerHeight, team.getBoundingClientRect().top) : 1;
    const dust = 1 - .86 * smooth(4.4, 6.4, t);
    const assemble = clamp((t - 1) / 3.1);

    // The light and the tilt follow the viewer; with no pointer, a slow drift.
    pointer.sx += (pointer.x - pointer.sx) * .08;
    pointer.sy += (pointer.y - pointer.sy) * .08;
    const rel = pointer.seen ? [(pointer.sx - center[0]) / Math.max(half[0], .3), (pointer.sy - center[1]) / .9] : [Math.sin(t * .35) * .6, Math.sin(t * .27) * .35];
    tilt.x += (clamp(-rel[1], -1, 1) * .1 - tilt.x) * .06;
    tilt.y += (clamp(rel[0], -1, 1) * .17 - tilt.y) * .06;
    const light = pointer.seen ? [pointer.sx, pointer.sy] : [center[0] + Math.sin(t * .4) * half[0] * .9, center[1] + .35];

    if (!flared && t >= 4.1 && flare) { flare.classList.add('go'); flared = true; }

    // Nothing to draw near the bottom of the page; elsewhere, once the mark is off-screen
    // and settled, half rate saves battery.
    const empty = r.bottom < 0 && field < .001;
    if (empty && blank) { requestAnimationFrame(frame); return; }
    blank = empty;
    if (!(r.bottom < 0 && t > 8 && frameNo % 2) || empty) {
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (reveal > .001) {
        gl.useProgram(logo.program);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform2f(logo.u.uCenter, ...center);
        gl.uniform2f(logo.u.uHalf, ...half);
        gl.uniform2f(logo.u.uTilt, tilt.x, tilt.y);
        gl.uniform1f(logo.u.uAspect, aspect);
        gl.uniform2f(logo.u.uTexel, 1 / img.naturalWidth, 1 / img.naturalHeight);
        gl.uniform2f(logo.u.uLight, ...light);
        gl.uniform1f(logo.u.uReveal, reveal);
        gl.uniform1f(logo.u.uTime, t);
        gl.uniform1i(logo.u.uTex, 0);
        gl.bindVertexArray(lVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      gl.useProgram(particles.program);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform2f(particles.u.uCenter, ...center);
      gl.uniform2f(particles.u.uHalf, ...half);
      gl.uniform2f(particles.u.uTilt, tilt.x, tilt.y);
      gl.uniform2f(particles.u.uMouse, pointer.seen ? pointer.sx : 99, pointer.seen ? pointer.sy : 99);
      gl.uniform1f(particles.u.uAspect, aspect);
      gl.uniform1f(particles.u.uTime, t);
      gl.uniform1f(particles.u.uAssemble, assemble);
      gl.uniform1f(particles.u.uDust, dust);
      gl.uniform1f(particles.u.uDpr, dpr);
      gl.uniform1f(particles.u.uPulse, t - pulseAt);
      gl.uniform1f(particles.u.uSize, small ? 1.5 : 1.7);
      gl.uniform1f(particles.u.uField, field);
      gl.bindVertexArray(pVao);
      gl.drawArrays(gl.POINTS, 0, count);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
