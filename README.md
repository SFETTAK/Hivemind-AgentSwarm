# 🐝 Hivemind Modular Backend

> **A modular, TypeScript-first orchestration engine for AI agent swarms**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-orange.svg)](https://pnpm.io/)

![Hivemind Dashboard](assets/dashboard-preview.png)

---

## 🏗️ Architecture

Hivemind is built as a **modular monorepo** with clear separation of concerns:

```
hivemind-modular/
├── packages/
│   ├── core/           # 🧠 Types, agents, profiles, tool parsing
│   ├── connectors/     # 🔌 External integrations (tmux, LLM APIs)
│   ├── config/         # ⚙️ Settings management
│   └── api/            # 🌐 Express REST API
└── pnpm-workspace.yaml
```

### Package Responsibilities

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| **@hivemind/core** | Agent definitions, types, profiles, tool execution | None (pure TS) |
| **@hivemind/connectors** | tmux client, OpenRouter/LLM client | core |
| **@hivemind/config** | Load/save settings, manage profiles | core |
| **@hivemind/api** | REST endpoints, orchestration logic | core, connectors, config |

---

## 🚀 Quick Start

### One-Line Install (Recommended)

**Linux / macOS / WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash
```

**Windows:**
Download and run [`install-windows.bat`](scripts/install-windows.bat) as Administrator.

👉 **[Full Installation Guide](docs/INSTALL.md)**

### Manual Install

```bash
# Clone
git clone https://github.com/SFETTAK/Hivemind-AgentSwarm.git
cd Hivemind-AgentSwarm

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start
pnpm start
```

The API runs on `http://localhost:3001` by default.

---

## 📦 Packages

### @hivemind/core

The brain of the operation - pure TypeScript with zero external dependencies.

```typescript
import { Agent, AGENT_ROLES, DEFAULT_PROFILES, parseToolCall } from '@hivemind/core'

// Agent roles with descriptions and icons
AGENT_ROLES.FORGE    // 🔨 Primary builder
AGENT_ROLES.SENTINEL // 🛡️ Quality assurance
AGENT_ROLES.ORACLE   // 🔮 Research & analysis
AGENT_ROLES.NEXUS    // 🌐 Integration specialist
AGENT_ROLES.SCRIBE   // 📜 Documentation

// Speed profiles (cruise → cosmic)
DEFAULT_PROFILES.cruise  // Budget-friendly
DEFAULT_PROFILES.fast    // Balanced
DEFAULT_PROFILES.turbo   // High performance
DEFAULT_PROFILES.cosmic  // Maximum power
```

### @hivemind/connectors

Integrations with external systems.

```typescript
import { TmuxClient, OpenRouterClient } from '@hivemind/connectors'

// Manage tmux sessions
const tmux = new TmuxClient()
await tmux.listSessions()
await tmux.createSession('hive-forge-api', '/path/to/project')
await tmux.sendCommand('hive-forge-api', 'echo hello')

// LLM completions via OpenRouter
const llm = new OpenRouterClient('sk-or-...')
const response = await llm.chatCompletion({
  model: 'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### @hivemind/config

Centralized settings management.

```typescript
import { SettingsManager } from '@hivemind/config'

const settings = new SettingsManager('/path/to/settings.json')
await settings.load()

settings.get('OPENROUTER_API_KEY')
settings.set('PROJECT_DIR', '/home/user/project')
await settings.save()
```

### @hivemind/api

Express REST API that ties everything together.

```typescript
import { createServer, startServer } from '@hivemind/api'

const app = createServer()
startServer(app, 3001)
```

---

## 🔌 API Endpoints

### Swarm Management
- `GET /api/swarm/status` - Overall swarm status
- `GET /api/swarm/agents` - List all agents
- `GET /api/swarm/edges` - Agent connections
- `GET /api/swarm/activity` - Recent activity feed

### Agent Operations
- `POST /api/agents/deploy` - Deploy a new agent
- `POST /api/agents/:name/send` - Send command to agent
- `POST /api/agents/:name/kill` - Kill an agent
- `GET /api/agents/:name/status` - Agent status
- `GET /api/agents/:name/output` - Terminal output

### Conductor (QUEEN)
- `POST /api/conductor/chat` - Chat with the Conductor
- `GET /api/conductor/history` - Chat history
- `POST /api/conductor/clear` - Clear history

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update settings

### Files
- `GET /api/files/list` - List directory contents
- `GET /api/files/read` - Read file content
- `POST /api/files/new` - Create new file
- `POST /api/files/mkdir` - Create directory
- `DELETE /api/files/:path` - Delete file
- `POST /api/files/rename` - Rename file

---

## 🎯 Roadmap

### 🍯 Colony System — Persistence & Collaboration

The Colony system adds **session persistence**, **multi-user collaboration**, and **portability** to Hivemind.

**Core capabilities:**
- Save and restore complete session state
- Real-time multi-user collaboration with presence awareness
- Portable session folders that can be moved between machines
- Role-based access control
- Event history with optional rollback

#### Colony Structure

A Colony is a self-contained directory containing all session data. It can reside on local disk, USB storage, cloud sync folders, or network shares:

```
my-colony/
│
├── colony.hive                 # 📄 Manifest file (YAML) - human-readable config
├── colony.lock                 # 🔒 Lock file (who has it open, prevents conflicts)
│
├── honey/                      # 🍯 HONEY - The project we're working on
│   └── (symlink or files)      #    Whatever the colony is building (can point anywhere!)
│
├── honeycomb/                  # 🪺 HONEYCOMB - Session knowledge  
│   ├── state.json              #    Runtime state (agents, costs, users)
│   ├── changelog.jsonl         #    Event history (who did what, when)
│   ├── snapshots/              #    Periodic checkpoints for rollback
│   ├── messages.md             #    Inter-agent communication log
│   ├── status.md               #    Current status board
│   ├── memory/                 #    Agent memories and context
│   └── prompts/                #    Custom prompts for this colony
│
└── pollen/                     # 🌸 POLLEN - Tools & resources
    ├── tools/                  #    Custom scripts
    ├── imports/                #    Imported resources
    └── generated/              #    AI-generated assets
```

**Architecture:**

The colony directory contains only session metadata. The actual project files (`honey/`) can be a symlink to any location—local filesystem, WSL mount, NAS, etc. This separation enables:

- Session portability independent of project location
- Multiple colonies targeting the same project
- Migration between development machines
- Flexible deployment topologies

#### Colony Manifest (`colony.hive`)

YAML configuration file defining colony settings:

```yaml
# colony.hive
version: 1
id: "col_abc123def456"
name: "My Awesome Project"
created: "2024-12-19T10:00:00Z"
last_accessed: "2024-12-19T15:30:00Z"

# Directory paths (relative or absolute, symlinks supported)
directories:
  honey: "./honey"                    # Or symlink to ~/projects/my-app
  honeycomb: "./honeycomb"
  pollen: "./pollen"
  external:                           # Additional linked directories
    - path: "~/Documents/shared-docs"
      alias: "docs"
      mode: "read-write"

# Default agent configuration
defaults:
  model_tier: "fast"                  # cruise | fast | turbo | cosmic
  agents:
    - role: forge
      task: general
    - role: sentinel
      task: tests

# Collaboration settings
sharing:
  enabled: true
  mode: "invite-only"                 # invite-only | password | open
  max_users: 5

# Access control
access:
  owner: "steven"
  admins: ["alex"]
  contributors: []
  viewers: []

# History configuration
history:
  tier: "standard"                    # minimal | standard | full
  snapshot_interval: 60               # minutes
  max_snapshots: 48
  retention_days: 30
```

#### Lifecycle States

```
┌──────────┐     ┌─────────┐     ┌─────────┐
│ STARTING │ ──> │ RUNNING │ ──> │ STOPPED │
└──────────┘     └─────────┘     └─────────┘
                      │               │
                      │    ┌──────┐   │
                      └──> │ IDLE │ <─┘
                           └──────┘
```

| State | Description |
|-------|-------------|
| **STARTING** | Loading colony from disk, initializing services |
| **RUNNING** | Active session with connected users and working agents |
| **IDLE** | No connected users; agents may continue running in tmux |
| **STOPPED** | Clean shutdown; session is portable and can be migrated |

**Persistence behavior:**
- **RUNNING/IDLE**: Continuous state persistence, tmux sessions maintained
- **STOPPED**: Serialized state, safe to copy/move the colony directory

#### Multi-User Collaboration

Real-time presence system via WebSocket:

| Status | Indicator | Condition |
|--------|-----------|-----------|
| Online | 🟢 | Activity within 2 minutes |
| Idle | 🟡 | No activity for 2-10 minutes |
| Offline | ⚫ | Disconnected |

**Collaboration features:**
- User presence indicators
- Focus tracking (which agent/panel a user is viewing)
- Real-time join/leave events
- Shared activity feed

#### Access Control

| Role | Start/Stop | Manage Users | Deploy Agents | Send Commands | View |
|------|------------|--------------|---------------|---------------|------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Contributor** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ✅ |

**Conflict resolution:**
- Concurrent agent commands: Processed in arrival order
- Settings modifications: Last-write-wins with change notifications
- Agent lifecycle changes: Permission-gated with audit logging

#### History & Rollback

Three configurable history tiers:

| Tier | What's Saved | Storage | Capability |
|------|--------------|---------|------------|
| **Minimal** | Event log only | ~KB/day | See what happened |
| **Standard** | + Hourly snapshots | ~MB/day | Restore to checkpoint |
| **Full** | + Every change versioned | ~10MB+/day | Time travel, branching, diff |

**Event log format (JSON Lines):**
```jsonl
{"ts":"2024-12-19T10:05:00Z","type":"agent_spawned","agent":"forge-api","user":"steven"}
{"ts":"2024-12-19T10:06:00Z","type":"command_sent","agent":"forge-api","cmd":"add pagination"}
{"ts":"2024-12-19T10:30:00Z","type":"agent_completed","agent":"forge-api","commits":3}
{"ts":"2024-12-19T10:31:00Z","type":"user_joined","user":"alex"}
```

**Full History Mode** capabilities:
- Commit-level state tracking
- Branch/merge support for experimental workflows
- Diff comparison between states
- Internal VCS (separate from project repository)

#### Portability

Colony directories are fully portable. Migration workflow:

1. Stop colony or ensure IDLE state
2. Copy directory to target location
3. On destination machine:
   - Update `honey` symlink if path changed
   - Open colony in Hivemind
   - Resume session

**CLI commands (planned):**
```bash
# Export colony (bundles everything)
hivemind export my-colony --output ~/Desktop/my-colony.zip

# Import colony
hivemind import ~/Desktop/my-colony.zip --to ~/.hivemind/colonies/

# Clone colony (new ID, fresh history)
hivemind clone my-colony new-colony
```

**Export options:**
- `--include-honey`: Resolve symlinks, include project files
- `--include-snapshots`: Include checkpoint history
- `--include-pollen`: Include tools/resources

#### File Locking

Lock file prevents concurrent access conflicts:

```json
// colony.lock
{
  "holder": "steven",
  "host": "192.168.1.50",
  "port": 3000,
  "pid": 12345,
  "locked_at": "2024-12-19T10:00:00Z"
}
```

**Behavior:**
- Lock exists → Prompt to join existing session
- Stale lock (PID not running) → Allow override
- On close → Lock file removed

#### Implementation Phases

| Phase | Features | Status |
|-------|----------|--------|
| **Phase 1** | Colony folder structure, manifest, state save/load, lock file | 📋 Planned |
| **Phase 2** | Event changelog, periodic snapshots, restore from snapshot | 📋 Planned |
| **Phase 3** | WebSocket presence, user join/leave, focus tracking, notifications | 📋 Planned |
| **Phase 4** | Export/import commands, clone, path migration helper | 📋 Planned |
| **Phase 5** | Full history mode, internal VCS, branching, merge/diff | 📋 Planned |

---

### 🐝 Swarm Buzz — Topology Animation

Animated network topology where agent nodes exhibit dynamic movement patterns based on system state.

**Behaviors:**
- **Idle**: Subtle ambient movement for inactive agents
- **Active**: Increased motion intensity during task execution
- **Communication**: Visual indicators for inter-agent messaging
- **Toggle**: User preference for static vs. animated layout
- **State reflection**: Animation patterns indicate overall swarm health

---

### 🧙 Setup Wizard — First-Run Configuration

Guided onboarding flow:

| Step | Purpose |
|------|---------|
| **Welcome** | Introduction and overview |
| **API Keys** | OpenRouter/Anthropic key configuration with connection validation |
| **Project Directory** | Working directory selection or new colony creation |
| **Speed Profile** | Model tier selection (Cruise/Fast/Turbo/Cosmic) with cost estimates |
| **First Agent** | Initial agent deployment and task assignment |
| **Tour** | UI walkthrough highlighting key components |

---

### 🔌 Connectors Module — External Integrations

Plugin architecture for third-party service integration.

#### Planned Connectors

| Connector | Purpose | Priority |
|-----------|---------|----------|
| **Git** | Commit tracking, branch awareness, auto-commit on task completion | High |
| **GitHub** | PR creation, issue tracking, code review integration | High |
| **GitLab** | Same as GitHub for GitLab users | Medium |
| **Slack** | Notifications, slash commands, channel updates | Medium |
| **Discord** | Bot integration, voice channel presence | Medium |
| **VS Code** | Extension for in-editor agent control | High |
| **Docker** | Container orchestration, isolated environments | Medium |
| **Jira** | Issue sync, sprint integration | Low |
| **Linear** | Modern issue tracking integration | Low |
| **Notion** | Documentation sync | Low |

#### Connector Interface (Draft)

```typescript
interface HivemindConnector {
  name: string
  version: string
  
  // Lifecycle
  initialize(config: ConnectorConfig): Promise<void>
  shutdown(): Promise<void>
  
  // Events (what the connector can react to)
  onAgentSpawned?(agent: Agent): void
  onAgentCompleted?(agent: Agent, result: TaskResult): void
  onCommandSent?(agent: Agent, command: string): void
  onError?(error: Error): void
  
  // Actions (what the connector can do)
  actions?: {
    [key: string]: (params: any) => Promise<any>
  }
}
```

#### Example: Git Connector

```typescript
const gitConnector: HivemindConnector = {
  name: 'git',
  version: '1.0.0',
  
  async initialize(config) {
    // Verify git repo exists
    // Set up file watchers
  },
  
  onAgentCompleted(agent, result) {
    // Auto-commit changes with descriptive message
    // Include agent name and task in commit
  },
  
  actions: {
    createBranch: async ({ name }) => { /* ... */ },
    commit: async ({ message }) => { /* ... */ },
    push: async () => { /* ... */ },
    getCurrentBranch: async () => { /* ... */ },
  }
}
```

---

### 🎨 UI Enhancements

Planned dashboard improvements:

| Feature | Description |
|---------|-------------|
| **Themes** | Dark/light mode, custom color schemes |
| **Keyboard Shortcuts** | Configurable hotkeys with vim-style option |
| **Agent Templates** | Reusable agent configurations |
| **Task Queue** | Visual pending work queue |
| **Cost Dashboard** | API usage breakdown and tracking |
| **Responsive Layout** | Tablet and mobile support |
| **Notifications** | Desktop notification integration |
| **Audio Feedback** | Optional sound effects for events |

---

## 📋 Technical Notes

### Model Selection

All model configurations use NATO-friendly providers only. No DeepSeek or other restricted models.

| Tier | Lead Model | Support Model |
|------|------------|---------------|
| **Cruise** | Claude 3.5 Haiku | GPT-4o Mini, Gemini Flash |
| **Fast** | Claude Sonnet 4 | Claude 3.5 Haiku |
| **Turbo** | Claude Opus 4.5 | Claude Sonnet 4 |
| **Cosmic** | Claude Opus 4.5 (all) | — |

### Session Naming

tmux sessions follow the pattern: `{prefix}-{role}-{task}`

Example: `hive-forge-auth` → Prefix: hive, Role: forge, Task: auth

### Conductor Tools

The Conductor (QUEEN) can execute these tools via natural language:

| Tool | Syntax | Description |
|------|--------|-------------|
| `deploy_agent` | `[TOOL: deploy_agent(role, task)]` | Spawn a new agent |
| `send_to_agent` | `[TOOL: send_to_agent(name, message)]` | Send command to agent |
| `broadcast` | `[TOOL: broadcast(message)]` | Message all agents |
| `kill_agent` | `[TOOL: kill_agent(name)]` | Terminate an agent |
| `get_status` | `[TOOL: get_status()]` | Get swarm status |

### Agent Roles

| Role | Icon | Purpose |
|------|------|---------|
| **FORGE** | 🔨 | Primary builder - code, features, implementation |
| **SENTINEL** | 🛡️ | Quality assurance - tests, validation, review |
| **ORACLE** | 🔮 | Research - analysis, exploration, documentation |
| **NEXUS** | 🔗 | Integration - APIs, systems, coordination |
| **SCRIBE** | 📝 | Documentation - guides, changelogs, knowledge |
| **CONDUCTOR** | 👑 | Orchestration - task management, swarm coordination |

### Directory Structure Conventions

```
project/
├── prompts/                    # Agent system prompts
│   ├── CONDUCTOR_WEB_PROMPT.md
│   ├── FORGE_PROMPT.md
│   └── ...
├── .hivemind/                  # Local hivemind config (future)
└── (project files)
```

---

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build specific package
pnpm --filter @hivemind/core build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

---

## 📄 License

MIT © 2024 Hivemind Contributors

---

*Built by the Hivemind team*

