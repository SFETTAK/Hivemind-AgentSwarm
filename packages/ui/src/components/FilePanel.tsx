// FilePanel - File browser with project management
import { useState, useEffect, useCallback, memo } from 'react'
import { useChatStore } from '../stores/chatStore'

// ============================================================================
// Types
// ============================================================================

interface FileItem {
  name: string
  path?: string
  type: 'file' | 'folder'
  special?: boolean
  expanded?: boolean
  children?: FileItem[]
}

interface ContextMenuState {
  x: number
  y: number
  item: FileItem
  path: string
}

export interface FilePanelProps {
  apiBase: string
}

// ============================================================================
// Helper Functions
// ============================================================================

const TEXT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.md', '.json', '.txt', '.css', '.html', '.yml', '.yaml', '.sh', '.env', '.gitignore']

async function fetchFolderFiles(
  apiBase: string,
  folderPath: string, 
  maxFiles = 20
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = []
  
  async function crawl(currentPath: string) {
    if (files.length >= maxFiles) return
    
    try {
      const res = await fetch(`${apiBase}/api/files?path=${encodeURIComponent(currentPath)}&depth=1`)
      const data = await res.json()
      if (!data.tree?.children) return
      
      for (const item of data.tree.children) {
        if (files.length >= maxFiles) break
        
        const itemPath = item.path
        if (item.type === 'folder') {
          if (['node_modules', '.git', '__pycache__', 'dist', 'build', '.next'].includes(item.name)) continue
          await crawl(itemPath)
        } else {
          const ext = item.name.includes('.') ? '.' + item.name.split('.').pop() : ''
          if (TEXT_EXTENSIONS.includes(ext) || item.name.startsWith('.')) {
            try {
              const readRes = await fetch(`${apiBase}/api/files/read?path=${encodeURIComponent(itemPath)}`)
              const fileData = await readRes.json()
              if (!fileData.error && fileData.content) {
                files.push({ path: itemPath, content: fileData.content })
              }
            } catch (e) { /* skip */ }
          }
        }
      }
    } catch (e) { /* skip */ }
  }
  
  await crawl(folderPath)
  return files
}

function getIcon(item: FileItem & { expanded?: boolean }): string {
  if (item.type === 'folder') return item.expanded ? '📂' : '📁'
  if (item.special) return '🐝'
  if (item.name.endsWith('.py')) return '🐍'
  if (item.name.endsWith('.js') || item.name.endsWith('.jsx')) return '⚡'
  if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) return '💙'
  if (item.name.endsWith('.md')) return '📝'
  if (item.name.endsWith('.json')) return '📋'
  if (item.name.endsWith('.txt')) return '📄'
  if (item.name.startsWith('.')) return '⚙️'
  return '📄'
}

// ============================================================================
// Tab Definitions
// ============================================================================

const TABS = [
  { id: 'files', icon: '📁', label: 'Files' },
  { id: 'project', icon: '⚙️', label: 'Project' },
] as const

type TabId = typeof TABS[number]['id']

// ============================================================================
// TreeNode Component
// ============================================================================

interface TreeNodeProps {
  item: FileItem
  depth?: number
  onSelect: (path: string, item: FileItem) => void
  selectedPath: string | null
  onContextMenu: (e: React.MouseEvent, item: FileItem, path: string) => void
}

function TreeNode({ item, depth = 0, onSelect, selectedPath, onContextMenu }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(item.expanded || false)
  const path = item.path || item.name
  const isSelected = selectedPath === path
  
  const handleClick = () => {
    if (item.type === 'folder') {
      setExpanded(!expanded)
    }
    onSelect(path, item)
  }
  
  const handleContextMenu = (e: React.MouseEvent) => {
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

// ============================================================================
// ContextMenu Component
// ============================================================================

interface ContextMenuProps {
  x: number
  y: number
  item: FileItem
  onClose: () => void
  onAction: (actionId: string, item: FileItem) => void
}

function ContextMenu({ x, y, item, onClose, onAction }: ContextMenuProps) {
  const actions: { id: string; label?: string; danger?: boolean }[] = [
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

// ============================================================================
// FilesTab Component
// ============================================================================

interface FilesTabProps {
  projectDir: string
  apiBase: string
}

function FilesTab({ projectDir, apiBase }: FilesTabProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [fileTree, setFileTree] = useState<FileItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = projectDir 
        ? `${apiBase}/api/files?path=${encodeURIComponent(projectDir)}&depth=3`
        : `${apiBase}/api/files?depth=3`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFileTree(data.tree)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectDir, apiBase])
  
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])
  
  const handleSelect = (path: string, _item: FileItem) => {
    setSelectedPath(path)
  }
  
  const handleContextMenu = (e: React.MouseEvent, item: FileItem, path: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, item, path })
  }
  
  const handleAction = async (actionId: string, item: FileItem) => {
    const itemPath = item.path || item.name
    
    try {
      switch (actionId) {
        case 'delete':
          if (confirm(`Delete "${item.name}"?`)) {
            await fetch(`${apiBase}/api/files`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: itemPath })
            })
            fetchFiles()
          }
          break
          
        case 'new-file': {
          const fileName = prompt('New file name:')
          if (fileName) {
            const newPath = `${itemPath}/${fileName}`
            await fetch(`${apiBase}/api/files/new`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: newPath, content: '' })
            })
            fetchFiles()
          }
          break
        }
          
        case 'new-folder': {
          const folderName = prompt('New folder name:')
          if (folderName) {
            const newPath = `${itemPath}/${folderName}`
            await fetch(`${apiBase}/api/files/mkdir`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderPath: newPath })
            })
            fetchFiles()
          }
          break
        }
          
        case 'rename': {
          const newName = prompt('New name:', item.name)
          if (newName && newName !== item.name) {
            const parentPath = itemPath.substring(0, itemPath.lastIndexOf('/'))
            const newPath = `${parentPath}/${newName}`
            await fetch(`${apiBase}/api/files/rename`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldPath: itemPath, newPath })
            })
            fetchFiles()
          }
          break
        }
          
        case 'open':
          console.log('Open file:', itemPath)
          break
          
        case 'add-to-chat':
          try {
            if (item.type === 'folder') {
              const files = await fetchFolderFiles(apiBase, itemPath)
              if (files.length === 0) {
                alert('Folder is empty or contains no readable files.')
                break
              }
              const folderContent = files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')
              useChatStore.getState().addFile({
                name: `📁 ${item.name}/`,
                path: itemPath,
                content: folderContent,
              })
            } else {
              const readRes = await fetch(`${apiBase}/api/files/read?path=${encodeURIComponent(itemPath)}`)
              const fileData = await readRes.json()
              if (fileData.error) throw new Error(fileData.error)
              
              useChatStore.getState().addFile({
                name: item.name,
                path: itemPath,
                content: fileData.content,
              })
            }
          } catch (e: any) {
            alert(`Error reading: ${e.message}`)
          }
          break
      }
    } catch (e: any) {
      console.error('File action error:', e)
      alert(`Error: ${e.message}`)
    }
  }
  
  const handleNewFile = async () => {
    const basePath = fileTree?.path || projectDir
    const fileName = prompt('New file name:')
    if (fileName) {
      try {
        await fetch(`${apiBase}/api/files/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: `${basePath}/${fileName}`, content: '' })
        })
        fetchFiles()
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
    }
  }
  
  const handleNewFolder = async () => {
    const basePath = fileTree?.path || projectDir
    const folderName = prompt('New folder name:')
    if (folderName) {
      try {
        await fetch(`${apiBase}/api/files/mkdir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: `${basePath}/${folderName}` })
        })
        fetchFiles()
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
    }
  }
  
  return (
    <div className="h-full flex flex-col">
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

// ============================================================================
// ProjectTab Component
// ============================================================================

interface ProjectTabProps {
  projectDir: string
  onChangeDir?: (dir: string) => void
}

function ProjectTab({ projectDir, onChangeDir }: ProjectTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(projectDir)
  
  const handleSave = () => {
    onChangeDir?.(editValue)
    setIsEditing(false)
  }
  
  return (
    <div className="h-full flex flex-col">
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

// ============================================================================
// Main FilePanel Component
// ============================================================================

function FilePanelComponent({ apiBase }: FilePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'files'
    return (localStorage.getItem('hivemind-filepanel-tab') as TabId) || 'files'
  })
  // Default to user's home directory + Hivemind-AgentSwarm (the install location)
  const defaultDir = typeof window !== 'undefined' 
    ? (localStorage.getItem('hivemind-project-dir') || '')
    : ''
  const [projectDir, setProjectDir] = useState(defaultDir)
  
  // Fetch project directory from settings on mount, fallback to home directory
  useEffect(() => {
    if (!projectDir) {
      // First try to get projectDir from settings
      fetch(`${apiBase}/api/settings`)
        .then(res => res.json())
        .then(data => {
          if (data.projectDir && data.projectDir !== '.') {
            setProjectDir(data.projectDir)
            localStorage.setItem('hivemind-project-dir', data.projectDir)
          } else {
            // Fallback to user's home directory
            fetch(`${apiBase}/api/system/home`)
              .then(res => res.json())
              .then(homeData => {
                if (homeData.home) {
                  setProjectDir(homeData.home)
                  localStorage.setItem('hivemind-project-dir', homeData.home)
                }
              })
              .catch(() => {})
          }
        })
        .catch(() => {
          // If settings fails, try home directory directly
          fetch(`${apiBase}/api/system/home`)
            .then(res => res.json())
            .then(homeData => {
              if (homeData.home) {
                setProjectDir(homeData.home)
                localStorage.setItem('hivemind-project-dir', homeData.home)
              }
            })
            .catch(() => {})
        })
    }
  }, [apiBase, projectDir])
  
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    localStorage.setItem('hivemind-filepanel-tab', tab)
  }
  
  const handleDirChange = (dir: string) => {
    setProjectDir(dir)
    localStorage.setItem('hivemind-project-dir', dir)
  }
  
  return (
    <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg overflow-hidden flex flex-col h-full">
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
      
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && <FilesTab projectDir={projectDir} apiBase={apiBase} />}
        {activeTab === 'project' && <ProjectTab projectDir={projectDir} onChangeDir={handleDirChange} />}
      </div>
    </div>
  )
}

export const FilePanel = memo(FilePanelComponent)

