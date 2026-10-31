// Traînées d'hyperespace sur un canvas : aspiration vers le réacteur, éclatement depuis la marque (saut),
// sortie d'hyperespace (retour). Courtes (≤ 1 s), réglées sur l'horloge (une image perdue fait sauter, jamais ralentir),
// 3 traits par image, et elles s'arrêtent seules : aucune boucle ne survit à une course.

export type StreakMode = 'aspire' | 'burst' | 'arrive'

export interface StreakPhase {
  mode: StreakMode
  /** Début, en ms depuis le lancement de la course. */
  at: number
  dur: number
  /** Centre, en px de fenêtre. */
  origin: { x: number; y: number }
}

export interface StreakRun {
  /** Résolue une fois le canvas vidé et sa mémoire rendue (fin de la dernière phase ou stop()). */
  done: Promise<void>
  stop(): void
}

const MAX = 120
/** Si les 8 premières images dépassent 20 ms en moyenne, on passe à 60 traînées. */
const LOW = 60
const SLOW_FRAME = 20
/** Rose braise, rose clair et rose presque blanc de la console (px-icon.svg). Jamais de cyan : il est réservé au « en jeu ». */
const COLORS = ['#E04065', '#FF9CB1', '#FFE3E8'] as const
/** Motif de 20 : 14 roses, 5 roses clairs, 1 blanche. Chaque tranche de 20 garde le mélange, donc la première moitié aussi. */
const bucketOf = (i: number): number => (i % 20 === 0 ? 2 : i % 4 === 2 ? 1 : 0)
/** Indices de chaque couleur, croissants : couper à `count` garde les proportions. */
const BY_BUCKET: number[][] = [[], [], []]
for (let i = 0; i < MAX; i++) BY_BUCKET[bucketOf(i)].push(i)

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Courses en cours : la scène peut tout arrêter d'un coup (abandon, fin d'aperçu). */
const running = new Set<() => void>()

export function stopAllStreaks(): void {
  for (const stop of [...running]) stop()
}

export function runStreaks(canvas: HTMLCanvasElement, phases: StreakPhase[], o: { count?: number } = {}): StreakRun {
  const ctx = canvas.getContext('2d')
  if (!ctx || !phases.length) return { done: Promise.resolve(), stop: () => {} }

  // Données : un angle, un rayon de départ et une vitesse par traînée, tirés une fois.
  const cos = new Float32Array(MAX)
  const sin = new Float32Array(MAX)
  const r0 = new Float32Array(MAX)
  const v = new Float32Array(MAX)
  for (let i = 0; i < MAX; i++) {
    const theta = Math.random() * Math.PI * 2
    cos[i] = Math.cos(theta)
    sin[i] = Math.sin(theta)
    r0[i] = 0.25 + Math.random() * 0.75
    v[i] = 0.6 + Math.random() * 0.8
  }
  let count = Math.max(1, Math.min(MAX, o.count ?? MAX))

  // Taille : au plus 1,25 px par px CSS et 3 millions de pixels en mémoire.
  const w = innerWidth
  const h = innerHeight
  const dpr = Math.min(1.25, devicePixelRatio || 1, Math.sqrt(3e6 / Math.max(1, w * h)))
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  // Poser la taille remet l'état du contexte à zéro : réglages après.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineWidth = 1.25
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = 'lighter'

  /** Distance du centre au coin le plus éloigné de la fenêtre. */
  const far = ({ x, y }: { x: number; y: number }): number =>
    Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))
  const reach = phases.map((p) => far(p.origin))
  const end = Math.max(...phases.map((p) => p.at + p.dur))

  const start = performance.now()
  const stamps: number[] = []
  let raf = 0
  let stopped = false
  let resolve!: () => void
  const done = new Promise<void>((r) => (resolve = r))

  function draw(p: StreakPhase, R: number, tau: number): void {
    const { x: ox, y: oy } = p.origin
    let alpha: number
    let k = 0
    let e = 0
    if (p.mode === 'aspire') {
      k = tau * tau * tau
      alpha = 0.7 * Math.min(1, tau / 0.4)
    } else if (p.mode === 'burst') {
      alpha = 0.7 * (1 - smoothstep(0.6, 1, tau))
    } else {
      e = 1 - Math.pow(1 - tau, 4)
      alpha = 0.7 * (1 - tau * tau)
    }
    if (alpha <= 0.002) return
    ctx!.globalAlpha = alpha
    for (let b = 0; b < 3; b++) {
      ctx!.beginPath()
      for (const i of BY_BUCKET[b]) {
        if (i >= count) break
        let head: number
        let tail: number
        if (p.mode === 'aspire') {
          // Vers le centre, traînée tournée vers l'extérieur, qui s'allonge en plongeant.
          head = r0[i] * R * (1 - k)
          tail = head + (12 + 120 * k) * v[i]
        } else if (p.mode === 'burst') {
          // Depuis la marque, traînée tournée vers l'intérieur.
          head = (0.03 + v[i] * 1.3 * tau * tau) * R
          tail = Math.max(0, head - (0.05 + 0.5 * tau) * v[i] * 0.25 * R)
        } else {
          // Sortie d'hyperespace : la traînée ralentit et se réduit à un point.
          head = r0[i] * R * (0.7 + 0.3 * e)
          tail = Math.max(0, head - (1 - e) * 0.35 * R * v[i])
        }
        ctx!.moveTo(ox + cos[i] * head, oy + sin[i] * head)
        ctx!.lineTo(ox + cos[i] * tail, oy + sin[i] * tail)
      }
      ctx!.strokeStyle = COLORS[b]
      ctx!.stroke()
    }
  }

  function frame(now: number): void {
    if (stopped) return
    // Nombre adaptatif : moyenne des 8 premiers intervalles.
    if (stamps.length < 9) {
      stamps.push(now)
      if (stamps.length === 9 && (stamps[8] - stamps[0]) / 8 > SLOW_FRAME) count = Math.min(count, LOW)
    }
    const t = Math.max(0, now - start)
    if (t >= end) return stop()
    ctx!.clearRect(0, 0, w, h)
    const i = phases.findIndex((p) => t >= p.at && t < p.at + p.dur)
    if (i >= 0) draw(phases[i], reach[i], (t - phases[i].at) / phases[i].dur)
    raf = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (stopped) return
    stopped = true
    running.delete(stop)
    cancelAnimationFrame(raf)
    clearTimeout(safety)
    ctx!.clearRect(0, 0, w, h)
    // Rend la mémoire du canvas.
    canvas.width = 0
    canvas.height = 0
    resolve()
  }

  // Fenêtre masquée : plus d'images, mais la course se termine quand même.
  const safety = setTimeout(stop, end + 500)
  running.add(stop)
  raf = requestAnimationFrame(frame)
  return { done, stop }
}
