#!/bin/bash
# Start Hivemind MCP Server
# Usage: ./scripts/start-server.sh [--background|-b] [--port PORT]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$PROJECT_DIR/mcp"

# Add local bin to PATH
export PATH="$PATH:$HOME/.local/bin"

# Default options
PORT=${HIVEMIND_PORT:-8000}
HOST=${HIVEMIND_HOST:-0.0.0.0}
BACKGROUND=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--background)
            BACKGROUND=true
            shift
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [-b|--background] [-p|--port PORT]"
            echo "  -b, --background  Run in tmux background session"
            echo "  -p, --port PORT   Port to listen on (default: 8000)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 not found. Make sure Python is installed."
    echo "   Try: sudo apt install python3 python3-pip"
    exit 1
fi

# Check if MCP dependencies are installed
if ! python3 -c "import mcp" 2>/dev/null; then
    echo "❌ MCP package not found. Installing dependencies..."
    pip3 install --break-system-packages mcp fastmcp pydantic uvicorn
fi

# Check if hivemind_mcp.py exists
if [ ! -f "$MCP_DIR/hivemind_mcp.py" ]; then
    echo "❌ hivemind_mcp.py not found at $MCP_DIR"
    exit 1
fi

if [ "$BACKGROUND" = true ]; then
    # Check if tmux is available
    if ! command -v tmux &> /dev/null; then
        echo "❌ tmux not found. Install with: sudo apt install tmux"
        exit 1
    fi
    
    # Kill existing session if running
    tmux kill-session -t hivemind-server 2>/dev/null || true
    
    echo "🐝 Starting Hivemind MCP server in background on port $PORT..."
    tmux new-session -d -s hivemind-server "cd $PROJECT_DIR && python3 $MCP_DIR/hivemind_mcp.py --http --port $PORT --host $HOST --project-dir $PROJECT_DIR"
    
    sleep 1
    if tmux has-session -t hivemind-server 2>/dev/null; then
        echo "✅ Server started in tmux session 'hivemind-server'"
        echo ""
        echo "   View logs:  tmux attach -t hivemind-server"
        echo "   Stop:       tmux kill-session -t hivemind-server"
        echo "   Check:      curl http://localhost:$PORT/mcp"
    else
        echo "❌ Failed to start server. Check logs."
        exit 1
    fi
else
    echo "🐝 Starting Hivemind MCP server on http://$HOST:$PORT"
    echo "   Project dir: $PROJECT_DIR"
    echo "   Press Ctrl+C to stop"
    echo ""
    python3 "$MCP_DIR/hivemind_mcp.py" --http --port "$PORT" --host "$HOST" --project-dir "$PROJECT_DIR"
fi

