import { useState, useEffect, useCallback, memo } from 'react'
import { getApiUrl } from '../config'
import { useChatStore } from '../stores/chatStore'

// Helper to recursively fetch all files in a folder
async function fetchFolderFiles(folderPath, folderName, maxFiles = 20) {
  const files = []
  const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.md', '.json', '.txt', '.css', '.html', '.yml', '.yaml', '.sh', '.env', '.gitignore']
  
  async function crawl(currentPath) {
    if (files.length >= maxFiles) return
    
    try {
      const res = await fetch(`${getApiUrl()}/files?path=${encodeURIComponent(currentPath)}&depth=1`)
      const data = await res.json()
      if (!data.tree?.children) return
      
      for (const item of data.tree.children) {
        if (files.length >= maxFiles) break
        
        const itemPath = item.path
        if (item.type === 'folder') {
          // Skip common large/irrelevant folders
          if (['node_modules', '.git', '__pycache__', 'dist', 'build', '.next'].includes(item.name)) continue
          await crawl(itemPath)
        } else {
          // Only include text files
          const ext = item.name.includes('.') ? '.' + item.name.split('.').pop() : ''
          if (textExtensions.includes(ext) || item.name.startsWith('.')) {
            try {
              const readRes = await fetch(`${getApiUrl()}/files/read?path=${encodeURIComponent(itemPath)}`)
              const fileData = await readRes.json()
              if (!fileData.error && fileData.content) {
                files.push({ path: itemPath, content: fileData.content })
              }
            } catch (e) { /* skip unreadable files */ }
          }
        }
      }
    } catch (e) { /* skip on error */ }
  }
  
  await crawl(folderPath)
  return files
}

// Tab definitions
const TABS = [
  { id: 'files', icon: '📁', label: 'Files' },
  { id: 'project', icon: '⚙️', label: 'Project' },
]

// File/Folder icons by type
const getIcon = (item) => {
  if (item.type === 'folder') return item.expanded ? '📂' : '📁'
  if (item.special) return '🐝'
  if (item.name.endsWith('.py')) return '🐍'
  if (item.name.endsWith('.js') || item.name.endsWith('.jsx')) return '⚡'
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
        <span className="text-xs">{getIcon({ ...item, expanded })}</span>
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
    { id: 'add-to-chat', label: '💬 Add to Chat' },
    { id: 'open', label: '📖 Open' },
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
        className="fixed z-50 bg-[#0d1117] border border-[#1e2a3a] rounded-lg shadow-xl py-1 min-w-[160px]"
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
                w-full text-left px-3 py-1.5 text-sm
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
function FilesTab({ projectDir, onRefresh }) {
  const [selectedPath, setSelectedPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [fileTree, setFileTree] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Fetch file tree from API
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = projectDir 
        ? `${getApiUrl()}/files?path=${encodeURIComponent(projectDir)}&depth=3`
        : `${getApiUrl()}/files?depth=3`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFileTree(data.tree)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectDir])
  
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])
  
  const handleSelect = (path, item) => {
    setSelectedPath(path)
  }
  
  const handleContextMenu = (e, item, path) => {
    setContextMenu({ x: e.clientX, y: e.clientY, item, path })
  }
  
  const handleAction = async (actionId, item) => {
    const itemPath = item.path || item.name
    
    try {
      switch (actionId) {
        case 'delete':
          if (confirm(`Delete "${item.name}"?`)) {
            await fetch(`${getApiUrl()}/files`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: itemPath })
            })
            fetchFiles() // Refresh
          }
          break
          
        case 'new-file':
          const fileName = prompt('New file name:')
          if (fileName) {
            const newPath = `${itemPath}/${fileName}`
            await fetch(`${getApiUrl()}/files/new`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: newPath, content: '' })
            })
            fetchFiles()
          }
          break
          
        case 'new-folder':
          const folderName = prompt('New folder name:')
          if (folderName) {
            const newPath = `${itemPath}/${folderName}`
            await fetch(`${getApiUrl()}/files/mkdir`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderPath: newPath })
            })
            fetchFiles()
          }
          break
          
        case 'rename':
          const newName = prompt('New name:', item.name)
          if (newName && newName !== item.name) {
            const parentPath = itemPath.substring(0, itemPath.lastIndexOf('/'))
            const newPath = `${parentPath}/${newName}`
            await fetch(`${getApiUrl()}/files/rename`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldPath: itemPath, newPath })
            })
            fetchFiles()
          }
          break
          
        case 'open':
          console.log('Open file:', itemPath)
          // TODO: Open in editor or preview
          break
          
        case 'add-to-chat':
          // Fetch file/folder content and add to chat context
          try {
            if (item.type === 'folder') {
              // Recursively get all files in folder
              const files = await fetchFolderFiles(itemPath, item.name)
              if (files.length === 0) {
                alert('Folder is empty or contains no readable files.')
                break
              }
              // Add folder as a single context item with all file contents
              const folderContent = files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')
              useChatStore.getState().addFile({
                name: `📁 ${item.name}/`,
                path: itemPath,
                content: folderContent,
                size: folderContent.length,
                fileCount: files.length,
                summary: null
              })
            } else {
              const readRes = await fetch(`${getApiUrl()}/files/read?path=${encodeURIComponent(itemPath)}`)
              const fileData = await readRes.json()
              if (fileData.error) throw new Error(fileData.error)
              
              // Add to chat store (content hidden from UI, sent to LLM)
              useChatStore.getState().addFile({
                name: item.name,
                path: itemPath,
                content: fileData.content,
                size: fileData.size,
                summary: null // Will be filled by LLM on first message
              })
            }
          } catch (e) {
            alert(`Error reading: ${e.message}`)
          }
          break
          
        default:
          console.log('Action:', actionId, 'on', item.name)
      }
    } catch (e) {
      console.error('File action error:', e)
      alert(`Error: ${e.message}`)
    }
  }
  
  // Handle new file/folder from bottom bar
  const handleNewFile = async () => {
    const basePath = fileTree?.path || projectDir
    const fileName = prompt('New file name:')
    if (fileName) {
      try {
        await fetch(`${getApiUrl()}/files/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: `${basePath}/${fileName}`, content: '' })
        })
        fetchFiles()
      } catch (e) {
        alert(`Error: ${e.message}`)
      }
    }
  }
  
  const handleNewFolder = async () => {
    const basePath = fileTree?.path || projectDir
    const folderName = prompt('New folder name:')
    if (folderName) {
      try {
        await fetch(`${getApiUrl()}/files/mkdir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: `${basePath}/${folderName}` })
        })
        fetchFiles()
      } catch (e) {
        alert(`Error: ${e.message}`)
      }
    }
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a] bg-[#0d1117]">
        <span className="text-xs text-zinc-500">📍</span>
        <span className="text-xs text-zinc-400 truncate flex-1">
          {fileTree?.path || projectDir || '~/project'}
        </span>
        <button 
          onClick={fetchFiles}
          className="text-xs text-zinc-500 hover:text-[#00d4ff] transition-colors"
          title="Refresh"
        >
          🔄
        </button>
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="text-xs text-zinc-500 p-3">Loading...</div>
        ) : error ? (
          <div className="text-xs text-red-400 p-3">{error}</div>
        ) : fileTree ? (
          <TreeNode
            item={fileTree}
            onSelect={handleSelect}
            selectedPath={selectedPath}
            onContextMenu={handleContextMenu}
          />
        ) : (
          <div className="text-xs text-zinc-500 p-3">No files</div>
        )}
      </div>
      
      {/* Actions Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#1e2a3a] bg-[#0d1117]">
        <button 
          onClick={handleNewFile}
          className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors"
        >
          📄 New
        </button>
        <button 
          onClick={handleNewFolder}
          className="text-xs px-2 py-1 text-zinc-400 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors"
        >
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

// Project Tab Content
function ProjectTab({ projectDir, onChangeDir }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(projectDir)
  
  const handleSave = () => {
    onChangeDir?.(editValue)
    setIsEditing(false)
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a] bg-[#0d1117]">
        <span className="text-xs text-zinc-500">📍</span>
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="flex-1 text-xs bg-transparent border-b border-[#00d4ff] text-white outline-none"
          />
        ) : (
          <span 
            className="text-xs text-zinc-400 truncate flex-1 cursor-pointer hover:text-zinc-300"
            onClick={() => { setEditValue(projectDir); setIsEditing(true) }}
          >
            {projectDir || '~/project'}
          </span>
        )}
        <button 
          onClick={() => { setEditValue(projectDir); setIsEditing(true) }}
          className="text-xs text-zinc-500 hover:text-[#00d4ff] transition-colors"
        >
          ✏️
        </button>
      </div>
      
      {/* Actions List */}
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
      
      {/* Bottom Actions Bar */}
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

// Main FilePanel Component - memoized to prevent re-renders on parent state changes
const FilePanel = memo(function FilePanel() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hivemind-filepanel-tab') || 'files'
  })
  const [projectDir, setProjectDir] = useState(() => {
    return localStorage.getItem('hivemind-project-dir') || ''  // Empty = use server's PROJECT_DIR
  })
  
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    localStorage.setItem('hivemind-filepanel-tab', tab)
  }
  
  const handleDirChange = (dir) => {
    setProjectDir(dir)
    localStorage.setItem('hivemind-project-dir', dir)
  }
  
  return (
    <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg overflow-hidden flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b border-[#1e2a3a] bg-[#080b10]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              flex-1 px-2 py-2 text-xs flex items-center justify-center gap-1
              transition-colors border-b-2
              ${activeTab === tab.id 
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
        {activeTab === 'files' && <FilesTab projectDir={projectDir} />}
        {activeTab === 'project' && <ProjectTab projectDir={projectDir} onChangeDir={handleDirChange} />}
      </div>
    </div>
  )
})

export default FilePanel
