import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import {
  Header,
  NetworkGraph,
  AgentCard,
  Controls,
  ConductorPanel,
  FloatingAgentChat,
  FilePanel,
  TabbedTerminal,
  TerminalPanel,
  Commentator,
  DraggablePanel,
  usePanelLayout,
  useSwarmStore,
  startPolling,
  Settings,
  type Agent,
} from '@hivemind/ui'

// API base URL - configurable
const API_BASE = 'http://192.168.1.133:3001'

// Start polling for swarm data
startPolling(API_BASE)

// Define the 6 panel slots in H-layout
const DEFAULT_LAYOUT = {
  topLeft: 'agents',
  botLeft: 'files',
  topCenter: 'topology',
  botCenter: 'conductor',
  topRight: 'controls',
  botRight: 'terminal',
}

// Panel definitions with their content
const PANEL_DEFS: Record<string, { title: string; icon: string }> = {
  agents: { title: 'Agents', icon: '🐝' },
  files: { title: 'Utilities', icon: '🧰' },
  topology: { title: 'Swarm Topology', icon: '◯' },
  terminal: { title: 'Terminal / Activity', icon: '💻' },
  controls: { title: 'Swarm Controls', icon: '⚡' },
  conductor: { title: 'Conductor', icon: '🎭' },
}

// Memoized Panel component
const PanelSlot = memo(function PanelSlot({ 
  panelId, 
  onDragStart, 
  onDrop, 
  isDragTarget, 
  isBeingDragged, 
  headerExtra,
  hideHeader = false,
  children 
}: {
  panelId: string
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
  isDragTarget: boolean
  isBeingDragged: boolean
  headerExtra?: React.ReactNode
  hideHeader?: boolean
  children: React.ReactNode
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

// Isolated conductor slot
const ConductorSlot = memo(function ConductorSlot({ 
  onDragStart, 
  onDrop, 
  isDragTarget, 
  isBeingDragged 
}: {
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
  isDragTarget: boolean
  isBeingDragged: boolean
}) {
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
      <ConductorPanel apiBase={API_BASE} />
    </DraggablePanel>
  )
})

// Wrapped TabbedTerminal that passes through the child components
function TabbedTerminalWrapper({ selectedAgent, agents }: { selectedAgent: string | null; agents: Agent[] }) {
  const Terminal = useCallback((props: { selectedAgent: string | null; agents: Agent[] }) => (
    <TerminalPanel {...props} apiBase={API_BASE} />
  ), [])
  
  const Activity = useCallback((props: { embedded?: boolean }) => (
    <Commentator {...props} apiBase={API_BASE} />
  ), [])
  
  return (
    <TabbedTerminal 
      selectedAgent={selectedAgent} 
      agents={agents}
      TerminalPanel={Terminal}
      Commentator={Activity}
    />
  )
}

export default function App() {
  const agents = useSwarmStore(state => state.agents)
  const loading = useSwarmStore(state => state.loading)
  const selectedAgent = useSwarmStore(state => state.selectedAgent)
  const setSelectedAgent = useSwarmStore(state => state.setSelectedAgent)
  const [showSettings, setShowSettings] = useState(false)
  
  // Panel layout system
  const { layout, draggingPanel, startDrag, dropOnPanel, resetLayout } = usePanelLayout(DEFAULT_LAYOUT)
  
  // Track open floating agent chat windows
  const [openChats, setOpenChats] = useState<Record<string, { agent: Agent; position: { x: number; y: number } }>>({})
  
  const handleAgentDoubleClick = useCallback((agent: Agent, clickPosition: { x: number; y: number }) => {
    setOpenChats(prev => {
      if (prev[agent.id]) return prev
      const position = { x: clickPosition.x + 20, y: clickPosition.y - 50 }
      return { ...prev, [agent.id]: { agent, position } }
    })
  }, [])
  
  const handleCloseChat = useCallback((agentId: string) => {
    setOpenChats(prev => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
  }, [])
  
  // Column widths
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === 'undefined') return 18
    const saved = localStorage.getItem('panel-left-width')
    return saved ? parseFloat(saved) : 18
  })
  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === 'undefined') return 22
    const saved = localStorage.getItem('panel-right-width')
    return saved ? parseFloat(saved) : 22
  })
  
  // Row heights per column
  const [leftTopHeight, setLeftTopHeight] = useState(() => {
    if (typeof window === 'undefined') return 30
    const saved = localStorage.getItem('panel-left-top-height')
    return saved ? parseFloat(saved) : 30
  })
  const [centerTopHeight, setCenterTopHeight] = useState(() => {
    if (typeof window === 'undefined') return 55
    const saved = localStorage.getItem('panel-center-top-height')
    return saved ? parseFloat(saved) : 55
  })
  const [rightTopHeight, setRightTopHeight] = useState(() => {
    if (typeof window === 'undefined') return 22
    const saved = localStorage.getItem('panel-right-top-height')
    return saved ? parseFloat(saved) : 22
  })
  
  const centerWidth = 100 - leftWidth - rightWidth
  
  // Memoized panels
  const controlsPanel = useMemo(() => <Controls embedded apiBase={API_BASE} />, [])
  const filesPanel = useMemo(() => <FilePanel apiBase={API_BASE} />, [])
  
  // Memoized drop handlers
  const dropHandlers = useMemo(() => ({
    topLeft: () => dropOnPanel('topLeft'),
    botLeft: () => dropOnPanel('botLeft'),
    topCenter: () => dropOnPanel('topCenter'),
    botCenter: () => dropOnPanel('botCenter'),
    topRight: () => dropOnPanel('topRight'),
    botRight: () => dropOnPanel('botRight'),
  }), [dropOnPanel])
  
  // Helper to render a panel slot
  const renderSlot = (slot: keyof typeof DEFAULT_LAYOUT) => {
    const panelId = layout[slot]
    const isDragTarget = !!(draggingPanel && draggingPanel !== panelId)
    const isBeingDragged = draggingPanel === panelId
    const headerExtra = panelId === 'agents' ? (
      <span className="text-xs text-cyan-400">({agents.length})</span>
    ) : null
    
    let content: React.ReactNode
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
        content = <TabbedTerminalWrapper selectedAgent={selectedAgent} agents={agents} />
        break
      case 'controls':
        content = controlsPanel
        break
      case 'conductor':
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

  const handleSettingsClick = useCallback(() => setShowSettings(true), [])
  
  return (
    <div className="min-h-screen bg-[#0a0e14] relative z-10 flex flex-col">
      <Header onSettingsClick={handleSettingsClick} apiBase={API_BASE} />
      
      {/* Settings modal */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} apiBase={API_BASE} />
      )}
      
      {/* Dragging indicator */}
      {draggingPanel && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 px-4 py-2 rounded-lg border border-cyan-400 shadow-lg">
          <span className="text-cyan-400 text-sm font-mono">
            Dragging: {PANEL_DEFS[draggingPanel]?.title} — Drop on another panel to swap
          </span>
        </div>
      )}
      
      <main className="flex-1 p-2 overflow-hidden">
        <div className="flex h-[calc(100vh-90px)] gap-0">
          
          {/* Left Column */}
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
          
          <ResizeHandle 
            onDrag={(delta) => {
              const newWidth = Math.max(10, Math.min(30, leftWidth + delta))
              setLeftWidth(newWidth)
              localStorage.setItem('panel-left-width', newWidth.toString())
            }}
          />
          
          {/* Center Column */}
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
          
          <ResizeHandle 
            onDrag={(delta) => {
              const newWidth = Math.max(15, Math.min(35, rightWidth - delta))
              setRightWidth(newWidth)
              localStorage.setItem('panel-right-width', newWidth.toString())
            }}
          />
          
          {/* Right Column */}
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
            setLeftTopHeight(30)
            setCenterTopHeight(55)
            setRightTopHeight(22)
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
          apiBase={API_BASE}
        />
      ))}
    </div>
  )
}

// Vertical resize handle
function VerticalResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDataRef = useRef({ startY: 0, parentHeight: 0 })
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
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
        dragDataRef.current.parentHeight = (e.target as HTMLElement).parentElement?.clientHeight || 600
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

// Horizontal resize handle
function ResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDataRef = useRef({ startX: 0 })
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
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

