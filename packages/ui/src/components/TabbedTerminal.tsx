// TabbedTerminal - Terminal output + Activity feed in tabs
import { useState, useCallback, memo } from 'react'
import type { Agent } from '../stores/swarmStore'

// Note: TerminalPanel and Commentator will be imported when migrated
// For now, we define the interface

export interface TabbedTerminalProps {
  selectedAgent: string | null
  agents: Agent[]
  TerminalPanel: React.ComponentType<{ selectedAgent: string | null; agents: Agent[] }>
  Commentator: React.ComponentType<{ embedded?: boolean }>
}

type TabId = 'terminal' | 'activity'

function getPersistedTab(): TabId {
  if (typeof window === 'undefined') return 'terminal'
  return (localStorage.getItem('hivemind-terminal-tab') as TabId) || 'terminal'
}

function TabbedTerminalComponent({ 
  selectedAgent, 
  agents, 
  TerminalPanel, 
  Commentator 
}: TabbedTerminalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(getPersistedTab)
  
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    localStorage.setItem('hivemind-terminal-tab', tab)
  }, [])
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab buttons */}
      <div className="flex border-b border-gray-700/50 bg-gray-800/30">
        <button
          onClick={() => handleTabChange('terminal')}
          className={`
            px-4 py-1.5 text-xs font-mono uppercase tracking-wider
            transition-colors border-b-2 -mb-px
            ${activeTab === 'terminal' 
              ? 'text-cyan-400 border-cyan-400 bg-gray-800/50' 
              : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-gray-800/30'}
          `}
        >
          💻 Terminal
        </button>
        <button
          onClick={() => handleTabChange('activity')}
          className={`
            px-4 py-1.5 text-xs font-mono uppercase tracking-wider
            transition-colors border-b-2 -mb-px
            ${activeTab === 'activity' 
              ? 'text-cyan-400 border-cyan-400 bg-gray-800/50' 
              : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-gray-800/30'}
          `}
        >
          🤖 Activity
        </button>
      </div>
      
      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'terminal' ? (
          <TerminalPanel selectedAgent={selectedAgent} agents={agents} />
        ) : (
          <Commentator embedded />
        )}
      </div>
    </div>
  )
}

export const TabbedTerminal = memo(TabbedTerminalComponent)

