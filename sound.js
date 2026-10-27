// Autogenics score: generated live with Web Audio (no audio files), synced to the hero.
// Browsers only allow sound after a visitor's click, tap or key press unless they allow
// autoplay, so it tries at load and otherwise starts on the first gesture.

const IMPACT = 4.1;   // seconds into the intro when the metal logo forms (hero3d.js)

function noise(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function room(ctx, seconds, decay) {
  const len = Math.round(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function createEngine(ctx) {
  const out = ctx.createGain();
  out.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .25;
  out.connect(comp).connect(ctx.destination);
  const bus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = .85;
  const verb = ctx.createConvolver(); verb.buffer = room(ctx, 3.8, 2.6);
  const wet = ctx.createGain(); wet.gain.value = .5;
  bus.connect(dry).connect(out);
  bus.connect(verb).connect(wet).connect(out);
  const hiss = noise(ctx, 2);

  const noiseVoice = (at, dur) => {
    const s = ctx.createBufferSource(); s.buffer = hiss; s.loop = true;
    s.start(at, Math.random() * 1.5); s.stop(at + dur + .05);
    return s;
  };

  return {
    out,
    // Out of silence: a low dissonant cluster (D, E-flat, A-flat) over a slowly beating
    // sub, with a dark wind. It darkens and opens toward the impact, then lets go.
    dread(at, dur) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(1, at + dur * .9);
      g.gain.setTargetAtTime(.0001, at + dur, .5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = .8;
      lp.frequency.setValueAtTime(160, at);
      lp.frequency.exponentialRampToValueAtTime(1300, at + dur);
      lp.connect(g);
      for (const [f, type, v] of [[36.7, 'sine', .5], [37.15, 'sine', .4], [73.4, 'sawtooth', .07], [77.8, 'sawtooth', .055], [103.8, 'sawtooth', .05], [146.8, 'sawtooth', .03]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = f; og.gain.value = v;
        o.connect(og).connect(type === 'sine' ? g : lp);
        o.start(at); o.stop(at + dur + 4);
      }
      const s = noiseVoice(at, dur + 3), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
      wf.type = 'lowpass';
      wf.frequency.setValueAtTime(200, at);
      wf.frequency.exponentialRampToValueAtTime(850, at + dur);
      wg.gain.value = .32;
      s.connect(wf).connect(wg).connect(g);
      const level = ctx.createGain(); level.gain.value = .34;
      g.connect(level).connect(bus);
    },
    // A deep heartbeat thump, with enough body to be heard on laptop speakers.
    thump(at, level = .45) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(62, at); o.frequency.exponentialRampToValueAtTime(34, at + .3);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + .008);
      g.gain.exponentialRampToValueAtTime(.0001, at + .9);
      o.connect(g).connect(bus); o.start(at); o.stop(at + 1);
      const s = noiseVoice(at, .2), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 220;
      ng.gain.setValueAtTime(level * .9, at); ng.gain.exponentialRampToValueAtTime(.0001, at + .18);
      s.connect(lp).connect(ng).connect(bus);
    },
    // A breath drawn in just before the hit.
    swell(at, dur) {
      const s = noiseVoice(at, dur), h = ctx.createBiquadFilter(), g = ctx.createGain();
      h.type = 'highpass';
      h.frequency.setValueAtTime(900, at); h.frequency.exponentialRampToValueAtTime(5500, at + dur);
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(.16, at + dur - .04);
      g.gain.linearRampToValueAtTime(0, at + dur + .02);
      s.connect(h).connect(g).connect(bus);
    },
    // The logo forming in metal: a deep hit.
    impact(at) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(36, at + .5);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.85, at + .006);
      g.gain.exponentialRampToValueAtTime(.0001, at + 2.4);
      o.connect(g).connect(out); o.start(at); o.stop(at + 2.5);
      const s = noiseVoice(at, .3), h = ctx.createBiquadFilter(), hg = ctx.createGain();
      h.type = 'highpass'; h.frequency.value = 2500;
      hg.gain.setValueAtTime(.3, at); hg.gain.exponentialRampToValueAtTime(.0001, at + .25);
      s.connect(h).connect(hg).connect(bus);
    },
    // One keystroke as the definition types itself: a soft click with a little body,
    // varied per key; spaces land a little deeper. Mostly dry, so it stays crisp.
    key(at, space = false) {
      const level = (space ? .1 : .075) * (.8 + Math.random() * .4);
      const s = noiseVoice(at, .05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.value = (space ? 1700 : 2500) + Math.random() * 900;
      g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(.0001, at + .032);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = (space ? 135 : 185) + Math.random() * 40;
      og.gain.setValueAtTime(level * .8, at); og.gain.exponentialRampToValueAtTime(.0001, at + .05);
      o.start(at); o.stop(at + .06);
      const send = ctx.createGain(); send.gain.value = .12;
      for (const node of [s.connect(bp).connect(g), o.connect(og)]) { node.connect(out); node.connect(send); }
      send.connect(verb);
    },
    // Clicking the logo: a dark rush out and a thump.
    pulse(at) {
      const s = noiseVoice(at, .6), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = .8;
      f.frequency.setValueAtTime(1400, at); f.frequency.exponentialRampToValueAtTime(180, at + .6);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.2, at + .05); g.gain.linearRampToValueAtTime(0, at + .6);
      s.connect(f).connect(g).connect(bus);
      this.thump(at + .02, .35);
    },
    // A low, slowly breathing bed under the page.
    pad(at) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + 3);
      const level = ctx.createGain(); level.gain.value = .05;
      for (const [f, type, v] of [[55, 'sine', .5], [82.5, 'sine', .32], [110.3, 'triangle', .14]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = f; og.gain.value = v;
        o.connect(og).connect(g); o.start(at);
      }
      const s = ctx.createBufferSource(); s.buffer = hiss; s.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = .07; depth.gain.value = 250; lfo.connect(depth).connect(lp.frequency); lfo.start(at);
      const ng = ctx.createGain(); ng.gain.value = .25;
      s.connect(lp).connect(ng).connect(g); s.start(at);
      g.connect(level).connect(bus);
      return level;
    },
  };
}

// The score, from `from` seconds into the intro onward; `now` is the AudioContext time.
export function scheduleIntro(e, from, now) {
  const at = s => now + Math.max(0, s - from);
  if (from < IMPACT - .3) e.dread(at(from), IMPACT - from);
  for (const [s, level] of [[.9, .3], [1.9, .36], [2.7, .42], [3.3, .48], [3.75, .55]]) if (s >= from) e.thump(at(s), level);
  if (from < IMPACT - .3) e.swell(at(Math.max(from, 3.2)), IMPACT - Math.max(from, 3.2));
  if (from < IMPACT + .25) e.impact(at(IMPACT));
  else e.thump(now + .02, .3);
}

const btn = document.querySelector('.sound');
const replay = document.querySelector('.replay');
const AC = window.AudioContext || window.webkitAudioContext;
if (btn && AC && document.documentElement.classList.contains('gl')) wire();

function wire() {
  let ctx, engine, padLevel, on = false, started = false;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return; }
  engine = createEngine(ctx);
  const hero = () => window.autogenicsHero;
  const show = state => {
    on = state;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.label').textContent = on ? 'Sound on' : 'Sound off';
    replay.hidden = !on;
  };

  const start = () => {
    // No score without the live hero (WebGL unavailable or reduced motion).
    if (started || ctx.state !== 'running' || !document.documentElement.classList.contains('gl')) return;
    started = true;
    const now = ctx.currentTime + .03;
    engine.out.gain.setTargetAtTime(.9, now, .08);
    const t = hero()?.time() ?? 99;
    scheduleIntro(engine, t, now);
    padLevel = engine.pad(now + Math.max(0, 4.4 - t));
    show(true);
  };
  const unlock = e => {
    if (started || e.target.closest?.('.sound, .replay')) return;
    ctx.resume().then(start);
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });
  // Allowed right away only where the visitor permits autoplay.
  ctx.resume().then(start).catch(() => {});

  btn.addEventListener('click', () => {
    if (!started) { ctx.resume().then(start); return; }
    if (on) { engine.out.gain.setTargetAtTime(0, ctx.currentTime, .12); show(false); }
    else { ctx.resume(); engine.out.gain.setTargetAtTime(.9, ctx.currentTime, .12); show(true); }
  });
  replay.addEventListener('click', () => {
    hero()?.restart();
    scheduleIntro(engine, 0, ctx.currentTime + .05);
  });
  addEventListener('hero:pulse', () => { if (started && on) engine.pulse(ctx.currentTime + .01); });
  addEventListener('type:key', e => { if (started && on) engine.key(ctx.currentTime + .005, e.detail?.space); });
  addEventListener('scroll', () => {
    if (!padLevel) return;
    const s = Math.min(1, scrollY / innerHeight);
    padLevel.gain.setTargetAtTime(.05 * (1 - .55 * s), ctx.currentTime, .3);
  }, { passive: true });
  setTimeout(() => btn.classList.add('ready'), 1200);
}
