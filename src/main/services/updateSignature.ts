// Signature des mises à jour : chaque installeur publié est signé avec une clé privée qui n'est jamais sur GitHub.
// Un compte GitHub piraté peut publier une release, mais pas la signer : Player X la refuse.
// Le même format est produit et vérifié par scripts/update-signature.mjs (publication).
import { createHash, createPublicKey, verify } from 'node:crypto'
import { createReadStream } from 'node:fs'
import updateKey from '@shared/update-key.json'

/** Ce qui est signé : le nom du produit, la version et l'empreinte SHA-512 (base64) de l'installeur. */
export function signedMessage(version: string, sha512: string): Buffer {
  return Buffer.from(`Player X update\n${version}\n${sha512}`, 'utf8')
}

export function sha512File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('base64')))
  })
}

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/** Version acceptable dans une URL de release (évite d'y glisser autre chose). */
export function isVersion(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 64 && VERSION.test(v)
}

/** `true` seulement si la signature (base64) correspond à cette version et à cette empreinte. */
export function verifyUpdateSignature(version: string, sha512: string, signature: string, publicKeyPem: string = updateKey.publicKey): boolean {
  const sig = signature.trim()
  if (!isVersion(version) || !/^[A-Za-z0-9+/]+={0,2}$/.test(sig)) return false
  try {
    return verify(null, signedMessage(version, sha512), createPublicKey(publicKeyPem), Buffer.from(sig, 'base64'))
  } catch {
    return false
  }
}
