// =============================================================================
// @hivemind/api - Entry Point
// =============================================================================

import * as path from 'path'
import { startServer } from './server'

// Default configuration
const PORT = parseInt(process.env.PORT || '3001', 10)
const SETTINGS_PATH = process.env.SETTINGS_PATH || path.join(__dirname, '..', '..', '..', 'settings.json')
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd()
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.join(__dirname, '..', '..', '..', 'mcp', 'prompts')

// Start the server
startServer({
  port: PORT,
  settingsPath: SETTINGS_PATH,
  projectDir: PROJECT_DIR,
  promptsDir: PROMPTS_DIR,
}).catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

// Export for programmatic use
export { createServer, startServer } from './server'
export type { ServerConfig } from './server'

