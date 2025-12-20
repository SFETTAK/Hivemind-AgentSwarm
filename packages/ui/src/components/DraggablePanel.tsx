// DraggablePanel - Panel with hold-to-drag swap functionality
import { useState, useRef, useEffect, memo, useCallback, type ReactNode } from 'react'

export interface DraggablePanelProps {
  id: string
  title: string
  icon: string
  children: ReactNode
  onDragStart?: (id: string) => void
  onDrop?: (id: string) => void
  isDragTarget?: boolean
  isBeingDragged?: boolean
  className?: string
  headerExtra?: ReactNode
  hideHeader?: boolean
}

const HOLD_DURATION = 300 // ms to hold before drag starts

function DraggablePanelComponent({ 
  id, 
  title, 
  icon,
  children, 
  onDragStart, 
  onDrop, 
  isDragTarget = false,
  isBeingDragged = false,
  className = '',
  headerExtra = null,
  hideHeader = false,
}: DraggablePanelProps) {
  const [isHolding, setIsHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
  }, [])

  const startHold = useCallback((e: React.MouseEvent) => {
    // Only trigger on left click
    if (e.button !== 0) return
    e.preventDefault()
    
    setIsHolding(true)
    setHoldProgress(0)
    
    // Progress animation
    const startTime = Date.now()
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setHoldProgress(Math.min(elapsed / HOLD_DURATION, 1))
    }, 16)
    
    // After hold duration, start drag
    holdTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      setHoldProgress(0)
      setIsHolding(false)
      onDragStart?.(id)
    }, HOLD_DURATION)
  }, [id, onDragStart])

  const handleDrop = useCallback(() => {
    onDrop?.(id)
  }, [id, onDrop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelHold()
    }
  }, [cancelHold])

  return (
    <div 
      className={`
        draggable-panel relative flex flex-col h-full
        ${isDragTarget ? 'ring-2 ring-cyan-400 ring-opacity-80' : ''}
        ${isBeingDragged ? 'opacity-50' : ''}
        ${className}
      `}
      onMouseUp={handleDrop}
    >
      {/* Title bar - drag handle (can be hidden if component has its own header) */}
      {!hideHeader && (
        <div 
          className={`
            panel-header flex items-center gap-2 px-3 py-1.5
            bg-gray-800/80 border-b border-gray-700/50
            cursor-grab select-none
            ${isHolding ? 'cursor-grabbing bg-gray-700/80' : 'hover:bg-gray-700/50'}
            transition-colors
          `}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
        >
          {/* Hold progress indicator */}
          {isHolding && (
            <div 
              className="absolute left-0 top-0 h-full bg-cyan-500/30 transition-all"
              style={{ width: `${holdProgress * 100}%` }}
            />
          )}
          
          <span className="text-sm relative z-10">{icon}</span>
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider relative z-10">
            {title}
          </span>
          
          {/* Extra header content (buttons, etc) */}
          {headerExtra && (
            <div className="ml-auto flex items-center gap-1 relative z-10">
              {headerExtra}
            </div>
          )}
        </div>
      )}
      
      {/* Drop target overlay */}
      {isDragTarget && (
        <div className="absolute inset-0 bg-cyan-500/20 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/90 px-4 py-2 rounded-lg border border-cyan-400">
            <span className="text-cyan-400 font-mono text-sm">Drop to swap</span>
          </div>
        </div>
      )}
      
      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export const DraggablePanel = memo(DraggablePanelComponent)

// ============================================================================
// Hook to manage panel layout state
// ============================================================================

export type PanelLayout = Record<string, string>

export interface UsePanelLayoutReturn {
  layout: PanelLayout
  draggingPanel: string | null
  startDrag: (panelId: string) => void
  dropOnPanel: (targetSlot: string) => void
  resetLayout: () => void
}

export function usePanelLayout(initialLayout: PanelLayout): UsePanelLayoutReturn {
  const [layout, setLayout] = useState<PanelLayout>(() => {
    if (typeof window === 'undefined') return initialLayout
    
    const saved = localStorage.getItem('hivemind-panel-layout')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved layout:', e)
      }
    }
    return initialLayout
  })
  
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null)

  // Save layout changes
  useEffect(() => {
    localStorage.setItem('hivemind-panel-layout', JSON.stringify(layout))
  }, [layout])

  const startDrag = useCallback((panelId: string) => {
    setDraggingPanel(panelId)
    
    // Add global mouse up listener to cancel drag
    const handleMouseUp = () => {
      setDraggingPanel(null)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const dropOnPanel = useCallback((targetSlot: string) => {
    setDraggingPanel(currentDragging => {
      if (!currentDragging) return null
      
      setLayout(prevLayout => {
        if (currentDragging === prevLayout[targetSlot]) return prevLayout
        
        // Find which slot the dragging panel is in
        const sourceSlot = Object.keys(prevLayout).find(slot => prevLayout[slot] === currentDragging)
        if (!sourceSlot) return prevLayout
        
        // Swap the panels
        return {
          ...prevLayout,
          [sourceSlot]: prevLayout[targetSlot],
          [targetSlot]: prevLayout[sourceSlot],
        }
      })
      
      return null // Clear dragging state
    })
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(initialLayout)
    localStorage.removeItem('hivemind-panel-layout')
  }, [initialLayout])

  return {
    layout,
    draggingPanel,
    startDrag,
    dropOnPanel,
    resetLayout,
  }
}

