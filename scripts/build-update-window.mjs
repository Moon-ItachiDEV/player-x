#!/usr/bin/env node
// Construit la fenêtre « Mise à jour de Player X » (installer/cmd/update, Go + WebView2) avant electron-builder :
// elle est rangée dans l'appli (resources/update-window/player-x-update.exe, voir "extraResources" dans package.json).
//   node scripts/build-update-window.mjs [sortie .exe]     (par défaut : build/update-window/player-x-update.exe)
//   node scripts/build-update-window.mjs --ci <dossier>    construction puis essai sur Windows (GitHub Actions) : mise à jour
//       simulée de bout en bout, captures dans <dossier>. En cas d'échec, la fenêtre est retirée (pas livrée) et le script
//       se termine sans erreur : la version sort quand même, ses mises à jour s'installent comme avant (sans fenêtre).
// Go doit être installé (compilation croisée possible depuis Linux). Sans la fenêtre, les mises à jour s'installent comme avant.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ci = process.argv[2] === '--ci' ? resolve(process.argv[3] ?? 'update-window') : null
const out = resolve((!ci && process.argv[2]) || join(root, 'build/update-window/player-x-update.exe'))
const mod = join(root, 'installer')
const dir = join(mod, 'cmd/update')
mkdirSync(dirname(out), { recursive: true })
mkdirSync(join(dir, 'payload'), { recursive: true })
copyFileSync(join(root, 'src/renderer/src/assets/px-icon.png'), join(dir, 'payload/icon.png'))

// Polices de l'appli (Inter, Sora) intégrées à la page : rien n'est chargé depuis Internet.
const font = (pkg, file, family, weight) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`
}
const fonts = [
  ...[400, 500, 600, 700].map((w) => font('inter', `inter-latin-${w}-normal.woff2`, 'Inter', w)),
  ...[600, 700].map((w) => font('sora', `sora-latin-${w}-normal.woff2`, 'Sora', w))
].join('\n')
writeFileSync(join(dir, 'ui/page.html'), readFileSync(join(dir, 'ui/index.html'), 'utf8').replace('/*__PX_FONTS__*/', fonts))

/** Sans fenêtre livrée : avertissement dans GitHub Actions, et la construction de Player X continue. */
function drop(why) {
  rmSync(out, { force: true })
  console.log(`::warning::Fenêtre de mise à jour non livrée (${why}) : les mises à jour de cette version s'installeront sans elle.`)
  process.exit(0)
}

try {
  execFileSync('go', ['build', '-mod=vendor', '-trimpath', '-ldflags', '-H windowsgui -s -w', '-o', out, './cmd/update'], {
    cwd: mod,
    stdio: 'inherit',
    env: { ...process.env, GOOS: 'windows', GOARCH: 'amd64', CGO_ENABLED: '0', GOFLAGS: '-mod=vendor' }
  })
} catch (e) {
  if (!ci) throw e
  drop('construction impossible')
}
console.log(`Fenêtre de mise à jour : ${out} (${(statSync(out).size / 1048576).toFixed(1)} Mo)`)

if (ci) {
  if (process.platform !== 'win32') drop('essai possible seulement sous Windows')
  mkdirSync(ci, { recursive: true })
  for (const mode of ['--selftest', '--selftest-norelaunch']) {
    const dir = join(ci, mode.slice(2))
    mkdirSync(dir, { recursive: true })
    try {
      const log = execFileSync(out, [mode, dir], { encoding: 'utf8', timeout: 90_000 })
      console.log(`Essai ${mode} :\n${log}`)
    } catch (e) {
      console.log(`Essai ${mode} :\n${e.stdout ?? ''}${e.stderr ?? ''}`)
      drop(`essai ${mode} raté`)
    }
  }
}
