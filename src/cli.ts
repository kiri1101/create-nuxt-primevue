#!/usr/bin/env node
import { nodeProblem } from './node-version.ts'

const problem = nodeProblem(process.versions.node)
if (problem) {
  console.error(problem)
  process.exitCode = 1
} else {
  // Imported only now, so an unsupported Node prints the message above instead of failing inside a module.
  const [{ create }, { doctor }] = await Promise.all([import('./create/index.ts'), import('./doctor/index.ts')])
  const [first, ...rest] = process.argv.slice(2)
  process.exitCode = first === 'doctor' ? await doctor(rest) : await create(process.argv.slice(2))
}
