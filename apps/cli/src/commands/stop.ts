import * as p from '@clack/prompts'
import pc from 'picocolors'
import { findInstallDir, readConfig } from '../services/config-store.js'
import { dockerComposeDown } from '../services/docker.js'

export async function stopCommand() {
  const dir = findInstallDir()
  const config = readConfig(dir)
  if (!config) {
    p.log.error('No OmniLearn installation found. Run `npx omnilearn setup` first.')
    process.exit(1)
  }

  p.intro(pc.cyan('Stopping OmniLearn'))
  try {
    dockerComposeDown(config.installDir)
    p.log.success('OmniLearn stopped.')
  } catch {
    p.log.error('Failed to stop services. Check Docker output above.')
    process.exit(1)
  }
}
