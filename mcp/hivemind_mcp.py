#!/usr/bin/env python3
"""
Hivemind MCP Server
===================

An MCP server for orchestrating AI agents via tmux sessions.
Designed to work with Cursor as the human interface.

Tools:
  - tmux_list: List all agent sessions
  - tmux_spawn: Start a new agent in tmux
  - tmux_kill: Stop an agent session
  - tmux_send: Send input to an agent
  - tmux_read: Read recent output from agent
  - tmux_attach_info: Get info for attaching to a session
  - hivemind_status: Read .hivemind/STATUS.md
  - hivemind_messages: Read .hivemind/MESSAGES.md
  - hivemind_write_message: Write to MESSAGES.md

Usage:
  python hivemind_mcp.py                    # stdio transport (local)
  python hivemind_mcp.py --http --port 8000 # HTTP transport (remote)
  
Environment Variables:
  HIVEMIND_PROJECT_DIR - Default project directory (defaults to cwd)
  HIVEMIND_TMUX_PREFIX - Prefix for tmux sessions (defaults to "hive")
"""

import asyncio
import subprocess
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field, ConfigDict


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_PROJECT_DIR = os.environ.get("HIVEMIND_PROJECT_DIR", os.getcwd())
TMUX_PREFIX = os.environ.get("HIVEMIND_TMUX_PREFIX", "hive")

# =============================================================================
# Initialize MCP Server
# =============================================================================

mcp = FastMCP("hivemind_mcp")


# =============================================================================
# Enums and Models
# =============================================================================

class AgentProgram(str, Enum):
    """Supported agent programs."""
    AIDER = "aider"
    CLAUDE = "claude"
    OLLAMA = "ollama"
    CUSTOM = "custom"


class AgentModel(str, Enum):
    """Common model choices for agents."""
    CLAUDE_SONNET = "claude-3-5-sonnet"
    CLAUDE_OPUS = "claude-opus-4"
    OLLAMA_CODELLAMA = "ollama/codellama:13b"
    OLLAMA_LLAMA = "ollama/llama3.2"
    OLLAMA_DEEPSEEK = "ollama/deepseek-coder"


# =============================================================================
# Input Models
# =============================================================================

class TmuxListInput(BaseModel):
    """Input for listing tmux sessions."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    filter_prefix: Optional[str] = Field(
        default=None,
        description="Only show sessions starting with this prefix"
    )


class TmuxSpawnInput(BaseModel):
    """Input for spawning a new agent."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    name: str = Field(
        ..., 
        description="Session name for the agent (e.g., 'forge', 'sentinel')",
        min_length=1,
        max_length=50
    )
    program: AgentProgram = Field(
        default=AgentProgram.AIDER,
        description="Agent program to run: aider, claude, ollama, or custom"
    )
    model: Optional[str] = Field(
        default=None,
        description="Model to use (e.g., 'claude-3-5-sonnet', 'ollama/codellama:13b')"
    )
    working_dir: Optional[str] = Field(
        default=None,
        description="Working directory for the agent. Defaults to project root."
    )
    initial_prompt: Optional[str] = Field(
        default=None,
        description="Initial prompt/task to send to the agent after startup"
    )
    auto_accept: bool = Field(
        default=True,
        description="Run in auto-accept mode (--yes for aider, --dangerously-skip-permissions for claude)"
    )
    custom_command: Optional[str] = Field(
        default=None,
        description="Custom command to run (only used when program=custom)"
    )
    use_worktree: bool = Field(
        default=False,
        description="Create a git worktree for isolated branch work"
    )
    branch_name: Optional[str] = Field(
        default=None,
        description="Branch name for worktree (defaults to session name)"
    )


class TmuxKillInput(BaseModel):
    """Input for killing a tmux session."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    name: str = Field(
        ...,
        description="Session name to kill"
    )
    force: bool = Field(
        default=False,
        description="Force kill without confirmation"
    )


class TmuxSendInput(BaseModel):
    """Input for sending text to a tmux session."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    name: str = Field(
        ...,
        description="Session name to send to"
    )
    text: str = Field(
        ...,
        description="Text to send to the session"
    )
    press_enter: bool = Field(
        default=True,
        description="Press Enter after sending text"
    )


class TmuxReadInput(BaseModel):
    """Input for reading tmux session output."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    name: str = Field(
        ...,
        description="Session name to read from"
    )
    lines: int = Field(
        default=50,
        description="Number of lines to capture",
        ge=1,
        le=500
    )


class TmuxAttachInfoInput(BaseModel):
    """Input for getting attach information."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    name: str = Field(
        ...,
        description="Session name to get info for"
    )


class HivemindStatusInput(BaseModel):
    """Input for reading hivemind status."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    project_dir: Optional[str] = Field(
        default=None,
        description="Project directory containing .hivemind/. Defaults to current project."
    )


class HivemindMessagesInput(BaseModel):
    """Input for reading hivemind messages."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    project_dir: Optional[str] = Field(
        default=None,
        description="Project directory containing .hivemind/"
    )
    filter_agent: Optional[str] = Field(
        default=None,
        description="Only show messages to/from this agent"
    )
    only_active: bool = Field(
        default=False,
        description="Only show active (unresolved) messages"
    )


class HivemindWriteMessageInput(BaseModel):
    """Input for writing a message to MESSAGES.md."""
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    
    project_dir: Optional[str] = Field(
        default=None,
        description="Project directory containing .hivemind/"
    )
    sender: str = Field(
        ...,
        description="Who is sending the message (e.g., 'CONDUCTOR', 'FORGE')"
    )
    recipient: str = Field(
        ...,
        description="Who should receive the message (e.g., 'FORGE', 'ALL')"
    )
    message_type: str = Field(
        default="REQUEST",
        description="Message type: REQUEST, RESPONSE, ALERT, INFO"
    )
    subject: str = Field(
        ...,
        description="Message subject"
    )
    body: str = Field(
        ...,
        description="Message body/content"
    )


# =============================================================================
# Helper Functions
# =============================================================================

def _run_tmux_command(args: List[str]) -> subprocess.CompletedProcess:
    """Run a tmux command and return the result."""
    cmd = ["tmux"] + args
    return subprocess.run(cmd, capture_output=True, text=True)


def _get_session_name(name: str) -> str:
    """Get the full session name with prefix."""
    if name.startswith(f"{TMUX_PREFIX}-"):
        return name
    return f"{TMUX_PREFIX}-{name}"


def _session_exists(session_name: str) -> bool:
    """Check if a tmux session exists."""
    result = _run_tmux_command(["has-session", "-t", session_name])
    return result.returncode == 0


def _build_agent_command(params: TmuxSpawnInput) -> str:
    """Build the command string for an agent."""
    if params.program == AgentProgram.CUSTOM:
        if not params.custom_command:
            raise ValueError("custom_command required when program=custom")
        return params.custom_command
    
    if params.program == AgentProgram.AIDER:
        cmd_parts = ["aider"]
        if params.model:
            cmd_parts.extend(["--model", params.model])
        if params.auto_accept:
            cmd_parts.append("--yes")
        return " ".join(cmd_parts)
    
    if params.program == AgentProgram.CLAUDE:
        cmd_parts = ["claude"]
        if params.auto_accept:
            cmd_parts.append("--dangerously-skip-permissions")
        return " ".join(cmd_parts)
    
    if params.program == AgentProgram.OLLAMA:
        # For ollama, we typically use aider with ollama backend
        cmd_parts = ["aider"]
        model = params.model or "ollama/codellama:13b"
        cmd_parts.extend(["--model", model])
        if params.auto_accept:
            cmd_parts.append("--yes")
        return " ".join(cmd_parts)
    
    raise ValueError(f"Unknown program: {params.program}")


def _create_worktree(working_dir: str, branch_name: str) -> str:
    """Create a git worktree and return the path."""
    worktree_base = os.path.join(working_dir, ".worktrees")
    os.makedirs(worktree_base, exist_ok=True)
    
    worktree_path = os.path.join(worktree_base, branch_name)
    
    if os.path.exists(worktree_path):
        return worktree_path
    
    # Create the worktree
    result = subprocess.run(
        ["git", "worktree", "add", worktree_path, "-b", f"squad/{branch_name}"],
        cwd=working_dir,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        # Try without -b if branch exists
        result = subprocess.run(
            ["git", "worktree", "add", worktree_path, f"squad/{branch_name}"],
            cwd=working_dir,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"Failed to create worktree: {result.stderr}")
    
    return worktree_path


# =============================================================================
# tmux Tools
# =============================================================================

@mcp.tool(
    name="tmux_list",
    annotations={
        "title": "List Agent Sessions",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def tmux_list(params: TmuxListInput) -> str:
    """List all hivemind agent tmux sessions.
    
    Returns information about running agent sessions including:
    - Session name
    - Status (attached/detached)
    - Working directory
    - Program running
    
    Args:
        params: Filter options for listing sessions
        
    Returns:
        JSON list of session information
    """
    result = _run_tmux_command([
        "list-sessions",
        "-F",
        "#{session_name}|#{session_attached}|#{session_path}|#{session_created}"
    ])
    
    if result.returncode != 0:
        if "no server running" in result.stderr or "no sessions" in result.stderr:
            return json.dumps({"sessions": [], "count": 0})
        return json.dumps({"error": f"Failed to list sessions: {result.stderr}"})
    
    sessions = []
    prefix = params.filter_prefix or TMUX_PREFIX
    
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|")
        if len(parts) >= 4:
            name = parts[0]
            if prefix and not name.startswith(prefix):
                continue
            
            sessions.append({
                "name": name,
                "short_name": name.replace(f"{TMUX_PREFIX}-", ""),
                "attached": parts[1] == "1",
                "path": parts[2],
                "created": parts[3]
            })
    
    return json.dumps({
        "sessions": sessions,
        "count": len(sessions)
    }, indent=2)


@mcp.tool(
    name="tmux_spawn",
    annotations={
        "title": "Spawn New Agent",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True
    }
)
async def tmux_spawn(params: TmuxSpawnInput) -> str:
    """Spawn a new AI agent in a tmux session.
    
    Creates a new tmux session running the specified agent program.
    Supports aider, claude code CLI, and ollama-backed agents.
    
    Args:
        params: Configuration for the new agent session
        
    Returns:
        JSON with session info and status
    """
    session_name = _get_session_name(params.name)
    
    # Check if session already exists
    if _session_exists(session_name):
        return json.dumps({
            "error": f"Session '{session_name}' already exists",
            "suggestion": "Use tmux_kill first or choose a different name"
        })
    
    # Determine working directory
    working_dir = params.working_dir or DEFAULT_PROJECT_DIR
    
    # Create worktree if requested
    if params.use_worktree:
        branch_name = params.branch_name or params.name
        try:
            working_dir = _create_worktree(working_dir, branch_name)
        except RuntimeError as e:
            return json.dumps({"error": str(e)})
    
    # Build the agent command
    try:
        agent_cmd = _build_agent_command(params)
    except ValueError as e:
        return json.dumps({"error": str(e)})
    
    # Create tmux session
    result = _run_tmux_command([
        "new-session",
        "-d",
        "-s", session_name,
        "-c", working_dir,
        agent_cmd
    ])
    
    if result.returncode != 0:
        return json.dumps({
            "error": f"Failed to create session: {result.stderr}",
            "command": f"tmux new-session -d -s {session_name} -c {working_dir} {agent_cmd}"
        })
    
    # Send initial prompt if provided
    if params.initial_prompt:
        await asyncio.sleep(2)  # Wait for agent to start
        _run_tmux_command([
            "send-keys",
            "-t", session_name,
            params.initial_prompt,
            "Enter"
        ])
    
    return json.dumps({
        "success": True,
        "session_name": session_name,
        "short_name": params.name,
        "program": params.program.value,
        "model": params.model,
        "working_dir": working_dir,
        "worktree": params.use_worktree,
        "attach_command": f"tmux attach -t {session_name}"
    }, indent=2)


@mcp.tool(
    name="tmux_kill",
    annotations={
        "title": "Kill Agent Session",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def tmux_kill(params: TmuxKillInput) -> str:
    """Kill an agent tmux session.
    
    Terminates the specified tmux session and the agent running in it.
    
    Args:
        params: Session name to kill
        
    Returns:
        JSON with result status
    """
    session_name = _get_session_name(params.name)
    
    if not _session_exists(session_name):
        return json.dumps({
            "error": f"Session '{session_name}' does not exist"
        })
    
    result = _run_tmux_command(["kill-session", "-t", session_name])
    
    if result.returncode != 0:
        return json.dumps({
            "error": f"Failed to kill session: {result.stderr}"
        })
    
    return json.dumps({
        "success": True,
        "killed": session_name
    })


@mcp.tool(
    name="tmux_send",
    annotations={
        "title": "Send to Agent",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True
    }
)
async def tmux_send(params: TmuxSendInput) -> str:
    """Send text/command to an agent session.
    
    Sends keystrokes to the specified tmux session, allowing you
    to communicate with the running agent.
    
    Args:
        params: Session name and text to send
        
    Returns:
        JSON with result status
    """
    session_name = _get_session_name(params.name)
    
    if not _session_exists(session_name):
        return json.dumps({
            "error": f"Session '{session_name}' does not exist"
        })
    
    args = ["send-keys", "-t", session_name, params.text]
    if params.press_enter:
        args.append("Enter")
    
    result = _run_tmux_command(args)
    
    if result.returncode != 0:
        return json.dumps({
            "error": f"Failed to send keys: {result.stderr}"
        })
    
    return json.dumps({
        "success": True,
        "sent_to": session_name,
        "text": params.text[:100] + ("..." if len(params.text) > 100 else "")
    })


@mcp.tool(
    name="tmux_read",
    annotations={
        "title": "Read Agent Output",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def tmux_read(params: TmuxReadInput) -> str:
    """Read recent output from an agent session.
    
    Captures the terminal buffer from the specified session,
    showing what the agent has been outputting.
    
    Args:
        params: Session name and number of lines to read
        
    Returns:
        JSON with captured output
    """
    session_name = _get_session_name(params.name)
    
    if not _session_exists(session_name):
        return json.dumps({
            "error": f"Session '{session_name}' does not exist"
        })
    
    result = _run_tmux_command([
        "capture-pane",
        "-t", session_name,
        "-p",
        "-S", f"-{params.lines}"
    ])
    
    if result.returncode != 0:
        return json.dumps({
            "error": f"Failed to capture pane: {result.stderr}"
        })
    
    output = result.stdout.rstrip()
    lines = output.split("\n")
    
    return json.dumps({
        "session": session_name,
        "lines_captured": len(lines),
        "output": output
    }, indent=2)


@mcp.tool(
    name="tmux_attach_info",
    annotations={
        "title": "Get Attach Info",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def tmux_attach_info(params: TmuxAttachInfoInput) -> str:
    """Get information for attaching to a session.
    
    Returns the commands and info needed to attach to an agent
    session in a terminal.
    
    Args:
        params: Session name
        
    Returns:
        JSON with attach commands and working directory
    """
    session_name = _get_session_name(params.name)
    
    if not _session_exists(session_name):
        return json.dumps({
            "error": f"Session '{session_name}' does not exist"
        })
    
    # Get session details
    result = _run_tmux_command([
        "display-message",
        "-t", session_name,
        "-p",
        "#{session_path}|#{pane_current_path}"
    ])
    
    path = DEFAULT_PROJECT_DIR
    if result.returncode == 0 and result.stdout.strip():
        parts = result.stdout.strip().split("|")
        path = parts[-1] if parts else DEFAULT_PROJECT_DIR
    
    return json.dumps({
        "session": session_name,
        "attach_command": f"tmux attach -t {session_name}",
        "working_directory": path,
        "cursor_terminal_hint": f"Run in terminal: tmux attach -t {session_name}"
    }, indent=2)


# =============================================================================
# Hivemind File Tools
# =============================================================================

@mcp.tool(
    name="hivemind_status",
    annotations={
        "title": "Read Hivemind Status",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def hivemind_status(params: HivemindStatusInput) -> str:
    """Read the .hivemind/STATUS.md file.
    
    Returns the current swarm status including which agents are
    active, idle, or blocked.
    
    Args:
        params: Project directory location
        
    Returns:
        Content of STATUS.md or error message
    """
    project_dir = params.project_dir or DEFAULT_PROJECT_DIR
    status_path = Path(project_dir) / ".hivemind" / "STATUS.md"
    
    if not status_path.exists():
        return json.dumps({
            "error": f"STATUS.md not found at {status_path}",
            "suggestion": "Initialize hivemind with the project first"
        })
    
    content = status_path.read_text()
    
    return json.dumps({
        "path": str(status_path),
        "content": content
    }, indent=2)


@mcp.tool(
    name="hivemind_messages",
    annotations={
        "title": "Read Hivemind Messages",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False
    }
)
async def hivemind_messages(params: HivemindMessagesInput) -> str:
    """Read the .hivemind/MESSAGES.md file.
    
    Returns messages between agents and the conductor.
    
    Args:
        params: Filter options for messages
        
    Returns:
        Content of MESSAGES.md or filtered messages
    """
    project_dir = params.project_dir or DEFAULT_PROJECT_DIR
    messages_path = Path(project_dir) / ".hivemind" / "MESSAGES.md"
    
    if not messages_path.exists():
        return json.dumps({
            "error": f"MESSAGES.md not found at {messages_path}",
            "suggestion": "Initialize hivemind with the project first"
        })
    
    content = messages_path.read_text()
    
    # TODO: Parse and filter messages if filter_agent or only_active specified
    
    return json.dumps({
        "path": str(messages_path),
        "content": content
    }, indent=2)


@mcp.tool(
    name="hivemind_write_message",
    annotations={
        "title": "Write Hivemind Message",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False
    }
)
async def hivemind_write_message(params: HivemindWriteMessageInput) -> str:
    """Write a message to .hivemind/MESSAGES.md.
    
    Appends a new message to the messages file for agent coordination.
    
    Args:
        params: Message details
        
    Returns:
        Confirmation of message written
    """
    project_dir = params.project_dir or DEFAULT_PROJECT_DIR
    messages_path = Path(project_dir) / ".hivemind" / "MESSAGES.md"
    
    if not messages_path.exists():
        # Create the file if it doesn't exist
        messages_path.parent.mkdir(parents=True, exist_ok=True)
        messages_path.write_text("# MESSAGES\n\n## ACTIVE\n\n## RESOLVED\n")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    message_entry = f"""
### [{timestamp}] {params.sender}→{params.recipient} | {params.message_type}
**Subject:** {params.subject}

{params.body}

---
"""
    
    # Read current content
    content = messages_path.read_text()
    
    # Insert after ## ACTIVE header
    if "## ACTIVE" in content:
        content = content.replace(
            "## ACTIVE\n",
            f"## ACTIVE\n{message_entry}"
        )
    else:
        content += message_entry
    
    messages_path.write_text(content)
    
    return json.dumps({
        "success": True,
        "message_added": {
            "timestamp": timestamp,
            "sender": params.sender,
            "recipient": params.recipient,
            "type": params.message_type,
            "subject": params.subject
        }
    }, indent=2)


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse
    import uvicorn
    
    parser = argparse.ArgumentParser(description="Hivemind MCP Server")
    parser.add_argument(
        "--http",
        action="store_true",
        help="Use HTTP transport instead of stdio"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for HTTP transport (default: 8000)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        default=None,
        help="Default project directory"
    )
    
    args = parser.parse_args()
    
    if args.project_dir:
        DEFAULT_PROJECT_DIR = args.project_dir
    
    if args.http:
        # Run with uvicorn directly for full control over host/port
        app = mcp.streamable_http_app()
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        mcp.run()

