# Hivemind Persistence & Session Planning

> Working document for planning Hivemind's persistence layer and multiplayer model.

---

## 🎮 Core Metaphor: Multiplayer Survival Crafting Game

Hivemind sessions work like multiplayer game worlds:

| Game Concept | Hivemind Equivalent |
|--------------|---------------------|
| World/Save | **Colony** (project + session state) |
| Players | Users (collaborative editing) |
| NPCs/Bots | Agents (FORGE, SENTINEL, etc.) |
| Host | User who started the colony |
| Private Server | Runs when host has it running |
| Dedicated Server | Always-on deployment |
| Join Code | Address + API key |

**Key insight:** The work players do changes the world. The world IS the persistence.
The game server (Hive server) just hosts it.

---

## 📋 Questions to Resolve

### 1. Project & Session Model

#### Q1.1: One session per project, or multiple?
> Can two lobbies run on the same project simultaneously?

**Options:**
- [ ] **A) One session per project** - Simple, prevents conflicts
- [x] **B) Multiple sessions allowed** - More flexible, needs conflict handling
- [ ] **C) One "live" session, multiple "saved" sessions** - Like game save slots

**Decision:** ✅ Multiple worlds/projects can run simultaneously

**Notes:**
```
- Each world/project runs in its own isolated ENV
- Worlds CAN share file space if desired (working on same codebase)
- Worlds can communicate via the existing message system (leave notes)
- tmux namespace isolation: prefix sessions with world ID (hive-<world>-<agent>)
- This is like running multiple game servers - each is independent but 
  could theoretically interact
```

**Project Creation Flow:**
```
1. "New World" / "New Project"
2. Select primary working directory
3. Optionally add additional directories/resources to the project
4. World spins up in isolated ENV
```

---

#### Q1.2: Session persistence - What happens on close?
> Does closing the browser end the session? Can you "resume" tomorrow?

**Options:**
- [ ] **A) Ephemeral** - Close browser = session ends, agents killed
- [ ] **B) Persistent background** - Session keeps running, reconnect anytime
- [x] **C) Hybrid** - Agents keep running, session state saved, can reconnect OR start fresh

**Decision:** ✅ Hybrid persistence

**Notes:**
```
- Close browser → agents keep running (tmux independent)
- Session state auto-saves periodically
- Reconnect → resume where you left off
- Explicit "End Session" → kills agents, offers clean slate
- Like leaving a game running vs save & quit
```

---

#### Q1.3: Colony lifecycle states
> What states can a colony be in?

**Decided states:**
```
┌──────────┐     ┌─────────┐     ┌─────────┐
│ STARTING │ ──> │ RUNNING │ ──> │ STOPPED │
└──────────┘     └─────────┘     └─────────┘
                      │               │
                      │    ┌──────┐   │
                      └──> │ IDLE │ <─┘  (no users connected,
                           └──────┘       agents may still be alive)
```

- **STARTING** - Colony initializing, loading state from disk
- **RUNNING** - Active, users connected, agents working, continuous saves
- **IDLE** - No users connected, agents may still be running in tmux
- **STOPPED** - Explicitly ended. Agents killed. Portable save file remains.

**Decision:** ✅ Simplified states

**Key insights:**
```
- Colony is fundamentally just files (reads/writes)
- If running, it's always saving - continuous persistence
- IDLE vs RUNNING is really just "are users connected?"
- STOPPED is the portable state - can move colony to another machine
- File locking prevents two people opening same colony simultaneously
  → Instead, prompt to JOIN the already-open colony
```

**Persistence model:**
```
Running colony = files on disk + session state in RAM + agents in tmux
Stopped colony = just files on disk (portable, can move anywhere)
```

---

#### Q1.4: What defines a "Colony"?

**Decided model:**
```
COLONY (the world - persistent save file + runtime state)
├── Colony ID (unique, stable forever)
├── Name (human-friendly, e.g. "awesome-app")
├── Primary working directory
├── Additional resource directories (optional)
├── State
│   ├── Lifecycle status (STARTING/RUNNING/IDLE/STOPPED)
│   ├── Active agents
│   ├── Connected users
│   ├── Cost tracking
│   └── File lock (prevents duplicate opens)
├── Settings
│   ├── Model tier (cruise/fast/turbo/cosmic)
│   ├── Default agents to spawn on start
│   └── Sharing/collab config
├── Access Control
│   ├── Owner (host)
│   ├── Admins (can start/stop, manage users)
│   ├── Contributors (read/write, can use agents)
│   └── Viewers (read-only)
├── Created timestamp
└── Last accessed timestamp
```

**Colony Creation Flow:**
```
1. User clicks "New Colony"
2. Select primary working directory
3. Optionally add additional directories/resources
4. Name the colony
5. Colony spins up in isolated ENV
6. Save file created with file lock
```

**Decision:** ✅ Confirmed

**Key decisions:**
```
- Colony ID: Stable forever (unique identifier for save file)
- Colony can exist as STOPPED save file (portable, can move to new machine)
- Multiple colonies on same directory: Allowed (we'll see if it's a bad idea)
- File locking: Prevents two people opening same colony
  → If locked, prompt: "Colony already open. Join session?"
```

**Access tiers:**
| Role | Start/Stop | Manage Users | Deploy Agents | Send Commands | View |
|------|------------|--------------|---------------|---------------|------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contributor | ❌ | ❌ | ✅ | ✅ | ✅ |
| Viewer | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### 2. Save File Structure

#### Q2.1: Colony folder structure

**Decision:** ✅ Colony is a folder (container)

```
my-colony/                          # The Colony folder (portable unit)
│
├── colony.hive                     # Colony manifest - the "save file"
│
├── honey/                          # 🍯 HONEY - The actual project files
│   ├── src/                        #    What we make and build
│   ├── package.json                #    The real work output
│   └── ...                         #    (or symlink to external dir)
│
├── honeycomb/                      # 🪺 HONEYCOMB - Shared knowledge
│   ├── memory/                     #    Agent memories, context
│   ├── prompts/                    #    Custom prompts for this colony
│   ├── messages.md                 #    Inter-agent communication log
│   ├── decisions.md                #    Decision history
│   └── status.md                   #    Current state, who's doing what
│
└── pollen/                         # 🌸 POLLEN - Tools & resources
    ├── tools/                      #    Custom tools, scripts
    ├── imports/                    #    Imported resources
    └── generated/                  #    AI-generated resources
```

**External directories (symlinks):**
```
honey/ can BE a symlink:
  my-colony/honey -> /home/user/projects/real-project/

Or contain symlinks:
  my-colony/honey/
  ├── src/                    # Local
  └── docs -> ~/Documents/project-docs/   # Symlinked
```

**Key insight:** The colony is self-contained and portable, but can reach out to external directories via symlinks. Move the colony folder = move everything (symlinks may break, but that's expected).

---

#### Q2.2: What's in `colony.hive`?

The manifest file - human-readable, version-controllable:

**Format decision:** YAML (human-friendly, comments allowed)

```yaml
# colony.hive - Colony manifest
version: 1
id: "col_abc123def456"
name: "My Awesome Project"
created: "2024-12-19T10:00:00Z"
last_accessed: "2024-12-19T15:30:00Z"

# Directory configuration
directories:
  honey: "./honey"                    # Can be relative or absolute
  honeycomb: "./honeycomb"
  pollen: "./pollen"
  external:                           # Additional linked directories
    - path: "~/Documents/shared-docs"
      alias: "docs"
      mode: "read-write"

# Default settings
defaults:
  model_tier: "fast"
  agents:
    - role: forge
      task: general
    - role: sentinel
      task: tests

# Sharing configuration  
sharing:
  enabled: true
  mode: "invite-only"              # invite-only | password | open
  max_users: 5

# Access control
access:
  owner: "steven"
  admins: ["alex"]
  contributors: []
  viewers: []
```

---

#### Q2.3: Runtime state files (in honeycomb/)

| File | Purpose | Format |
|------|---------|--------|
| `honeycomb/state.json` | Runtime state (agents, users, costs) | JSON |
| `honeycomb/messages.md` | Inter-agent messages | Markdown |
| `honeycomb/status.md` | Current status board | Markdown |
| `honeycomb/decisions.md` | Decision log | Markdown |
| `honeycomb/memory/*.json` | Agent memories | JSON |
| `honeycomb/prompts/*.md` | Custom prompts | Markdown |

**Questions remaining:**
- [ ] Lock file location? (`colony.lock` in root?)
- [ ] Checkpoint/backup strategy?

**Decision:** _____________

---

#### Q2.3: Data integrity & corruption prevention

**Strategies to consider:**

| Strategy | Complexity | Protection Level |
|----------|------------|------------------|
| Atomic writes (write temp, rename) | Low | Medium |
| Write-ahead log (WAL) | Medium | High |
| Checksums on files | Low | Detect-only |
| Periodic backups | Low | Recovery |
| File locking | Medium | Prevents concurrent writes |

**Questions:**
- [ ] What's the minimum viable protection for MVP?
- [ ] Do we need distributed locks for multi-user?
- [ ] How do we handle recovery from corruption?

**Proposed MVP:**
```
1. Atomic writes for all JSON files
2. Checksum in file header
3. Auto-backup before major operations
4. On corruption: prompt to restore from backup
```

**Decision:** _____________

---

### 3. Collaboration Model (Future Section)

_To be filled in after Project & Session decisions are made._

- User identity
- Permissions model
- Conflict handling
- Presence system

---

### 4. Portability (Future Section)

_To be filled in after structure is decided._

- Export/Import format
- What's included in "pack up and go"
- Migration between machines

---

## 📝 Decisions Log

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| 2024-12-19 | Terminology | **Colony** | Hive-themed, differentiates from "project" (the code) |
| 2024-12-19 | Multiple colonies | **Allowed** | Isolated ENVs, can share files, communicate via messages |
| 2024-12-19 | Persistence model | **Hybrid** | Continuous save while running, portable when stopped |
| 2024-12-19 | Lifecycle states | **STARTING/RUNNING/IDLE/STOPPED** | Simple, IDLE = no users, STOPPED = portable |
| 2024-12-19 | Colony identity | **ID (stable) + Name (human)** | ID never changes, name is friendly |
| 2024-12-19 | File locking | **Lock on open, prompt to join** | Prevents conflicts, encourages collaboration |
| 2024-12-19 | Access control | **Owner/Admin/Contributor/Viewer** | Tiered permissions |
| 2024-12-19 | Same directory colonies | **Allowed (experiment)** | May be useful, we'll see |
| 2024-12-19 | Colony structure | **Folder with honey/honeycomb/pollen** | Thematic, organized by purpose |
| 2024-12-19 | Manifest format | **YAML (colony.hive)** | Human-readable, supports comments |
| 2024-12-19 | External dirs | **Symlinks supported** | Flexible, honey can be symlink or contain symlinks |

---

## 🎯 Next Steps

1. [ ] Resolve Q1.1 - Q1.4 (Project & Session model)
2. [ ] Resolve Q2.1 - Q2.3 (Save file structure)
3. [ ] Draft TypeScript types for decided models
4. [ ] Design persistence API
5. [ ] Implement MVP persistence layer
6. [ ] Add collaboration layer

---

*Document created: 2024-12-19*
*Last updated: 2024-12-19*
