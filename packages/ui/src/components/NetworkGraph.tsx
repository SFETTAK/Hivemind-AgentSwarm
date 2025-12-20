// NetworkGraph - Canvas-based swarm topology visualization
import { useEffect, useRef, useCallback, useState, memo } from 'react'
import { useSwarmStore, type Agent, type Edge } from '../stores/swarmStore'

// ============================================================================
// Types
// ============================================================================

interface Position {
  x: number
  y: number
}

interface Particle {
  id: number
  from: string
  to: string
  color: string
  progress: number
}

export interface NetworkGraphProps {
  onAgentDoubleClick?: (agent: Agent, position: Position) => void
  onSelectAgent: (agentId: string | null) => void
  selectedAgent: string | null
}

// ============================================================================
// Component
// ============================================================================

function NetworkGraphComponent({ onAgentDoubleClick, onSelectAgent, selectedAgent }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  
  // Local positions for dragging - persisted to localStorage
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem('hivemind-node-positions')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  
  // Pan and zoom state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 })
  
  const agents = useSwarmStore(state => state.agents)
  const edges = useSwarmStore(state => state.edges)
  
  // Get position for an agent (local override or server default)
  const getAgentPosition = useCallback((agent: Agent): Position => {
    if (nodePositions[agent.id]) {
      return nodePositions[agent.id]
    }
    // Default positions based on agent type
    const defaultPositions: Record<string, Position> = {
      'conductor': { x: 0.5, y: 0.3 },
      'user': { x: 0.5, y: 0.7 },
    }
    return defaultPositions[agent.id] || { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4 }
  }, [nodePositions])
  
  // Spawn particle function
  const spawnParticle = useCallback(() => {
    if (edges.length === 0) return
    const activeEdges = edges.filter(e => e.active)
    if (activeEdges.length > 0) {
      const edge = activeEdges[Math.floor(Math.random() * activeEdges.length)]
      const colors = ['#00d4ff', '#00ff88', '#ffcc00']
      particlesRef.current.push({
        id: Date.now() + Math.random(),
        from: edge.source,
        to: edge.target,
        color: colors[Math.floor(Math.random() * colors.length)],
        progress: 0,
      })
    }
  }, [edges])
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let time = 0
    
    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }
    resize()
    window.addEventListener('resize', resize)
    
    const particleInterval = setInterval(spawnParticle, 600)
    
    const animate = () => {
      time += 0.02
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const w = canvas.width
      const h = canvas.height
      
      if (agents.length === 0) {
        ctx.font = '16px JetBrains Mono, monospace'
        ctx.fillStyle = '#71717a'
        ctx.textAlign = 'center'
        ctx.fillText('Connecting to Hivemind...', w / 2, h / 2)
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      
      // Draw edges
      edges.forEach(edge => {
        const fromAgent = agents.find(a => a.id === edge.source)
        const toAgent = agents.find(a => a.id === edge.target)
        if (!fromAgent || !toAgent) return
        
        const from = getAgentPosition(fromAgent)
        const to = getAgentPosition(toAgent)
        
        ctx.beginPath()
        ctx.moveTo(from.x * w, from.y * h)
        ctx.lineTo(to.x * w, to.y * h)
        ctx.strokeStyle = edge.active ? 'rgba(0, 212, 255, 0.4)' : 'rgba(39, 39, 42, 0.6)'
        ctx.lineWidth = edge.active ? 2 : 1
        ctx.stroke()
      })
      
      // Update and draw particles
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, progress: p.progress + 0.012 }))
        .filter(p => p.progress < 1)
      
      particlesRef.current.forEach(p => {
        const fromAgent = agents.find(a => a.id === p.from)
        const toAgent = agents.find(a => a.id === p.to)
        if (!fromAgent || !toAgent) return
        
        const from = getAgentPosition(fromAgent)
        const to = getAgentPosition(toAgent)
        
        const x = from.x * w + (to.x * w - from.x * w) * p.progress
        const y = from.y * h + (to.y * h - from.y * h) * p.progress
        
        // Trail
        const trailLength = 0.08
        for (let i = 0; i < 5; i++) {
          const trailProgress = p.progress - (i * trailLength / 5)
          if (trailProgress < 0) continue
          const tx = from.x * w + (to.x * w - from.x * w) * trailProgress
          const ty = from.y * h + (to.y * h - from.y * h) * trailProgress
          ctx.beginPath()
          ctx.arc(tx, ty, 3 - i * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = p.color + (40 - i * 8).toString(16).padStart(2, '0')
          ctx.fill()
        }
        
        // Glow
        ctx.beginPath()
        ctx.arc(x, y, 10, 0, Math.PI * 2)
        ctx.fillStyle = p.color + '30'
        ctx.fill()
        
        // Core
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      })
      
      // Draw nodes
      agents.forEach(agent => {
        const pos = getAgentPosition(agent)
        const x = pos.x * w
        const y = pos.y * h
        const size = 32
        const isSelected = selectedAgent === agent.id
        const isConductor = agent.id === 'conductor'
        
        // Outer glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2.5)
        gradient.addColorStop(0, agent.color + '40')
        gradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(x, y, size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
        
        // Pulse animation for active/conductor
        if (agent.status === 'active' || isConductor) {
          const pulseSize = size + Math.sin(time * 3) * 6
          ctx.beginPath()
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2)
          ctx.strokeStyle = agent.color + '60'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        
        // Selection ring
        if (isSelected) {
          ctx.beginPath()
          ctx.arc(x, y, size + 10, 0, Math.PI * 2)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.stroke()
          ctx.setLineDash([])
        }
        
        // Node circle
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = '#131920'
        ctx.fill()
        ctx.strokeStyle = agent.color
        ctx.lineWidth = isConductor ? 4 : 3
        ctx.stroke()
        
        // Icon
        ctx.font = `${size * 0.7}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(agent.icon, x, y)
        
        // Label
        ctx.font = 'bold 11px JetBrains Mono, monospace'
        ctx.fillStyle = '#e4e4e7'
        ctx.fillText(agent.name, x, y + size + 18)
        
        // Status indicator
        const statusColors: Record<string, string> = { 
          active: '#00ff88', 
          idle: '#ffcc00', 
          stuck: '#ff4757', 
          offline: '#71717a',
          error: '#ff4757',
          stopped: '#71717a'
        }
        ctx.beginPath()
        ctx.arc(x + size - 5, y - size + 5, 6, 0, Math.PI * 2)
        ctx.fillStyle = statusColors[agent.status] || '#71717a'
        ctx.fill()
        ctx.strokeStyle = '#0a0e14'
        ctx.lineWidth = 2
        ctx.stroke()
      })
      
      ctx.restore()
      
      // Draw zoom indicator
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = '#71717a'
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(zoom * 100)}%`, w - 10, h - 10)
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      window.removeEventListener('resize', resize)
      clearInterval(particleInterval)
      cancelAnimationFrame(animationRef.current)
    }
  }, [agents, edges, selectedAgent, spawnParticle, getAgentPosition, nodePositions, zoom, pan])
  
  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number): Position => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const canvasX = screenX - rect.left
    const canvasY = screenY - rect.top
    const x = (canvasX - pan.x) / zoom / canvas.width
    const y = (canvasY - pan.y) / zoom / canvas.height
    return { x, y }
  }, [pan, zoom])
  
  // Find agent at position
  const findAgentAt = useCallback((x: number, y: number): Agent | undefined => {
    const hitRadius = 0.06 / zoom
    return agents.find(agent => {
      const pos = getAgentPosition(agent)
      const dx = pos.x - x
      const dy = pos.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      return dist < hitRadius
    })
  }, [agents, getAgentPosition, zoom])
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    
    const clicked = findAgentAt(x, y)
    if (clicked) {
      const pos = getAgentPosition(clicked)
      setDragging(clicked.id)
      setDragOffset({ x: pos.x - x, y: pos.y - y })
      onSelectAgent(clicked.id)
    } else {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [screenToCanvas, findAgentAt, getAgentPosition, onSelectAgent, pan])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY)
      const newX = Math.max(0.05, Math.min(0.95, x + dragOffset.x))
      const newY = Math.max(0.05, Math.min(0.95, y + dragOffset.y))
      
      setNodePositions(prev => {
        const updated = { ...prev, [dragging]: { x: newX, y: newY } }
        try {
          localStorage.setItem('hivemind-node-positions', JSON.stringify(updated))
        } catch {}
        return updated
      })
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }, [dragging, isPanning, screenToCanvas, dragOffset, panStart])
  
  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setIsPanning(false)
  }, [])
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.3, Math.min(3, zoom * zoomFactor))
    
    const zoomRatio = newZoom / zoom
    const newPanX = mouseX - (mouseX - pan.x) * zoomRatio
    const newPanY = mouseY - (mouseY - pan.y) * zoomRatio
    
    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [zoom, pan])
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragging || isPanning) return
    
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    const clicked = findAgentAt(x, y)
    onSelectAgent(clicked?.id || null)
  }, [dragging, isPanning, screenToCanvas, findAgentAt, onSelectAgent])
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    const clicked = findAgentAt(x, y)
    if (clicked && onAgentDoubleClick) {
      onAgentDoubleClick(clicked, { x: e.clientX, y: e.clientY })
    }
  }, [screenToCanvas, findAgentAt, onAgentDoubleClick])
  
  const resetPositions = useCallback(() => {
    setNodePositions({})
    try {
      localStorage.removeItem('hivemind-node-positions')
    } catch {}
  }, [])
  
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])
  
  return (
    <div className="relative w-full h-full bg-[#131920] rounded-xl border border-[#27272a] overflow-hidden">
      <div className="absolute top-4 left-4 text-xs text-zinc-500 uppercase tracking-widest z-10">
        ⬡ Swarm Topology
      </div>
      <div className="absolute top-4 right-4 text-xs z-10 flex gap-2">
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <button 
            onClick={resetView}
            className="px-2 py-1 rounded bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white transition-colors"
            title="Reset zoom and pan"
          >
            🔍 {Math.round(zoom * 100)}%
          </button>
        )}
        {Object.keys(nodePositions).length > 0 && (
          <button 
            onClick={resetPositions}
            className="px-2 py-1 rounded bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white transition-colors"
            title="Reset node positions"
          >
            ↺ Reset
          </button>
        )}
        <span className={`px-2 py-1 rounded ${agents.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {agents.length > 0 ? `${agents.length} agents` : 'connecting...'}
        </span>
      </div>
      <div className="absolute bottom-4 left-4 text-[10px] text-zinc-600 z-10">
        💡 Drag nodes • Scroll to zoom • Drag empty space to pan
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1 z-10">
        <button 
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="w-7 h-7 rounded bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center text-sm"
        >
          +
        </button>
        <button 
          onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}
          className="w-7 h-7 rounded bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center text-sm"
        >
          −
        </button>
        <button 
          onClick={resetView}
          className="w-7 h-7 rounded bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center text-xs"
          title="Fit to view"
        >
          ⊡
        </button>
      </div>
      <canvas 
        ref={canvasRef} 
        className={`w-full h-full ${dragging ? 'cursor-grabbing' : isPanning ? 'cursor-move' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  )
}

export const NetworkGraph = memo(NetworkGraphComponent)

