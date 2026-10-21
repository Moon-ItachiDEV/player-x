// Toutes les images clés WAAPI des mises à jour, au même endroit. Toujours jouées par anim() (session.ts).
// WAAPI ne lit pas var() dans `easing` : les courbes de tokens.css sont recopiées ici.

export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  in: 'cubic-bezier(.4,0,1,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
  glide: 'cubic-bezier(.22,1,.36,1)',
  warp: 'cubic-bezier(.7,0,.84,0)',
  arrive: 'cubic-bezier(.16,1,.3,1)'
} as const

export interface KeyframeSet {
  frames: Keyframe[]
  opts: KeyframeAnimationOptions
}

/** Une animation à `fill: 'both'` (partagé avec les images clés du lancement, launch/keyframes.ts). */
export const k = (frames: Keyframe[], duration: number, easing: string, delay = 0): KeyframeSet => ({
  frames,
  opts: { duration, easing, delay, fill: 'both' }
})

export const KF = {
  // ---------- carte ----------
  cardIn: k([{ transform: 'translateY(14px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], 420, EASE.glide),
  cardInSober: k([{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.out),
  cardLeave: k([{ transform: 'none', opacity: 1 }, { transform: 'translateY(8px) scale(.98)', opacity: 0 }], 200, EASE.in),
  sheen: k([{ transform: 'translateX(-100%)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translateX(100%)', opacity: 0 }], 1100, EASE.inOut),
  rxSpinIn: k([{ transform: 'rotate(-120deg)', opacity: 0 }, { transform: 'rotate(0)', opacity: 1 }], 420, EASE.glide, 140),
  pingArrive: k([{ transform: 'scale(.6)', opacity: 0.8 }, { transform: 'scale(2.2)', opacity: 0 }], 700, EASE.out, 300),
  pingStage: k([{ transform: 'scale(.7)', opacity: 0.6 }, { transform: 'scale(2)', opacity: 0 }], 700, EASE.out),
  pingLock: k([{ transform: 'scale(.7)', opacity: 0.7 }, { transform: 'scale(2)', opacity: 0 }], 600, EASE.out),
  sparkPulse: k(
    [
      { transform: 'scale(1)', opacity: 0.6 },
      { transform: 'scale(1.7)', opacity: 1 },
      { transform: 'scale(1)', opacity: 0.6 }
    ],
    320,
    EASE.out
  ),
  /** Un paquet de lumière part de la tête de la barre (p %) et file vers le réacteur. */
  packet: (p: number, ms: number, i: number): KeyframeSet =>
    k([{ transform: `translateX(${p}%)`, opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { transform: 'translateX(0%)', opacity: 0 }], ms, EASE.in, i * 140),
  textIn: k([{ transform: 'translateY(4px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.out, 100),
  textOut: k([{ opacity: 1 }, { opacity: 0 }], 140, EASE.in),
  fpChar: (i: number): KeyframeSet => k([{ transform: 'translateY(2px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 140, EASE.out, i * 24),
  shieldIn: k([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 260, EASE.glide, 80),
  shieldFill: k([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 260, EASE.glide),
  stamp: k([{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 220, EASE.out, 140),
  shieldOut: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.8)', opacity: 0 }], 240, EASE.in, 600),
  glowSettle: k([{ opacity: 1 }, { opacity: 0.6 }], 500, EASE.out),
  glowTick: (critical: boolean): KeyframeSet => k([{ opacity: 0.6 }, { opacity: critical ? 1 : 0.85 }, { opacity: 0.6 }], 600, EASE.inOut),
  secIn: k([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220, EASE.glide),
  rise: (i: number): KeyframeSet => k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.glide, 600 + i * 60),
  /** Remplissage de « Redémarrer » pendant le compte à rebours (piloté par currentTime). */
  charge: (seconds: number): KeyframeSet => ({
    frames: [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
    opts: { duration: seconds * 1000, easing: 'linear', fill: 'both' }
  }),

  // ---------- saut (t = 0 quand la transition de vue est prête) ----------
  oldRoot: (cx: number, cy: number): KeyframeSet =>
    k(
      [
        { transform: 'scale(1)', opacity: 1, transformOrigin: `${cx}px ${cy}px` },
        { transform: 'scale(.92)', opacity: 0, transformOrigin: `${cx}px ${cy}px` }
      ],
      520,
      EASE.warp,
      40
    ),
  veilIn: k([{ opacity: 0 }, { opacity: 1 }], 520, EASE.warp, 40),
  flash: k([{ transform: 'scale(.2)', opacity: 0 }, { opacity: 0.85, offset: 0.35 }, { transform: 'scale(1.6)', opacity: 0 }], 200, EASE.out, 400),
  /** Le cœur du réacteur devient le logo : il part de (dx, dy) par rapport à sa place finale. */
  markFly: (dx: number, dy: number): KeyframeSet =>
    k(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 }
      ],
      360,
      EASE.glide,
      460
    ),
  ringLight: k([{ opacity: 0 }, { opacity: 1 }], 120, EASE.out, 600),
  ringOut: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], 180, EASE.out, 720),
  warpText: k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 200, EASE.glide, 760),
  canvasOut: k([{ opacity: 1 }, { opacity: 0 }], 120, EASE.out, 880),

  // ---------- retour (t = 0 à la fin de l'attente) ----------
  ringGroup: (g: number): KeyframeSet => k([{ opacity: 0 }, { opacity: 1 }], 180, EASE.out, g * 60),
  kicker: k([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.glide, 150),
  from: k([{ transform: 'translateX(-6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 260, EASE.glide, 250),
  toChar: (i: number, base = 350): KeyframeSet =>
    k([{ transform: 'translateY(.5em)', opacity: 0 }, { transform: 'none', opacity: 1 }], 360, EASE.glide, base + i * 40),
  chip: (i: number, base = 600): KeyframeSet => k([{ transform: 'translateY(4px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 240, EASE.glide, base + i * 60),
  skipIn: k([{ opacity: 0 }, { opacity: 1 }], 260, EASE.out, 500),
  contentOut: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.98)', opacity: 0 }], 240, EASE.in),
  ringExit: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], 400, EASE.in),
  shock: k([{ transform: 'scale(.3)', opacity: 0.5 }, { transform: 'scale(2.6)', opacity: 0 }], 500, EASE.out),
  markToRail: (dx: number, dy: number, s: number, ms = 600): KeyframeSet =>
    k([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], ms, EASE.glide),
  markFadeInPlace: k([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], 400, EASE.out),
  veilOut: (ms = 500, delay = 50): KeyframeSet => k([{ opacity: 1 }, { opacity: 0 }], ms, EASE.out, delay),
  fade: (ms: number, delay = 0): KeyframeSet => k([{ opacity: 0 }, { opacity: 1 }], ms, EASE.out, delay),
  fadeOut: (ms: number, delay = 0): KeyframeSet => k([{ opacity: 1 }, { opacity: 0 }], ms, EASE.out, delay)
} as const
