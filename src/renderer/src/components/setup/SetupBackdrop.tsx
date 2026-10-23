// Fond de l'écran de démarrage : mosaïque floutée des jaquettes détectées, puis l'image du jeu survolé.
// Tout est peint une fois dans de petites toiles que le CSS agrandit : aucun filtre CSS, seule l'opacité s'anime.
import { useEffect, useMemo, useRef } from 'react'
import { hue } from '@shared/text'
import type { Game } from '@shared/types'
import { fxOn, subscribeArt } from '../../motion'

const W = 240
const H = 135
const TILE_W = 56
const TILE_H = 84
const MAX_TILES = 12

interface Tile {
  name: string
  img: HTMLImageElement | null
}

function load(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  return img.decode().then(
    () => img,
    () => null
  )
}

/** Dessine l'image recadrée (object-fit: cover) dans le rectangle donné. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5): void {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * focusY, sw, sh, x, y, w, h)
}

/** Deux rangées de jaquettes décalées, floutées d'un coup (sans bords sombres entre elles). */
function paintMosaic(canvas: HTMLCanvasElement, tiles: Tile[]): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || tiles.length === 0) return
  const sheet = document.createElement('canvas')
  sheet.width = W
  sheet.height = H
  const sctx = sheet.getContext('2d')
  if (!sctx) return
  const cols = Math.ceil(W / TILE_W) + 1
  let i = 0
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[i++ % tiles.length]
      const x = c * TILE_W - (row ? TILE_W / 2 : 8)
      const y = row * TILE_H - 26
      if (t.img) drawCover(sctx, t.img, x, y, TILE_W, TILE_H)
      else {
        sctx.fillStyle = `hsl(${hue(t.name)} 45% 32%)`
        sctx.fillRect(x, y, TILE_W, TILE_H)
      }
    }
  }
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'blur(7px) saturate(1.45) brightness(0.6)'
  ctx.drawImage(sheet, -10, -10, W + 20, H + 20)
}

function paintFocus(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'blur(4px) saturate(1.5) brightness(0.5)'
  drawCover(ctx, img, -8, -8, W + 16, H + 16, 0.25)
}

/** Jeux de la mosaïque : favoris, puis joués récemment, puis ceux qui ont une jaquette. */
function pickTiles(games: Game[]): Game[] {
  const score = (g: Game): number => (g.favorite ? 4 : 0) + (g.lastPlayed ? 2 : 0) + (g.coverUrl ? 1 : 0)
  return [...games].sort((a, b) => score(b) - score(a)).slice(0, MAX_TILES)
}

export function SetupBackdrop({ games }: { games: Game[] }): React.JSX.Element {
  const mosaic = useRef<HTMLCanvasElement>(null)
  const a = useRef<HTMLCanvasElement>(null)
  const b = useRef<HTMLCanvasElement>(null)
  const picked = useMemo(() => pickTiles(games), [games])
  // Ne repeindre que si les images changent (les jaquettes arrivent en arrière-plan).
  const key = picked.map((g) => `${g.name}|${g.coverUrl ?? ''}`).join('\n')
  const pickedRef = useRef(picked)
  pickedRef.current = picked

  useEffect(() => {
    const canvas = mosaic.current
    const list = pickedRef.current
    if (!canvas || list.length === 0) return
    let alive = true
    Promise.all(list.map((g) => load(g.coverUrl))).then((imgs) => {
      if (!alive) return
      paintMosaic(
        canvas,
        list.map((g, i) => ({ name: g.name, img: imgs[i] }))
      )
      canvas.classList.add('is-on')
    })
    return () => {
      alive = false
    }
  }, [key])

  // Jeu survolé (useTilt appelle setArtFocus) : fondu enchaîné entre deux toiles.
  useEffect(() => {
    const ca = a.current
    const cb = b.current
    if (!ca || !cb) return
    const layers = [ca, cb]
    let front = 0
    let shown: string | null = null
    let token = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const show = async (url: string | null): Promise<void> => {
      const t = ++token
      if (!url || !fxOn()) {
        layers.forEach((l) => l.classList.remove('is-front'))
        shown = null
        return
      }
      if (url === shown) return
      const img = await load(url)
      if (!img || t !== token) return
      const back = layers[1 - front]
      paintFocus(back, img)
      back.classList.add('is-front')
      layers[front].classList.remove('is-front')
      front = 1 - front
      shown = url
    }

    const unsubscribe = subscribeArt(({ focus }) => {
      clearTimeout(timer)
      // Le pointeur se pose avant qu'on change le fond ; en sortie, pas d'éclair entre deux jaquettes.
      timer = setTimeout(() => void show(focus), focus ? 160 : 420)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
      token++
    }
  }, [])

  return (
    <div className="setup-bg" aria-hidden="true">
      <div className="setup-bg-glow fx-loop" />
      <canvas ref={mosaic} className="setup-bg-art setup-bg-mosaic" width={W} height={H} />
      <canvas ref={a} className="setup-bg-art setup-bg-focus" width={W} height={H} />
      <canvas ref={b} className="setup-bg-art setup-bg-focus" width={W} height={H} />
      <div className="setup-bg-shade" />
    </div>
  )
}
