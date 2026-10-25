// Player X — petit script de la landing. Tout le contenu marche sans lui.
// 1. bascule le mode épinglé quand la fenêtre change ; 2. suit l’étape active (aria-current du sommaire,
// repli quand animation-timeline manque) ; 3. « Envoie le lien sur ton PC » sur mobile.

const root = document.documentElement;
const pinQuery = matchMedia('(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)');
pinQuery.addEventListener('change', (e) => { root.classList.toggle('pin', e.matches); update(); });

const scene = document.querySelector('.scene');
const steps = [...scene.querySelectorAll(':scope > .step')];
const toc = [...document.querySelectorAll('.toc a')];

let ticking = false;
function update() {
  ticking = false;
  if (!root.classList.contains('pin')) return;
  const mid = innerHeight / 2;
  let step = steps.findIndex((el) => { const r = el.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
  if (step < 0) step = steps[0].getBoundingClientRect().top > mid ? 0 : steps.length - 1;
  if (scene.dataset.step === String(step)) return;
  scene.dataset.step = step;
  toc.forEach((a, i) => (i === step ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
addEventListener('resize', update, { passive: true });
update();

// Mobile : Player X est pour Windows, on envoie le lien vers son PC.
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
