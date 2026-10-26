// Tests du passage de relais (npm run test:update) : lanceur intégré à Node, aucune dépendance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Node exige l'extension ; TypeScript ne la permet que via allowImportingTsExtensions, absent du tsconfig de l'appli.
// @ts-ignore TS5097
import { MAX_BACK_MS, MAX_INSTALL_DELAY, clampDelay, isLast, isPending, isWindowDir, lastFromPending, visibleBounds, type PendingUpdate } from './updateHandoff.ts'

const FP = 'ab'.repeat(64)
const pending = (over: Partial<PendingUpdate> = {}): PendingUpdate => ({
  from: '0.5.1',
  to: '0.6.0',
  fingerprint: FP,
  size: 96_888_422,
  downloadMs: 38_000,
  quitAt: 1_000_000,
  relaunch: true,
  ...over
})

test('clampDelay : borné entre 0 et 1500, nombres seulement', () => {
  assert.equal(clampDelay(undefined), 0)
  assert.equal(clampDelay(-5), 0)
  assert.equal(clampDelay(1200), 1200)
  assert.equal(clampDelay(99999), MAX_INSTALL_DELAY)
  assert.equal(MAX_INSTALL_DELAY, 1500)
  assert.equal(clampDelay(NaN), 0)
  assert.equal(clampDelay(Infinity), 0)
  assert.equal(clampDelay('1200'), 0)
  assert.equal(clampDelay(449.6), 450)
})

test('isPending : accepte un enregistrement complet ou minimal', () => {
  assert.equal(isPending(pending()), true)
  assert.equal(isPending({ from: '0.5.1', to: '0.6.0', quitAt: 0, relaunch: false }), true)
})

test('isPending : refuse ce qui est mal formé', () => {
  assert.equal(isPending(pending({ fingerprint: 'AB'.repeat(64) })), false)
  assert.equal(isPending(pending({ fingerprint: 'ab'.repeat(63) })), false)
  assert.equal(isPending(pending({ fingerprint: 'zz'.repeat(64) })), false)
  const { relaunch: _r, ...noRelaunch } = pending()
  assert.equal(isPending(noRelaunch), false)
  assert.equal(isPending(pending({ quitAt: -1 })), false)
  assert.equal(isPending(pending({ size: -1 })), false)
  assert.equal(isPending(pending({ downloadMs: NaN })), false)
  assert.equal(isPending(pending({ from: '' })), false)
  assert.equal(isPending(pending({ to: 'x'.repeat(65) })), false)
  assert.equal(isPending(null), false)
  assert.equal(isPending('0.6.0'), false)
  assert.equal(isPending([]), false)
})

test('isPending : dossier de la fenêtre de mise à jour facultatif', () => {
  assert.equal(isPending(pending({ window: 'C:\\Users\\a\\AppData\\Local\\Temp\\PlayerXUpdate\\1761440000000' })), true)
  assert.equal(isPending(pending({ window: '' })), false)
  assert.equal(isPending(pending({ window: 'x'.repeat(501) })), false)
  assert.equal(isPending({ ...pending(), window: 42 }), false)
})

test('isWindowDir : seulement un sous-dossier numéroté du dossier de la fenêtre', () => {
  const root = 'C:\\Temp\\PlayerXUpdate'
  assert.equal(isWindowDir(root + '\\1761440000000', root, '\\'), true)
  assert.equal(isWindowDir(root + '\\..\\1761440000000', root, '\\'), false)
  assert.equal(isWindowDir(root + '\\1761440000000\\x', root, '\\'), false)
  assert.equal(isWindowDir(root + 'X\\1761440000000', root, '\\'), false)
  assert.equal(isWindowDir('D:\\autre\\1761440000000', root, '\\'), false)
  assert.equal(isWindowDir(root, root, '\\'), false)
  assert.equal(isWindowDir(undefined, root, '\\'), false)
  assert.equal(isWindowDir('/tmp/PlayerXUpdate/1761440000000', '/tmp/PlayerXUpdate', '/'), true)
})

test('lastFromPending : version différente → null', () => {
  assert.equal(lastFromPending(pending(), '0.5.1', 1_012_000), null)
})

test('lastFromPending : redémarrage en 12 s → backMs 12000, thisBoot', () => {
  const last = lastFromPending(pending(), '0.6.0', 1_012_000)
  assert.deepEqual(last, {
    from: '0.5.1',
    to: '0.6.0',
    fingerprint: FP,
    size: 96_888_422,
    downloadMs: 38_000,
    installedAt: 1_012_000,
    relaunch: true,
    backMs: 12_000,
    thisBoot: true
  })
})

test('lastFromPending : pas de backMs sans relance, trop long ou négatif', () => {
  assert.equal(lastFromPending(pending({ relaunch: false }), '0.6.0', 1_012_000)?.backMs, undefined)
  assert.equal(lastFromPending(pending(), '0.6.0', 1_000_000 + 200_000)?.backMs, undefined)
  assert.equal(lastFromPending(pending(), '0.6.0', 1_000_000 + MAX_BACK_MS)?.backMs, MAX_BACK_MS)
  assert.equal(lastFromPending(pending(), '0.6.0', 999_000)?.backMs, undefined)
  assert.equal(lastFromPending(pending(), '0.6.0', 1_000_000)?.backMs, undefined)
  assert.equal(lastFromPending(pending({ relaunch: false }), '0.6.0', 1_012_000)?.thisBoot, true)
})

test('isLast : relit seulement une dernière mise à jour bien formée', () => {
  const last = lastFromPending(pending(), '0.6.0', 1_012_000)
  assert.equal(isLast(last), true)
  assert.equal(isLast({ ...last, thisBoot: false }), true)
  assert.equal(isLast({ from: '0.5.1', to: '0.6.0', installedAt: 1, relaunch: false }), true)
  assert.equal(isLast({ ...last, backMs: -1 }), false)
  assert.equal(isLast({ ...last, fingerprint: 'nope' }), false)
  assert.equal(isLast({ ...last, installedAt: undefined }), false)
  assert.equal(isLast('0.6.0'), false)
  assert.equal(isLast(null), false)
})

test('visibleBounds : garde une position visible, refuse le reste', () => {
  const screen = [{ x: 0, y: 0, width: 1920, height: 1040 }]
  const b = { x: 100, y: 50, width: 1440, height: 900, maximized: false }
  assert.deepEqual(visibleBounds(b, screen), b)
  assert.deepEqual(visibleBounds({ ...b, x: 100.4, maximized: true }, screen), { ...b, maximized: true })
  // Trop petite, hors écran (écran débranché), barre de titre au-dessus de l'écran, mal formée.
  assert.equal(visibleBounds({ ...b, width: 800 }, screen), null)
  assert.equal(visibleBounds({ ...b, x: 1900 }, screen), null)
  assert.equal(visibleBounds({ ...b, x: -1400 }, screen), null)
  assert.equal(visibleBounds({ ...b, y: -100 }, screen), null)
  assert.equal(visibleBounds({ ...b, y: 1000 }, screen), null)
  assert.equal(visibleBounds({ ...b, x: '100' }, screen), null)
  assert.equal(visibleBounds({ ...b, maximized: undefined }, screen), null)
  assert.equal(visibleBounds(null, screen), null)
  assert.equal(visibleBounds(b, []), null)
  // Second écran à gauche : coordonnées négatives.
  assert.deepEqual(visibleBounds({ ...b, x: -1700 }, [...screen, { x: -1920, y: 0, width: 1920, height: 1040 }]), { ...b, x: -1700 })
})
