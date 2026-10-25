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
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float h;
void main() {
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = uv * vec2(r.x / r.y, 1.0) * 1.6;
  float k = t * (0.45 + 0.9 * h);
  p += 0.55 * vec2(sin(p.y * 2.3 + k * 1.3), cos(p.x * 1.9 - k));
  p += 0.35 * vec2(sin(p.y * 4.1 - k * 0.8), cos(p.x * 3.3 + k * 1.2));
  float v = sin(p.x * 2.6 + p.y * 1.4 + k * 1.7) + 0.5 * sin(p.y * 5.0 - k);
  float c = 0.5 + 0.5 * sin(v * 2.6 + (uv.y - 0.5) * 7.0);
  c = pow(c, 1.5);
  vec3 col = mix(vec3(0.08, 0.05, 0.08), vec3(0.74, 0.69, 0.74), smoothstep(0.08, 0.62, c));
  col = mix(col, vec3(1.0), smoothstep(0.78, 1.0, c));
  vec3 tint = mix(vec3(1.0, 0.54, 0.50), vec3(0.88, 0.13, 0.49), uv.x);
  col = mix(col, col * tint * 1.45, 0.5);
  float d = distance(uv * vec2(r.x / r.y, 1.0), m * vec2(r.x / r.y, 1.0));
  col += smoothstep(0.7, 0.0, d) * (0.15 + 0.6 * h) * vec3(1.0, 0.82, 0.9);
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
  const U = { r: gl.getUniformLocation(prog, 'r'), t: gl.getUniformLocation(prog, 't'), m: gl.getUniformLocation(prog, 'm'), h: gl.getUniformLocation(prog, 'h') };
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
