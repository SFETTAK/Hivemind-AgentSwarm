import { useSwarmStore } from '../stores/swarmStore'

const typeStyles = {
  info: 'border-l-[#00d4ff]',
  task: 'border-l-[#00ff88]',
  alert: 'border-l-[#ff4757]',
}

export default function MessageStream() {
  const messages = useSwarmStore(state => state.messages)
  
  return (
    <div className="bg-[#131920] border border-[#27272a] rounded-xl p-4 h-full flex flex-col">
      <div className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
        💬 Message Stream ({messages.length})
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="text-zinc-600 text-xs p-2 text-center">
            <div className="mb-2">📭</div>
            <div>No messages yet</div>
            <div className="text-[10px] mt-1">Use Broadcast to send messages</div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div 
              key={i}
              className={`border-l-2 pl-3 py-1.5 ${typeStyles[msg.type] || 'border-l-zinc-600'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-0.5">
                <span>{msg.time}</span>
                <span className="text-[#00d4ff] font-medium">{msg.sender}</span>
                <span>→</span>
                <span className="text-[#00ff88]">{msg.recipient}</span>
              </div>
              <div className="text-xs text-zinc-300 leading-relaxed">{msg.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
