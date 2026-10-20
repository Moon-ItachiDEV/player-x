// Images clés WAAPI du lancement, toujours jouées par anim() (update/session.ts). Seulement transform et opacity.
// Mêmes courbes que la mise à jour (update/keyframes.ts).
import { EASE, k, type KeyframeSet } from '../update/keyframes'

export const LKF = {
  // ---------- mise à feu (Full) ----------
  veilIn: k([{ opacity: 0 }, { opacity: 1 }], 180, EASE.out),
  bandIn: k([{ transform: 'translateX(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.glide, 40),
  /** Sans source utilisable : la jaquette apparaît sur place. */
  posterIn: k([{ transform: 'scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220, EASE.glide),
  /** Prise : la jaquette quitte l'endroit cliqué. `fade` : proportions trop différentes, elle apparaît pendant les 90 premières ms. */
  posterFrom: (dx: number, dy: number, s: number, fade: boolean): KeyframeSet =>
    k(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: fade ? 0 : 1 },
        ...(fade ? [{ opacity: 1, offset: 90 / 280 }] : []),
        { transform: 'none', opacity: 1 }
      ],
      280,
      EASE.glide
    ),
  textRise: (i: number): KeyframeSet => k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220, EASE.out, 100 + i * 40),
  /** Mise à feu : l'onde part de la jaquette au moment où Windows transmet le lien. */
  shock: k([{ transform: 'scale(.7)', opacity: 0.6 }, { transform: 'scale(1.8)', opacity: 0 }], 440, EASE.out),
  sheen: k([{ transform: 'translateX(-120%)', opacity: 0 }, { opacity: 0.3, offset: 0.5 }, { transform: 'translateX(120%)', opacity: 0 }], 360, EASE.inOut, 40),
  // ---------- départ vers la carte ----------
  textOut: k([{ opacity: 1 }, { opacity: 0 }], 140, EASE.in),
  stageOut: k([{ opacity: 1 }, { opacity: 0 }], 220, EASE.in),
  posterTo: (dx: number, dy: number, s: number): KeyframeSet =>
    k([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], 280, EASE.inOut),
  cardLand: k([{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.out, 60),
  /** Fenêtre quittée, clic, molette ou Échap pendant la scène : fondu court, jamais de coupure nette. */
  skipFade: k([{ opacity: 1 }, { opacity: 0 }], 160, EASE.out),
  // ---------- carte ----------
  /** Effets coupés, ou mise à feu déjà vue : la jaquette glisse de l'endroit cliqué jusqu'à la vignette. */
  thumbGlide: (dx: number, dy: number, s: number): KeyframeSet => k([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], 280, EASE.glide),
  /** Lien transmis après la scène : le filet de la carte s'allume une fois. */
  ignite: k([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], 280, EASE.out),
  /** Clic sur un jeu déjà en cours de lancement : un reflet passe sur la carte. */
  cardSheen: k([{ transform: 'translateX(-100%)', opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'translateX(100%)', opacity: 0 }], 600, EASE.inOut)
} as const
