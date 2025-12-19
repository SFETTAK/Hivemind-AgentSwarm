import { create } from 'zustand'

// Store for managing chat attachments (files added to conductor chat)
export const useChatStore = create((set, get) => ({
  // Files attached to the current chat context
  attachedFiles: [],
  
  // Add a file to chat context
  addFile: (file) => {
    const { attachedFiles } = get()
    // Don't add duplicates
    if (attachedFiles.some(f => f.path === file.path)) return
    set({ attachedFiles: [...attachedFiles, file] })
  },
  
  // Remove a file from chat context
  removeFile: (path) => {
    const { attachedFiles } = get()
    set({ attachedFiles: attachedFiles.filter(f => f.path !== path) })
  },
  
  // Clear all attached files
  clearFiles: () => set({ attachedFiles: [] }),
  
  // Get formatted context for LLM (includes file contents)
  getFileContext: () => {
    const { attachedFiles } = get()
    if (attachedFiles.length === 0) return ''
    
    return attachedFiles.map(f => 
      `--- FILE: ${f.name} (${f.path}) ---\n${f.content}\n--- END FILE ---`
    ).join('\n\n')
  }
}))

