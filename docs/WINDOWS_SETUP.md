# Windows Setup Guide (WSL2)

Hivemind uses tmux for agent session management, which requires a Linux environment. On Windows, we use WSL2 (Windows Subsystem for Linux).

## Prerequisites

- Windows 10 version 2004+ or Windows 11
- Administrator access (for WSL installation)
- ~2GB disk space for WSL distro

## Quick Start (Automated)

Run PowerShell as Administrator:

```powershell
# First, allow script execution (one-time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run the setup script
.\scripts\windows-setup.ps1
```

Or step by step:

```powershell
# 1. Install WSL2 (requires restart)
wsl --install

# 2. After restart, open "Ubuntu" from the Start Menu
#    Create a username and password when prompted (remember this password!)

# 3. Run the setup script
.\scripts\windows-setup.ps1 -SkipWSLInstall
```

## Manual Setup

### Step 1: Install WSL2

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart your computer when prompted.

### Step 2: Set Up Ubuntu

After restart, Ubuntu will launch automatically. If it doesn't:
1. Open the **Start Menu**
2. Search for "**Ubuntu**" and click it

Create a username and password when prompted. **Remember this password** - you'll need it for `sudo` commands.

### Step 3: Install Dependencies in WSL

Open Ubuntu (or your WSL distro) and run:

```bash
# Update packages (enter your WSL password when prompted)
sudo apt update

# Install tmux, Node.js, and Python pip
sudo apt install -y tmux nodejs npm python3-pip

# Install Python dependencies
pip3 install --break-system-packages mcp fastmcp pydantic uvicorn

# Optional: Install aider for AI agents
pip3 install --break-system-packages aider-chat

# Add local bin to PATH (add to ~/.bashrc for persistence)
echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc
source ~/.bashrc
```

**Or use our install script:**
```bash
# Navigate to the project (replace with your actual path)
cd /mnt/c/path/to/hivemind-agentswarm

# Make script executable and run
chmod +x scripts/wsl-install.sh
./scripts/wsl-install.sh
```

### Step 4: Verify Installation

```bash
tmux -V          # Should show tmux 3.x
python3 --version # Should show Python 3.10+
node --version   # Should show v18+
```

### Step 5: Start the MCP Server

From WSL, navigate to the project and start the server:

```bash
# Navigate to project (replace with your actual path)
# Windows paths map to WSL like this:
#   C:\Projects\hivemind  →  /mnt/c/Projects/hivemind
#   D:\Code\myproject     →  /mnt/d/Code/myproject
cd /mnt/c/Projects/hivemind-agentswarm/mcp

# Start the server
python3 hivemind_mcp.py --http --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Keep this terminal open** - the server needs to stay running.

### Step 6: Start the Dashboard (Optional)

In a new terminal (Windows or WSL):

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Step 7: Configure Cursor MCP

Add to your Cursor MCP settings (`~/.cursor/mcp.json` or `C:\Users\<username>\.cursor\mcp.json`):

```json
{
  "mcpServers": {
    "hivemind": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Restart Cursor to connect.

### Step 8: Verify MCP Connection

After restarting Cursor:
1. Open a new chat (Ctrl+L)
2. Type: "list tmux sessions" or try any hivemind command
3. If connected, you'll see the MCP tools respond
4. If you see "No MCP servers configured", check your mcp.json file

## Troubleshooting

### "pip3: command not found"
```bash
sudo apt install python3-pip
```

### "externally-managed-environment" error
Use the `--break-system-packages` flag:
```bash
pip3 install --break-system-packages <package>
```

### WSL can't access Windows files
Windows drives are mounted at `/mnt/c/`, `/mnt/d/`, etc.
```bash
cd /mnt/c/path/to/hivemind-agentswarm
```

### Port not accessible from Windows
WSL2 should forward ports automatically. If not, check Windows Firewall settings.

### tmux sessions not persisting
tmux sessions only persist while WSL is running. To keep WSL running in background:
```powershell
# Keep WSL running even when all terminals close
wsl --set-default Ubuntu
```

### PowerShell says "script cannot be loaded"
Enable script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "python3: command not found" in WSL
The PATH may not include local bin. Run:
```bash
export PATH=$PATH:$HOME/.local/bin
# Or add to ~/.bashrc permanently
```

### MCP server not connecting to Cursor
1. Make sure the server is running (you should see "Uvicorn running on http://0.0.0.0:8000")
2. Check that `~/.cursor/mcp.json` contains the hivemind config
3. Restart Cursor completely (not just reload window)
4. Check Windows Firewall isn't blocking port 8000

## Architecture Notes

```
┌─────────────────────────────────────────────────────────┐
│                    WINDOWS                               │
│  ┌─────────────┐     ┌─────────────┐                    │
│  │   Cursor    │     │  Dashboard  │                    │
│  │   (IDE)     │     │  (Browser)  │                    │
│  └──────┬──────┘     └──────┬──────┘                    │
│         │                   │                            │
│         │ MCP Protocol      │ HTTP                       │
│         │                   │                            │
├─────────┼───────────────────┼────────────────────────────┤
│         │      WSL2         │                            │
│         ▼                   ▼                            │
│  ┌─────────────────────────────────────┐                │
│  │         MCP Server (Python)          │                │
│  │         http://localhost:8000        │                │
│  └──────────────────┬──────────────────┘                │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────┐                │
│  │              tmux                    │                │
│  │   ┌────────┐ ┌────────┐ ┌────────┐  │                │
│  │   │ FORGE  │ │SENTINEL│ │ ORACLE │  │                │
│  │   └────────┘ └────────┘ └────────┘  │                │
│  └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

## Running as a Service

To keep the MCP server running in the background:

```bash
# In WSL, start a tmux session for the server
tmux new-session -d -s hivemind-server "python3 /mnt/c/path/to/mcp/hivemind_mcp.py --http --port 8000"

# Attach to check on it
tmux attach -t hivemind-server

# Detach with Ctrl+B, then D
```

## API Keys (For Dashboard)

The dashboard needs API keys to spawn AI agents. Get keys from:

| Provider | URL | Notes |
|----------|-----|-------|
| **OpenRouter** (Recommended) | https://openrouter.ai/keys | Access to many models, pay-per-use |
| **Anthropic** | https://console.anthropic.com/ | Direct Claude access |
| **OpenAI** | https://platform.openai.com/api-keys | GPT models |

Edit `dashboard/settings.json` with your keys:
```json
{
  "OPENROUTER_API_KEY": "sk-or-v1-your-key-here",
  "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
}
```

## Next Steps

- See [README.md](../README.md) for full usage documentation
- See [Agent Prompts](../mcp/prompts/) for agent role configurations
- Try spawning your first agent: "Spawn FORGE to work on the API"

