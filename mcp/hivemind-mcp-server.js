#!/usr/bin/env node
/**
 * Hivemind MCP Server
 * 
 * Model Context Protocol server for controlling Hivemind swarm from
 * Claude Desktop, ChatGPT, or any MCP-compatible client.
 * 
 * Usage:
 *   node hivemind-mcp-server.js
 * 
 * Or add to Claude Desktop config:
 *   "hivemind": {
 *     "command": "node",
 *     "args": ["/path/to/hivemind-mcp-server.js"],
 *     "env": { "HIVEMIND_API": "http://localhost:3001" }
 *   }
 */

const HIVEMIND_API = process.env.HIVEMIND_API || 'http://localhost:3001';

// MCP Protocol helpers
function sendResponse(id, result) {
  const response = { jsonrpc: '2.0', id, result };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id, code, message) {
  const response = { jsonrpc: '2.0', id, error: { code, message } };
  process.stdout.write(JSON.stringify(response) + '\n');
}

// API helpers
async function apiGet(endpoint) {
  const response = await fetch(`${HIVEMIND_API}${endpoint}`);
  return response.json();
}

async function apiPost(endpoint, body = {}) {
  const response = await fetch(`${HIVEMIND_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function apiDelete(endpoint) {
  const response = await fetch(`${HIVEMIND_API}${endpoint}`, { method: 'DELETE' });
  return response.json();
}

// Tool definitions
const TOOLS = [
  {
    name: 'hivemind_status',
    description: 'Get the current status of the Hivemind swarm including all agents, their states, and system health.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'hivemind_deploy_agent',
    description: 'Deploy a new AI agent to the swarm. Available roles: FORGE (builder), SENTINEL (reviewer), ORACLE (architect), NEXUS (integrator), SCRIBE (documenter).',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['forge', 'sentinel', 'oracle', 'nexus', 'scribe'], description: 'Agent role to deploy' },
        task: { type: 'string', description: 'Task description for the agent' },
      },
      required: ['role', 'task'],
    },
  },
  {
    name: 'hivemind_send_to_agent',
    description: 'Send a message or command to a specific agent in the swarm.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent name or session ID (e.g., "forge", "hive-forge-task")' },
        message: { type: 'string', description: 'Message to send to the agent' },
      },
      required: ['agent', 'message'],
    },
  },
  {
    name: 'hivemind_broadcast',
    description: 'Broadcast a message to all active agents in the swarm.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to broadcast' },
      },
      required: ['message'],
    },
  },
  {
    name: 'hivemind_kill_agent',
    description: 'Terminate a specific agent session.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent name or session ID to kill' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'hivemind_get_output',
    description: 'Get the recent terminal output from a specific agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent name or session ID' },
        lines: { type: 'number', description: 'Number of lines to retrieve (default: 100)' },
      },
      required: ['agent'],
    },
  },
  {
    name: 'hivemind_chat_queen',
    description: 'Send a message to the QUEEN (conductor) for orchestration decisions. QUEEN can deploy agents, coordinate tasks, and manage the swarm.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message for the QUEEN conductor' },
      },
      required: ['message'],
    },
  },
  {
    name: 'hivemind_list_files',
    description: 'List files in the project directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Subdirectory path (relative to project root)' },
      },
      required: [],
    },
  },
  {
    name: 'hivemind_read_file',
    description: 'Read contents of a file in the project.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (relative to project root)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'hivemind_debug',
    description: 'Get debug information including logs, environment, and tmux session status.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['logs', 'env', 'tmux', 'test-deploy'], description: 'Type of debug info' },
      },
      required: ['type'],
    },
  },
];

// Tool execution
async function executeTool(name, args) {
  switch (name) {
    case 'hivemind_status': {
      const status = await apiGet('/api/swarm/status');
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }

    case 'hivemind_deploy_agent': {
      const result = await apiPost('/api/agents/deploy', {
        role: args.role,
        task: args.task,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_send_to_agent': {
      const result = await apiPost(`/api/agents/${args.agent}/send`, {
        command: args.message,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_broadcast': {
      const result = await apiPost('/api/swarm/broadcast', {
        message: args.message,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_kill_agent': {
      const result = await apiDelete(`/api/agents/${args.agent}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_get_output': {
      const lines = args.lines || 100;
      const result = await apiGet(`/api/agents/${args.agent}/output?lines=${lines}`);
      return { content: [{ type: 'text', text: result.output || 'No output available' }] };
    }

    case 'hivemind_chat_queen': {
      const result = await apiPost('/api/conductor/chat', {
        message: args.message,
      });
      return { content: [{ type: 'text', text: result.message || JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_list_files': {
      const path = args.path || '';
      const result = await apiGet(`/api/files/list?path=${encodeURIComponent(path)}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'hivemind_read_file': {
      const result = await apiGet(`/api/files/read?path=${encodeURIComponent(args.path)}`);
      return { content: [{ type: 'text', text: result.content || 'File not found' }] };
    }

    case 'hivemind_debug': {
      let result;
      switch (args.type) {
        case 'logs':
          result = await apiGet('/api/debug/logs?limit=50');
          break;
        case 'env':
          result = await apiGet('/api/debug/env');
          break;
        case 'tmux':
          result = await apiGet('/api/debug/tmux');
          break;
        case 'test-deploy':
          result = await apiPost('/api/debug/test-deploy', { agent: 'test', task: 'mcp-test' });
          break;
        default:
          result = { error: 'Unknown debug type' };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Handle MCP messages
async function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'hivemind',
          version: '1.0.0',
        },
      });
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call':
      try {
        const result = await executeTool(params.name, params.arguments || {});
        sendResponse(id, result);
      } catch (error) {
        sendError(id, -32000, error.message);
      }
      break;

    case 'notifications/initialized':
      // Client acknowledged initialization, no response needed
      break;

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

// Main loop - read JSON-RPC messages from stdin
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        await handleMessage(message);
      } catch (error) {
        console.error('Parse error:', error.message);
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Log startup to stderr (not stdout, which is for MCP protocol)
console.error(`Hivemind MCP Server started - API: ${HIVEMIND_API}`);

