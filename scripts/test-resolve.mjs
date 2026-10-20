// Tests (npm run test:launch) : les modules de l'interface s'importent entre eux sans extension, comme Vite les résout.
// Node exige l'extension : ce crochet ajoute « .ts » quand le chemin relatif seul ne mène à rien.
// registerHooks (Node ≥ 22.15) est synchrone ; avant, le même crochet passe par register (asynchrone).
import * as nodeModule from 'node:module'

const bare = (specifier) => /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)

if (nodeModule.registerHooks) {
  nodeModule.registerHooks({
    resolve(specifier, context, next) {
      try {
        return next(specifier, context)
      } catch (e) {
        if (bare(specifier)) return next(`${specifier}.ts`, context)
        throw e
      }
    }
  })
} else {
  const hook = `const bare = ${bare.toString()}
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (e) {
    if (bare(specifier)) return next(specifier + '.ts', context)
    throw e
  }
}`
  nodeModule.register(`data:text/javascript,${encodeURIComponent(hook)}`)
}
