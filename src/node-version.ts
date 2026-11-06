/** What Nuxt 4.6 declares in its engines field. Nuxt's own range can tighten later: keep this in step with it. */
export const SUPPORTED_NODE = '^22.22.3 || ^24.15.0 || >=26.0.0'

/** Returns a message when this Node version is outside the range Nuxt supports, otherwise null. */
export function nodeProblem(version: string): string | null {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number)
  const supported =
    major >= 26 ||
    (major === 24 && minor >= 15) ||
    (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)))
  return supported
    ? null
    : `create-nuxt-primevue needs a Node version that Nuxt supports (today ${SUPPORTED_NODE}). You are running ${version}.`
}
