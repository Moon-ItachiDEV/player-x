// Player X — mode « ciné » de la landing (GSAP + ScrollTrigger + SplitText, hébergés sur le site).
// Seulement quand boot.js a posé html.cine (ordinateur, souris, mouvement non réduit). Sinon la page reste celle du CSS.
// Scènes : plongée dans le mur → QG + visite guidée, bandeau à la vitesse, titres lettre par lettre,
// jaquettes qui atterrissent, galerie horizontale, Alt+X qui allume l'overlay, charge finale.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('cine')) return;
  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) { root.classList.remove('cine'); return; }
  const { gsap, ScrollTrigger, SplitText, CustomEase } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('braise', 'M0,0 C0.16,1 0.3,1 1,1');
  ScrollTrigger.config({ ignoreMobileResize: true });
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rand = gsap.utils.random;
  // Un dégradé coupé en morceaux se perd : chaque mot (ou lettre) reçoit son propre dégradé.
  const gradWords = (el) => {
    if (!el) return [];
    const sp = new SplitText(el, { type: 'words', wordsClass: 'gw' });
    el.classList.add('gsplit');
    return sp.words;
  };

  const start = () => {
    root.classList.add('cine-on');
    dive();
    band();
    titles();
    tiles();
    gallery();
    overlay();
    finale();
    addEventListener('load', () => ScrollTrigger.refresh());
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);

  // ─── 1. Plongée dans le mur, puis le QG et sa visite guidée (une seule scène épinglée) ───
  function dive() {
    const hero = $('.hero');
    const reveal = $('.reveal');
    const wall = $('.wall');
    const screen = $('.reveal .screen');
    hero.appendChild(reveal);
    const dark = document.createElement('i');
    dark.className = 'dive-dark';
    hero.insertBefore(dark, reveal);
    const veil = document.createElement('i');
    veil.className = 'tourveil';
    screen.appendChild(veil);
    const stops = [
      { t: 'Le jeu à la une', x: 0.36, y: 0.38 },
      { t: 'Les patchs de tes jeux', x: 0.66, y: 0.33 },
      { t: 'Ta dernière session', x: 0.84, y: 0.24 },
      { t: 'Ta bibliothèque, à la molette', x: 0.5, y: 0.84 }
    ];
    const cap = document.createElement('p');
    cap.className = 'tourcap mega';
    cap.setAttribute('aria-hidden', 'true');
    cap.innerHTML = stops.map((s) => `<span>${s.t}</span>`).join('');
    hero.appendChild(cap);
    const caps = $$('span', cap);

    const h1a = new SplitText($('#t-hero > span:not(.grad)'), { type: 'chars', charsClass: 'ch' });
    const h1b = gradWords($('#t-hero .grad'));
    const h1 = { chars: [...h1a.chars, ...h1b] };
    const qg = new SplitText($('#t-qg'), { type: 'words', wordsClass: 'gw' });
    $('#t-qg .grad')?.classList.add('gsplit');
    const hc = hero.getBoundingClientRect();
    const cx = hc.left + hc.width / 2;

    gsap.set(wall, { transformPerspective: 1400, rotationX: 24, rotationZ: -14, scale: 1.08, transformOrigin: '60% 50%' });
    gsap.set(screen, { transformPerspective: 1600, scale: 0.22, rotationX: 42, y: 140, opacity: 0, transformOrigin: '50% 60%' });
    gsap.set(qg.words, { yPercent: 120, opacity: 0 });
    gsap.set('.reveal-head p', { opacity: 0, y: 20 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: '+=720%', pin: true, scrub: 1, anticipatePin: 1 }
    });
    // le titre éclate, le reste tombe
    tl.to(h1.chars, {
      x: (i, el) => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2 - cx) * 1.8; },
      y: () => rand(-260, 260), rotation: () => rand(-50, 50), z: 400, opacity: 0,
      duration: 1.1, ease: 'power2.in', stagger: { amount: 0.35, from: 'center' }
    }, 0)
      .fromTo(['.hero .wordmark', '.hero .lead', '.hero .cta-row', '.facts li'], { y: 0, opacity: 1 }, { y: 120, opacity: 0, duration: 0.7, ease: 'power2.in', stagger: 0.05 }, 0)
      // la caméra entre dans le mur
      .to(wall, { rotationX: 4, rotationZ: -6, scale: 2.8, duration: 2.4, ease: 'power2.in' }, 0.25)
      .to($$('.wall-row'), { '--ry': (i) => (i % 2 ? '160%' : '-160%'), duration: 2.2, ease: 'power2.in' }, 0.55)
      .to(dark, { opacity: 0.94, duration: 1.1 }, 1.6)
      // la fenêtre de Player X fonce vers nous en se redressant
      .to(screen, { scale: 1, rotationX: 0, y: 0, opacity: 1, duration: 1.7, ease: 'power3.out' }, 1.35)
      .to(qg.words, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'braise', stagger: 0.08 }, 2.6)
      .to('.reveal-head p', { opacity: 1, y: 0, duration: 0.5 }, 2.8)
      .to({}, { duration: 0.6 });
    // visite guidée : zoom sur chaque zone, le reste s'assombrit, la légende devient un grand titre
    stops.forEach((s, i) => {
      const at = `stop${i}`;
      const k = 1.6;
      tl.addLabel(at)
        .to(screen, { scale: k, xPercent: -(s.x - 0.5) * k * 100, yPercent: -(s.y - 0.5) * k * 100, duration: 1.2, ease: 'power2.inOut' }, at)
        .to(veil, { opacity: 1, '--fx': `${s.x * 100}%`, '--fy': `${s.y * 100}%`, '--fr': '13%', duration: 1.2, ease: 'power2.inOut' }, at)
        .to(['.reveal-head'], { opacity: 0, duration: 0.4 }, at)
        .fromTo(caps[i], { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'braise' }, `${at}+=0.5`)
        .to({}, { duration: 0.7 });
      if (i < stops.length - 1) tl.to(caps[i], { yPercent: -60, opacity: 0, duration: 0.4 }, `stop${i}+=1.9`);
    });
    tl.addLabel('wide')
      .to(screen, { scale: 1, xPercent: 0, yPercent: 0, duration: 1.2, ease: 'power2.inOut' }, 'wide')
      .to(veil, { opacity: 0, duration: 1 }, 'wide')
      .to(caps[stops.length - 1], { yPercent: -60, opacity: 0, duration: 0.4 }, 'wide')
      .to('.reveal-head', { opacity: 1, duration: 0.6 }, 'wide+=0.5')
      .to({}, { duration: 0.6 });
  }

  // ─── 2. Bandeau qui suit la vitesse et le sens du défilement ───
  function band() {
    const track = $('.band-track');
    if (!track) return;
    const loop = gsap.to(track, { xPercent: -50, repeat: -1, ease: 'none', duration: 38 });
    const skew = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    let dir = 1;
    ScrollTrigger.create({
      onUpdate(self) {
        const v = self.getVelocity();
        dir = self.direction;
        gsap.to(loop, { timeScale: dir * (1 + Math.min(Math.abs(v) / 300, 7)), duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, overwrite: false });
        skew(gsap.utils.clamp(-14, 14, v / -220));
      }
    });
    ScrollTrigger.addEventListener('scrollEnd', () => skew(0));
  }

  // ─── 3. Titres qui sortent d'une fente, lettre par lettre, et se penchent avec la vitesse ───
  const galTitles = [];
  function titles() {
    const heads = $$('.feat h2.mega, .ovs h2.mega, .how .mega:not(.grad)');
    const skews = [];
    heads.forEach((el) => {
      const sp = new SplitText(el, { type: 'chars', mask: 'chars', charsClass: 'ch' });
      gsap.set(sp.chars, { yPercent: 115, rotation: 8 });
      if (el.closest('.hgal')) { galTitles.push({ el, chars: sp.chars }); return; }
      gsap.to(sp.chars, { yPercent: 0, rotation: 0, duration: 0.8, ease: 'braise', stagger: 0.03, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      skews.push(gsap.quickTo(el, 'skewX', { duration: 0.6, ease: 'power3' }));
    });
    gsap.set('.how .mega.grad', { yPercent: 0 });
    ScrollTrigger.create({
      onUpdate(self) { const s = gsap.utils.clamp(-10, 10, self.getVelocity() / -300); skews.forEach((f) => f(s)); }
    });
    ScrollTrigger.addEventListener('scrollEnd', () => skews.forEach((f) => f(0)));
  }

  // ─── 4. « Joue. » : les jaquettes arrivent de la profondeur et se posent ───
  function tiles() {
    const list = $$('.tile');
    if (!list.length) return;
    gsap.fromTo(list,
      { '--lz': () => `${rand(-900, -300)}px`, '--ly': () => `${rand(80, 220)}px`, '--lry': () => `${rand(-28, 28)}deg`, '--lrx': '24deg', '--lo': 0 },
      { '--lz': '0px', '--ly': '0px', '--lry': '0deg', '--lrx': '0deg', '--lo': 1, ease: 'power3.out', stagger: { amount: 0.5, from: 'random' },
        scrollTrigger: { trigger: '.tiles', start: 'top 95%', end: 'top 35%', scrub: 1 } });
  }

  // ─── 5. Galerie horizontale : Analyse, Débloque, À jour ───
  function gallery() {
    const wrap = $('.hgal');
    const track = $('.hgal-track');
    if (!wrap || !track) return;
    const dist = () => track.scrollWidth - innerWidth;
    const gal = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: wrap, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    $$('.hgal .feat').forEach((sec, i) => {
      const shot = $('.feat-shot .screen', sec);
      const flip = sec.classList.contains('flip');
      gsap.fromTo(shot, { rotationY: flip ? 22 : -22, x: flip ? -140 : 140, opacity: 0, transformPerspective: 1600 },
        { rotationY: 0, x: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: sec, containerAnimation: gal, start: i ? 'left 85%' : 'left 100%', end: 'left 25%', scrub: 1 } });
      const t = galTitles.find((g) => sec.contains(g.el));
      if (t) gsap.to(t.chars, { yPercent: 0, rotation: 0, duration: 0.8, ease: 'braise', stagger: 0.03, scrollTrigger: { trigger: sec, containerAnimation: gal, start: i ? 'left 65%' : 'left 100%', once: true } });
      const p = $('.feat-txt p', sec);
      if (p && i) gsap.from(p, { opacity: 0, y: 30, duration: 0.7, ease: 'braise', scrollTrigger: { trigger: sec, containerAnimation: gal, start: 'left 55%', once: true } });
    });
  }

  // ─── 6. Overlay : Alt+X s'enfonce, la scène s'ouvre, les panneaux s'allument ───
  function overlay() {
    const sec = $('.ovs');
    if (!sec) return;
    const keys = $$('.ovs-keys kbd');
    const frame = $('.ovs-frame');
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: '+=170%', pin: true, scrub: 1, anticipatePin: 1 } });
    tl.fromTo(frame, { clipPath: 'inset(14% 18% 14% 18% round 22px)', scale: 0.92 }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', scale: 1, duration: 1, ease: 'power2.inOut' }, 0)
      .to(keys, { y: '0.1em', boxShadow: 'inset 0 -0.02em 0 rgba(0,0,0,0.6), 0 0 0 #4a1630, 0 0 0 0.03em rgba(255,200,220,0.5), 0 0 1.2em rgba(255,92,134,0.9)', duration: 0.25, stagger: 0.12 }, 0.8)
      .to(keys, { y: 0, duration: 0.25, stagger: 0.12 }, 1.15)
      .fromTo('.ovs-scan', { top: '-20%', opacity: 0 }, { top: '110%', opacity: 1, duration: 0.9, ease: 'power1.inOut' }, 1.2)
      .fromTo('.ovs-p', { opacity: 0, clipPath: 'inset(0 100% 0 0 round 6px)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0 round 6px)', duration: 0.6, ease: 'power4.out', stagger: 0.2 }, 1.35)
      .to('.ovs-base img', { filter: 'brightness(0.62) saturate(0.85)', duration: 0.8 }, 2)
      .to({}, { duration: 0.6 });
  }

  // ─── 7. Charge finale : les étapes se remplissent, l'anneau se charge, tout s'allume, le bouton surgit ───
  function finale() {
    gsap.fromTo('.how li', { '--fill': 0 }, { '--fill': 1, ease: 'none', stagger: 0.35, scrollTrigger: { trigger: '.how', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } });
    const sec = $('.final');
    const h2 = $('#t-go');
    $$('.grad', h2).forEach((g) => g.classList.add('gsplit-ch'));
    const sp = new SplitText(h2, { type: 'chars', charsClass: 'ch' });
    const icon = $('.final-icon');
    const btn = $('.final .btn-aura');
    const meta = $('.final .meta');
    const flash = $('.final .flash');
    let fired = false;
    gsap.set(sp.chars, { opacity: 0.18 });
    gsap.set('.ring-fg', { strokeDashoffset: 1 });
    gsap.set(icon, { filter: 'grayscale(1) brightness(0.45)' });
    gsap.set([btn, meta], { opacity: 0.25, scale: 0.94 });
    const burst = () => {
      gsap.timeline()
        .fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out' })
        .to(flash, { opacity: 0, duration: 0.6, ease: 'power2.in' })
        .fromTo(icon, { scale: 1.18 }, { scale: 1, duration: 0.8, ease: 'back.out(1.6)' }, 0)
        .to([btn, meta], { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.06 }, 0.05)
        .add(() => { btn.classList.add('is-lit'); setTimeout(() => btn.classList.remove('is-lit'), 1600); }, 0.1);
    };
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sec, start: 'top top', end: '+=130%', pin: true, scrub: 0.6, anticipatePin: 1,
        onUpdate(self) { if (self.progress > 0.97 && !fired) { fired = true; burst(); } if (self.progress < 0.5) fired = false; }
      }
    })
      .to('.ring-fg', { strokeDashoffset: 0, duration: 1 }, 0)
      .to(icon, { filter: 'grayscale(0) brightness(1)', duration: 1 }, 0)
      .to(sp.chars, { opacity: 1, stagger: 0.06, duration: 0.3 }, 0.1);
  }
})();
