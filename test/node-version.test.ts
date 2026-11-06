import { describe, expect, it } from 'vitest'
import { SUPPORTED_NODE, nodeProblem } from '../src/node-version.ts'

// Nuxt 4.6 declares "^22.22.3 || ^24.15.0 || >=26.0.0" in its engines field.
describe('nodeProblem: the Node versions Nuxt supports', () => {
  it.each(['22.22.3', '22.22.4', '22.23.0', '22.100.0', '24.15.0', '24.15.1', '24.21.0', '26.0.0', '26.1.0', '27.0.0', '30.2.1'])(
    'accepts %s',
    (v) => {
      expect(nodeProblem(v)).toBeNull()
    },
  )
  it.each(['18.20.0', '20.19.0', '22.0.0', '22.12.0', '22.22.2', '22.21.9', '23.9.0', '24.0.0', '24.14.9', '24.14.99', '25.0.0', '25.9.9'])(
    'refuses %s',
    (v) => {
      expect(nodeProblem(v)).toBe(
        `create-nuxt-primevue needs a Node version that Nuxt supports (today ${SUPPORTED_NODE}). You are running ${v}.`,
      )
    },
  )
  it('declares the range Nuxt declares', () => {
    expect(SUPPORTED_NODE).toBe('^22.22.3 || ^24.15.0 || >=26.0.0')
  })
})
