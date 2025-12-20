// =============================================================================
// @hivemind/core - Tool Parsing
// =============================================================================
// Parse [TOOL: ...] commands from Conductor responses.
// Pure parsing logic - no execution here.

import type { ToolCall, ToolName } from './types'

const VALID_TOOLS: ToolName[] = ['deploy_agent', 'send_to_agent', 'broadcast', 'kill_agent', 'get_status']

/**
 * Parse tool calls from a text response
 * Looks for patterns like: [TOOL: deploy_agent(forge, my-task)]
 */
export function parseToolCalls(text: string): ToolCall[] {
  const toolPattern = /\[TOOL:\s*(\w+)\(([^)]*)\)\]/g
  const calls: ToolCall[] = []
  
  let match
  while ((match = toolPattern.exec(text)) !== null) {
    const [, toolName, argsStr] = match
    
    if (!isValidTool(toolName)) {
      console.warn(`Unknown tool: ${toolName}`)
      continue
    }
    
    const args = argsStr
      .split(',')
      .map(a => a.trim().replace(/^["']|["']$/g, ''))
      .filter(a => a.length > 0)
    
    calls.push({
      tool: toolName as ToolName,
      args,
    })
  }
  
  return calls
}

/**
 * Check if a tool name is valid
 */
export function isValidTool(name: string): name is ToolName {
  return VALID_TOOLS.includes(name as ToolName)
}

/**
 * Format a tool call for display
 */
export function formatToolCall(call: ToolCall): string {
  return `[TOOL: ${call.tool}(${call.args.join(', ')})]`
}

