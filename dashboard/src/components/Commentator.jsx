import { useState, useEffect, useRef } from 'react'
import { getApiBase } from '../config'

export default function Commentator({ embedded = false }) {
  const [commentary, setCommentary] = useState([
    { id: 1, time: getTimeStr(), text: '🎙️ Commentator online. Watching the swarm...', type: 'intro', agent: null },
  ])
  const [isLive, setIsLive] = useState(true)
  const [lastActivity, setLastActivity] = useState({}) // Track last seen activity per agent
  const scrollRef = useRef(null)
  
  // Auto-scroll to bottom when new commentary arrives
  useEffect(() => {
    if (scrollRef.current && isLive) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [commentary, isLive])
  
  // Poll for real agent activity
  useEffect(() => {
    if (!isLive) return
    
    const fetchActivity = async () => {
      try {
        const apiBase = getApiBase()
        
        const res = await fetch(`${apiBase}/api/activity`)
        const data = await res.json()
        
        if (data.activities && data.activities.length > 0) {
          const newComments = []
          
          data.activities.forEach(activity => {
            // Only add if activity changed from last time
            const lastSeen = lastActivity[activity.agent]
            if (lastSeen !== activity.summary && activity.summary) {
              newComments.push({
                id: Date.now() + Math.random(),
                time: getTimeStr(),
                text: activity.summary,
                type: getActivityType(activity.summary),
                agent: activity.agent,
                role: activity.role,
              })
            }
          })
          
          // Update last seen activity
          const newLastActivity = { ...lastActivity }
          data.activities.forEach(a => {
            if (a.summary) newLastActivity[a.agent] = a.summary
          })
          setLastActivity(newLastActivity)
          
          // Add new comments
          if (newComments.length > 0) {
            setCommentary(prev => [...prev, ...newComments].slice(-100))
          }
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Poll every 3 seconds for real-time feel
    const interval = setInterval(fetchActivity, 3000)
    fetchActivity() // Initial fetch
    
    return () => clearInterval(interval)
  }, [isLive, lastActivity])
  
  const roleColors = {
    forge: '#00ff88',
    sentinel: '#ffcc00',
    oracle: '#a855f7',
    nexus: '#00d4ff',
    scribe: '#ff6b6b',
    conductor: '#ff9500',
  }
  
  const roleIcons = {
    forge: '🔨',
    sentinel: '🛡️',
    oracle: '🔮',
    nexus: '🔗',
    scribe: '📝',
    conductor: '🎯',
  }
  
  function getActivityType(summary) {
    if (!summary) return 'info'
    const s = summary.toLowerCase()
    if (s.includes('error') || s.includes('fail') || s.includes('✗')) return 'error'
    if (s.includes('complete') || s.includes('✓') || s.includes('pass')) return 'success'
    if (s.includes('commit') || s.includes('editing')) return 'action'
    if (s.includes('thinking') || s.includes('processing')) return 'thinking'
    return 'info'
  }
  
  function getTypeStyle(type) {
    switch (type) {
      case 'intro': return { color: '#a855f7', fontStyle: 'italic' }
      case 'error': return { color: '#ff4444' }
      case 'success': return { color: '#00ff88' }
      case 'action': return { color: '#00d4ff' }
      case 'thinking': return { color: '#888', fontStyle: 'italic' }
      default: return { color: '#ccc' }
    }
  }
  
  return (
    <div className={`h-full flex flex-col overflow-hidden ${embedded ? '' : 'bg-[#131920] rounded-lg'}`} style={embedded ? {} : { border: '1px solid #1e2a3a' }}>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #1e2a3a' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🎙️</span>
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Activity Log</span>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCommentary([{ id: 1, time: getTimeStr(), text: '🎙️ Log cleared', type: 'intro', agent: null }])}
              className="text-xs text-zinc-500 hover:text-white"
              title="Clear log"
            >
              🗑
            </button>
            <button 
              onClick={() => setIsLive(!isLive)}
              className="text-xs text-zinc-500 hover:text-white"
              title={isLive ? 'Pause' : 'Resume'}
            >
              {isLive ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      )}
      
      {/* Embedded mini-header with just controls */}
      {embedded && (
        <div className="flex items-center justify-end px-2 py-1 bg-gray-800/30">
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-red-500 mr-auto">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
              LIVE
            </span>
          )}
          <button 
            onClick={() => setCommentary([{ id: 1, time: getTimeStr(), text: '🎙️ Log cleared', type: 'intro', agent: null }])}
            className="text-xs text-zinc-500 hover:text-white px-1"
            title="Clear log"
          >
            🗑
          </button>
          <button 
            onClick={() => setIsLive(!isLive)}
            className="text-xs text-zinc-500 hover:text-white px-1"
            title={isLive ? 'Pause' : 'Resume'}
          >
            {isLive ? '⏸' : '▶'}
          </button>
        </div>
      )}
      
      {/* Activity Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
        style={{ 
          background: 'linear-gradient(180deg, #0d1117 0%, #131920 100%)',
          fontFamily: '"SF Mono", "Fira Code", monospace',
          fontSize: '11px',
        }}
      >
        {commentary.map((item) => {
          // Count how many agents of this role exist
          const roleCount = commentary.filter(c => c.role === item.role && c.agent).length > 1
          // Extract number from agent name if present (e.g., "forge-api-2" -> "2")
          const agentNum = item.agent?.match(/-(\d+)$/)
          const showNum = roleCount && agentNum
          
          return (
            <div key={item.id} className="flex gap-1.5 items-start leading-tight">
              {item.agent ? (
                <>
                  <span 
                    className="shrink-0 relative"
                    style={{ color: roleColors[item.role] || '#888' }}
                    title={item.agent}
                  >
                    {roleIcons[item.role] || '•'}
                    {showNum && (
                      <span className="absolute -top-1 -right-1 text-[8px] font-bold">{agentNum[1]}</span>
                    )}
                  </span>
                  <span style={getTypeStyle(item.type)} className="flex-1">{item.text}</span>
                </>
              ) : (
                <span style={getTypeStyle(item.type)} className="flex-1">{item.text}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getTimeStr() {
  return new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}
