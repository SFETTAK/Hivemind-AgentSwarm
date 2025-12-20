# Hivemind Debug & Logging System

A comprehensive debug system for diagnosing deployment issues, tracking agent activity, and troubleshooting across different environments.

## Quick Start

### Enable Debug Mode

Set the `DEBUG` environment variable before starting the API:

```bash
# Enable all hivemind debug logs
DEBUG=hivemind pnpm start

# Or enable specific categories
DEBUG=hivemind:tmux,hivemind:agents pnpm start
```

### Debug Endpoints

Once the API is running, these endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/debug/logs` | GET | Get recent log entries |
| `/api/debug/logs` | DELETE | Clear log buffer |
| `/api/debug/logs/stream` | GET | Real-time log stream (SSE) |
| `/api/debug/env` | GET | Environment info (sanitized) |
| `/api/debug/tmux` | GET | Tmux session diagnostics |
| `/api/debug/test-deploy` | POST | Test deployment without running aider |

---

## API Reference

### GET /api/debug/logs

Retrieve recent log entries with optional filtering.

**Query Parameters:**
- `level` - Minimum log level: `debug`, `info`, `warn`, `error`
- `category` - Filter by category: `api`, `tmux`, `conductor`, `agents`, `tools`, `swarm`
- `limit` - Max entries to return (default: 100)
- `since` - ISO timestamp to filter from

**Example:**
```bash
# Get last 50 error logs
curl "http://localhost:3001/api/debug/logs?level=error&limit=50"

# Get all agent-related logs
curl "http://localhost:3001/api/debug/logs?category=agents"

# Get logs since a specific time
curl "http://localhost:3001/api/debug/logs?since=2025-01-01T00:00:00Z"
```

**Response:**
```json
{
  "count": 25,
  "total": 150,
  "logs": [
    {
      "timestamp": "2025-01-15T10:30:45.123Z",
      "level": "info",
      "category": "agents",
      "message": "Agent deployed successfully",
      "data": { "sessionName": "hive-forge-task", "role": "forge" }
    }
  ]
}
```

### GET /api/debug/logs/stream

Real-time log streaming via Server-Sent Events.

**Example:**
```bash
curl -N "http://localhost:3001/api/debug/logs/stream"
```

**JavaScript:**
```javascript
const eventSource = new EventSource('/api/debug/logs/stream');
eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(`[${log.level}] ${log.message}`);
};
```

### GET /api/debug/env

Get environment information (API keys are NOT exposed, only whether they're set).

**Response:**
```json
{
  "node_version": "v20.10.0",
  "platform": "linux",
  "arch": "x64",
  "uptime": 3600,
  "memory": { "heapUsed": 50000000, "heapTotal": 100000000 },
  "debug_enabled": "hivemind:*",
  "log_to_file": false,
  "log_dir": "/tmp/hivemind-logs",
  "cwd": "/home/user/Hivemind-AgentSwarm",
  "has_openrouter_key": true,
  "has_anthropic_key": false
}
```

### GET /api/debug/tmux

Get tmux session diagnostics.

**Response:**
```json
{
  "tmux_version": "tmux 3.3a",
  "total_sessions": 5,
  "hivemind_sessions": ["hive-forge-task", "hive-sentinel-review"],
  "sessions": [
    {
      "name": "hive-forge-task",
      "created": "2025-01-15T10:00:00.000Z",
      "windows": 1,
      "isHivemind": true
    }
  ]
}
```

### POST /api/debug/test-deploy

Test the deployment pipeline without actually starting aider. Useful for diagnosing why agents aren't spawning.

**Request Body:**
```json
{
  "agent": "forge",
  "task": "test"
}
```

**Response:**
```json
{
  "agent": "forge",
  "task": "test",
  "sessionName": "hive-forge-test",
  "steps": [
    { "step": "check_existing", "result": "not found" },
    { "step": "check_aider", "result": "/usr/local/bin/aider" },
    { "step": "check_env", "result": { "hasOpenRouter": true, "hasAnthropic": false } },
    { "step": "test_session_create", "result": "success" }
  ],
  "summary": {
    "canCreateSessions": true,
    "aiderAvailable": true,
    "envConfigured": true
  }
}
```

---

## Log Categories

| Category | Description |
|----------|-------------|
| `api` | API server events, route initialization |
| `tmux` | Tmux session operations (create, kill, send) |
| `conductor` | QUEEN/Conductor LLM interactions |
| `agents` | Agent deployment and management |
| `tools` | Tool execution (deploy_agent, send_to_agent, etc.) |
| `swarm` | Swarm-level operations |

---

## File Logging

To enable persistent file logging:

```bash
HIVEMIND_LOG_FILE=true HIVEMIND_LOG_DIR=/var/log/hivemind pnpm start
```

Logs are written as JSON lines to `/var/log/hivemind/hivemind-YYYY-MM-DD.log`.

---

## Troubleshooting Common Issues

### Agents Not Appearing in Topology

1. Check if tmux sessions exist:
   ```bash
   curl http://localhost:3001/api/debug/tmux
   ```

2. Test deployment pipeline:
   ```bash
   curl -X POST http://localhost:3001/api/debug/test-deploy \
     -H "Content-Type: application/json" \
     -d '{"agent":"forge","task":"test"}'
   ```

3. Check logs for errors:
   ```bash
   curl "http://localhost:3001/api/debug/logs?category=agents&level=error"
   ```

### Aider Not Found

If `test-deploy` shows `aider` not found:

```bash
# Install aider via pipx (recommended)
pipx install aider-chat

# Or via pip
pip install aider-chat --user
```

### API Keys Not Set

If `test-deploy` shows `hasOpenRouter: false`:

1. Check settings.json has keys configured
2. Or set environment variables:
   ```bash
   export OPENROUTER_API_KEY="your-key"
   pnpm start
   ```

### Session Already Exists

If deployment fails with "session already exists":

```bash
# Kill the existing session
tmux kill-session -t hive-forge-taskname

# Or kill all hivemind sessions
tmux kill-session -t hive-forge-taskname 2>/dev/null
tmux list-sessions | grep "^hive-" | cut -d: -f1 | xargs -I{} tmux kill-session -t {}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | (none) | Enable debug logging (`hivemind`, `hivemind:*`, or specific categories) |
| `HIVEMIND_LOG_FILE` | `false` | Enable file logging |
| `HIVEMIND_LOG_DIR` | `/tmp/hivemind-logs` | Directory for log files |

---

## Adding Custom Logging

In your code:

```typescript
import { logger, createLogger } from '../utils/logger';

// Use pre-configured loggers
logger.api.info('Server started');
logger.agents.error('Deployment failed', { error: err.message });

// Or create custom category
const myLogger = createLogger('custom');
myLogger.debug('Custom debug message');
```

