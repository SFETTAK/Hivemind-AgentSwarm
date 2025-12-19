import { useState, useRef, useEffect } from 'react'

export default function ConductorChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState({ cost: 0, tokens: 0 })
  const messagesEndRef = useRef(null)
  
  // Draggable position - load from localStorage
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('conductor-chat-position')
    return saved ? JSON.parse(saved) : { x: null, y: null }
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  
  // Resizable size - load from localStorage
  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem('conductor-chat-size')
    return saved ? JSON.parse(saved) : { width: 384, height: 500 }
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 })
  
  const apiUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:3001`
    : 'http://localhost:3001'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load history on open
  useEffect(() => {
    if (isOpen) {
      fetch(`${apiUrl}/api/conductor/history`)
        .then(r => r.json())
        .then(data => {
          if (data.history && data.history.length > 0) {
            setMessages(data.history.map((m, i) => ({
              id: i,
              role: m.role,
              content: m.content
            })))
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    
    const userMessage = { id: Date.now(), role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    
    try {
      const res = await fetch(`${apiUrl}/api/conductor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      
      const data = await res.json()
      
      if (data.error) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: `❌ Error: ${data.error}`
        }])
      } else {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: data.message
        }])
        setStats(prev => ({
          cost: prev.cost + parseFloat(data.cost || 0),
          tokens: prev.tokens + (data.usage?.total_tokens || 0)
        }))
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `❌ Connection error: ${e.message}`
      }])
    }
    
    setLoading(false)
  }

  const clearHistory = async () => {
    await fetch(`${apiUrl}/api/conductor/clear`, { method: 'POST' })
    setMessages([])
    setStats({ cost: 0, tokens: 0 })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Drag handlers
  const handleDragStart = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return
    setIsDragging(true)
    const rect = e.currentTarget.parentElement.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top
    }
  }

  const handleDrag = (e) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY
    const newX = dragRef.current.startPosX + deltaX
    const newY = dragRef.current.startPosY + deltaY
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 384 // width of chat
    const maxY = window.innerHeight - 500 // height of chat
    
    setPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    })
  }

  const handleDragEnd = () => {
    if (isDragging) {
      setIsDragging(false)
      localStorage.setItem('conductor-chat-position', JSON.stringify(position))
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, position])

  // Resize handlers
  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height
    }
  }

  const handleResize = (e) => {
    if (!isResizing) return
    const deltaX = e.clientX - resizeRef.current.startX
    const deltaY = e.clientY - resizeRef.current.startY
    
    // Resize from bottom-right corner (or top-left if position is set)
    const newWidth = Math.max(300, Math.min(800, resizeRef.current.startW + deltaX))
    const newHeight = Math.max(300, Math.min(800, resizeRef.current.startH + deltaY))
    
    setSize({ width: newWidth, height: newHeight })
  }

  const handleResizeEnd = () => {
    if (isResizing) {
      setIsResizing(false)
      localStorage.setItem('conductor-chat-size', JSON.stringify(size))
    }
  }

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, size])

  // Calculate style based on position
  const getPositionStyle = () => {
    if (position.x !== null && position.y !== null) {
      return { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    }
    return { right: 24, bottom: 24 } // Default position
  }

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-50"
        style={{
          ...getPositionStyle(),
          background: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
          boxShadow: '0 4px 20px rgba(0, 212, 255, 0.4)'
        }}
        title="Chat with Conductor"
      >
        <span className="text-2xl">🎯</span>
      </button>
    )
  }

  // Chat panel when open
  return (
    <div
      className="fixed rounded-xl overflow-hidden flex flex-col z-50"
      style={{
        ...getPositionStyle(),
        width: size.width,
        height: size.height,
        backgroundColor: '#131920',
        border: '1px solid #2d3748',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Header - Draggable */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-move select-none"
        style={{
          background: 'linear-gradient(135deg, #1a2332 0%, #0d1117 100%)',
          borderBottom: '1px solid #2d3748'
        }}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <div className="font-semibold text-white text-sm">CONDUCTOR</div>
            <div className="text-xs" style={{ color: '#00d4ff' }}>
              {loading ? 'Thinking...' : 'Online'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#ffcc00' }}>
            ${stats.cost.toFixed(3)}
          </span>
          <button
            onClick={clearHistory}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: '#8892a0' }}
            title="Clear history"
          >
            🗑️
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: '#8892a0' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        style={{ background: '#0d1117' }}
      >
        {messages.length === 0 && (
          <div className="text-center py-8" style={{ color: '#6b7280' }}>
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-sm">Chat with CONDUCTOR</div>
            <div className="text-xs mt-1">Your AI orchestrator</div>
          </div>
        )}
        
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: msg.role === 'user' ? '#00d4ff22' : '#1a2332',
                border: `1px solid ${msg.role === 'user' ? '#00d4ff44' : '#2d3748'}`,
                color: '#e0e0e0'
              }}
            >
              {msg.role === 'assistant' && (
                <div className="text-xs mb-1" style={{ color: '#a855f7' }}>
                  CONDUCTOR
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2"
              style={{ backgroundColor: '#1a2332', border: '1px solid #2d3748' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-3"
        style={{
          borderTop: '1px solid #2d3748',
          background: '#131920'
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Conductor anything..."
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: '#0d1117',
              border: '1px solid #2d3748',
              color: '#e0e0e0'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: loading || !input.trim() ? '#2d3748' : 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
              color: loading || !input.trim() ? '#6b7280' : '#fff'
            }}
          >
            Send
          </button>
        </div>
        <div className="text-xs mt-2 text-center" style={{ color: '#6b7280' }}>
          Press Enter to send • Shift+Enter for newline
        </div>
      </div>
      
      {/* Resize handle - bottom right corner */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #00d4ff 50%)',
          borderBottomRightRadius: '0.75rem'
        }}
        title="Drag to resize"
      />
    </div>
  )
}

