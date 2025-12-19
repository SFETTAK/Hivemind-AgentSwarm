import { useState, useEffect } from 'react'

// Standalone preview component for the new tabbed file browser
// Run on separate port to test before integrating

const LEFT_TABS = [
  { id: 'files', icon: '📁', label: 'Files' },
  { id: 'project', icon: '⚙️', label: 'Project' },
]

const RIGHT_TABS = [
  { id: 'commentator', icon: '🎙️', label: 'Commentator' },
  { id: 'tasks', icon: '📋', label: 'Tasks' },
]

// Mock file tree for preview
const MOCK_FILES = {
  name: 'my-project',
  type: 'folder',
  expanded: true,
  children: [
    {
      name: 'src',
      type: 'folder',
      expanded: true,
      children: [
        { name: 'main.py', type: 'file' },
        { name: 'utils.py', type: 'file' },
        { name: 'api.py', type: 'file' },
      ]
    },
    {
      name: 'docs',
      type: 'folder',
      expanded: false,
      children: [
        { name: 'README.md', type: 'file' },
        { name: 'API.md', type: 'file' },
      ]
    },
    {
      name: 'tests',
      type: 'folder',
      expanded: false,
      children: [
        { name: 'test_main.py', type: 'file' },
      ]
    },
    { name: 'project.conductor', type: 'file', special: true },
    { name: '.gitignore', type: 'file' },
    { name: 'requirements.txt', type: 'file' },
  ]
}

// File/Folder icons
const getIcon = (item) => {
  if (item.type === 'folder') {
    return item.expanded ? '📂' : '📁'
  }
  if (item.special) return '🐝'
  if (item.name.endsWith('.py')) return '🐍'
  if (item.name.endsWith('.md')) return '📝'
  if (item.name.endsWith('.json')) return '📋'
  if (item.name.endsWith('.txt')) return '📄'
  if (item.name.startsWith('.')) return '⚙️'
  return '📄'
}

// Tree Node Component
function TreeNode({ item, depth = 0, onSelect, selectedPath, onContextMenu }) {
  const [expanded, setExpanded] = useState(item.expanded || false)
  const path = item.path || item.name
  const isSelected = selectedPath === path
  
  const handleClick = () => {
    if (item.type === 'folder') {
      setExpanded(!expanded)
    }
    onSelect(path, item)
  }
  
  const handleContextMenu = (e) => {
    e.preventDefault()
    onContextMenu(e, item, path)
  }
  
  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm
          hover:bg-[#1e2a3a] rounded transition-colors
          ${isSelected ? 'bg-[#1e2a3a] text-[#00d4ff]' : 'text-zinc-300'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-xs">{getIcon(item)}</span>
        <span className={item.special ? 'text-[#00d4ff] font-medium' : ''}>
          {item.name}
        </span>
      </div>
      
      {item.type === 'folder' && expanded && item.children && (
        <div>
          {item.children.map((child, i) => (
            <TreeNode
              key={child.name + i}
              item={{ ...child, path: `${path}/${child.name}` }}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Context Menu Component
function ContextMenu({ x, y, item, onClose, onAction }) {
  const actions = [
    { id: 'add-to-chat', label: '💬 Add to Chat', desc: 'Reference in conversation' },
    { id: 'open', label: '📖 Open', desc: 'View contents' },
    { id: 'divider' },
    { id: 'rename', label: '✏️ Rename' },
    { id: 'delete', label: '🗑️ Delete', danger: true },
  ]
  
  if (item?.type === 'folder') {
    actions.splice(2, 0, { id: 'new-file', label: '📄 New File' })
    actions.splice(3, 0, { id: 'new-folder', label: '📁 New Folder' })
  }
  
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-[#0d1117] border border-[#1e2a3a] rounded-lg shadow-xl py-1 min-w-[180px]"
        style={{ left: x, top: y }}
      >
        {actions.map((action, i) => 
          action.id === 'divider' ? (
            <div key={i} className="border-t border-[#1e2a3a] my-1" />
          ) : (
            <button
              key={action.id}
              onClick={() => { onAction(action.id, item); onClose() }}
              className={`
                w-full text-left px-3 py-1.5 text-sm flex items-center gap-2
                hover:bg-[#1e2a3a] transition-colors
                ${action.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300'}
              `}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </>
  )
}

// Files Tab Content
function FilesTab({ projectDir, onAddToChat }) {
  const [selectedPath, setSelectedPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  
  const handleSelect = (path, item) => {
    setSelectedPath(path)
  }
  
  const handleContextMenu = (e, item, path) => {
    setContextMenu({ x: e.clientX, y: e.clientY, item, path })
  }
  
  const handleAction = (actionId, item) => {
    console.log('Action:', actionId, 'on', item.name)
    if (actionId === 'add-to-chat') {
      onAddToChat?.(item)
    }
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Project Root Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a] bg-[#0d1117]">
        <span className="text-xs text-zinc-500">📍</span>
        <span className="text-xs text-zinc-400 truncate flex-1">
          {projectDir || '~/my-project'}
        </span>
        <button 
          className="text-xs text-zinc-500 hover:text-[#00d4ff] transition-colors"
          title="Change project directory"
        >
          ⚙️
        </button>
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        <TreeNode
          item={MOCK_FILES}
          onSelect={handleSelect}
          selectedPath={selectedPath}
          onContextMenu={handleContextMenu}
        />
      </div>
      
      {/* Actions Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#1e2a3a] bg-[#0d1117]">
        <button className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors">
          📄 New
        </button>
        <button className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors">
          📁 Folder
        </button>
        <button className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors">
          ⬆️ Upload
        </button>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}


// Project Tab Content - Directory/Folder management only
function ProjectTab() {
  const [projectDir, setProjectDir] = useState('~/projects/my-project')
  const [isEditing, setIsEditing] = useState(false)
  
  return (
    <div className="h-full flex flex-col">
      {/* Header - matches Files tab style */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a] bg-[#0d1117]">
        <span className="text-xs text-zinc-500">📍</span>
        {isEditing ? (
          <input
            type="text"
            value={projectDir}
            onChange={(e) => setProjectDir(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            autoFocus
            className="flex-1 text-xs bg-transparent border-b border-[#00d4ff] text-white outline-none"
          />
        ) : (
          <span 
            className="text-xs text-zinc-400 truncate flex-1 cursor-pointer hover:text-zinc-300"
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {projectDir}
          </span>
        )}
        <button 
          onClick={() => setIsEditing(true)}
          className="text-xs text-zinc-500 hover:text-[#00d4ff] transition-colors"
          title="Change directory"
        >
          ✏️
        </button>
      </div>
      
      {/* Actions List - scrollable like file tree */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        <div className="space-y-1">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#1e2a3a] rounded transition-colors">
            <span>📂</span> Open in File Manager
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#1e2a3a] rounded transition-colors">
            <span>🔄</span> Refresh File Tree
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#1e2a3a] rounded transition-colors">
            <span>📋</span> Copy Path
          </button>
          <div className="border-t border-[#1e2a3a] my-2" />
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#1e2a3a] rounded transition-colors">
            <span>📦</span> Export Project
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-[#1e2a3a] rounded transition-colors">
            <span>📥</span> Import Project
          </button>
        </div>
      </div>
      
      {/* Bottom Actions Bar - matches Files tab style */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#1e2a3a] bg-[#0d1117]">
        <button className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors">
          📂 Open
        </button>
        <button className="text-xs px-2 py-1 text-[#00d4ff] hover:text-white hover:bg-[#1e2a3a] rounded transition-colors font-medium">
          ✨ New
        </button>
      </div>
    </div>
  )
}

// Tasks Tab Content (placeholder for future)
function TasksTab() {
  const tasks = [
    { id: 1, agent: 'FORGE', task: 'Implement API endpoints', status: 'in_progress' },
    { id: 2, agent: 'SENTINEL', task: 'Write unit tests', status: 'pending' },
    { id: 3, agent: 'SCRIBE', task: 'Update documentation', status: 'completed' },
  ]
  
  const statusColors = {
    pending: 'text-zinc-400',
    in_progress: 'text-yellow-400',
    completed: 'text-green-400',
  }
  
  const statusIcons = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
  }
  
  return (
    <div className="h-full flex flex-col p-2">
      <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2 px-1">
        Task Queue
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1">
        {tasks.map(task => (
          <div
            key={task.id}
            className="bg-[#0d1117] border border-[#1e2a3a] rounded p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className={statusColors[task.status]}>
                {statusIcons[task.status]}
              </span>
              <span className="text-[#00d4ff] text-xs font-medium">
                {task.agent}
              </span>
            </div>
            <div className="text-zinc-300 text-xs mt-1 pl-5">
              {task.task}
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-2 border-t border-[#1e2a3a]">
        <button className="w-full px-3 py-1.5 bg-[#1e2a3a] text-zinc-300 rounded text-sm hover:bg-[#2a3a4a] transition-colors">
          + Add Task
        </button>
      </div>
    </div>
  )
}

// Mock Commentator Tab
function CommentatorTab() {
  const comments = [
    { time: '2s ago', text: 'FORGE just created a new API endpoint' },
    { time: '15s ago', text: 'SENTINEL is reviewing the changes' },
    { time: '1m ago', text: 'Project initialized successfully' },
  ]
  
  return (
    <div className="h-full flex flex-col p-2">
      <div className="flex-1 overflow-y-auto space-y-2">
        {comments.map((c, i) => (
          <div key={i} className="text-xs">
            <span className="text-zinc-500">{c.time}</span>
            <p className="text-zinc-300 mt-0.5">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main Tabbed Panel Component
export default function FileBrowserPreview() {
  const [leftTab, setLeftTab] = useState('files')
  const [rightTab, setRightTab] = useState('commentator')
  const [addedFiles, setAddedFiles] = useState([])
  
  const handleAddToChat = (item) => {
    setAddedFiles(prev => [...prev, item.name])
    console.log('Added to chat:', item.name)
  }
  
  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-8">
      {/* Preview Container - Simulates full layout */}
      <div className="flex gap-4 w-full max-w-6xl">
        
        {/* LEFT SIDEBAR - Agents + Files/Project */}
        <div className="w-64 flex flex-col gap-3 flex-shrink-0">
          <div className="text-xs text-zinc-500 uppercase tracking-widest px-2">
            🐝 Agents (3)
          </div>
          
          {/* Mock Agent Cards */}
          {['FORGE', 'SENTINEL', 'ORACLE'].map(name => (
            <div
              key={name}
              className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[#00d4ff] font-medium text-sm">{name}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Working on task...</div>
            </div>
          ))}
          
          {/* Divider */}
          <div className="border-t border-[#1e2a3a] my-1" />
          
          {/* Files/Project Tabs */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg overflow-hidden flex-1 min-h-[300px] flex flex-col">
            {/* Tab Bar */}
            <div className="flex border-b border-[#1e2a3a] bg-[#080b10]">
              {LEFT_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLeftTab(tab.id)}
                  className={`
                    flex-1 px-2 py-2 text-xs flex items-center justify-center gap-1
                    transition-colors border-b-2
                    ${leftTab === tab.id 
                      ? 'text-[#00d4ff] border-[#00d4ff] bg-[#0d1117]' 
                      : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-[#0d1117]'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {leftTab === 'files' && <FilesTab onAddToChat={handleAddToChat} />}
              {leftTab === 'project' && <ProjectTab />}
            </div>
          </div>
        </div>
        
        {/* CENTER - Network Graph + Terminal (mock) */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Mock Network Graph */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg flex-1 min-h-[200px] flex items-center justify-center">
            <div className="text-zinc-600 text-sm">🕸️ Network Graph</div>
          </div>
          
          {/* Mock Terminal */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg h-48 p-3">
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
              💻 Terminal Output
            </div>
            <div className="font-mono text-xs text-green-400">
              $ FORGE: Creating api.py...<br/>
              $ FORGE: Added 3 endpoints<br/>
              $ SENTINEL: Running tests...
            </div>
          </div>
        </div>
        
        {/* RIGHT SIDEBAR - Controls + Commentator/Tasks */}
        <div className="w-72 flex flex-col gap-3 flex-shrink-0">
          {/* Mock Controls */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-3">
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
              🎮 Controls
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-1.5 bg-[#00d4ff] text-black rounded text-xs font-medium">
                Deploy
              </button>
              <button className="flex-1 px-3 py-1.5 bg-[#1e2a3a] text-zinc-300 rounded text-xs">
                Kill All
              </button>
            </div>
          </div>
          
          {/* Commentator/Tasks Tabs */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg overflow-hidden flex-1 min-h-[250px] flex flex-col">
            {/* Tab Bar */}
            <div className="flex border-b border-[#1e2a3a] bg-[#080b10]">
              {RIGHT_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`
                    flex-1 px-2 py-2 text-xs flex items-center justify-center gap-1
                    transition-colors border-b-2
                    ${rightTab === tab.id 
                      ? 'text-[#00d4ff] border-[#00d4ff] bg-[#0d1117]' 
                      : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-[#0d1117]'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {rightTab === 'commentator' && <CommentatorTab />}
              {rightTab === 'tasks' && <TasksTab />}
            </div>
          </div>
          
          {/* Chat Context - Shows "Add to Chat" results */}
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-3">
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
              📎 Chat Context
            </div>
            
            {addedFiles.length === 0 ? (
              <div className="text-zinc-600 text-xs">
                Right-click file → "Add to Chat"
              </div>
            ) : (
              <div className="space-y-1">
                {addedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-[#1e2a3a] rounded px-2 py-1 text-xs"
                  >
                    <span className="text-[#00d4ff]">📎</span>
                    <span className="text-zinc-300 truncate flex-1">{file}</span>
                    <button 
                      onClick={() => setAddedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

