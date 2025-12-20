# Hivemind Installation Guide

## Quick Install

### Linux / macOS / WSL

One command:

```bash
curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash
```

This will:
- Install dependencies (git, tmux, node, pnpm, aider)
- Clone the repository
- Build all packages
- Create `hivemind` and `hivemind-stop` commands

### Windows

1. **Download the installer:**
   - Go to: https://github.com/SFETTAK/Hivemind-AgentSwarm/blob/main/scripts/install-windows.bat
   - Click "Raw" → Right-click → "Save as..." → Save to Desktop

2. **Run as Administrator:**
   - Right-click `install-windows.bat`
   - Select "Run as administrator"
   - Follow the prompts

3. **What it does:**
   - Installs WSL2 (Windows Subsystem for Linux)
   - Installs Ubuntu
   - Runs the Linux installer inside WSL
   - Creates a desktop shortcut

> **Note:** Windows installation requires a restart after WSL is installed. Run the installer again after restart.

---

## Manual Installation

If the one-liner doesn't work, install manually:

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| pnpm | 8+ | `pnpm -v` |
| tmux | any | `tmux -V` |
| git | any | `git --version` |
| aider | any | `aider --version` |

### Install Dependencies

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y git curl tmux python3 python3-pip

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm

# aider
pip3 install aider-chat
```

**macOS:**
```bash
brew install git curl tmux python node
npm install -g pnpm
pip3 install aider-chat
```

**Fedora/RHEL:**
```bash
sudo dnf install -y git curl tmux python3 python3-pip
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pnpm
pip3 install aider-chat
```

### Clone and Build

```bash
# Clone
git clone https://github.com/SFETTAK/Hivemind-AgentSwarm.git
cd Hivemind-AgentSwarm

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Configure

Create `settings.json` in the project root:

```json
{
  "openrouterApiKey": "sk-or-v1-your-key-here",
  "projectDir": "/path/to/your/project",
  "promptsDir": "./mcp/prompts",
  "tmuxPrefix": "hive",
  "autoAccept": true,
  "speedLevel": 2
}
```

**Get an API key:**
- OpenRouter: https://openrouter.ai/keys (recommended)
- Anthropic: https://console.anthropic.com/

### Run

```bash
# Start API server
cd packages/api
node dist/index.js &

# Start dashboard (in another terminal)
cd apps/dashboard
npx vite --host 0.0.0.0
```

Open http://localhost:5173

---

## Post-Installation

### Add Your API Key

Edit `~/Hivemind-AgentSwarm/settings.json`:

```json
{
  "openrouterApiKey": "sk-or-v1-your-actual-key"
}
```

### Start Hivemind

```bash
hivemind
```

### Stop Hivemind

```bash
hivemind-stop
```

Or press `Ctrl+C` in the terminal running the dashboard.

---

## Troubleshooting

### "command not found: hivemind"

The PATH wasn't updated. Either:
- Open a new terminal
- Or run: `export PATH="$HOME/.local/bin:$PATH"`

### Build fails with TypeScript errors

Make sure you have Node 20+:
```bash
node -v  # Should be v20.x.x or higher
```

### tmux errors

Make sure tmux is installed:
```bash
tmux -V
```

### Windows: WSL not installing

- Make sure Windows is fully updated
- Enable "Virtual Machine Platform" in Windows Features
- Run PowerShell as admin: `wsl --install`

### Agents not responding

1. Check that your API key is valid
2. Check the API server is running: `curl http://localhost:3001/health`
3. Check tmux sessions: `tmux list-sessions`

---

## Updating

```bash
cd ~/Hivemind-AgentSwarm
git pull
pnpm install
pnpm build
```

---

## Uninstalling

```bash
# Stop all services
hivemind-stop

# Remove the installation
rm -rf ~/Hivemind-AgentSwarm
rm ~/.local/bin/hivemind
rm ~/.local/bin/hivemind-stop
```

On Windows, also remove the desktop shortcut.

