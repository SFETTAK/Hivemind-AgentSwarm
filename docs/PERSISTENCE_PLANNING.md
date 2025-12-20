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

**Proposed states:**
```
┌──────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ STARTING │ ──> │ RUNNING │ ──> │ SUSPENDED │ ──> │ STOPPED │
└──────────┘     └─────────┘     └───────────┘     └─────────┘
                      │                │
                      └────────────────┘
                        (host reconnects)
```

- **STARTING** - Colony initializing, loading state
- **RUNNING** - Active, host connected, agents working  
- **SUSPENDED** - Host disconnected, agents still alive in tmux. Can resume.
- **STOPPED** - Explicitly ended. Agents killed. Save file remains for reload.

**Questions:**
- [ ] Can a SUSPENDED colony be resumed by someone other than host?
- [ ] How long before SUSPENDED auto-stops? (Or does it run forever until explicit stop?)
- [ ] Auto-save on state transitions?

**Decision:** _____________

---

#### Q1.4: What defines a "Colony"?

**Proposed model:**
```
COLONY (the world - persistent save file + runtime state)
├── Colony ID (unique, generated once)
├── Name (user-friendly, e.g. "awesome-app")
├── Primary working directory
├── Additional resource directories (optional)
├── State
│   ├── Lifecycle status (STARTING/RUNNING/SUSPENDED/STOPPED)
│   ├── Active agents
│   ├── Connected users
│   ├── Cost tracking
│   └── Last checkpoint
├── Settings
│   ├── Model tier (cruise/fast/turbo/cosmic)
│   ├── Default agents to spawn on start
│   └── Sharing/collab config
├── Host user
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
6. Save file created
```

**Questions:**
- [ ] Is Colony ID stable forever, or regenerated on "Save As" / fork?
- [ ] Can a Colony exist as just a save file (STOPPED) with no active runtime?
- [ ] Multiple colonies on same working directory - allowed or warned?

**Decision:** _____________

---

### 2. Save File Structure

#### Q2.1: Where do Hivemind files live?

**Options:**
- [ ] **A) Global home** - `~/.hivemind/projects/<project-id>/`
- [ ] **B) Per-project** - `<project-dir>/.hivemind/`
- [ ] **C) Configurable** - Default global, can override per-project
- [ ] **D) Hybrid** - Config in project, state in global

**Decision:** _____________

**Pros/Cons:**
```
Global home:
  ✅ Project folder stays clean
  ✅ One place to backup all Hivemind data
  ❌ Harder to "pack up and go" with project
  ❌ Path breaks if project moves

Per-project:
  ✅ Portable with project
  ✅ Easy to version control (or .gitignore)
  ❌ Clutters project folder
  ❌ Different users have different Hivemind states

Hybrid:
  ✅ Best of both?
  ❌ Complexity
```

---

#### Q2.2: What goes in each file?

**Proposed file breakdown:**

| File | Purpose | Format | Versioned? |
|------|---------|--------|------------|
| `project.hive` | Project manifest/blueprint | YAML/JSON | ✅ Optional |
| `state.json` | Runtime session state | JSON | ❌ |
| `history.jsonl` | Chat/decision history | JSON Lines | ❌ |
| `messages.md` | Inter-agent messages | Markdown | ❌ |
| `checkpoints/` | Auto-save snapshots | JSON | ❌ |

**Questions:**
- [ ] Should `project.hive` be YAML (human-friendly) or JSON (machine-friendly)?
- [ ] Is `messages.md` for humans or machines? Both?
- [ ] What's the checkpoint strategy? Time-based? Event-based?

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
| | | | |

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
