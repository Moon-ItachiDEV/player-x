// Player X — landing. Tout le contenu marche sans ce script.
// Sur mobile, Player X étant pour Windows, le bouton envoie le lien vers son PC (partage, sinon copie).
for (const btn of document.querySelectorAll('[data-share]')) {
  const label = btn.querySelector('span');
  const initial = label.textContent;
  btn.addEventListener('click', async () => {
    const url = location.origin + '/';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Player X', text: 'Player X, pour Windows : ouvre ce lien sur ton PC.', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      label.textContent = 'Lien copié';
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      label.textContent = url.replace(/^https?:\/\//, '');
    }
    setTimeout(() => { label.textContent = initial; }, 2600);
  });
}

// « Joue. » : la jaquette survolée s'incline vers la souris, avec un reflet (souris seulement, pas au toucher ni en mouvement réduit).
const still = matchMedia('(prefers-reduced-motion: reduce)');
for (const tile of document.querySelectorAll('.tile')) {
  tile.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = tile.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    tile.classList.add('is-on');
    tile.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    tile.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (still.matches) return;
    tile.style.setProperty('--ry', `${((x - 0.5) * 22).toFixed(2)}deg`);
    tile.style.setProperty('--rx', `${((0.5 - y) * 22).toFixed(2)}deg`);
  });
  tile.addEventListener('pointerleave', () => {
    tile.classList.remove('is-on');
    tile.style.setProperty('--rx', '0deg');
    tile.style.setProperty('--ry', '0deg');
  });
}

// Boutons « métal liquide » : un shader WebGL dessine un chrome qui coule, teinté braise, plus vif sous la souris,
// et le bouton est attiré par le curseur. Sans WebGL : anneau CSS. Mouvement réduit : une seule image, pas d'attraction.
const FRAG = `
precision highp float;
uniform vec2 r;      // taille en pixels
uniform float t;     // temps
uniform vec2 m;      // souris (0..1, origine en bas à gauche)
uniform float h;     // survol 0..1
uniform float ring;  // épaisseur du chrome en pixels

// Arrondi : distance signée au bouton (une pilule)
float pill(vec2 p, vec2 b) {
  float rad = b.y;
  vec2 q = abs(p) - b + rad;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}
// Champ « liquide » : sinus déformés, lisses
float field(vec2 p, float k) {
  p += 0.45 * vec2(sin(p.y * 1.7 + k), cos(p.x * 1.3 - k * 0.8));
  p += 0.25 * vec2(sin(p.y * 3.1 - k * 1.2), cos(p.x * 2.7 + k));
  return sin(p.x * 1.9 + k * 0.7) * cos(p.y * 2.2 - k * 0.5) + 0.35 * sin((p.x + p.y) * 3.3 + k * 1.4);
}
// Studio : ciel clair rosé, horizon net, sol sombre, deux bandes de lumière
vec3 env(vec3 d, float k) {
  float y = d.y + 0.08 * sin(d.x * 3.0 + k * 0.6);
  vec3 sky = mix(vec3(1.0, 0.93, 0.96), vec3(1.0, 0.66, 0.76), clamp(y * 1.4, 0.0, 1.0));
  vec3 ground = mix(vec3(0.22, 0.08, 0.13), vec3(0.03, 0.02, 0.04), clamp(-y * 2.2, 0.0, 1.0));
  vec3 c = mix(ground, sky, smoothstep(-0.03, 0.03, y));
  c += vec3(1.0) * exp(-pow((y - 0.02) * 26.0, 2.0)) * 0.9;
  c += vec3(1.0, 0.92, 0.96) * exp(-pow((d.x - 0.45 - 0.2 * sin(k * 0.3)) * 7.0, 2.0)) * 0.55 * smoothstep(-0.1, 0.3, y);
  c += vec3(1.0, 0.75, 0.82) * exp(-pow((d.x + 0.6) * 9.0, 2.0)) * 0.35;
  return c;
}
void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 c = px - 0.5 * r;
  float d = pill(c, 0.5 * r);
  float k = t * (0.55 + 1.1 * h);
  vec2 uv = px / r.y;
  // relief du liquide (gradient par différences finies)
  float e = 0.02;
  float f0 = field(uv * 2.2, k);
  vec2 g = vec2(field((uv + vec2(e, 0.0)) * 2.2, k) - f0, field((uv + vec2(0.0, e)) * 2.2, k) - f0) / e;
  vec2 mouse = (m - 0.5) * r;
  float near = exp(-dot(c - mouse, c - mouse) / (r.y * r.y * 1.6));
  vec3 col;
  if (d > -ring) {
    // Chrome : un tube biseauté (profil rond) + le liquide qui coule dessus
    float tt = clamp((d + ring) / ring, 0.0, 1.0) * 2.0 - 1.0;
    vec2 dir = normalize(c / max(0.5 * r, vec2(1.0)) + 1e-4);
    vec3 n = normalize(vec3(dir * tt * 1.2 + g * 0.07, sqrt(max(0.0, 1.0 - tt * tt)) + 0.15));
    vec3 rd = reflect(vec3(0.0, 0.0, -1.0), n);
    // légère dispersion des couleurs, comme un vrai chrome
    col = vec3(env(rd + vec3(0.012, 0.0, 0.0), k).r, env(rd, k).g, env(rd - vec3(0.012, 0.0, 0.0), k).b);
    col *= mix(vec3(1.0), vec3(1.0, 0.78, 0.86), 0.35);
    col += near * (0.25 + 0.75 * h) * vec3(1.0, 0.9, 0.95) * pow(max(n.z, 0.0), 6.0);
    col *= 0.55 + 0.45 * smoothstep(1.0, 0.6, abs(tt));
  } else {
    // Intérieur : laque rose braise, le liquide en reflets sous le vernis
    float y = px.y / r.y;
    vec3 base = mix(vec3(0.91, 0.20, 0.44), vec3(1.0, 0.50, 0.64), y);
    vec3 n = normalize(vec3(g * 0.035, 1.0));
    vec3 l = normalize(vec3(mouse / r.y, 0.9));
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
    vec3 rd = reflect(vec3(0.0, 0.0, -1.0), n);
    col = base + 0.09 * (env(rd, k) - 0.5);
    col += spec * (0.35 + 0.65 * h) * vec3(1.0, 0.92, 0.95);
    col += smoothstep(0.55, 0.95, y) * 0.16;                      // vernis du haut
    col *= 1.0 - 0.35 * exp((d + ring) / (ring * 0.9));         // ombre au pied du chrome
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
const calm = matchMedia('(prefers-reduced-motion: reduce)');

function metal(btn) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = { r: gl.getUniformLocation(prog, 'r'), t: gl.getUniformLocation(prog, 't'), m: gl.getUniformLocation(prog, 'm'), h: gl.getUniformLocation(prog, 'h'), ring: gl.getUniformLocation(prog, 'ring') };
  btn.prepend(canvas);
  btn.classList.add('gl');

  let mx = 0.8, my = 0.7, hover = 0, target = 0, visible = false, raf = 0, last = performance.now(), time = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(btn.offsetWidth * dpr));
    canvas.height = Math.max(1, Math.round(btn.offsetHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const draw = () => {
    gl.uniform2f(U.r, canvas.width, canvas.height);
    gl.uniform1f(U.t, time);
    gl.uniform2f(U.m, mx, my);
    gl.uniform1f(U.h, hover);
    gl.uniform1f(U.ring, (4.5 + 2.5 * hover) * Math.min(devicePixelRatio || 1, 2));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    hover += (target - hover) * Math.min(1, dt * 6);
    draw();
    raf = visible && !calm.matches ? requestAnimationFrame(frame) : 0;
  };
  const start = () => { if (!raf && visible && !calm.matches) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { size(); draw(); start(); } }).observe(btn);
  new ResizeObserver(() => { size(); draw(); }).observe(btn);
  calm.addEventListener('change', () => { draw(); start(); });

  btn.addEventListener('pointermove', (e) => {
    const b = btn.getBoundingClientRect();
    mx = (e.clientX - b.left) / b.width;
    my = 1 - (e.clientY - b.top) / b.height;
    target = 1;
    if (e.pointerType === 'mouse' && !calm.matches) {
      btn.style.setProperty('--tx', `${((mx - 0.5) * 14).toFixed(1)}px`);
      btn.style.setProperty('--ty', `${((0.5 - my) * 10).toFixed(1)}px`);
    }
    if (calm.matches) draw();
  });
  btn.addEventListener('pointerleave', () => {
    target = 0;
    btn.style.setProperty('--tx', '0px');
    btn.style.setProperty('--ty', '0px');
  });
}
document.querySelectorAll('.btn-metal').forEach(metal);
