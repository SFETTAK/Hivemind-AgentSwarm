// Controls - Swarm control buttons (deploy, broadcast, pause, stop)
import { useState, memo, useCallback } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface ControlsProps {
  embedded?: boolean
  apiBase: string
}

type LoadingState = 'deploy' | 'broadcast' | 'pause' | 'stop' | null

// ============================================================================
// Component
// ============================================================================

function ControlsComponent({ embedded = false, apiBase }: ControlsProps) {
  const [loading, setLoading] = useState<LoadingState>(null)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [showDeploy, setShowDeploy] = useState(false)
  const [deployRole, setDeployRole] = useState('forge')
  const [deployTask, setDeployTask] = useState('general')

  const handleDeploy = useCallback(async () => {
    setLoading('deploy')
    try {
      const res = await fetch(`${apiBase}/api/agents/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: deployRole, task: deployTask })
      })
      const data = await res.json()
      alert(data.message || data.error)
      setShowDeploy(false)
    } catch (e: any) {
      alert('Failed to deploy agent: ' + e.message)
    }
    setLoading(null)
  }, [apiBase, deployRole, deployTask])

  const handleBroadcast = useCallback(async () => {
    if (!broadcastMsg.trim()) return
    setLoading('broadcast')
    try {
      const res = await fetch(`${apiBase}/api/swarm/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMsg })
      })
      const data = await res.json()
      alert(data.message || data.error)
      setBroadcastMsg('')
      setShowBroadcast(false)
    } catch (e: any) {
      alert('Failed to broadcast: ' + e.message)
    }
    setLoading(null)
  }, [apiBase, broadcastMsg])

  const handlePause = useCallback(async () => {
    setLoading('pause')
    try {
      const res = await fetch(`${apiBase}/api/swarm/pause`, { method: 'POST' })
      const data = await res.json()
      alert(data.message || data.error)
    } catch (e: any) {
      alert('Failed to pause: ' + e.message)
    }
    setLoading(null)
  }, [apiBase])

  const handleStop = useCallback(async () => {
    if (!confirm('⚠️ EMERGENCY STOP will kill ALL agent sessions. Continue?')) return
    setLoading('stop')
    try {
      const res = await fetch(`${apiBase}/api/swarm/stop`, { method: 'POST' })
      const data = await res.json()
      alert(data.message || data.error)
    } catch (e: any) {
      alert('Failed to stop: ' + e.message)
    }
    setLoading(null)
  }, [apiBase])

  return (
    <div className={embedded ? "h-full overflow-y-auto p-2" : "bg-[#131920] border border-[#27272a] rounded-xl p-4"}>
      {!embedded && (
        <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
          ⚡ Swarm Controls
        </div>
      )}
      
      <div className="space-y-2">
        {/* Deploy Agent */}
        {showDeploy ? (
          <div className="p-3 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg space-y-2">
            <select 
              value={deployRole} 
              onChange={(e) => setDeployRole(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0f14] border border-[#27272a] rounded text-sm text-white"
            >
              <option value="forge">🔨 FORGE (Builder)</option>
              <option value="sentinel">🛡️ SENTINEL (Quality)</option>
              <option value="oracle">🔮 ORACLE (Research)</option>
              <option value="nexus">🔗 NEXUS (Integration)</option>
              <option value="scribe">📝 SCRIBE (Docs)</option>
            </select>
            <input
              type="text"
              placeholder="Task name..."
              value={deployTask}
              onChange={(e) => setDeployTask(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0f14] border border-[#27272a] rounded text-sm text-white placeholder-zinc-600"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleDeploy} 
                disabled={loading === 'deploy'} 
                className="flex-1 px-3 py-1.5 bg-[#00d4ff] text-black text-sm font-medium rounded hover:bg-[#00d4ff]/80 disabled:opacity-50"
              >
                {loading === 'deploy' ? '...' : 'Deploy'}
              </button>
              <button 
                onClick={() => setShowDeploy(false)} 
                className="px-3 py-1.5 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowDeploy(true)} 
            className="w-full px-4 py-2.5 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 border border-[#00d4ff]/50 rounded-lg text-[#00d4ff] text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>🚀</span> Deploy Agent
          </button>
        )}
        
        {/* Broadcast */}
        {showBroadcast ? (
          <div className="p-3 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg space-y-2">
            <textarea
              placeholder="Message to all agents..."
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#0a0f14] border border-[#27272a] rounded text-sm text-white placeholder-zinc-600 h-16 resize-none"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleBroadcast} 
                disabled={loading === 'broadcast'} 
                className="flex-1 px-3 py-1.5 bg-[#00ff88] text-black text-sm font-medium rounded hover:bg-[#00ff88]/80 disabled:opacity-50"
              >
                {loading === 'broadcast' ? '...' : 'Send'}
              </button>
              <button 
                onClick={() => setShowBroadcast(false)} 
                className="px-3 py-1.5 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowBroadcast(true)} 
            className="w-full px-4 py-2.5 bg-[#00ff88]/20 hover:bg-[#00ff88]/30 border border-[#00ff88]/50 rounded-lg text-[#00ff88] text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>📢</span> Broadcast
          </button>
        )}
        
        <button 
          onClick={handlePause} 
          disabled={loading === 'pause'} 
          className="w-full px-4 py-2.5 bg-[#ffcc00]/20 hover:bg-[#ffcc00]/30 border border-[#ffcc00]/50 rounded-lg text-[#ffcc00] text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>⏸️</span> {loading === 'pause' ? 'Pausing...' : 'Pause Swarm'}
        </button>
        
        <button 
          onClick={handleStop} 
          disabled={loading === 'stop'} 
          className="w-full px-4 py-2.5 bg-[#ff4757]/20 hover:bg-[#ff4757]/30 border border-[#ff4757]/50 rounded-lg text-[#ff4757] text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>🛑</span> {loading === 'stop' ? 'Stopping...' : 'Emergency Stop'}
        </button>
      </div>
    </div>
  )
}

export const Controls = memo(ControlsComponent)

