// Chat attachment store
// Manages files attached to conductor chat

import { create } from 'zustand'

export interface AttachedFile {
  name: string
  path: string
  content: string
  summary?: string
}

export interface ChatState {
  attachedFiles: AttachedFile[]
  addFile: (file: AttachedFile) => void
  removeFile: (path: string) => void
  clearFiles: () => void
  updateFileSummary: (path: string, summary: string) => void
  getFileContext: () => string
}

export const useChatStore = create<ChatState>((set, get) => ({
  attachedFiles: [],
  
  addFile: (file) => {
    const { attachedFiles } = get()
    // Don't add duplicates
    if (attachedFiles.some(f => f.path === file.path)) return
    set({ attachedFiles: [...attachedFiles, file] })
  },
  
  removeFile: (path) => {
    const { attachedFiles } = get()
    set({ attachedFiles: attachedFiles.filter(f => f.path !== path) })
  },
  
  clearFiles: () => set({ attachedFiles: [] }),
  
  updateFileSummary: (path, summary) => {
    const { attachedFiles } = get()
    set({
      attachedFiles: attachedFiles.map(f =>
        f.path === path ? { ...f, summary } : f
      )
    })
  },
  
  getFileContext: () => {
    const { attachedFiles } = get()
    if (attachedFiles.length === 0) return ''
    
    return attachedFiles.map(f =>
      `--- FILE: ${f.name} (${f.path}) ---\n${f.content}\n--- END FILE ---`
    ).join('\n\n')
  }
}))

