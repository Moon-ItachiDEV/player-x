#!/usr/bin/env node
// Signe ou vérifie un installeur de Player X (même format que src/main/services/updateSignature.ts).
//   node scripts/update-signature.mjs hash <installeur.exe>
//   node scripts/update-signature.mjs sign <version> <sha512> <clé-privée.pem>
//   node scripts/update-signature.mjs verify <version> <sha512> <signature-base64>
// La clé privée ne va jamais sur GitHub : la signature est faite hors de la CI, puis transmise au workflow « Publish ».
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SHA512 = /^[A-Za-z0-9+/]{86}==$/
const message = (version, sha512) => Buffer.from(`Player X update\n${version}\n${sha512}`, 'utf8')

function fail(text) {
  console.error(text)
  process.exit(1)
}

function checkArgs(version, sha512) {
  if (!VERSION.test(version ?? '')) fail(`Version invalide : ${version}`)
  if (!SHA512.test(sha512 ?? '')) fail(`Empreinte SHA-512 (base64) invalide : ${sha512}`)
}

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'hash') {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(args[0])) hash.update(chunk)
  console.log(hash.digest('base64'))
} else if (cmd === 'sign') {
  const [version, sha512, keyPath] = args
  checkArgs(version, sha512)
  const key = createPrivateKey(readFileSync(keyPath, 'utf8'))
  const signature = sign(null, message(version, sha512), key).toString('base64')
  // Vérifie aussitôt avec la clé publique livrée dans l'appli : une clé qui ne correspond pas ne doit jamais signer.
  const { publicKey } = JSON.parse(readFileSync(new URL('../src/shared/update-key.json', import.meta.url), 'utf8'))
  if (!verify(null, message(version, sha512), createPublicKey(publicKey), Buffer.from(signature, 'base64')))
    fail('Cette clé privée ne correspond pas à la clé publique de Player X.')
  console.log(signature)
} else if (cmd === 'verify') {
  const [version, sha512, signature] = args
  checkArgs(version, sha512)
  const { publicKey } = JSON.parse(readFileSync(new URL('../src/shared/update-key.json', import.meta.url), 'utf8'))
  const ok = /^[A-Za-z0-9+/]+={0,2}$/.test(signature?.trim() ?? '') && verify(null, message(version, sha512), createPublicKey(publicKey), Buffer.from(signature.trim(), 'base64'))
  if (!ok) fail('Signature invalide pour cette version et cet installeur.')
  console.log('Signature valide.')
} else {
  fail('Usage : hash <exe> | sign <version> <sha512> <clé.pem> | verify <version> <sha512> <signature>')
}
