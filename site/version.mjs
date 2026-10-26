// Lancé par Netlify au déploiement (commande de build) : remplace la version écrite dans
// index.html par le tag de la dernière version stable sur GitHub. En cas d'échec, garde la valeur écrite.
// Aucun appel à l'API GitHub depuis le navigateur.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('./public/index.html', import.meta.url));
const api = 'https://api.github.com/repos/Moon-ItachiDEV/player-x/releases/latest';

try {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'player-x-landing' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(api, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);
  const { tag_name: tag } = await res.json();
  const version = String(tag || '').replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$/.test(version)) throw new Error(`tag inattendu : ${tag}`);
  const html = await readFile(file, 'utf8');
  const next = html.replace(/(<[^>]*\sdata-v(?=[\s>])[^>]*>)[^<]*/g, `$1${version}`);
  await writeFile(file, next);
  console.log(`version.mjs : ${version}`);
} catch (err) {
  console.warn(`version.mjs : version écrite conservée (${err.message})`);
}
