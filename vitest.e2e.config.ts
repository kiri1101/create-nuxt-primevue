import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'

// The checks share one project in a fixed order: create, badge (false, guard, v5, true), doctor, then the
// heavy variants (E2E_FULL only), which free that project first.
const ORDER = ['create.e2e.ts', 'badge.e2e.ts', 'doctor.e2e.ts', 'create-full.e2e.ts']

class ChainSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    const rank = (f: TestSpecification) => ORDER.findIndex((n) => f.moduleId.replaceAll('\\', '/').endsWith(`/${n}`))
    return [...files].sort((a, b) => rank(a) - rank(b))
  }
}

// Installs and builds run one at a time: the machine has little spare memory.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    globalSetup: ['e2e/global-setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { sequencer: ChainSequencer },
    testTimeout: 15 * 60_000,
    hookTimeout: 15 * 60_000,
  },
})
