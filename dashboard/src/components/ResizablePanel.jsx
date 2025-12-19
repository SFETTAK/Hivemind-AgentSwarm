import { useState, useRef, useCallback } from 'react'

export default function ResizablePanel({ 
  children, 
  direction = 'vertical', // 'vertical' or 'horizontal'
  initialSize = 50, // percentage
  minSize = 10,
  maxSize = 90,
  storageKey = null, // localStorage key for persistence
  className = ''
}) {
  // Load from localStorage if key provided
  const getInitialSize = () => {
    if (storageKey) {
      const saved = localStorage.getItem(`panel-size-${storageKey}`)
      if (saved) return parseFloat(saved)
    }
    return initialSize
  }
  
  const [size, setSize] = useState(getInitialSize)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    let newSize
    
    if (direction === 'vertical') {
      newSize = ((e.clientY - rect.top) / rect.height) * 100
    } else {
      newSize = ((e.clientX - rect.left) / rect.width) * 100
    }
    
    // Clamp to min/max
    newSize = Math.max(minSize, Math.min(maxSize, newSize))
    setSize(newSize)
    
    // Save to localStorage
    if (storageKey) {
      localStorage.setItem(`panel-size-${storageKey}`, newSize.toString())
    }
  }, [isDragging, direction, minSize, maxSize, storageKey])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // Add global listeners when dragging
  useState(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  const isVertical = direction === 'vertical'
  
  return (
    <div 
      ref={containerRef}
      className={`flex ${isVertical ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ height: '100%', width: '100%' }}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={isDragging ? handleMouseUp : undefined}
      onMouseLeave={isDragging ? handleMouseUp : undefined}
    >
      {/* First Panel */}
      <div style={{ 
        [isVertical ? 'height' : 'width']: `${size}%`,
        overflow: 'hidden',
        minHeight: isVertical ? 0 : undefined,
        minWidth: isVertical ? undefined : 0
      }}>
        {children[0]}
      </div>
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          ${isVertical ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'}
          bg-[#1e2a3a] hover:bg-[#00d4ff] transition-colors
          flex items-center justify-center
          ${isDragging ? 'bg-[#00d4ff]' : ''}
        `}
        style={{
          flexShrink: 0,
          [isVertical ? 'width' : 'height']: '100%'
        }}
      >
        {/* Grip dots */}
        <div className={`
          ${isVertical ? 'flex-row' : 'flex-col'} 
          flex gap-1 opacity-50
        `}>
          <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
          <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
          <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
        </div>
      </div>
      
      {/* Second Panel */}
      <div style={{ 
        [isVertical ? 'height' : 'width']: `${100 - size}%`,
        overflow: 'hidden',
        minHeight: isVertical ? 0 : undefined,
        minWidth: isVertical ? undefined : 0
      }}>
        {children[1]}
      </div>
    </div>
  )
}

