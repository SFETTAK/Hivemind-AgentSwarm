import { useEffect, useState } from 'react'
import Header from './components/Header'
import NetworkGraph from './components/NetworkGraph'
import AgentCard from './components/AgentCard'
import MessageStream from './components/MessageStream'
import Controls from './components/Controls'
import TerminalPanel from './components/TerminalPanel'
import Settings from './components/Settings'
import Commentator from './components/Commentator'
import ResizablePanel from './components/ResizablePanel'
import ConductorChat from './components/ConductorChat'
import { useSwarmStore } from './stores/swarmStore'

export default function App() {
  const agents = useSwarmStore(state => state.agents)
  const stats = useSwarmStore(state => state.stats)
  const loading = useSwarmStore(state => state.loading)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showTerminal, setShowTerminal] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  
  // Column widths (percentages) - persisted to localStorage
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('panel-left-width')
    return saved ? parseFloat(saved) : 15
  })
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('panel-right-width')
    return saved ? parseFloat(saved) : 25
  })
  
  // Listen for agent selection events
  useEffect(() => {
    const handleSelect = (e) => setSelectedAgent(e.detail)
    window.addEventListener('selectAgent', handleSelect)
    return () => window.removeEventListener('selectAgent', handleSelect)
  }, [])
  
  const centerWidth = 100 - leftWidth - rightWidth
  
  return (
    <div className="min-h-screen bg-[#0a0e14] relative z-10 flex flex-col">
      <Header onSettingsClick={() => setShowSettings(true)} />
      
      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      
      <main className="flex-1 p-4 overflow-hidden">
        <div className="flex h-[calc(100vh-100px)] gap-0">
          
          {/* Left Sidebar - Agent Cards */}
          <div 
            className="overflow-y-auto pr-2 flex-shrink-0"
            style={{ width: `${leftWidth}%` }}
          >
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2 px-2">
              🐝 Agents ({agents.length})
            </div>
            <div className="space-y-2 px-1">
              {loading ? (
                <div className="text-zinc-600 text-sm p-4">Loading...</div>
              ) : agents.length === 0 ? (
                <div className="text-zinc-600 text-sm p-4">No agents</div>
              ) : (
                agents.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    selected={selectedAgent === agent.shortName}
                    onClick={() => setSelectedAgent(agent.shortName)}
                  />
                ))
              )}
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
          
          {/* Center - Network Graph + Terminal + Stats */}
          <div 
            className="flex flex-col gap-3 px-2 overflow-hidden"
            style={{ width: `${centerWidth}%` }}
          >
            <ResizablePanel 
              direction="vertical" 
              initialSize={55} 
              minSize={30} 
              maxSize={80}
              storageKey="center-split"
              className="flex-1"
            >
              {/* Network Graph */}
              <div className="h-full">
                <NetworkGraph 
                  onSelectAgent={setSelectedAgent}
                  selectedAgent={selectedAgent}
                />
              </div>
              
              {/* Terminal Panel */}
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-1 px-1">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">
                    💻 Terminal Output
                  </div>
                  <button 
                    onClick={() => setShowTerminal(!showTerminal)}
                    className="text-xs text-zinc-500 hover:text-white"
                  >
                    {showTerminal ? '⊟' : '⊞'}
                  </button>
                </div>
                {showTerminal && (
                  <div className="flex-1 min-h-0">
                    <TerminalPanel 
                      selectedAgent={selectedAgent}
                      agents={agents}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </div>
          
          {/* Right Resize Handle */}
          <ResizeHandle 
            onDrag={(delta) => {
              const newWidth = Math.max(15, Math.min(40, rightWidth - delta))
              setRightWidth(newWidth)
              localStorage.setItem('panel-right-width', newWidth.toString())
            }}
          />
          
          {/* Right Sidebar */}
          <div 
            className="flex flex-col gap-3 pl-2 overflow-hidden flex-shrink-0"
            style={{ width: `${rightWidth}%` }}
          >
            <Controls />
            
            <ResizablePanel 
              direction="vertical" 
              initialSize={40} 
              minSize={20} 
              maxSize={70}
              storageKey="right-split"
              className="flex-1"
            >
              {/* Commentator */}
              <div className="h-full">
                <Commentator />
              </div>
              
              {/* Message Stream */}
              <div className="h-full">
                <MessageStream />
              </div>
            </ResizablePanel>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="text-center text-xs text-zinc-600 py-1">
        © 2025 · Hivemind Swarm Dashboard
      </footer>
      
      {/* Conductor Chat - Floating */}
      <ConductorChat />
    </div>
  )
}

// Horizontal resize handle component
function ResizeHandle({ onDrag }) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useState(0)
  
  const handleMouseDown = (e) => {
    e.preventDefault()
    startXRef.current = e.clientX
    setIsDragging(true)
    
    const handleMouseMove = (e) => {
      const delta = ((e.clientX - startXRef.current) / window.innerWidth) * 100
      startXRef.current = e.clientX
      onDrag(delta)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
  
  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        w-1 cursor-col-resize flex-shrink-0
        bg-[#1e2a3a] hover:bg-[#00d4ff] transition-colors
        flex items-center justify-center
        ${isDragging ? 'bg-[#00d4ff]' : ''}
      `}
      style={{ height: '100%' }}
    >
      <div className="flex flex-col gap-1 opacity-30">
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
        <div className="w-0.5 h-0.5 bg-zinc-400 rounded-full"></div>
      </div>
    </div>
  )
}

