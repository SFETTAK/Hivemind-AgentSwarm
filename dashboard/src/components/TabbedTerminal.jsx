import { useState } from 'react'
import TerminalPanel from './TerminalPanel'
import Commentator from './Commentator'

export default function TabbedTerminal({ selectedAgent, agents }) {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hivemind-terminal-tab') || 'terminal'
  })
  
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('hivemind-terminal-tab', tab)
  }
  
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

