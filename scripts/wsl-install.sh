#!/bin/bash
# Hivemind WSL Dependencies Installer
# Run this inside WSL after wsl --install
#
# Usage: ./scripts/wsl-install.sh           # Interactive mode
#        ./scripts/wsl-install.sh -y        # Non-interactive, install everything
#        ./scripts/wsl-install.sh --no-aider # Skip aider installation

set -e

# Parse arguments
INSTALL_AIDER=""
INTERACTIVE=true

for arg in "$@"; do
    case $arg in
        -y|--yes)
            INTERACTIVE=false
            INSTALL_AIDER=true
            ;;
        --no-aider)
            INSTALL_AIDER=false
            ;;
        --with-aider)
            INSTALL_AIDER=true
            ;;
        -h|--help)
            echo "Usage: $0 [-y|--yes] [--no-aider] [--with-aider]"
            echo "  -y, --yes      Non-interactive mode, install everything"
            echo "  --no-aider     Skip aider-chat installation"
            echo "  --with-aider   Install aider-chat"
            exit 0
            ;;
    esac
done

echo "🐝 Hivemind WSL Dependencies Installer"
echo "======================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if running in WSL
if [ ! -f /proc/version ] || ! grep -qi microsoft /proc/version; then
    echo -e "${YELLOW}Warning: This doesn't appear to be WSL. Continuing anyway...${NC}"
fi

# Update packages
echo -e "\n${CYAN}📦 Updating packages...${NC}"
sudo apt-get update -qq

# Install system dependencies
echo -e "\n${CYAN}📦 Installing tmux, nodejs, npm, python3-pip...${NC}"
sudo apt-get install -y tmux nodejs npm python3-pip

# Install Python packages
echo -e "\n${CYAN}📦 Installing Python packages...${NC}"
pip3 install --break-system-packages mcp fastmcp pydantic uvicorn

# Handle aider installation
if [ "$INSTALL_AIDER" = "" ] && [ "$INTERACTIVE" = true ]; then
    read -p "Install aider-chat for AI agents? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INSTALL_AIDER=true
    fi
fi

if [ "$INSTALL_AIDER" = true ]; then
    echo -e "${CYAN}Installing aider-chat...${NC}"
    pip3 install --break-system-packages aider-chat
fi

# Add local bin to PATH
if ! grep -q 'HOME/.local/bin' ~/.bashrc; then
    echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc
    echo -e "${GREEN}✅ Added ~/.local/bin to PATH${NC}"
fi

# Verify installations
echo -e "\n${CYAN}📦 Verifying installations...${NC}"
echo -e "  tmux:    $(tmux -V)"
echo -e "  python3: $(python3 --version)"
echo -e "  node:    $(node --version)"
echo -e "  npm:     $(npm --version)"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}🐝 WSL Dependencies Installed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Source your bashrc: ${YELLOW}source ~/.bashrc${NC}"
echo -e "  2. Start MCP server:   ${YELLOW}python3 mcp/hivemind_mcp.py --http --port 8000${NC}"
echo -e "  3. Start dashboard:    ${YELLOW}cd dashboard && npm run dev${NC}"
echo ""

