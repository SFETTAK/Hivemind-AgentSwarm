#!/bin/bash
# =============================================================================
# HIVEMIND INSTALLER - Linux/macOS/WSL
# =============================================================================
#
# One-line install:
#   curl -fsSL https://raw.githubusercontent.com/SFETTAK/Hivemind-AgentSwarm/main/scripts/install.sh | bash
#
# Or download and run:
#   chmod +x install.sh
#   ./install.sh
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${CYAN}========================================"
echo "  🐝 Hivemind Installer"
echo "========================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Detect OS
# -----------------------------------------------------------------------------
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    if grep -q Microsoft /proc/version 2>/dev/null; then
        OS="wsl"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

log_info "Detected OS: $OS"

# -----------------------------------------------------------------------------
# Check/Install Dependencies
# -----------------------------------------------------------------------------
check_command() {
    if command -v "$1" &> /dev/null; then
        log_success "$1 found"
        return 0
    else
        return 1
    fi
}

install_linux_deps() {
    log_info "Installing Linux dependencies..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y git curl tmux python3 python3-pip
        
        # Install Node.js 20+ if needed
        if ! check_command node || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
            log_info "Installing Node.js 20..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y git curl tmux python3 python3-pip nodejs
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy --noconfirm git curl tmux python python-pip nodejs npm
    else
        log_error "Unsupported package manager. Please install manually:"
        log_error "  git, curl, tmux, python3, pip, nodejs (v20+), npm"
        exit 1
    fi
}

install_macos_deps() {
    log_info "Installing macOS dependencies..."
    
    # Check for Homebrew
    if ! check_command brew; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install git curl tmux python node
}

# Install OS-specific dependencies
case $OS in
    linux|wsl)
        install_linux_deps
        ;;
    macos)
        install_macos_deps
        ;;
    *)
        log_error "Unsupported OS: $OSTYPE"
        exit 1
        ;;
esac

# -----------------------------------------------------------------------------
# Install pnpm
# -----------------------------------------------------------------------------
if ! check_command pnpm; then
    log_info "Installing pnpm..."
    npm install -g pnpm
    log_success "pnpm installed"
fi

# -----------------------------------------------------------------------------
# Install aider
# -----------------------------------------------------------------------------
if ! check_command aider; then
    log_info "Installing aider..."
    pip3 install aider-chat --break-system-packages 2>/dev/null || pip3 install aider-chat
    log_success "aider installed"
fi

# -----------------------------------------------------------------------------
# Clone/Update Hivemind
# -----------------------------------------------------------------------------
INSTALL_DIR="$HOME/Hivemind-AgentSwarm"

if [ -d "$INSTALL_DIR" ]; then
    log_info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    log_info "Cloning Hivemind..."
    git clone https://github.com/SFETTAK/Hivemind-AgentSwarm.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
log_info "Installing dependencies..."
pnpm install

log_info "Building packages..."
pnpm build

# -----------------------------------------------------------------------------
# Create settings template
# -----------------------------------------------------------------------------
if [ ! -f "$INSTALL_DIR/settings.json" ]; then
    log_info "Creating settings.json..."
    cat > "$INSTALL_DIR/settings.json" << 'EOF'
{
  "openrouterApiKey": "",
  "anthropicApiKey": "",
  "projectDir": ".",
  "promptsDir": "./mcp/prompts",
  "tmuxPrefix": "hive",
  "autoAccept": true,
  "speedLevel": 2
}
EOF
    log_warn "Please edit settings.json to add your API key"
fi

# -----------------------------------------------------------------------------
# Create launcher script
# -----------------------------------------------------------------------------
LAUNCHER="$HOME/.local/bin/hivemind"
mkdir -p "$HOME/.local/bin"

cat > "$LAUNCHER" << 'EOF'
#!/bin/bash
# Hivemind Launcher

HIVEMIND_DIR="$HOME/Hivemind-AgentSwarm"
cd "$HIVEMIND_DIR"

# Kill any existing hivemind sessions
tmux kill-session -t hivemind-api 2>/dev/null || true

# Start API server in tmux
echo "Starting API server..."
tmux new-session -d -s hivemind-api -c "$HIVEMIND_DIR/packages/api" "node dist/index.js"

# Wait for API to be ready
echo "Waiting for API..."
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Start dashboard
echo "Starting dashboard..."
echo ""
echo "========================================"
echo "  🐝 Hivemind is running!"
echo "========================================"
echo ""
echo "  Dashboard: http://localhost:5173"
echo "  API:       http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

cd "$HIVEMIND_DIR/apps/dashboard"
npx vite --host 0.0.0.0
EOF

chmod +x "$LAUNCHER"

# Add to PATH if not already
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# Create stop script
# -----------------------------------------------------------------------------
cat > "$HOME/.local/bin/hivemind-stop" << 'EOF'
#!/bin/bash
# Stop all Hivemind services

echo "Stopping Hivemind..."

# Kill API server
tmux kill-session -t hivemind-api 2>/dev/null && echo "API server stopped"

# Kill all agent sessions
for session in $(tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^hive-"); do
    tmux kill-session -t "$session" 2>/dev/null && echo "Killed: $session"
done

echo "Hivemind stopped."
EOF

chmod +x "$HOME/.local/bin/hivemind-stop"

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================"
echo "  ✅ Hivemind Installed Successfully!"
echo "========================================${NC}"
echo ""
echo "  To start Hivemind:"
echo -e "    ${CYAN}hivemind${NC}"
echo ""
echo "  To stop Hivemind:"
echo -e "    ${CYAN}hivemind-stop${NC}"
echo ""
echo "  Configuration:"
echo "    $INSTALL_DIR/settings.json"
echo ""

# Check if API key is set
if ! grep -q '"openrouterApiKey": "[^"]' "$INSTALL_DIR/settings.json" 2>/dev/null; then
    echo -e "${YELLOW}  ⚠️  Don't forget to add your OpenRouter API key!${NC}"
    echo "    Edit: $INSTALL_DIR/settings.json"
    echo ""
fi

echo "  Documentation:"
echo "    https://github.com/SFETTAK/Hivemind-AgentSwarm"
echo ""

# Prompt to start
read -p "Start Hivemind now? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    export PATH="$HOME/.local/bin:$PATH"
    exec hivemind
fi

