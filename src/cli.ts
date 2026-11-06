#!/usr/bin/env node
import { create } from './create/index.ts'
import { doctor } from './doctor/index.ts'

const [first, ...rest] = process.argv.slice(2)
process.exitCode = first === 'doctor' ? await doctor(rest) : await create(process.argv.slice(2))
