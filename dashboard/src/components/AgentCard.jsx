const statusColors = {
  active: 'bg-[#00ff88]',
  idle: 'bg-[#ffcc00]',
  stuck: 'bg-[#ff4757]',
}

const statusLabels = {
  active: 'ACTIVE',
  idle: 'IDLE',
  stuck: 'STUCK',
}

export default function AgentCard({ agent, selected, onClick, onDoubleClick }) {
  return (
    <div 
      className={`
        bg-[#131920] border rounded-lg p-2.5 cursor-pointer transition-all duration-200
        ${selected ? 'border-[#00d4ff] shadow-lg shadow-[#00d4ff]/20' : 'border-[#27272a] hover:border-zinc-600'}
      `}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: agent.color + '20' }}
        >
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs truncate">{agent.name}</div>
          <div className="text-[10px] text-zinc-500">{agent.model || 'aider'}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className={`w-2 h-2 rounded-full ${statusColors[agent.status] || 'bg-gray-500'}`} />
          <span className="text-[9px] text-zinc-500">{statusLabels[agent.status] || '?'}</span>
        </div>
      </div>
      
      <div className="text-[10px] text-zinc-400 truncate mb-1">
        {agent.task || agent.path || 'No task'}
      </div>
      
      <div className="flex justify-between text-[9px] text-zinc-500">
        <span>⏱ {agent.runtime || '0s'}</span>
      </div>
    </div>
  )
}
