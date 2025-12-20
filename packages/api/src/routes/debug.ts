/**
 * Debug API Routes
 * 
 * Endpoints for accessing logs and debugging information.
 */

import { Router, Request, Response } from 'express';
import { getLogs, clearLogs, LogLevel, logBuffer } from '../utils/logger';

const router: Router = Router();

/**
 * GET /api/debug/logs
 * Get recent log entries with optional filtering
 * 
 * Query params:
 *   - level: minimum log level (debug, info, warn, error)
 *   - category: filter by category (api, tmux, conductor, agents, tools, swarm)
 *   - limit: max number of entries (default 100)
 *   - since: ISO timestamp to filter from
 */
router.get('/logs', (req: Request, res: Response) => {
  const { level, category, limit, since } = req.query;
  
  const logs = getLogs({
    level: level as LogLevel | undefined,
    category: category as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 100,
    since: since as string | undefined,
  });

  res.json({
    count: logs.length,
    total: logBuffer.length,
    logs,
  });
});

/**
 * DELETE /api/debug/logs
 * Clear all logs from buffer
 */
router.delete('/logs', (_req: Request, res: Response) => {
  clearLogs();
  res.json({ message: 'Logs cleared' });
});

/**
 * GET /api/debug/logs/stream
 * Server-sent events for real-time log streaming
 */
router.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Track last sent index
  let lastIndex = logBuffer.length;

  // Poll for new logs every 500ms
  const interval = setInterval(() => {
    if (logBuffer.length > lastIndex) {
      const newLogs = logBuffer.slice(lastIndex);
      for (const log of newLogs) {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      }
      lastIndex = logBuffer.length;
    }
  }, 500);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * GET /api/debug/env
 * Get relevant environment info (sanitized)
 */
router.get('/env', (_req: Request, res: Response) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    debug_enabled: process.env.DEBUG || 'none',
    log_to_file: process.env.HIVEMIND_LOG_FILE === 'true',
    log_dir: process.env.HIVEMIND_LOG_DIR || '/tmp/hivemind-logs',
    cwd: process.cwd(),
    // Don't expose actual API keys, just whether they're set
    has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
    has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
  });
});

/**
 * GET /api/debug/tmux
 * Get tmux session information for debugging
 */
router.get('/tmux', async (_req: Request, res: Response) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // Check if tmux is available
    const { stdout: tmuxVersion } = await execAsync('tmux -V').catch(() => ({ stdout: 'not installed' }));
    
    // List all sessions
    const { stdout: sessions } = await execAsync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_windows}"')
      .catch(() => ({ stdout: '' }));
    
    // List all hive- sessions specifically
    const { stdout: hiveSessions } = await execAsync('tmux list-sessions -F "#{session_name}" | grep "^hive-"')
      .catch(() => ({ stdout: '' }));

    const sessionList = sessions.trim().split('\n').filter(Boolean).map(line => {
      const [name, created, windows] = line.split('|');
      return {
        name,
        created: new Date(parseInt(created, 10) * 1000).toISOString(),
        windows: parseInt(windows, 10),
        isHivemind: name.startsWith('hive-'),
      };
    });

    res.json({
      tmux_version: tmuxVersion.trim(),
      total_sessions: sessionList.length,
      hivemind_sessions: hiveSessions.trim().split('\n').filter(Boolean),
      sessions: sessionList,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get tmux info',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/debug/test-deploy
 * Test agent deployment without actually running aider
 * Useful for debugging deployment issues
 */
router.post('/test-deploy', async (req: Request, res: Response) => {
  const { agent = 'test', task = 'debug-test' } = req.body;
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const sessionName = `hive-${agent.toLowerCase()}`;
  const results: Record<string, unknown> = {
    agent,
    task,
    sessionName,
    steps: [],
  };

  try {
    // Step 1: Check if session already exists
    const { stdout: existing } = await execAsync(`tmux has-session -t ${sessionName} 2>&1 && echo "exists" || echo "not found"`)
      .catch(() => ({ stdout: 'error checking' }));
    (results.steps as unknown[]).push({ step: 'check_existing', result: existing.trim() });

    // Step 2: Check if aider is available
    const { stdout: aiderPath } = await execAsync('which aider || echo "not found"')
      .catch(() => ({ stdout: 'not found' }));
    (results.steps as unknown[]).push({ step: 'check_aider', result: aiderPath.trim() });

    // Step 3: Check environment variables
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    (results.steps as unknown[]).push({ 
      step: 'check_env', 
      result: { hasOpenRouter, hasAnthropic } 
    });

    // Step 4: Try creating a test session (will be killed immediately)
    const testSession = `hive-debug-${Date.now()}`;
    try {
      await execAsync(`tmux new-session -d -s ${testSession} -x 200 -y 50`);
      await execAsync(`tmux kill-session -t ${testSession}`);
      (results.steps as unknown[]).push({ step: 'test_session_create', result: 'success' });
    } catch (err) {
      (results.steps as unknown[]).push({ 
        step: 'test_session_create', 
        result: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Summary
    results.summary = {
      canCreateSessions: (results.steps as { step: string; result: string }[]).find(s => s.step === 'test_session_create')?.result === 'success',
      aiderAvailable: !aiderPath.includes('not found'),
      envConfigured: hasOpenRouter || hasAnthropic,
    };

    res.json(results);
  } catch (err) {
    res.status(500).json({
      error: 'Test deploy failed',
      details: err instanceof Error ? err.message : String(err),
      results,
    });
  }
});

export default router;

