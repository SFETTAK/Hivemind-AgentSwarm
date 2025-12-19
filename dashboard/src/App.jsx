import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import Header from './components/Header'
import NetworkGraph from './components/NetworkGraph'
import AgentCard from './components/AgentCard'
import Controls from './components/Controls'
import Settings from './components/Settings'
import ConductorPanel from './components/ConductorPanel'
import FloatingAgentChat from './components/FloatingAgentChat'
import FilePanel from './components/FilePanel'
import TabbedTerminal from './components/TabbedTerminal'
import { DraggablePanel, usePanelLayout } from './components/DraggablePanel'
import { useSwarmStore } from './stores/swarmStore'

// Define the 6 panel slots in H-layout
// ┌─────────┬─────────────────┬─────────┐
// │ AGENTS  │    TOPOLOGY     │CONTROLS │
// ├─────────┼─────────────────┼─────────┤
// │  FILES  │   CONDUCTOR     │TERMINAL │
// └─────────┴─────────────────┴─────────┘
const DEFAULT_LAYOUT = {
  topLeft: 'agents',
  botLeft: 'files',
  topCenter: 'topology',
  botCenter: 'conductor',
  topRight: 'controls',
  botRight: 'terminal',
}

// Panel definitions with their content
const PANEL_DEFS = {
  agents: { title: 'Agents', icon: '🐝' },
  files: { title: 'Utilities', icon: '🧰' },
  topology: { title: 'Swarm Topology', icon: '◯' },
  terminal: { title: 'Terminal / Activity', icon: '💻' },
  controls: { title: 'Swarm Controls', icon: '⚡' },
  conductor: { title: 'Conductor', icon: '🎭' },
}

// Memoized Panel component - defined outside App to prevent recreation on every render
const PanelSlot = memo(function PanelSlot({ 
  panelId, 
  onDragStart, 
  onDrop, 
  isDragTarget, 
  isBeingDragged, 
  headerExtra,
  hideHeader = false,
  children 
}) {
  const def = PANEL_DEFS[panelId] || { title: panelId, icon: '?' }
  
  return (
    <DraggablePanel
      id={panelId}
      title={def.title}
      icon={def.icon}
      onDragStart={onDragStart}
      onDrop={onDrop}
      isDragTarget={isDragTarget}
      isBeingDragged={isBeingDragged}
      headerExtra={headerExtra}
      hideHeader={hideHeader}
    >
      {children}
    </DraggablePanel>
  )
})

// Completely isolated conductor slot - doesn't depend on selectedAgent at all
// hideHeader=true because ConductorPanel has its own header with the configurable name
const ConductorSlot = memo(function ConductorSlot({ onDragStart, onDrop, isDragTarget, isBeingDragged }) {
  return (
    <DraggablePanel
      id="conductor"
      title="Conductor"
      icon="🎭"
      onDragStart={onDragStart}
      onDrop={onDrop}
      isDragTarget={isDragTarget}
      isBeingDragged={isBeingDragged}
      hideHeader
    >
      <ConductorPanel />
    </DraggablePanel>
  )
})

export default function App() {
  // Only subscribe to what App actually needs - stats/runtime are in Header
  const agents = useSwarmStore(state => state.agents)
  const loading = useSwarmStore(state => state.loading)
  const selectedAgent = useSwarmStore(state => state.selectedAgent)
  const setSelectedAgent = useSwarmStore(state => state.setSelectedAgent)
  const [showSettings, setShowSettings] = useState(false)
  
  // Panel layout system
  const { layout, draggingPanel, startDrag, dropOnPanel, resetLayout } = usePanelLayout(DEFAULT_LAYOUT)
  
  // Track open floating agent chat windows
  const [openChats, setOpenChats] = useState({})
  
  const handleAgentDoubleClick = useCallback((agent, clickPosition) => {
    setOpenChats(prev => {
      if (prev[agent.id]) return prev // Already open
      const position = { x: clickPosition.x + 20, y: clickPosition.y - 50 }
      return { ...prev, [agent.id]: { agent, position } }
    })
  }, [])
  
  const handleCloseChat = useCallback((agentId) => {
    setOpenChats(prev => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
  }, [])
  
  // Column widths
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('panel-left-width')
    return saved ? parseFloat(saved) : 18
  })
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('panel-right-width')
    return saved ? parseFloat(saved) : 22
  })
  
  // Row heights (percentage of available height) - INDEPENDENT per column
  // Defaults: Left=30% agents/70% files, Center=55/45, Right=22% controls/78% terminal
  const [leftTopHeight, setLeftTopHeight] = useState(() => {
    const saved = localStorage.getItem('panel-left-top-height')
    return saved ? parseFloat(saved) : 30
  })
  const [centerTopHeight, setCenterTopHeight] = useState(() => {
    const saved = localStorage.getItem('panel-center-top-height')
    return saved ? parseFloat(saved) : 55
  })
  const [rightTopHeight, setRightTopHeight] = useState(() => {
    const saved = localStorage.getItem('panel-right-top-height')
    return saved ? parseFloat(saved) : 22
  })
  
  const centerWidth = 100 - leftWidth - rightWidth
  
  // Memoize ConductorPanel so it doesn't re-render when selectedAgent changes
  const conductorPanel = useMemo(() => <ConductorPanel />, [])
  const controlsPanel = useMemo(() => <Controls embedded />, [])
  const filesPanel = useMemo(() => <FilePanel />, [])
  
  // Memoized drop handlers for each slot to avoid creating new functions
  const dropHandlers = useMemo(() => ({
    topLeft: () => dropOnPanel('topLeft'),
    botLeft: () => dropOnPanel('botLeft'),
    topCenter: () => dropOnPanel('topCenter'),
    botCenter: () => dropOnPanel('botCenter'),
    topRight: () => dropOnPanel('topRight'),
    botRight: () => dropOnPanel('botRight'),
  }), [dropOnPanel])
  
  // Helper to render a panel slot
  const renderSlot = (slot) => {
    const panelId = layout[slot]
    const isDragTarget = draggingPanel && draggingPanel !== panelId
    const isBeingDragged = draggingPanel === panelId
    const headerExtra = panelId === 'agents' ? (
      <span className="text-xs text-cyan-400">({agents.length})</span>
    ) : null
    
    // Get content based on panel type
    let content
    switch (panelId) {
      case 'agents':
        content = (
          <div className="h-full overflow-y-auto p-2">
            <div className="space-y-2">
              {loading ? (
                <div className="text-zinc-600 text-sm p-4">Loading...</div>
              ) : agents.length === 0 ? (
                <div className="text-zinc-600 text-sm p-4">No agents</div>
              ) : (
                agents.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    selected={selectedAgent === agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    onDoubleClick={() => handleAgentDoubleClick(agent, { x: 150, y: 200 })}
                  />
                ))
              )}
            </div>
          </div>
        )
        break
      case 'files':
        content = filesPanel
        break
      case 'topology':
        content = (
          <NetworkGraph 
            onSelectAgent={setSelectedAgent}
            selectedAgent={selectedAgent}
            onAgentDoubleClick={handleAgentDoubleClick}
          />
        )
        break
      case 'terminal':
        content = <TabbedTerminal selectedAgent={selectedAgent} agents={agents} />
        break
      case 'controls':
        content = controlsPanel
        break
      case 'conductor':
        // Use completely isolated component for conductor
        return (
          <ConductorSlot
            key={slot}
            onDragStart={startDrag}
            onDrop={dropHandlers[slot]}
            isDragTarget={isDragTarget}
            isBeingDragged={isBeingDragged}
          />
        )
      default:
        content = <div className="p-4 text-zinc-500">Unknown panel: {panelId}</div>
    }
    
    // Hide header for panels that have their own (terminal has tabs)
    const shouldHideHeader = panelId === 'terminal'
    
    return (
      <PanelSlot
        key={slot}
        panelId={panelId}
        onDragStart={startDrag}
        onDrop={dropHandlers[slot]}
        isDragTarget={isDragTarget}
        isBeingDragged={isBeingDragged}
        headerExtra={headerExtra}
        hideHeader={shouldHideHeader}
      >
        {content}
      </PanelSlot>
    )
  }

  // Stable callback for Header
  const handleSettingsClick = useCallback(() => setShowSettings(true), [])
  
  return (
    <div className="min-h-screen bg-[#0a0e14] relative z-10 flex flex-col">
      <Header onSettingsClick={handleSettingsClick} />
      
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      
      {/* Layout reset button - tiny, in corner */}
      {draggingPanel && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 px-4 py-2 rounded-lg border border-cyan-400 shadow-lg">
          <span className="text-cyan-400 text-sm font-mono">
            Dragging: {PANEL_DEFS[draggingPanel]?.title} — Drop on another panel to swap
          </span>
        </div>
      )}
      
      <main className="flex-1 p-2 overflow-hidden">
        <div className="flex h-[calc(100vh-90px)] gap-0">
          
          {/* Left Column - Independent vertical resize */}
          <div 
            className="flex flex-col gap-1 flex-shrink-0"
            style={{ width: `${leftWidth}%` }}
          >
            <div style={{ height: `${leftTopHeight}%` }} className="min-h-0">
              {renderSlot('topLeft')}
            </div>
            <VerticalResizeHandle 
              onDrag={(delta) => {
                const newHeight = Math.max(20, Math.min(80, leftTopHeight + delta))
                setLeftTopHeight(newHeight)
                localStorage.setItem('panel-left-top-height', newHeight.toString())
              }}
            />
            <div style={{ height: `${100 - leftTopHeight}%` }} className="min-h-0">
              {renderSlot('botLeft')}
            </div>
          </div>
          
          {/* Left Resize Handle */}
          <ResizeHandle 
            onDrag={(delta) => {
              const newWidth = Math.max(10, Math.min(30, leftWidth + delta))
              setLeftWidth(newWidth)
              localStorage.setItem('panel-left-width', newWidth.toString())
            }}
          />
          
          {/* Center Column - Independent vertical resize */}
          <div 
            className="flex flex-col gap-1 px-1 overflow-hidden"
            style={{ width: `${centerWidth}%` }}
          >
            <div style={{ height: `${centerTopHeight}%` }} className="min-h-0">
              {renderSlot('topCenter')}
            </div>
            <VerticalResizeHandle 
              onDrag={(delta) => {
                const newHeight = Math.max(20, Math.min(80, centerTopHeight + delta))
                setCenterTopHeight(newHeight)
                localStorage.setItem('panel-center-top-height', newHeight.toString())
              }}
            />
            <div style={{ height: `${100 - centerTopHeight}%` }} className="min-h-0">
              {renderSlot('botCenter')}
            </div>
          </div>
          
          {/* Right Resize Handle */}
          <ResizeHandle 
            onDrag={(delta) => {
              const newWidth = Math.max(15, Math.min(35, rightWidth - delta))
              setRightWidth(newWidth)
              localStorage.setItem('panel-right-width', newWidth.toString())
            }}
          />
          
          {/* Right Column - Independent vertical resize */}
          <div 
            className="flex flex-col gap-1 pl-1 flex-shrink-0"
            style={{ width: `${rightWidth}%` }}
          >
            <div style={{ height: `${rightTopHeight}%` }} className="min-h-0">
              {renderSlot('topRight')}
            </div>
            <VerticalResizeHandle 
              onDrag={(delta) => {
                const newHeight = Math.max(20, Math.min(80, rightTopHeight + delta))
                setRightTopHeight(newHeight)
                localStorage.setItem('panel-right-top-height', newHeight.toString())
              }}
            />
            <div style={{ height: `${100 - rightTopHeight}%` }} className="min-h-0">
              {renderSlot('botRight')}
            </div>
          </div>
        </div>
      </main>
      
      <footer className="text-center text-xs text-zinc-600 py-1 flex items-center justify-center gap-4">
        <span>© 2025 · Hivemind Swarm Dashboard</span>
        <button 
          onClick={() => {
            resetLayout()
            // Reset all column heights to preferred defaults
            setLeftTopHeight(30)      // Small agents, big files
            setCenterTopHeight(55)    // Balanced topo/conductor
            setRightTopHeight(22)     // Small controls, big terminal
            setLeftWidth(18)
            setRightWidth(22)
            localStorage.removeItem('panel-left-top-height')
            localStorage.removeItem('panel-center-top-height')
            localStorage.removeItem('panel-right-top-height')
            localStorage.removeItem('panel-left-width')
            localStorage.removeItem('panel-right-width')
          }}
          className="text-zinc-600 hover:text-cyan-400 transition-colors"
          title="Reset panel layout to default"
        >
          ↺ Reset Layout
        </button>
      </footer>
      
      {/* Floating Agent Chat Windows */}
      {Object.entries(openChats).map(([agentId, { agent, position }]) => (
        <FloatingAgentChat
          key={agentId}
          agent={agent}
          initialPosition={position}
          onClose={() => handleCloseChat(agentId)}
        />
      ))}
    </div>
  )
}

// Vertical resize handle (horizontal bar)
function VerticalResizeHandle({ onDrag }) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDataRef = useRef({ startY: 0, parentHeight: 0 })
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e) => {
      e.preventDefault()
      const deltaPixels = e.clientY - dragDataRef.current.startY
      dragDataRef.current.startY = e.clientY
      const deltaPercent = (deltaPixels / dragDataRef.current.parentHeight) * 100
      onDrag(deltaPercent)
    }
    
    const handleMouseUp = () => setIsDragging(false)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onDrag])
  
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        dragDataRef.current.startY = e.clientY
        dragDataRef.current.parentHeight = e.target.parentElement?.clientHeight || 600
        setIsDragging(true)
      }}
      className={`
        h-1.5 cursor-row-resize flex-shrink-0 rounded
        bg-gray-700/50 hover:bg-cyan-500/50 transition-colors
        flex items-center justify-center select-none
        ${isDragging ? 'bg-cyan-500/70' : ''}
      `}
    >
      <div className="flex gap-0.5 opacity-40">
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
      </div>
    </div>
  )
}

// Horizontal resize handle (vertical bar)
function ResizeHandle({ onDrag }) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDataRef = useRef({ startX: 0 })
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e) => {
      e.preventDefault()
      const delta = ((e.clientX - dragDataRef.current.startX) / window.innerWidth) * 100
      dragDataRef.current.startX = e.clientX
      onDrag(delta)
    }
    
    const handleMouseUp = () => setIsDragging(false)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onDrag])
  
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        dragDataRef.current.startX = e.clientX
        setIsDragging(true)
      }}
      className={`
        w-1.5 cursor-col-resize flex-shrink-0 select-none
        bg-gray-700/50 hover:bg-cyan-500/50 transition-colors
        flex items-center justify-center
        ${isDragging ? 'bg-cyan-500/70' : ''}
      `}
    >
      <div className="flex flex-col gap-0.5 opacity-40">
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
      </div>
    </div>
  )
}
