#!/usr/bin/env node
// Construit l'installeur sur mesure (installer/, Go + WebView2) autour de l'installeur NSIS déjà produit par electron-builder.
//   node scripts/build-installer.mjs <installeur NSIS .exe> <dossier win-unpacked> <version> <sortie .exe>
// Il ne signe rien et ne touche pas aux fichiers des mises à jour (latest.yml, .blockmap, .sig) : c'est un fichier en plus,
// pour une première installation. Go doit être installé (go build, compilation croisée possible depuis Linux).
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [setup, unpacked, version, out] = process.argv.slice(2)
if (!setup || !unpacked || !version || !out) {
  console.error('usage : node scripts/build-installer.mjs <installeur NSIS .exe> <dossier win-unpacked> <version> <sortie .exe>')
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'installer')
const payload = join(dir, 'payload')
mkdirSync(payload, { recursive: true })

/** Taille installée : somme des fichiers du dossier win-unpacked (la progression la suit pendant la copie). */
function size(p) {
  const st = statSync(p)
  if (!st.isDirectory()) return st.size
  return readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0)
}

copyFileSync(resolve(setup), join(payload, 'setup.exe'))
copyFileSync(join(root, 'src/renderer/src/assets/px-icon.png'), join(payload, 'icon.png'))
writeFileSync(join(payload, 'info.json'), JSON.stringify({ version, size: size(resolve(unpacked)) }))

// Polices de l'appli (Inter, Sora) intégrées à la page : rien n'est chargé depuis Internet.
const font = (pkg, file, family, weight) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`
}
const fonts = [
  ...[400, 500, 600, 700].map((w) => font('inter', `inter-latin-${w}-normal.woff2`, 'Inter', w)),
  ...[600, 700].map((w) => font('sora', `sora-latin-${w}-normal.woff2`, 'Sora', w))
].join('\n')
const page = readFileSync(join(dir, 'ui/index.html'), 'utf8').replace('/*__PX_FONTS__*/', fonts)
writeFileSync(join(dir, 'ui/page.html'), page)

execFileSync('go', ['build', '-mod=vendor', '-trimpath', '-ldflags', '-H windowsgui -s -w', '-o', resolve(out), '.'], {
  cwd: dir,
  stdio: 'inherit',
  env: { ...process.env, GOOS: 'windows', GOARCH: 'amd64', CGO_ENABLED: '0', GOFLAGS: '-mod=vendor' }
})
console.log(`Installeur sur mesure : ${out} (${(statSync(out).size / 1048576).toFixed(1)} Mo)`)
