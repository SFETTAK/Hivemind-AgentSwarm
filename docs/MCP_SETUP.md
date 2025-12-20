# Hivemind MCP Integration

Control your Hivemind swarm directly from **Claude Desktop**, **ChatGPT**, or any MCP-compatible AI assistant.

> 💡 **Why MCP?** If the web UI has issues, you can still fully control the swarm through your AI assistant. Claude or ChatGPT are smart enough to orchestrate agents using the MCP tools.

---

## Quick Setup

### 1. Start Hivemind API

```bash
cd ~/Hivemind-AgentSwarm
pnpm start
```

The API runs on `http://localhost:3001` by default.

### 2. Configure Your AI Client

#### Claude Desktop

Edit `~/.config/claude/claude_desktop_config.json` (Linux/Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "hivemind": {
      "command": "node",
      "args": ["/path/to/Hivemind-AgentSwarm/mcp/hivemind-mcp-server.js"],
      "env": {
        "HIVEMIND_API": "http://localhost:3001"
      }
    }
  }
}
```

**Replace `/path/to/` with your actual installation path.**

#### ChatGPT (via MCP Bridge)

ChatGPT requires an MCP bridge. Use the Hivemind API directly via HTTP tools, or set up an MCP-to-HTTP proxy.

#### Cursor IDE

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "hivemind": {
      "command": "node",
      "args": ["./mcp/hivemind-mcp-server.js"],
      "env": {
        "HIVEMIND_API": "http://localhost:3001"
      }
    }
  }
}
```

---

## Available Tools

Once configured, your AI assistant has access to these tools:

| Tool | Description |
|------|-------------|
| `hivemind_status` | Get swarm status, all agents, health |
| `hivemind_deploy_agent` | Deploy FORGE, SENTINEL, ORACLE, NEXUS, or SCRIBE |
| `hivemind_send_to_agent` | Send message/command to specific agent |
| `hivemind_broadcast` | Message all active agents |
| `hivemind_kill_agent` | Terminate an agent session |
| `hivemind_get_output` | Get agent's terminal output |
| `hivemind_chat_queen` | Talk to QUEEN for orchestration |
| `hivemind_list_files` | List project files |
| `hivemind_read_file` | Read file contents |
| `hivemind_debug` | Get logs, env info, tmux status |

---

## Example Conversations

### Deploy and Coordinate Agents

**You:** "Deploy a FORGE agent to create a REST API, then have SENTINEL review it"

**Claude:** *Uses hivemind_deploy_agent to spawn FORGE, waits, then deploys SENTINEL and sends review task*

### Check Swarm Status

**You:** "What agents are running?"

**Claude:** *Uses hivemind_status to list all active agents with their tasks and status*

### Debug Issues

**You:** "Why aren't my agents spawning?"

**Claude:** *Uses hivemind_debug with type "test-deploy" to diagnose the issue*

### Direct QUEEN Control

**You:** "Tell QUEEN to wake up the whole swarm for a big refactoring task"

**Claude:** *Uses hivemind_chat_queen to communicate with the conductor*

---

## HTTPS Setup (Optional)

For secure connections:

```bash
# Generate self-signed certificate
./scripts/setup-https.sh

# Start with HTTPS
HIVEMIND_HTTPS=true pnpm start
```

Update your MCP config to use `https://localhost:3001`.

---

## Troubleshooting

### "Connection refused" errors

1. Make sure Hivemind API is running: `pnpm start`
2. Check the API URL in your MCP config matches where the API is running
3. If using WSL, use `localhost` not the WSL IP

### Tools not appearing in Claude

1. Restart Claude Desktop after editing config
2. Check config file syntax (valid JSON)
3. Verify the path to `hivemind-mcp-server.js` is correct

### Agent deployment fails

Use the debug tool:
```
hivemind_debug with type: "test-deploy"
```

This shows if aider is installed, API keys are set, and tmux works.

### Check MCP server logs

The MCP server logs to stderr. Run manually to see output:
```bash
node mcp/hivemind-mcp-server.js
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVEMIND_API` | `http://localhost:3001` | API server URL |
| `HIVEMIND_HTTPS` | `false` | Enable HTTPS |
| `HIVEMIND_CERT_DIR` | `~/.hivemind/certs` | Certificate directory |

---

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌─────────────────┐
│  Claude Desktop │ ◄──────────────────► │  MCP Server     │
│  or ChatGPT     │    (stdio JSON-RPC)   │  (Node.js)      │
└─────────────────┘                       └────────┬────────┘
                                                   │ HTTP
                                                   ▼
                                          ┌─────────────────┐
                                          │  Hivemind API   │
                                          │  (Express)      │
                                          └────────┬────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                        ┌──────────┐        ┌──────────┐        ┌──────────┐
                        │  FORGE   │        │ SENTINEL │        │  ORACLE  │
                        │  (tmux)  │        │  (tmux)  │        │  (tmux)  │
                        └──────────┘        └──────────┘        └──────────┘
```

The MCP server translates tool calls from your AI assistant into HTTP requests to the Hivemind API, which then manages tmux sessions running aider.

---

## Security Notes

- The MCP server only connects to localhost by default
- API keys are stored in `settings.json`, not in the MCP config
- Self-signed certs are for local development only
- For production, use proper certificates from Let's Encrypt or similar

