/**
 * Hivemind Debug Logger
 * 
 * Centralized logging with levels, timestamps, and optional file output.
 * Enable debug mode via DEBUG=hivemind or DEBUG=hivemind:* environment variable.
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

// In-memory log buffer for UI access
const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 1000;

// Log file path (optional)
const LOG_DIR = process.env.HIVEMIND_LOG_DIR || '/tmp/hivemind-logs';
const LOG_TO_FILE = process.env.HIVEMIND_LOG_FILE === 'true';

// Debug categories enabled
const DEBUG_ENV = process.env.DEBUG || '';
const DEBUG_ALL = DEBUG_ENV.includes('hivemind:*') || DEBUG_ENV === 'hivemind';

function isDebugEnabled(category: string): boolean {
  if (DEBUG_ALL) return true;
  return DEBUG_ENV.includes(`hivemind:${category}`);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function colorize(level: LogLevel, text: string): string {
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[36m',  // cyan
    info: '\x1b[32m',   // green
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m',  // red
  };
  const reset = '\x1b[0m';
  return `${colors[level]}${text}${reset}`;
}

function log(level: LogLevel, category: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data,
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Console output
  const levelStr = colorize(level, level.toUpperCase().padEnd(5));
  const categoryStr = `[${category}]`.padEnd(15);
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  
  // Only show debug logs if debug is enabled for this category
  if (level === 'debug' && !isDebugEnabled(category)) {
    return;
  }

  console.log(`${entry.timestamp} ${levelStr} ${categoryStr} ${message}${dataStr}`);

  // File output (optional)
  if (LOG_TO_FILE) {
    writeToFile(entry);
  }
}

function writeToFile(entry: LogEntry): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const date = entry.timestamp.split('T')[0];
    const logFile = path.join(LOG_DIR, `hivemind-${date}.log`);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFile, line);
  } catch (err) {
    console.error('Failed to write log file:', err);
  }
}

// Logger factory for specific categories
export function createLogger(category: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', category, message, data),
    info: (message: string, data?: unknown) => log('info', category, message, data),
    warn: (message: string, data?: unknown) => log('warn', category, message, data),
    error: (message: string, data?: unknown) => log('error', category, message, data),
  };
}

// Pre-configured loggers for common categories
export const logger = {
  api: createLogger('api'),
  tmux: createLogger('tmux'),
  conductor: createLogger('conductor'),
  agents: createLogger('agents'),
  tools: createLogger('tools'),
  swarm: createLogger('swarm'),
};

// Get logs for API endpoint
export function getLogs(options?: {
  level?: LogLevel;
  category?: string;
  limit?: number;
  since?: string;
}): LogEntry[] {
  let logs = [...logBuffer];

  if (options?.level) {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(options.level);
    logs = logs.filter(l => levels.indexOf(l.level) >= minIndex);
  }

  if (options?.category) {
    logs = logs.filter(l => l.category === options.category);
  }

  if (options?.since) {
    const sinceTime = options.since;
    logs = logs.filter(l => l.timestamp >= sinceTime);
  }

  if (options?.limit) {
    logs = logs.slice(-options.limit);
  }

  return logs;
}

// Clear logs
export function clearLogs(): void {
  logBuffer.length = 0;
}

// Export for direct access
export { logBuffer };

