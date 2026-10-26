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
