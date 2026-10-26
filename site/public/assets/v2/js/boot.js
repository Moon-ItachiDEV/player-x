// Mode « ciné » (GSAP) seulement sur ordinateur, fenêtre assez haute, souris, mouvement non réduit.
// Si GSAP ne se charge pas dans les 3 s, la page reste en mode simple (tout le contenu marche sans).
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  if (!matchMedia('(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference) and (hover: hover)').matches) return;
  d.classList.add('cine');
  setTimeout(function () { if (!window.gsap || !window.ScrollTrigger || !d.classList.contains('cine-on')) d.classList.remove('cine'); }, 3000);
})();
