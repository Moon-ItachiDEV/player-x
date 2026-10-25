// Tests des notes de « Quoi de neuf » (npm run test:update) : zéro doublon, versions de test seulement pour leur canal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
// @ts-ignore TS5097
import { parseNotes, releasesUpTo } from './releaseNotes.ts'

const BETA_BOX = `## Version de test (canal Bêta)

Tu la reçois parce que tu as choisi **Paramètres › À propos › Canal › Bêta**.
`
const INSTALL = `## Installer

Si tu as déjà la 0.4.0 ou plus récente, rien à faire : la mise à jour arrive toute seule.
`

test('sections : Installer et l’encadré des versions de test ne s’affichent pas', () => {
  const s = parseNotes(`${BETA_BOX}\n## Changements\n\n- **A** : texte.\n\n${INSTALL}`)
  assert.deepEqual(
    s.map((x) => x.title),
    ['Changements']
  )
  assert.deepEqual(s[0].items, [{ title: 'A', text: 'Texte.' }])
})

test('une phrase répétée ne reste que dans la version où elle est apparue', () => {
  const notes = {
    'x/0.9.4-beta.1.md': `${BETA_BOX}## Changements\n\n- **Un** : premier.\n\n## Bon à savoir\n\n- CS2 en **plein écran fenêtré**.\n`,
    'x/0.9.4-beta.2.md': `${BETA_BOX}## Changements\n\n- **Deux** : second.\n\n## Bon à savoir\n\n- CS2 en plein écran fenêtré\n`,
    'x/0.9.3.md': `## Nouveautés\n\n- **Zéro** : stable.\n\n${INSTALL}`
  }
  const r = releasesUpTo(notes, '0.9.4-beta.2')
  assert.deepEqual(
    r.map((x) => x.version),
    ['0.9.4-beta.2', '0.9.4-beta.1', '0.9.3']
  )
  assert.deepEqual(
    r[0].sections.map((x) => x.title),
    ['Changements']
  )
  assert.equal(r[1].sections[1].items.length, 1)
  assert.equal(r[0].tag, 'Deux')
})

test('versions de test : seulement sur une version de test de la même version', () => {
  const notes = { '0.9.4-beta.1.md': '## C\n\n- a\n', '0.9.3.md': '## C\n\n- b\n', '0.9.0-beta.1.md': '## C\n\n- c\n' }
  assert.deepEqual(
    releasesUpTo(notes, '0.9.4').map((x) => x.version),
    ['0.9.3']
  )
  assert.deepEqual(
    releasesUpTo(notes, '0.9.4-beta.3').map((x) => x.version),
    ['0.9.4-beta.1', '0.9.3']
  )
})

test('les vraies notes (docs/release-notes) : aucun élément en double, quelle que soit la version', () => {
  const dir = new URL('../../docs/release-notes/', import.meta.url)
  const notes: Record<string, string> = {}
  for (const f of readdirSync(dir)) if (f.endsWith('.md')) notes[f] = readFileSync(new URL(f, dir), 'utf8')
  for (const current of Object.keys(notes).map((f) => f.slice(0, -3))) {
    const seen = new Set<string>()
    for (const r of releasesUpTo(notes, current))
      for (const s of r.sections)
        for (const it of s.items) {
          const key = `${it.title ?? ''} ${it.text}`.replace(/\*\*|`/g, '').toLowerCase()
          assert.ok(!seen.has(key), `${current} : « ${key.slice(0, 60)} » en double (${r.version})`)
          seen.add(key)
          assert.ok(!/^(installer|télécharger|version de test)/i.test(s.title), `${r.version} : section ${s.title}`)
        }
  }
})
