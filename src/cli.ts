#!/usr/bin/env node
import { create } from './create/index.ts'

process.exitCode = await create(process.argv.slice(2))
