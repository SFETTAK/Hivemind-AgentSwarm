import { useState, useEffect, memo, useCallback } from 'react'
import { useSwarmStore } from '../stores/swarmStore'
import { getApiBase } from '../config'

// Profile definitions matching Settings.jsx
const PROFILES = {
  1: { key: 'cruise', name: 'Cruise', icon: '🐢', color: '#00ff88' },
  2: { key: 'fast', name: 'Fast', icon: '🐇', color: '#ffcc00' },
  3: { key: 'turbo', name: 'Turbo', icon: '🚀', color: '#ff6b6b' },
  4: { key: 'cosmic', name: 'COSMIC', icon: '💎', color: '#a855f7' },
}

const MODEL_CONFIGS = {
  cruise: {
    MODEL_FORGE: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_SENTINEL: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_ORACLE: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_NEXUS: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_SCRIBE: 'openrouter/deepseek/deepseek-chat-v3.1',
  },
  fast: {
    MODEL_FORGE: 'openrouter/anthropic/claude-sonnet-4',
    MODEL_SENTINEL: 'openrouter/anthropic/claude-sonnet-4',
    MODEL_ORACLE: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_NEXUS: 'openrouter/deepseek/deepseek-chat-v3.1',
    MODEL_SCRIBE: 'openrouter/deepseek/deepseek-chat-v3.1',
  },
  turbo: {
    MODEL_FORGE: 'openrouter/anthropic/claude-opus-4',
    MODEL_SENTINEL: 'openrouter/anthropic/claude-sonnet-4',
    MODEL_ORACLE: 'openrouter/anthropic/claude-sonnet-4',
    MODEL_NEXUS: 'openrouter/anthropic/claude-sonnet-4',
    MODEL_SCRIBE: 'openrouter/anthropic/claude-sonnet-4',
  },
  cosmic: {
    MODEL_FORGE: 'openrouter/anthropic/claude-opus-4.5',
    MODEL_SENTINEL: 'openrouter/anthropic/claude-opus-4.5',
    MODEL_ORACLE: 'openrouter/anthropic/claude-opus-4.5',
    MODEL_NEXUS: 'openrouter/anthropic/claude-opus-4.5',
    MODEL_SCRIBE: 'openrouter/anthropic/claude-opus-4.5',
  },
}

function Header({ onSettingsClick }) {
  const stats = useSwarmStore(state => state.stats)
  const runtime = useSwarmStore(state => state.runtime)
  const connected = useSwarmStore(state => state.connected)
  const loading = useSwarmStore(state => state.loading)
  
  // Persist speed selection to localStorage
  const [speed, setSpeed] = useState(() => {
    const saved = localStorage.getItem('hivemind-speed')
    return saved ? parseInt(saved, 10) : 2 // Default to Fast
  })
  const [saving, setSaving] = useState(false)
  
  const apiBase = getApiBase()
  
  // Load current profile on mount
  useEffect(() => {
    fetch(`${apiBase}/api/settings`)
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          // Detect which profile matches
          const s = data.settings
          if (s.MODEL_FORGE?.includes('deepseek') && s.MODEL_SENTINEL?.includes('deepseek')) {
            setSpeed(1) // Cruise
          } else if (s.MODEL_FORGE?.includes('opus-4.5')) {
            setSpeed(4) // Cosmic (opus-4.5)
          } else if (s.MODEL_FORGE?.includes('opus-4')) {
            setSpeed(3) // Turbo (opus-4)
          } else {
            setSpeed(2) // Fast (default - sonnet)
          }
        }
      })
      .catch(() => {})
  }, [apiBase])
  
  const handleSpeedChange = useCallback(async (newSpeed) => {
    if (saving) return
    
    setSpeed(newSpeed)
    localStorage.setItem('hivemind-speed', newSpeed.toString())
    setSaving(true)
    
    const profile = PROFILES[newSpeed]
    const models = MODEL_CONFIGS[profile.key]
    
    try {
      await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: models })
      })
    } catch (e) {
      console.error('Failed to save profile:', e)
    }
    
    setSaving(false)
  }, [saving, apiBase])
  
  const currentProfile = PROFILES[speed]
  
  return (
    <header className="bg-[#131920]/80 backdrop-blur-sm border-b border-[#27272a] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🐝</span>
        <div>
          <h1 className="text-xl font-bold tracking-wider text-[#00d4ff]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            HIVEMIND
          </h1>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
            Swarm Orchestration Dashboard
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Speed Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0e14] border border-[#27272a]">
          <span className="text-lg w-6 text-center" title={currentProfile.name}>{currentProfile.icon}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map(level => (
              <button
                key={level}
                onClick={() => handleSpeedChange(level)}
                disabled={saving}
                className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                  speed === level 
                    ? 'scale-110' 
                    : 'opacity-40 hover:opacity-70'
                }`}
                style={{ 
                  backgroundColor: speed === level ? PROFILES[level].color : '#27272a',
                  color: speed === level ? '#131920' : '#888'
                }}
                title={PROFILES[level].name}
              >
                {level}
              </button>
            ))}
          </div>
          <span className="text-xs ml-1 w-12 text-center" style={{ color: currentProfile.color }}>
            {currentProfile.name}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Agents:</span>
            <span className="text-[#00d4ff] font-semibold">{stats.agentCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Messages:</span>
            <span className="text-[#00ff88] font-semibold">{stats.messageCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Cost:</span>
            <span className="text-[#ffcc00] font-semibold">{stats.cost}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Runtime:</span>
            <span className="text-white font-semibold">{runtime}</span>
          </div>
        </div>
        
        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0e14] border border-[#27272a] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
        >
          <span>⚙️</span>
          <span className="text-xs text-zinc-400 hover:text-[#00d4ff]">Settings</span>
        </button>
        
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0e14] border border-[#27272a]">
          <div className={`w-2 h-2 rounded-full ${
            loading ? 'bg-yellow-500 animate-pulse' : 
            connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-xs text-zinc-400">
            {loading ? 'Connecting...' : connected ? 'MCP Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  )
}

export default memo(Header)
